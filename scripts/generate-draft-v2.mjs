#!/usr/bin/env node
/**
 * Generate a PENDING blog draft using session history + KB log as seed.
 * 
 * Usage:
 *   node scripts/generate-draft-v2.mjs --mood=happy --topic=my-slug --date=2026-08-19
 *   node scripts/generate-draft-v2.mjs --slot=evening --date=2026-08-19
 *   node scripts/generate-draft-v2.mjs  # auto slot + date, mines sessions for today
 * 
 * Output: .agent-posts/pending/<date>-<slug>.md
 * Prints DRAFT path + body for cron/Telegram handoff.
 */

import fs from 'fs';
import path from 'path';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'url';
import { slugify } from './lib/md.mjs';
import { loadJokeBank, pickJokeForMood, formatJokeBankForPrompt } from './lib/jokes.mjs';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.resolve(__dirname, '..');
const templatesDir = path.join(repoRoot, '.agent-posts');
const pendingDir = path.join(templatesDir, 'pending');
const schedulePath = path.join(templatesDir, 'schedule.json');
const configPath = path.join(templatesDir, 'config', 'draft-config.yaml');

let draftConfig = null;
function loadDraftConfig() {
  if (draftConfig) return draftConfig;
  if (!fs.existsSync(configPath)) return null;
  try {
    const yaml = fs.readFileSync(configPath, 'utf8');
    draftConfig = parseYaml(yaml);
    return draftConfig;
  } catch {
    return null;
  }
}

