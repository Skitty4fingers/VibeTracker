const express = require('express');
const router = express.Router();
const { getDb, allRows, getRow } = require('../db/database');
const { computeScoreFields, rankTeams } = require('../lib/scoring');

// GET /api/scores — all teams with scores + computed fields, ranked
router.get('/', async (req, res) => {
    try {
        const db = await getDb();
        const settings = await getRow(db, 'SELECT * FROM EventSettings WHERE sessionKey = ?', [req.sessionKey]);
        const teams = await allRows(db, 'SELECT * FROM Team WHERE sessionKey = ? ORDER BY teamName', [req.sessionKey]);

        const results = [];
        for (const team of teams) {
            const score = await getRow(db, 'SELECT * FROM Score WHERE teamId = ?', [team.id]);
            const scoreData = score || { c1: null, c2: null, c3: null, c4: null, c5: null, c6: null, c7: null, c8: null, c9: null, c10: null };
            const computed = computeScoreFields(scoreData);
            const members = team.membersText ? team.membersText.split('\n').map(l => l.trim()).filter(l => l.length > 0) : [];

            results.push({
                teamId: team.id,
                teamName: team.teamName,
                projectName: team.projectName,
                description: team.description || '',
                members,
                memberCount: members.length,
                repoUrl: team.repoUrl,
                demoUrl: team.demoUrl,
                c1: scoreData.c1, c2: scoreData.c2, c3: scoreData.c3, c4: scoreData.c4, c5: scoreData.c5,
                c6: scoreData.c6, c7: scoreData.c7, c8: scoreData.c8, c9: scoreData.c9, c10: scoreData.c10,
                ...computed,
            });
        }

        rankTeams(results);

        res.json({
            scoringLocked: !!(settings && settings.scoringLocked),
            showPartial: settings ? !!settings.showPartial : true,
            teams: results,
        });
    } catch (e) {
        console.error('GET /api/scores error:', e);
        res.status(500).json({ errors: ['Internal server error'] });
    }
});

// GET /api/scores/:teamId
router.get('/:teamId', async (req, res) => {
    try {
        const db = await getDb();
        const teamId = parseInt(req.params.teamId, 10);
        const team = await getRow(db, 'SELECT * FROM Team WHERE id = ? AND sessionKey = ?', [teamId, req.sessionKey]);
        if (!team) return res.status(404).json({ errors: ['Team not found'] });

        const score = await getRow(db, 'SELECT * FROM Score WHERE teamId = ?', [teamId]);
        const scoreData = score || { c1: null, c2: null, c3: null, c4: null, c5: null, c6: null, c7: null, c8: null, c9: null, c10: null };
        const computed = computeScoreFields(scoreData);

        res.json({
            teamId: team.id,
            teamName: team.teamName,
            projectName: team.projectName,
            c1: scoreData.c1, c2: scoreData.c2, c3: scoreData.c3, c4: scoreData.c4, c5: scoreData.c5,
            c6: scoreData.c6, c7: scoreData.c7, c8: scoreData.c8, c9: scoreData.c9, c10: scoreData.c10,
            ...computed,
        });
    } catch (e) {
        console.error('GET /api/scores/:teamId error:', e);
        res.status(500).json({ errors: ['Internal server error'] });
    }
});

// PUT /api/scores/:teamId
router.put('/:teamId', async (req, res) => {
    try {
        const db = await getDb();
        const settings = await getRow(db, 'SELECT * FROM EventSettings WHERE sessionKey = ?', [req.sessionKey]);
        if (settings && settings.scoringLocked) {
            return res.status(403).json({ errors: ['Scoring is locked'] });
        }

        const teamId = parseInt(req.params.teamId, 10);
        const team = await getRow(db, 'SELECT * FROM Team WHERE id = ? AND sessionKey = ?', [teamId, req.sessionKey]);
        if (!team) return res.status(404).json({ errors: ['Team not found'] });

        const errors = [];
        const scores = {};
        for (let i = 1; i <= 10; i++) {
            const key = `c${i}`;
            const val = req.body[key];
            if (val === null || val === undefined || val === '') {
                scores[key] = null;
            } else {
                const n = parseInt(val, 10);
                if (!Number.isInteger(n) || n < 1 || n > 10) {
                    errors.push(`${key} must be integer 1–10 or null`);
                } else {
                    scores[key] = n;
                }
            }
        }
        if (errors.length) return res.status(400).json({ errors });

        // Upsert: check if exists
        const existing = await getRow(db, 'SELECT teamId FROM Score WHERE teamId = ?', [teamId]);
        if (existing) {
            await db.execute({
                sql: `UPDATE Score SET c1=?, c2=?, c3=?, c4=?, c5=?, c6=?, c7=?, c8=?, c9=?, c10=?, updatedAt=datetime('now') WHERE teamId=?`,
                args: [scores.c1, scores.c2, scores.c3, scores.c4, scores.c5, scores.c6, scores.c7, scores.c8, scores.c9, scores.c10, teamId],
            });
        } else {
            await db.execute({
                sql: `INSERT INTO Score (teamId, c1, c2, c3, c4, c5, c6, c7, c8, c9, c10, updatedAt) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, datetime('now'))`,
                args: [teamId, scores.c1, scores.c2, scores.c3, scores.c4, scores.c5, scores.c6, scores.c7, scores.c8, scores.c9, scores.c10],
            });
        }

        const scoreRow = await getRow(db, 'SELECT * FROM Score WHERE teamId = ?', [teamId]);
        const computed = computeScoreFields(scoreRow);
        res.json({ teamId, ...scores, ...computed });
    } catch (e) {
        console.error('PUT /api/scores/:teamId error:', e);
        res.status(500).json({ errors: ['Internal server error'] });
    }
});

module.exports = router;
