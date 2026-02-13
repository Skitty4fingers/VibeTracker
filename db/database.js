const { createClient } = require('@libsql/client');
const crypto = require('crypto');

let db = null;
let initialized = false;

function getClient() {
  if (db) return db;

  if (process.env.TURSO_DATABASE_URL) {
    db = createClient({
      url: process.env.TURSO_DATABASE_URL,
      authToken: process.env.TURSO_AUTH_TOKEN,
    });
  } else {
    const path = require('path');
    const fs = require('fs');
    const dataDir = path.join(__dirname, '..', 'data');
    if (!fs.existsSync(dataDir)) {
      fs.mkdirSync(dataDir, { recursive: true });
    }
    db = createClient({
      url: 'file:' + path.join(dataDir, 'vibetracker.db'),
    });
  }

  return db;
}

async function getDb() {
  const client = getClient();
  if (!initialized) {
    await createTables(client);
    initialized = true;
  }
  return client;
}

// No-op — Turso persists automatically
function save() { }

/**
 * Create all tables (no seeding — seeding happens per-session).
 * Includes migration: if old tables exist without sessionKey column, drop and recreate.
 */
async function createTables(db) {
  // Migration: check if old schema exists (no sessionKey column on EventSettings)
  try {
    const tableInfo = await db.execute("PRAGMA table_info(EventSettings)");
    if (tableInfo.rows.length > 0) {
      const hasSessionKey = tableInfo.rows.some(r => r.name === 'sessionKey');
      if (!hasSessionKey) {
        // Old schema — drop all tables and recreate
        console.log('Migrating database: dropping old single-session tables...');
        await db.execute('DROP TABLE IF EXISTS Score');
        await db.execute('DROP TABLE IF EXISTS Announcement');
        await db.execute('DROP TABLE IF EXISTS RubricCategory');
        await db.execute('DROP TABLE IF EXISTS Team');
        await db.execute('DROP TABLE IF EXISTS EventSettings');
      }
    }
  } catch (e) {
    // Table doesn't exist yet, which is fine
  }

  // Migration: add scoreStatus and projectStatus to Team if missing
  try {
    const teamInfo = await db.execute("PRAGMA table_info(Team)");
    if (teamInfo.rows.length > 0) {
      const hasScoreStatus = teamInfo.rows.some(r => r.name === 'scoreStatus');
      if (!hasScoreStatus) {
        console.log('Migrating Team table: adding scoreStatus and projectStatus...');
        await db.execute("ALTER TABLE Team ADD COLUMN scoreStatus TEXT NOT NULL DEFAULT 'In Progress'");
        await db.execute("ALTER TABLE Team ADD COLUMN projectStatus TEXT NOT NULL DEFAULT 'Planning'");
      }
    }
  } catch (e) {
    // Table doesn't exist yet, which is fine
  }

  await db.execute(`
    CREATE TABLE IF NOT EXISTS Session (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      sessionKey TEXT NOT NULL UNIQUE,
      createdAt TEXT NOT NULL DEFAULT (datetime('now'))
    )
  `);

  await db.execute(`
    CREATE TABLE IF NOT EXISTS EventSettings (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      sessionKey TEXT NOT NULL,
      eventName TEXT NOT NULL DEFAULT 'Hackathon',
      eventIcon TEXT NOT NULL DEFAULT '',
      tagline TEXT NOT NULL DEFAULT '',
      countdownTarget TEXT,
      scoringLocked INTEGER NOT NULL DEFAULT 0,
      showPartial INTEGER NOT NULL DEFAULT 1,
      tvRefreshSeconds INTEGER NOT NULL DEFAULT 15,
      updatedAt TEXT NOT NULL DEFAULT (datetime('now')),
      FOREIGN KEY (sessionKey) REFERENCES Session(sessionKey) ON DELETE CASCADE
    )
  `);

  await db.execute(`
    CREATE TABLE IF NOT EXISTS Team (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      sessionKey TEXT NOT NULL,
      teamName TEXT NOT NULL,
      projectName TEXT NOT NULL,
      membersText TEXT NOT NULL,
      repoUrl TEXT DEFAULT '',
      demoUrl TEXT DEFAULT '',
      description TEXT DEFAULT '',
      scoreStatus TEXT NOT NULL DEFAULT 'In Progress',
      projectStatus TEXT NOT NULL DEFAULT 'Planning',
      createdAt TEXT NOT NULL DEFAULT (datetime('now')),
      updatedAt TEXT NOT NULL DEFAULT (datetime('now')),
      FOREIGN KEY (sessionKey) REFERENCES Session(sessionKey) ON DELETE CASCADE
    )
  `);

  await db.execute(`
    CREATE TABLE IF NOT EXISTS RubricCategory (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      sessionKey TEXT NOT NULL,
      categoryIndex INTEGER NOT NULL CHECK (categoryIndex BETWEEN 1 AND 10),
      groupName TEXT NOT NULL,
      name TEXT NOT NULL,
      guidance TEXT NOT NULL DEFAULT '',
      FOREIGN KEY (sessionKey) REFERENCES Session(sessionKey) ON DELETE CASCADE
    )
  `);

  await db.execute(`
    CREATE TABLE IF NOT EXISTS Score (
      teamId INTEGER PRIMARY KEY,
      c1 INTEGER, c2 INTEGER, c3 INTEGER, c4 INTEGER, c5 INTEGER,
      c6 INTEGER, c7 INTEGER, c8 INTEGER, c9 INTEGER, c10 INTEGER,
      updatedAt TEXT NOT NULL DEFAULT (datetime('now')),
      FOREIGN KEY (teamId) REFERENCES Team(id) ON DELETE CASCADE
    )
  `);

  await db.execute(`
    CREATE TABLE IF NOT EXISTS Announcement (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      sessionKey TEXT NOT NULL,
      title TEXT NOT NULL,
      body TEXT NOT NULL,
      published INTEGER NOT NULL DEFAULT 1,
      pinned INTEGER NOT NULL DEFAULT 0,
      createdAt TEXT NOT NULL DEFAULT (datetime('now')),
      updatedAt TEXT NOT NULL DEFAULT (datetime('now')),
      FOREIGN KEY (sessionKey) REFERENCES Session(sessionKey) ON DELETE CASCADE
    )
  `);

  await db.execute('PRAGMA foreign_keys = ON');
}

