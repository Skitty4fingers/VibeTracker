const { createClient } = require('@libsql/client');

let db = null;
let initialized = false;

function getClient() {
  if (db) return db;

  // Turso (production) or local SQLite file
  if (process.env.TURSO_DATABASE_URL) {
    db = createClient({
      url: process.env.TURSO_DATABASE_URL,
      authToken: process.env.TURSO_AUTH_TOKEN,
    });
  } else {
    // Local dev: use a local SQLite file via libsql
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
    await initialize(client);
    initialized = true;
  }
  return client;
}

// save() is a no-op now — Turso persists automatically
function save() { }

async function initialize(db) {
  await db.execute(`
    CREATE TABLE IF NOT EXISTS EventSettings (
      id INTEGER PRIMARY KEY CHECK (id = 1),
      eventName TEXT NOT NULL DEFAULT 'Hackathon',
      eventIcon TEXT NOT NULL DEFAULT '',
      tagline TEXT NOT NULL DEFAULT '',
      countdownTarget TEXT,
      scoringLocked INTEGER NOT NULL DEFAULT 0,
      showPartial INTEGER NOT NULL DEFAULT 1,
      tvRefreshSeconds INTEGER NOT NULL DEFAULT 15,
      updatedAt TEXT NOT NULL DEFAULT (datetime('now'))
    )
  `);

  await db.execute(`
    CREATE TABLE IF NOT EXISTS Team (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      teamName TEXT NOT NULL UNIQUE,
      projectName TEXT NOT NULL,
      membersText TEXT NOT NULL,
      repoUrl TEXT DEFAULT '',
      demoUrl TEXT DEFAULT '',
      description TEXT DEFAULT '',
      createdAt TEXT NOT NULL DEFAULT (datetime('now')),
      updatedAt TEXT NOT NULL DEFAULT (datetime('now'))
    )
  `);

  await db.execute(`
    CREATE TABLE IF NOT EXISTS RubricCategory (
      id INTEGER PRIMARY KEY CHECK (id BETWEEN 1 AND 10),
      groupName TEXT NOT NULL,
      name TEXT NOT NULL,
      guidance TEXT NOT NULL DEFAULT ''
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
      title TEXT NOT NULL,
      body TEXT NOT NULL,
      published INTEGER NOT NULL DEFAULT 1,
      pinned INTEGER NOT NULL DEFAULT 0,
      createdAt TEXT NOT NULL DEFAULT (datetime('now')),
      updatedAt TEXT NOT NULL DEFAULT (datetime('now'))
    )
  `);

  await db.execute('PRAGMA foreign_keys = ON');

  // Seed EventSettings if empty
  const settingsCount = await db.execute('SELECT COUNT(*) as cnt FROM EventSettings');
  if (settingsCount.rows[0].cnt === 0) {
    await db.execute({
      sql: `INSERT INTO EventSettings (id, eventName, eventIcon, scoringLocked, showPartial, tvRefreshSeconds, updatedAt)
            VALUES (1, 'Hackathon', ?, 0, 1, 15, datetime('now'))`,
      args: ['\u26a1'],
    });
  }

  // Seed RubricCategory if empty
  const rubricCount = await db.execute('SELECT COUNT(*) as cnt FROM RubricCategory');
  if (rubricCount.rows[0].cnt === 0) {
    const defaultRubric = [
      [1, 'Business', 'Problem importance', '1: unclear / low relevance · 10: high-priority pain point with clear stakeholders'],
      [2, 'Business', 'Value & ROI', '1: no measurable benefit · 10: quantified benefit (cost, risk reduction, revenue, productivity) + credible assumptions'],
      [3, 'Business', 'Customer / user experience', '1: hard to use / unclear workflow · 10: intuitive experience with clear user journey and outcomes'],
      [4, 'Business', 'Strategic alignment', '1: off-strategy / isolated · 10: directly supports key business priorities and operating model'],
      [5, 'Business', 'Innovation & differentiation', '1: incremental / common pattern · 10: meaningfully new approach, defensible advantage, reusable pattern'],
      [6, 'Technical', 'Architecture & engineering quality', '1: brittle prototype · 10: sound design, clean interfaces, handles edge cases'],
      [7, 'Technical', 'AI implementation correctness', '1: prompt-only / unreliable behavior · 10: appropriate model choice, grounded outputs, evaluation approach defined'],
      [8, 'Technical', 'Security, privacy & compliance hygiene', '1: unclear data handling / secrets risk · 10: data classification noted, controls described, no secrets, least-privilege considered'],
      [9, 'Technical', 'Reliability & performance', '1: fails often / slow / not repeatable · 10: stable runs, basic tests or eval script, performance understood'],
      [10, 'Technical', 'Ship-ability (operational readiness)', '1: cannot be handed off · 10: runbook/README, deployment path, logging/monitoring notes, cost awareness'],
    ];
    for (const [id, groupName, name, guidance] of defaultRubric) {
      await db.execute({
        sql: 'INSERT INTO RubricCategory (id, groupName, name, guidance) VALUES (?, ?, ?, ?)',
        args: [id, groupName, name, guidance],
      });
    }
  }

  // Seed Sample Teams if empty
  const teamCount = await db.execute('SELECT COUNT(*) as cnt FROM Team');
  if (teamCount.rows[0].cnt === 0) {
    const sampleTeams = [
      {
        name: 'ChronoShift',
        project: 'AI Calendar Optimizer',
        desc: 'Automates meeting scheduling to maximize deep work time using predictive analytics.',
        members: 'Alice Chen\nBob Smith\nCharlie Davis',
        repo: 'https://github.com/example/chronoshift'
      },
      {
        name: 'EcoVibe',
        project: 'Carbon Footprint Tracker',
        desc: 'Real-time dashboard for tracking office energy consumption with IoT integration.',
        members: 'Diana Prince\nEvan Wright',
        repo: 'https://github.com/example/ecovibe'
      },
      {
        name: 'CodeFlow',
        project: 'Voice-First IDE',
        desc: 'Accessibility-focused IDE plugin allowing full coding control via voice commands.',
        members: 'Fiona Gallagher\nGeorge Hill\nHannah Lee',
        repo: 'https://github.com/example/codeflow'
      }
    ];

    for (const t of sampleTeams) {
      await db.execute({
        sql: `INSERT INTO Team (teamName, projectName, description, membersText, repoUrl, createdAt, updatedAt)
              VALUES (?, ?, ?, ?, ?, datetime('now'), datetime('now'))`,
        args: [t.name, t.project, t.desc, t.members, t.repo],
      });
    }
  }

  // Seed Sample Announcements if empty
  const annCount = await db.execute('SELECT COUNT(*) as cnt FROM Announcement');
  if (annCount.rows[0].cnt === 0) {
    await db.execute({
      sql: `INSERT INTO Announcement (title, body, published, pinned, createdAt, updatedAt)
            VALUES (?, ?, 1, 1, datetime('now'), datetime('now'))`,
      args: ['🚀 Kickoff!', 'Welcome to the Global Hackathon 2026! **Happy Hacking!**\n\n- Coding starts now\n- Mentors available in the lounge'],
    });

    await db.execute({
      sql: `INSERT INTO Announcement (title, body, published, pinned, createdAt, updatedAt)
            VALUES (?, ?, 1, 1, datetime('now'), datetime('now'))`,
      args: ['🍕 Lunch Arrived', 'Pizza and salads are now available in the **Main Hall**.\n\nPlease take a break and fuel up!'],
    });
  }

  // Seed sample scores
  const scoreCount = await db.execute('SELECT COUNT(*) as cnt FROM Score');
  if (scoreCount.rows[0].cnt === 0) {
    const teamsResult = await db.execute('SELECT id, teamName FROM Team');
    const teams = teamsResult.rows;
    const scores = [
      { name: 'ChronoShift', vals: [8, 9, 7, 8, 6, 7, 8, 9, 8, 7] },
      { name: 'EcoVibe', vals: [6, 7, 8, 6, 5, 9, 8, 7, 9, 8] },
      { name: 'CodeFlow', vals: [7, 8, 9, 7, 9, 6, 7, 6, 7, 6] },
    ];

    for (const s of scores) {
      const team = teams.find(t => t.teamName === s.name);
      if (team) {
        await db.execute({
          sql: `INSERT INTO Score (teamId, c1, c2, c3, c4, c5, c6, c7, c8, c9, c10, updatedAt)
                VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, datetime('now'))`,
          args: [team.id, ...s.vals],
        });
      }
    }
  }
}

/**
 * Execute a SELECT query and return rows as an array of plain objects.
 * Compatible with both @libsql/client result format.
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
 * Returns the result including lastInsertRowid.
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

module.exports = { getDb, save, allRows, getRow, execute, lastInsertId };
