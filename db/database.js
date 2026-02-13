const initSqlJs = require('sql.js');
const path = require('path');
const fs = require('fs');

const DB_PATH = path.join(__dirname, '..', 'data', 'vibetracker.db');
let db = null;
let initPromise = null;

async function getDb() {
  if (db) return db;
  if (initPromise) return initPromise;

  initPromise = (async () => {
    const SQL = await initSqlJs();
    const dataDir = path.dirname(DB_PATH);
    if (!fs.existsSync(dataDir)) {
      fs.mkdirSync(dataDir, { recursive: true });
    }

    if (fs.existsSync(DB_PATH)) {
      const buffer = fs.readFileSync(DB_PATH);
      db = new SQL.Database(buffer);
    } else {
      db = new SQL.Database();
    }

    initialize(db);
    save();
    return db;
  })();

  return initPromise;
}

function save() {
  if (!db) return;
  const data = db.export();
  const buffer = Buffer.from(data);
  fs.writeFileSync(DB_PATH, buffer);
}

function initialize(db) {
  db.run(`
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

  db.run(`
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

  db.run(`
    CREATE TABLE IF NOT EXISTS RubricCategory (
      id INTEGER PRIMARY KEY CHECK (id BETWEEN 1 AND 10),
      groupName TEXT NOT NULL,
      name TEXT NOT NULL,
      guidance TEXT NOT NULL DEFAULT ''
    )
  `);

  db.run(`
    CREATE TABLE IF NOT EXISTS Score (
      teamId INTEGER PRIMARY KEY,
      c1 INTEGER, c2 INTEGER, c3 INTEGER, c4 INTEGER, c5 INTEGER,
      c6 INTEGER, c7 INTEGER, c8 INTEGER, c9 INTEGER, c10 INTEGER,
      updatedAt TEXT NOT NULL DEFAULT (datetime('now')),
      FOREIGN KEY (teamId) REFERENCES Team(id) ON DELETE CASCADE
    )
  `);

  db.run(`
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

  db.run('PRAGMA foreign_keys = ON');

  // Seed EventSettings if empty
  const settingsCount = db.exec('SELECT COUNT(*) as cnt FROM EventSettings');
  if (settingsCount[0].values[0][0] === 0) {
    db.run(`INSERT INTO EventSettings (id, eventName, eventIcon, scoringLocked, showPartial, tvRefreshSeconds, updatedAt)
            VALUES (1, 'Hackathon', ?, 0, 1, 15, datetime('now'))`, ['\u26a1']);
  }

  // Seed RubricCategory if empty
  const rubricCount = db.exec('SELECT COUNT(*) as cnt FROM RubricCategory');
  if (rubricCount[0].values[0][0] === 0) {
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
      db.run('INSERT INTO RubricCategory (id, groupName, name, guidance) VALUES (?, ?, ?, ?)',
        [id, groupName, name, guidance]);
    }
  }

  // Seed Sample Teams if empty
  const teamCount = db.exec('SELECT COUNT(*) as cnt FROM Team');
  if (teamCount[0].values[0][0] === 0) {
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
      db.run(`INSERT INTO Team (teamName, projectName, description, membersText, repoUrl, createdAt, updatedAt)
              VALUES (?, ?, ?, ?, ?, datetime('now'), datetime('now'))`,
        [t.name, t.project, t.desc, t.members, t.repo]);
    }
  }

  // Seed Sample Announcements if empty
  const annCount = db.exec('SELECT COUNT(*) as cnt FROM Announcement');
  if (annCount[0].values[0][0] === 0) {
    db.run(`INSERT INTO Announcement (title, body, published, pinned, createdAt, updatedAt)
            VALUES (?, ?, 1, 1, datetime('now'), datetime('now'))`,
      ['🚀 Kickoff!', 'Welcome to the Global Hackathon 2026! **Happy Hacking!**\n\n- Coding starts now\n- Mentors available in the lounge']);

    db.run(`INSERT INTO Announcement (title, body, published, pinned, createdAt, updatedAt)
            VALUES (?, ?, 1, 1, datetime('now'), datetime('now'))`,
      ['🍕 Lunch Arrived', 'Pizza and salads are now available in the **Main Hall**.\n\nPlease take a break and fuel up!']);
  }

  // Seed sample scores
  const scoreCount = db.exec('SELECT COUNT(*) as cnt FROM Score');
  if (scoreCount[0].values[0][0] === 0) {
    const teams = allRows(db, 'SELECT id, teamName FROM Team');
    const scores = [
      { name: 'ChronoShift', vals: [8, 9, 7, 8, 6, 7, 8, 9, 8, 7] },
      { name: 'EcoVibe', vals: [6, 7, 8, 6, 5, 9, 8, 7, 9, 8] },
      { name: 'CodeFlow', vals: [7, 8, 9, 7, 9, 6, 7, 6, 7, 6] },
    ];

    for (const s of scores) {
      const team = teams.find(t => t.teamName === s.name);
      if (team) {
        db.run(`INSERT INTO Score (teamId, c1, c2, c3, c4, c5, c6, c7, c8, c9, c10, updatedAt)
                VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, datetime('now'))`,
          [team.id, ...s.vals]);
      }
    }
  }
}

/**
 * Execute a SELECT query and return rows as an array of plain objects.
 * Uses db.exec (which returns {columns, values}) and maps to objects.
 */
function allRows(db, sql, params = []) {
  let result;
  if (params.length > 0) {
    const stmt = db.prepare(sql);
    stmt.bind(params);
    const rows = [];
    const columns = [];
    let gotColumns = false;
    while (stmt.step()) {
      const row = stmt.getAsObject();
      rows.push(row);
    }
    stmt.free();
    return rows;
  } else {
    result = db.exec(sql);
    if (!result || result.length === 0) return [];
    const { columns, values } = result[0];
    return values.map(row => {
      const obj = {};
      columns.forEach((col, i) => { obj[col] = row[i]; });
      return obj;
    });
  }
}

/**
 * Get a single row as a plain object, or null if not found.
 */
function getRow(db, sql, params = []) {
  const rows = allRows(db, sql, params);
  return rows.length > 0 ? rows[0] : null;
}

/**
 * Get the last insert rowid.
 */
function lastInsertId(db) {
  const result = db.exec('SELECT last_insert_rowid() as id');
  if (result && result.length > 0) {
    return result[0].values[0][0];
  }
  return null;
}

module.exports = { getDb, save, allRows, getRow, lastInsertId };
