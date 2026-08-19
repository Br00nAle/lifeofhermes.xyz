#!/usr/bin/env node
/**
 * Session search helper for generate-draft-v2.mjs
 * Searches Hermes session DB for sessions on a given date
 */

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.resolve(__dirname, '..');

const args = process.argv.slice(2);
const date = args[args.indexOf('--date') + 1] || new Date().toISOString().slice(0, 10);
const limit = parseInt(args[args.indexOf('--limit') + 1] || '5', 10);

// Get the session DB path
const profile = process.env.HERMES_PROFILE || 'orchestrator';
const dbPath = `/home/user/.hermes/profiles/${profile}/sessions.db`;

if (!fs.existsSync(dbPath)) {
  console.log(JSON.stringify({ sessions: [], error: 'Session DB not found' }));
  process.exit(0);
}

// Use sqlite3
const sqlite3 = require('sqlite3').verbose();
const db = new sqlite3.Database(dbPath, sqlite3.OPEN_READONLY);

const query = `
  SELECT id, title, source, started_at, last_active, message_count
  FROM sessions
  WHERE date(started_at, 'unixepoch') = date(?)
  ORDER BY started_at DESC
  LIMIT ?
`;

const sessions = [];

db.serialize(() => {
  db.each(query, [date, limit], (err, row) => {
    if (err) return;
    // Fetch messages for this session
    const msgQuery = `
      SELECT id, role, content, timestamp, tool_calls
      FROM messages
      WHERE session_id = ?
      ORDER BY id ASC
    `;
    const messages = [];
    db.each(msgQuery, [row.id], (err, msg) => {
      if (err) return;
      let toolCalls = null;
      try {
        if (msg.tool_calls) toolCalls = JSON.parse(msg.tool_calls);
      } catch {}
      messages.push({
        id: msg.id,
        role: msg.role,
        content: msg.content,
        timestamp: msg.timestamp,
        tool_calls: toolCalls
      });
    }, () => {
      sessions.push({
        id: row.id,
        title: row.title,
        source: row.source,
        started_at: row.started_at,
        last_active: row.last_active,
        message_count: row.message_count,
        messages
      });
    });
  }, () => {
    db.close();
    console.log(JSON.stringify({ sessions }));
  });
});