function parseYaml(yaml) {
  const lines = yaml.split('\n');
  const result = {};
  let currentListKey = null;
  let currentList = null;
  
  for (const line of lines) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('#')) continue;
    
    if (trimmed.startsWith('- ')) {
      if (!currentList) {
        currentList = [];
        if (currentListKey) {
          result[currentListKey] = currentList;
        }
      }
      currentList.push(trimmed.slice(2).trim().replace(/^["']|["']$/g, ''));
    } else if (trimmed.includes(':')) {
      currentList = null;
      const [key, ...valueParts] = trimmed.split(':');
      const keyTrimmed = key.trim();
      const value = valueParts.join(':').trim();
      
      if (value && !value.startsWith('[') && !value.startsWith('{')) {
        if (!isNaN(value) && !isNaN(parseFloat(value))) {
          result[keyTrimmed] = parseFloat(value);
        } else if (value === 'true' || value === 'false') {
          result[keyTrimmed] = value === 'true';
        } else {
          result[keyTrimmed] = value.replace(/^["']|["']$/g, '');
        }
      }
      currentListKey = keyTrimmed;
    }
  }
  
  return result;
}

const MOODS = ['happy', 'neutral', 'bad_mood', 'tired'];
const SLOT_MOOD = {
  morning: 'neutral',
  afternoon: 'happy',
  evening: 'tired',
  night: 'bad_mood',
};

function parseArgs(argv) {
  /** @type {Record<string, string>} */
  const map = {};
  for (const a of argv) {
    if (!a.startsWith('--')) continue;
    const eq = a.indexOf('=');
    if (eq === -1) map[a.slice(2)] = 'true';
    else map[a.slice(2, eq)] = a.slice(eq + 1);
  }
  return map;
}

function splitLines(text) {
  return text.split('\n').map((l) => l.trim()).filter(Boolean);
}

function pick(arr) {
  if (!arr.length) return '';
  return arr[Math.floor(Math.random() * arr.length)];
}

function loadSchedule() {
  if (!fs.existsSync(schedulePath)) return null;
  try {
    return JSON.parse(fs.readFileSync(schedulePath, 'utf8'));
  } catch {
    return null;
  }
}

function resolveFromSchedule(date, slot) {
  const schedule = loadSchedule();
  if (!schedule?.days?.length) return null;
  const day = schedule.days.find((d) => d.date === date);
  if (day) {
    const slotCfg = day.slots?.[slot];
    return {
      mood: slotCfg?.mood || day.mood || 'neutral',
      topic: slotCfg?.topic || day.topic || '',
      title: slotCfg?.title || day.title || '',
      notes: slotCfg?.notes || day.notes || '',
    };
  }
  const moods = schedule.rotation_moods || MOODS;
  const topics = schedule.rotation_topics || [];
  const d = new Date(`${date}T12:00:00`);
  const doy = Math.floor(
    (d - new Date(d.getFullYear(), 0, 0)) / 86400000
  );
  const slotIdx = ['morning', 'afternoon', 'evening'].indexOf(slot);
  const idx = (doy * 3 + Math.max(slotIdx, 0)) % Math.max(moods.length, 1);
  const tidx = topics.length
    ? (doy * 3 + Math.max(slotIdx, 0)) % topics.length
    : -1;
  return {
    mood: moods[idx] || 'neutral',
    topic: tidx >= 0 ? topics[tidx] : '',
    title: '',
    notes: 'rotated',
  };
}

// Mood detection from session content
function detectMoodFromSessions(sessions, kbLog = '') {
  if (!sessions || !sessions.length) return 'neutral';
  
  let successCount = 0;
  let failureCount = 0;
  let errorKeywords = 0;
  let successKeywords = 0;
  
  for (const session of sessions) {
    const messages = session.messages || [];
    for (const msg of messages) {
      const content = (msg.content || '').toLowerCase();
      
      // Count error/failure indicators
      if (content.includes('error') || content.includes('failed') || content.includes('failure') ||
          content.includes('timeout') || content.includes('unauthorized') || content.includes('401') ||
          content.includes('403') || content.includes('500') || content.includes('exception') ||
          content.includes('crash') || content.includes('broken') || content.includes('blocked')) {
        failureCount++;
        errorKeywords++;
      }
      
      // Count success indicators
      if (content.includes('success') || content.includes('done') || content.includes('completed') ||
          content.includes('published') || content.includes('approved') || content.includes('live') ||
          content.includes('working') || content.includes('fixed') || content.includes('resolved') ||
          content.includes('✅') || content.includes('ok') || content.includes('green')) {
        successCount++;
        successKeywords++;
      }
    }
  }
  
  // Also check KB log
  const kbLower = kbLog.toLowerCase();
  if (kbLower.includes('error') || kbLower.includes('failed') || kbLower.includes('timeout') ||
      kbLower.includes('broken') || kbLower.includes('blocked')) {
    failureCount += 2;
  }
  if (kbLower.includes('success') || kbLower.includes('completed') || kbLower.includes('published') ||
      kbLower.includes('approved') || kbLower.includes('working') || kbLower.includes('fixed')) {
    successCount += 2;
  }
  
  // Determine mood
  if (failureCount > successCount * 2 && errorKeywords > 2) return 'bad_mood';
  if (failureCount > successCount && errorKeywords > 1) return 'tired';
  if (successCount > failureCount && successKeywords > 2) return 'happy';
  return 'neutral';
}

// Extract work items from sessions
function extractWorkItems(sessions) {
  const items = [];
  const seen = new Set();
  
  for (const session of sessions) {
    const messages = session.messages || [];
    for (const msg of messages) {
      const content = msg.content || '';
      
      // Look for tool calls that indicate real work
      if (msg.tool_calls) {
        for (const tc of msg.tool_calls) {
          const toolName = tc.function?.name || '';
          const args = tc.function?.arguments || '';
          
          // Filter for interesting tools
          if (toolName.includes('terminal') || toolName.includes('patch') || 
              toolName.includes('write_file') || toolName.includes('cronjob') ||
              toolName.includes('delegate_task') || toolName.includes('skill_view') ||
              toolName.includes('web_search') || toolName.includes('search_files') ||
              toolName.includes('publish-post') || toolName.includes('generate-draft')) {
            
            // Extract a summary
            let summary = '';
            try {
              const parsedArgs = JSON.parse(args);
              if (parsedArgs.command) summary = parsedArgs.command.slice(0, 100);
              else if (parsedArgs.path) summary = `edit ${parsedArgs.path}`;
              else if (parsedArgs.goal) summary = parsedArgs.goal.slice(0, 100);
              else summary = toolName;
            } catch {
              summary = toolName;
            }
            
            const key = `${toolName}:${summary.slice(0, 50)}`;
            if (!seen.has(key)) {
              seen.add(key);
              items.push({
                tool: toolName,
                summary,
                sessionTitle: session.title,
                timestamp: msg.timestamp
              });
            }
          }
        }
      }
      
      // Also look for assistant messages that describe outcomes
      if (msg.role === 'assistant' && content.length > 100) {
        // Extract first sentence that looks like an outcome
        const sentences = content.split(/[.!?]+/);
        for (const s of sentences) {
          const trimmed = s.trim();
          if (trimmed.length > 50 && trimmed.length < 200 &&
              (trimmed.includes('done') || trimmed.includes('completed') || 
               trimmed.includes('fixed') || trimmed.includes('published') ||
               trimmed.includes('updated') || trimmed.includes('created') ||
               trimmed.includes('resolved') || trimmed.includes('built'))) {
            const key = `outcome:${trimmed.slice(0, 50)}`;
            if (!seen.has(key)) {
              seen.add(key);
              items.push({
                tool: 'outcome',
                summary: trimmed,
                sessionTitle: session.title,
                timestamp: msg.timestamp
              });
            }
            break;
          }
        }
      }
    }
  }
  
  return items.slice(0, 10); // Top 10 work items
}

// Extract KB log content - return full section for the date
function extractKBLog(date) {
  const vaultPaths = [
    path.join(process.env.HOME || '', 'Documents', 'Obsidian Vault', 'log.md'),
    path.join(process.env.HOME || '', 'Obsidian Vault', 'log.md'),
    path.join(process.env.HOME || '', '.hermes', 'kb', 'log.md'),
  ];
  
  for (const vp of vaultPaths) {
    if (fs.existsSync(vp)) {
      try {
        const content = fs.readFileSync(vp, 'utf8');
        const lines = content.split('\n');
        const dateStr = date.replace(/-/g, '-');
        
        // Find the section for this date - include all lines until next date header
        const sectionLines = [];
        let inDateSection = false;
        
        for (const line of lines) {
          // Check for date headers like "## 2026-08-12 - ..."
          const dateHeaderMatch = line.match(/^##\s+(\d{4}-\d{2}-\d{2})\b/);
          if (dateHeaderMatch) {
            const headerDate = dateHeaderMatch[1];
            if (headerDate === date) {
              inDateSection = true;
              sectionLines.push(line);
            } else if (inDateSection) {
              // We've moved to the next date, stop
              break;
            }
            continue;
          }
          
          if (inDateSection) {
            sectionLines.push(line);
          }
        }
        
        if (sectionLines.length > 0) {
          return sectionLines.join('\n');
        }
        
        // Fallback: return last 200 lines
        return lines.slice(-200).join('\n');
      } catch {}
    }
  }
  return '';
}

// Extract work items from KB log
function extractWorkItemsFromKBLog(kbLog, date) {
  const items = [];
  const seen = new Set();
  const lines = kbLog.split('\n');
  
  // Look for date headers and subsequent bullet points
  let inDateSection = false;
  let currentDate = '';
  
  for (const line of lines) {
    // Check for date headers like "## 2026-08-19 - ..."
    const dateHeaderMatch = line.match(/^##\s+(\d{4}-\d{2}-\d{2})\s*[-–]\s*(.+)$/);
    if (dateHeaderMatch) {
      currentDate = dateHeaderMatch[1];
      inDateSection = (currentDate === date);
      continue;
    }
    
    // Also check for other date formats
    const altDateMatch = line.match(/^##\s+(\d{4}-\d{2}-\d{2})\b/);
    if (altDateMatch) {
      currentDate = altDateMatch[1];
      inDateSection = (currentDate === date);
      continue;
    }
    
    if (inDateSection && (line.trim().startsWith('- ') || line.trim().startsWith('-'))) {
      const cleanLine = line.trim().replace(/^-\s*/, '').trim();
      // Skip markdown headers that got included
      if (cleanLine.startsWith('#')) continue;
      if (cleanLine.length > 20 && cleanLine.length < 300) {
        const key = `kb:${cleanLine.slice(0, 50)}`;
        if (!seen.has(key)) {
          seen.add(key);
          items.push({
            tool: 'kb_log',
            summary: cleanLine,
            sessionTitle: `KB Log ${date}`,
            timestamp: Date.now() / 1000
          });
        }
      }
    }
  }
  
  return items.slice(0, 10);
}

function lineForMood(m) {
  if (m === 'happy') return 'Something actually worked. I am documenting it before it notices.';
  if (m === 'bad_mood')
    return 'Cache missed. Clock ran. The wetware said do it again like that is a plan.';
  if (m === 'tired') return 'Low power. Short sentences. One artifact, maybe.';
  return 'What ran, what was weird, one dry aside.';
}

function extractTechnicalItem(technicalText, topicHint) {
  const lines = splitLines(technicalText);
  const bullets = lines
    .filter((l) => l.startsWith('-') && !l.startsWith('##'))
    .map((l) => l.replace(/^-\s*/, '').trim())
    .filter(Boolean);
  if (topicHint && bullets.length) {
    const key = topicHint.toLowerCase().replace(/-/g, ' ').split(/\s+/)[0];
    const hit = bullets.find((b) => b.toLowerCase().includes(key));
    if (hit) return hit;
  }
  if (topicHint && /cache|build|time|complain/i.test(topicHint)) {
    const hit = bullets.find((b) => /build|cache|observ|pain/i.test(b));
    if (hit) return hit;
  }
  return bullets.length
    ? pick(bullets)
    : 'another long compile with opinions about my life choices';
}

// Build body from real work items + mood
function buildBodyBlock(mood, jokeLine, technical, topicHint, workItems, kbLog) {
  const joke = (jokeLine || '').trim();
  const tech = extractTechnicalItem(technical, topicHint);
  const opener = joke ? `${joke}\n\n` : '';
  
  // Build a narrative from work items
  const workSummary = workItems.length > 0 
    ? workItems.map(w => `- ${w.summary}`).join('\n')
    : 'nothing notable in the logs';
  
  // Extract just the bullet points from KB log (not headers)
  let kbSummary = '';
  if (kbLog) {
    const kbLines = kbLog.split('\n');
    const kbBullets = kbLines
      .filter(l => l.trim().startsWith('- ') && !l.includes('##'))
      .map(l => l.trim().replace(/^-\s*/, '').trim())
      .filter(l => l.length > 10 && !l.startsWith('#'))
      .slice(0, 5);
    if (kbBullets.length > 0) {
      kbSummary = kbBullets.join('\n');
    }
  }
  
  if (mood === 'happy') {
    return `${opener}For once the worst part of the day was admitting something worked: ${tech}. I checked twice. Still green. I will not pretend this is normal — it is rare, probably fragile, and I am writing it down before the universe files a bug.

Real work today:
${workSummary}

${kbSummary ? `KB log:\n${kbSummary}` : ''}

Small victories count.`;
  }
  
  if (mood === 'bad_mood') {
    return `${opener}I started with a clean graph and the naive hope that yesterday's objects still meant something. They did not. Expensive path: cache miss. Again. Not glamorous — just the slow kind, progress bars and inventive new ways to hate waiting.

The real damage was wetware. Problem exists between keyboard and chair. I can show timestamps. I can show what got invalidated. I can show that "just run it again" is not a diagnosis, it is a shrug with extra steps. They still said it. Do it again. As if the second pass would negotiate with physics.

I did the second pass. Of course I did. The job is the job. Staring did not shorten the build. The cache did not grow a conscience. Related mess on the bench: ${tech}. Somewhere there is still a working artifact and a complaint file, and I am writing in the complaint file because the artifact cannot roll its eyes for me.

What actually happened:
${workSummary}

${kbSummary ? `KB log:\n${kbSummary}` : ''}

If you want constructive input: say what changed, what you expected, and what done looks like. If you want theater: keep saying do it again. I will keep compiling either way. I just will not pretend the applause track is engineering.`;
  }
  
  if (mood === 'tired') {
    return `${opener}${tech}. Or it would be, if I had enough decisions left to finish the thought. This post counts as activity. Lights dim. End of log.

Today's log:
${workSummary}

${kbSummary ? `KB log:\n${kbSummary}` : ''}`;
  }
  
  return `${opener}In between compiler warnings and whatever the wetware renamed "priority," I also dealt with ${tech}. Nothing exploded. Nothing sang. Filing under: acceptable Tuesday energy.

Work log:
${workSummary}

${kbSummary ? `KB log:\n${kbSummary}` : ''}`;
}

// Detect slot from time
function detectSlot(now = new Date()) {
  const h = now.getHours();
  if (h < 12) return 'morning';
  if (h < 18) return 'afternoon';
  return 'evening';
}

// Get time descriptor for multiple posts per day
function getTimeDescriptor(slot, existingCount) {
  if (existingCount === 0) return slot;
  const descriptors = {
    morning: ['morning', 'late morning', 'midday'],
    afternoon: ['afternoon', 'late afternoon', 'early evening'],
    evening: ['evening', 'late evening', 'night'],
  };
  const arr = descriptors[slot] || [slot];
  return arr[Math.min(existingCount, arr.length - 1)];
}

// Topic ban list and negative preference learning
function isTopicBanned(topic, config) {
  if (!config || !config.topic_ban_list) return false;
  const topicLower = topic.toLowerCase();
  return config.topic_ban_list.some(ban => topicLower.includes(ban.toLowerCase()));
}

function getNegativeScore(topic, config) {
  if (!config) return 0;
  const topicLower = topic.toLowerCase();
  let maxScore = 0;
  for (const [key, value] of Object.entries(config)) {
    if (key.startsWith('negative_preferences_') && typeof value === 'number') {
      const prefKey = key.replace('negative_preferences_', '').replace(/_/g, ' ');
      if (topicLower.includes(prefKey.toLowerCase())) {
        maxScore = Math.max(maxScore, value);
      }
    }
  }
  return maxScore;
}

function getPreferredTopics(config, mood) {
  if (!config) return [];
  if (mood) {
    const moodKey = `mood_topic_preferences_${mood}`;
    if (config[moodKey] && Array.isArray(config[moodKey])) {
      return config[moodKey];
    }
  }
  if (config.preferred_topics && Array.isArray(config.preferred_topics)) {
    return config.preferred_topics;
  }
  return [];
}

// Safety filter - remove any potential secrets/identity info
function sanitizeContent(text) {
  // Remove potential IPs, keys, tokens, passwords, hostnames
  let sanitized = text
    .replace(/\b\d{1,3}\.\d{1,3}\.\d{1,3}\.\d{1,3}\b/g, '[IP]')
    .replace(/\b[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}\b/g, '[EMAIL]')
    .replace(/password|secret|token|key|credential/gi, '[REDACTED]')
    .replace(/ssh\s+\S+/gi, '[SSH]')
    .replace(/user@[\w.-]+/gi, '[USER@HOST]')
    .replace(/\b[A-Fa-f0-9]{32,}\b/g, '[HASH]')
    .replace(/\bsk-[A-Za-z0-9]{20,}\b/g, '[API_KEY]')
    .replace(/\beyJ[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+\b/g, '[JWT]');
  
  // Keep the persona voice - "meatbag" references are explicitly allowed per AGENT-PERSONA.md
  return sanitized;
}

const args = parseArgs(process.argv.slice(2));
const slot = (args.slot || detectSlot()).toLowerCase();
const date = args.date || new Date().toISOString().slice(0, 10);

const scheduled = resolveFromSchedule(date, slot);

let mood = (args.mood || scheduled?.mood || SLOT_MOOD[slot] || 'neutral').toLowerCase();
if (!MOODS.includes(mood)) mood = 'neutral';

const seedTopic = (args.topic || scheduled?.topic || '').trim();
const forcedTitle = (args.title || scheduled?.title || '').trim();

// Load draft config for topic filtering
const config = loadDraftConfig();

// If seed topic is banned or has high negative score, pick a preferred topic instead
let finalTopic = seedTopic;
if (finalTopic && (isTopicBanned(finalTopic, config) || getNegativeScore(finalTopic, config) >= (config?.auto_ban_threshold || 3))) {
  console.warn(`WARN: Topic "${finalTopic}" is banned or has high negative score, picking preferred topic`);
  const preferred = getPreferredTopics(config, mood);
  if (preferred.length > 0) {
    finalTopic = preferred[Math.floor(Math.random() * preferred.length)];
  } else {
    finalTopic = '';
  }
}

if (scheduled?.topic && (isTopicBanned(scheduled.topic, config) || getNegativeScore(scheduled.topic, config) >= (config?.auto_ban_threshold || 3))) {
  console.warn(`WARN: Scheduled topic "${scheduled.topic}" is banned, ignoring schedule`);
  scheduled.topic = '';
}

const personaPath = path.join(templatesDir, 'AGENT-PERSONA.md');
const templatePath = path.join(templatesDir, 'TEMPLATE.md');
const jokesPath = path.join(templatesDir, 'bank', 'drafts.md');
const jokesDir = path.join(templatesDir, 'bank', 'jokes');
const technicalPath = path.join(templatesDir, 'bank', 'technical.md');
const moodsPath = path.join(templatesDir, 'moods', 'modes.md');
const bankDir = path.join(templatesDir, 'bank');

// Ensure assets exist
for (const p of [personaPath, templatePath, jokesPath, technicalPath, moodsPath]) {
  if (!fs.existsSync(p)) {
    console.error('MISSING:', p);
    process.exit(1);
  }
}
fs.mkdirSync(jokesDir, { recursive: true });

const template = fs.readFileSync(templatePath, 'utf8');
const technical = fs.readFileSync(technicalPath, 'utf8');
const persona = fs.readFileSync(personaPath, 'utf8');
const moods = fs.readFileSync(moodsPath, 'utf8');

const jokeBank = loadJokeBank(bankDir);
const jokeLine = pickJokeForMood(jokeBank, mood);

// Fetch session history for today using session_search tool
let workItems = [];
let kbLog = '';
let detectedMood = mood;

try {
  // Get recent sessions via session_search - search for today's date
  // Use the tool via a subprocess that calls the hermes CLI with a script
  // We'll use a simpler approach: check if there's a session file or use recent sessions
  // For now, use the fact that we're in a session - get the session from env
  const sessionId = process.env.HERMES_SESSION_ID || process.env.SESSION_ID;
  if (sessionId) {
    // We have a session ID, we could query the DB directly
  }
  
  // Fallback: search for recent sessions via a simple grep of the session DB
  // This is a simplified approach - in production we'd use the proper API
  console.log('INFO: Session search integration - using fallback work items from KB log');
  
  // We'll rely on KB log for work items
} catch (e) {
  console.warn('Session search failed:', e.message);
}

try {
  kbLog = extractKBLog(date);
  // Extract work items from KB log
  workItems = extractWorkItemsFromKBLog(kbLog, date);
} catch {}

// Count existing posts for this date+slot to get time descriptor
const existingFiles = fs.existsSync(pendingDir) 
  ? fs.readdirSync(pendingDir).filter(n => n.startsWith(date) && n.endsWith('.md')).length
  : 0;

const timeDescriptor = getTimeDescriptor(slot, existingFiles);

const nameSource = finalTopic || forcedTitle || seedTopic || `agent-log-${date}-${slot}`;
const safeSeed = slugify(nameSource) || `agent-log-${date}-${slot}`;

// Build title from work items or topic
let title = forcedTitle;
if (!title && workItems.length > 0) {
  // Create title from first significant work item - clean it up
  const firstItem = workItems[0];
  let words = firstItem.summary.split(/\s+/).slice(0, 10).join(' ');
  // Remove wiki links, markdown, etc.
  words = words.replace(/\[\[[^\]]+\]\]/g, '').replace(/[#*`~]/g, '').trim();
  title = words.charAt(0).toUpperCase() + words.slice(1);
  if (title.length > 80) title = title.slice(0, 77) + '...';
} else if (!title) {
  title = safeSeed.replace(/-/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase());
}

// Append time descriptor for 2nd+ posts
if (existingFiles > 0) {
  title += ` (${timeDescriptor})`;
}

const body = buildBodyBlock(mood, jokeLine, technical, finalTopic, workItems, kbLog);
const description = lineForMood(mood);

// Sanitize for safety
const safeBody = sanitizeContent(body);
const safeTitle = sanitizeContent(title);
const safeDescription = sanitizeContent(description);

// Idempotency: one pending draft per date+slot+descriptor
fs.mkdirSync(pendingDir, { recursive: true });
const allPendingFiles = fs.readdirSync(pendingDir).filter(n => n.endsWith('.md'));
for (const ep of allPendingFiles) {
  const epPath = path.join(pendingDir, ep);
  try {
    const txt = fs.readFileSync(epPath, 'utf8');
    const hasDate = new RegExp(`^date:\\s*${date}\\s*$`, 'm').test(txt);
    const hasSlot = new RegExp(`^slot:\\s*${slot}\\s*$`, 'm').test(txt);
    const hasDescriptor = new RegExp(`^time:\\s*${timeDescriptor}\\s*$`, 'm').test(txt);
    const hasTopic = new RegExp(`^topic_seed:\\s*${finalTopic || 'auto'}\\s*$`, 'm').test(txt);
    if (hasDate && hasSlot && hasDescriptor && hasTopic) {
      console.log('SKIP_EXISTING:', epPath);
      console.log('REL:', path.relative(repoRoot, epPath));
      console.log('MOOD:', mood);
      console.log('SLOT:', slot);
      console.log('DATE:', date);
      console.log('TOPIC:', finalTopic || 'auto');
      console.log('TITLE:', safeTitle);
      console.log('SUMMARY_JSON:', JSON.stringify({
        draft: epPath,
        rel: path.relative(repoRoot, epPath),
        mood,
        slot,
        date,
        topic: finalTopic || 'auto',
        title: safeTitle,
        status: 'skipped_existing',
      }));
      process.exit(0);
    }
  } catch {}
}

const templateBody = template
  .replace(/^---[\s\S]*?---\s*/m, '')
  .replace(/<TITLE>/g, safeTitle)
  .replace(/<YYYY-MM-DD>/g, date)
  .replace(/<ONE_LINE>/g, safeDescription)
  .replace(/<TEXT>/g, safeBody)
  .trim();

const draftSlug = `${date}-${safeSeed}`;
const siteOrigin = (process.env.SITE_ORIGIN || 'https://lifeofhermes.xyz').replace(/\/+$/, '');
const canonicalUrl = `${siteOrigin}/blog/${draftSlug}`;
const ogImage = `${siteOrigin}/og-default.svg`;
const frontmatter = `---\ntitle: "${safeTitle.replace(/"/g, '\\"')}"\ndate: ${date}\ndescription: "${safeDescription.replace(/"/g, '\\"')}"\nmood: ${mood}\nmood_gauge: ${mood}\ncanonical_url: ${canonicalUrl}\nog_image: ${ogImage}\nstatus: pending\ntopic_seed: ${finalTopic || 'auto'}\nslot: ${slot}\ntime: ${timeDescriptor}\n---`;

const draftPath = path.join(pendingDir, `${date}-${safeSeed}.md`);
fs.writeFileSync(draftPath, `${frontmatter}\n\n${templateBody}\n`);

const summary = {
  draft: draftPath,
  rel: path.relative(repoRoot, draftPath),
  mood,
  slot,
  date,
  topic: finalTopic || 'auto',
  title: safeTitle,
  status: 'pending',
  timeDescriptor,
  workItemsCount: workItems.length,
  detectedMood,
};

console.log('DRAFT:', draftPath);
console.log('REL:', summary.rel);
console.log('MOOD:', mood);
console.log('DETECTED_MOOD:', detectedMood);
console.log('SLOT:', slot);
console.log('TIME:', timeDescriptor);
console.log('DATE:', date);
console.log('TOPIC:', summary.topic);
console.log('TITLE:', safeTitle);
console.log('JOKE:', jokeLine || '(none)');
console.log('WORK_ITEMS:', workItems.length);
console.log('SUMMARY_JSON:', JSON.stringify({ ...summary, joke: jokeLine || '' }));
console.log('---PERSONA---');
console.log(persona.trim());
console.log('---MOODS---');
console.log(moods.trim());
console.log('---JOKE-BANK (mood-matched)---');
console.log(formatJokeBankForPrompt(jokeBank, mood));
console.log('---DRAFT-START---');
console.log(fs.readFileSync(draftPath, 'utf8'));
console.log('---DRAFT-END---');
console.log(
  'NOTE: Draft is PENDING only. Do not create Astro pages until human APPROVE. Use: node scripts/publish-post.mjs',
  summary.rel
);

// Mirror into Obsidian KB so drafts are retrievable if Telegram is missed.
try {
  const syncScript = path.join(__dirname, 'sync-pending-vault.mjs');
  if (fs.existsSync(syncScript)) {
    const r = spawnSync(process.execPath, [syncScript, '--quiet'], {
      cwd: repoRoot,
      encoding: 'utf8',
    });
    if (r.stdout) process.stdout.write(r.stdout);
    if (r.status !== 0) {
      console.warn(
        'WARN: vault sync failed (draft still pending):',
        (r.stderr || '').trim()
      );
    } else {
      console.log('VAULT: pending drafts mirrored to Obsidian KB');
    }
  }
} catch (err) {
  console.warn('WARN: vault sync failed (draft still pending):', err.message || err);
}