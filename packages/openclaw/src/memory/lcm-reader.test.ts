import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { DatabaseSync } from 'node:sqlite';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';

import {
  resolveLcmDbPath,
  searchLcmHistory,
  toFtsQuery,
} from './lcm-reader.js';

let dir: string;
let dbPath: string;

const DM_KEY = 'agent:main:tlon:direct:~nec';
const DM_THREAD_KEY = 'agent:main:tlon:direct:~nec:thread:170.141.184';
const OTHER_DM_KEY = 'agent:main:tlon:direct:~sampel';

function seedDb() {
  const db = new DatabaseSync(dbPath);
  db.exec(`
    CREATE TABLE conversations (
      conversation_id INTEGER PRIMARY KEY AUTOINCREMENT,
      session_id TEXT NOT NULL,
      session_key TEXT,
      active INTEGER NOT NULL DEFAULT 1,
      archived_at TEXT,
      created_at TEXT NOT NULL DEFAULT (datetime('now'))
    );
    CREATE TABLE messages (
      message_id INTEGER PRIMARY KEY AUTOINCREMENT,
      conversation_id INTEGER NOT NULL,
      seq INTEGER NOT NULL,
      role TEXT NOT NULL,
      content TEXT NOT NULL,
      token_count INTEGER NOT NULL DEFAULT 1,
      created_at TEXT NOT NULL DEFAULT (datetime('now'))
    );
    CREATE VIRTUAL TABLE messages_fts USING fts5(
      content,
      tokenize='porter unicode61'
    );
  `);
  const insertConversation = db.prepare(
    `INSERT INTO conversations (session_id, session_key, active) VALUES (?, ?, ?)`
  );
  const insertMessage = db.prepare(
    `INSERT INTO messages (conversation_id, seq, role, content, created_at)
     VALUES (?, ?, ?, ?, ?)`
  );
  const insertFts = db.prepare(
    `INSERT INTO messages_fts (rowid, content) VALUES (?, ?)`
  );
  const addMessage = (
    conversationId: number,
    seq: number,
    role: string,
    content: string,
    createdAt: string
  ) => {
    insertMessage.run(conversationId, seq, role, content, createdAt);
    const row = db.prepare('SELECT last_insert_rowid() AS id').get() as {
      id: number;
    };
    insertFts.run(row.id, content);
  };

  insertConversation.run('s1', DM_KEY, 0); // archived pre-reset segment
  insertConversation.run('s2', DM_KEY, 1); // active segment
  insertConversation.run('s3', DM_THREAD_KEY, 1); // thread child
  insertConversation.run('s4', OTHER_DM_KEY, 1); // different person

  addMessage(1, 1, 'user', 'I moved to Pacific time in June', '2026-06-02');
  addMessage(2, 1, 'user', 'standup reminder please', '2026-08-20');
  addMessage(
    3,
    1,
    'assistant',
    'the Pacific move noted in thread',
    '2026-08-21'
  );
  addMessage(
    4,
    1,
    'user',
    'secret: interviewing at Pacific Corp',
    '2026-08-01'
  );
  addMessage(
    2,
    2,
    'tool',
    'Pacific tool output should be excluded',
    '2026-08-22'
  );
  db.close();
}

beforeEach(async () => {
  dir = await fs.mkdtemp(path.join(os.tmpdir(), 'lcm-reader-'));
  dbPath = path.join(dir, 'lcm.db');
  seedDb();
});

afterEach(async () => {
  await fs.rm(dir, { recursive: true, force: true });
});

describe('toFtsQuery', () => {
  it('quotes terms and strips FTS operators', () => {
    expect(toFtsQuery('pacific time')).toBe('"pacific" "time"');
    expect(toFtsQuery('a OR b NOT "c"')).toBe('"a" "OR" "b" "NOT" "c"');
    expect(toFtsQuery('  ')).toBeNull();
  });
});

describe('searchLcmHistory', () => {
  it('finds hits across archived segments and thread children', () => {
    const hits = searchLcmHistory({
      baseSessionKeys: [DM_KEY],
      query: 'pacific',
      dbPath,
    });
    const contents = hits.map((hit) => hit.content);
    expect(contents).toContain('I moved to Pacific time in June');
    expect(contents).toContain('the Pacific move noted in thread');
  });

  it('never returns hits from other surfaces', () => {
    const hits = searchLcmHistory({
      baseSessionKeys: [DM_KEY],
      query: 'pacific',
      dbPath,
    });
    expect(hits.map((hit) => hit.content)).not.toContain(
      'secret: interviewing at Pacific Corp'
    );
    expect(hits.every((hit) => hit.sessionKey.startsWith(DM_KEY))).toBe(true);
  });

  it('excludes tool-role messages', () => {
    const hits = searchLcmHistory({
      baseSessionKeys: [DM_KEY],
      query: 'pacific',
      dbPath,
    });
    expect(hits.map((hit) => hit.content)).not.toContain(
      'Pacific tool output should be excluded'
    );
  });

  it('returns [] for a missing database or empty inputs', () => {
    expect(
      searchLcmHistory({
        baseSessionKeys: [DM_KEY],
        query: 'pacific',
        dbPath: path.join(dir, 'nope.db'),
      })
    ).toEqual([]);
    expect(
      searchLcmHistory({ baseSessionKeys: [], query: 'pacific', dbPath })
    ).toEqual([]);
    expect(
      searchLcmHistory({ baseSessionKeys: [DM_KEY], query: '!!!', dbPath })
    ).toEqual([]);
  });

  it('returns [] on schema mismatch instead of throwing', async () => {
    const brokenPath = path.join(dir, 'broken.db');
    const db = new DatabaseSync(brokenPath);
    db.exec('CREATE TABLE conversations (wrong TEXT)');
    db.close();
    expect(
      searchLcmHistory({
        baseSessionKeys: [DM_KEY],
        query: 'pacific',
        dbPath: brokenPath,
      })
    ).toEqual([]);
  });
});

describe('resolveLcmDbPath', () => {
  it('prefers LCM_DATABASE_PATH, then OPENCLAW_STATE_DIR', () => {
    expect(resolveLcmDbPath({ LCM_DATABASE_PATH: '/x/lcm.db' } as never)).toBe(
      '/x/lcm.db'
    );
    expect(resolveLcmDbPath({ OPENCLAW_STATE_DIR: '/state' } as never)).toBe(
      path.join('/state', 'lcm.db')
    );
  });
});