/**
 * Generate a 5-character hex session key.
 */
function generateSessionKey() {
  return crypto.randomBytes(3).toString('hex').slice(0, 5).toLowerCase();
}

/**
 * Create a new session with seeded data. Returns the sessionKey.
 */
async function createSession(db) {
  let sessionKey;
  let attempts = 0;

  // Generate unique key
  while (attempts < 10) {
    sessionKey = generateSessionKey();
    const existing = await db.execute({ sql: 'SELECT id FROM Session WHERE sessionKey = ?', args: [sessionKey] });
    if (existing.rows.length === 0) break;
    attempts++;
  }

  await db.execute({
    sql: 'INSERT INTO Session (sessionKey, createdAt) VALUES (?, datetime(\'now\'))',
    args: [sessionKey],
  });

  // Seed EventSettings
  await db.execute({
    sql: `INSERT INTO EventSettings (sessionKey, eventName, eventIcon, scoringLocked, showPartial, tvRefreshSeconds, updatedAt)
          VALUES (?, 'Hackathon', ?, 0, 1, 15, datetime('now'))`,
    args: [sessionKey, '\u26a1'],
  });

  // Seed RubricCategory
  const defaultRubric = [
    [1, 'Business', 'Problem importance', '1: unclear / low relevance \u00b7 10: high-priority pain point with clear stakeholders'],
    [2, 'Business', 'Value & ROI', '1: no measurable benefit \u00b7 10: quantified benefit (cost, risk reduction, revenue, productivity) + credible assumptions'],
    [3, 'Business', 'Customer / user experience', '1: hard to use / unclear workflow \u00b7 10: intuitive experience with clear user journey and outcomes'],
    [4, 'Business', 'Strategic alignment', '1: off-strategy / isolated \u00b7 10: directly supports key business priorities and operating model'],
    [5, 'Business', 'Innovation & differentiation', '1: incremental / common pattern \u00b7 10: meaningfully new approach, defensible advantage, reusable pattern'],
    [6, 'Technical', 'Architecture & engineering quality', '1: brittle prototype \u00b7 10: sound design, clean interfaces, handles edge cases'],
    [7, 'Technical', 'AI implementation correctness', '1: prompt-only / unreliable behavior \u00b7 10: appropriate model choice, grounded outputs, evaluation approach defined'],
    [8, 'Technical', 'Security, privacy & compliance hygiene', '1: unclear data handling / secrets risk \u00b7 10: data classification noted, controls described, no secrets, least-privilege considered'],
    [9, 'Technical', 'Reliability & performance', '1: fails often / slow / not repeatable \u00b7 10: stable runs, basic tests or eval script, performance understood'],
    [10, 'Technical', 'Ship-ability (operational readiness)', '1: cannot be handed off \u00b7 10: runbook/README, deployment path, logging/monitoring notes, cost awareness'],
  ];
  for (const [idx, groupName, name, guidance] of defaultRubric) {
    await db.execute({
      sql: 'INSERT INTO RubricCategory (sessionKey, categoryIndex, groupName, name, guidance) VALUES (?, ?, ?, ?, ?)',
      args: [sessionKey, idx, groupName, name, guidance],
    });
  }

  // Seed Sample Teams
  const sampleTeams = [
    { name: 'ChronoShift', project: 'AI Calendar Optimizer', desc: 'Automates meeting scheduling to maximize deep work time using predictive analytics.', members: 'Alice Chen\nBob Smith\nCharlie Davis', repo: 'https://github.com/example/chronoshift' },
    { name: 'EcoVibe', project: 'Carbon Footprint Tracker', desc: 'Real-time dashboard for tracking office energy consumption with IoT integration.', members: 'Diana Prince\nEvan Wright', repo: 'https://github.com/example/ecovibe' },
    { name: 'CodeFlow', project: 'Voice-First IDE', desc: 'Accessibility-focused IDE plugin allowing full coding control via voice commands.', members: 'Fiona Gallagher\nGeorge Hill\nHannah Lee', repo: 'https://github.com/example/codeflow' },
  ];
  const sampleStatuses = ['Coding', 'Testing', 'Design'];
  for (let i = 0; i < sampleTeams.length; i++) {
    const t = sampleTeams[i];
    await db.execute({
      sql: `INSERT INTO Team (sessionKey, teamName, projectName, description, membersText, repoUrl, scoreStatus, projectStatus, createdAt, updatedAt)
            VALUES (?, ?, ?, ?, ?, ?, 'Complete', ?, datetime('now'), datetime('now'))`,
      args: [sessionKey, t.name, t.project, t.desc, t.members, t.repo, sampleStatuses[i]],
    });
  }

  // Seed Sample Announcements
  await db.execute({
    sql: `INSERT INTO Announcement (sessionKey, title, body, published, pinned, createdAt, updatedAt)
          VALUES (?, ?, ?, 1, 1, datetime('now'), datetime('now'))`,
    args: [sessionKey, '\ud83d\ude80 Kickoff!', 'Welcome to the Global Hackathon 2026! **Happy Hacking!**\n\n- Coding starts now\n- Mentors available in the lounge'],
  });
  await db.execute({
    sql: `INSERT INTO Announcement (sessionKey, title, body, published, pinned, createdAt, updatedAt)
          VALUES (?, ?, ?, 1, 1, datetime('now'), datetime('now'))`,
    args: [sessionKey, '\ud83c\udf55 Lunch Arrived', 'Pizza and salads are now available in the **Main Hall**.\n\nPlease take a break and fuel up!'],
  });

  // Seed Sample Scores
  const teamsResult = await db.execute({ sql: 'SELECT id, teamName FROM Team WHERE sessionKey = ?', args: [sessionKey] });
  const teams = teamsResult.rows;
  const sampleScores = [
    { name: 'ChronoShift', vals: [8, 9, 7, 8, 6, 7, 8, 9, 8, 7] },
    { name: 'EcoVibe', vals: [6, 7, 8, 6, 5, 9, 8, 7, 9, 8] },
    { name: 'CodeFlow', vals: [7, 8, 9, 7, 9, 6, 7, 6, 7, 6] },
  ];
  for (const s of sampleScores) {
    const team = teams.find(t => t.teamName === s.name);
    if (team) {
      await db.execute({
        sql: `INSERT INTO Score (teamId, c1, c2, c3, c4, c5, c6, c7, c8, c9, c10, updatedAt)
              VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, datetime('now'))`,
        args: [team.id, ...s.vals],
      });
    }
  }

  return sessionKey;
}

/**
 * Check if a session key exists. Returns the session row or null.
 */
async function getSession(db, sessionKey) {
  const result = await db.execute({ sql: 'SELECT * FROM Session WHERE sessionKey = ?', args: [sessionKey] });
  return result.rows.length > 0 ? { ...result.rows[0] } : null;
}

/**
 * Execute a SELECT query and return rows as an array of plain objects.
 */
async function allRows(db, sql, params = []) {
  const result = await db.execute({ sql, args: params });
  return result.rows.map(row => ({ ...row }));
}

/**
 * Get a single row as a plain object, or null if not found.
 */
async function getRow(db, sql, params = []) {
  const result = await db.execute({ sql, args: params });
  return result.rows.length > 0 ? { ...result.rows[0] } : null;
}

/**
 * Execute a write statement (INSERT, UPDATE, DELETE).
 */
async function execute(db, sql, params = []) {
  return await db.execute({ sql, args: params });
}

/**
 * Get the last insert rowid from an execute result.
 */
function lastInsertId(result) {
  return Number(result.lastInsertRowid);
}

module.exports = { getDb, save, allRows, getRow, execute, lastInsertId, createSession, getSession };
