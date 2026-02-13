const express = require('express');
const router = express.Router();
const { getDb, allRows, getRow } = require('../db/database');

function parseMembers(text) {
    if (!text) return [];
    return text.split('\n').map(l => l.trim()).filter(l => l.length > 0);
}

async function validateTeam(body, db, excludeId) {
    const errors = [];
    const { teamName, projectName, membersText } = body;

    if (!teamName || typeof teamName !== 'string' || teamName.trim().length === 0) {
        errors.push('teamName is required');
    } else if (teamName.trim().length > 60) {
        errors.push('teamName max 60 characters');
    } else {
        const existing = await getRow(db, 'SELECT id FROM Team WHERE teamName = ?', [teamName.trim()]);
        if (existing && existing.id !== excludeId) {
            errors.push('teamName must be unique');
        }
    }

    if (!projectName || typeof projectName !== 'string' || projectName.trim().length === 0) {
        errors.push('projectName is required');
    } else if (projectName.trim().length > 80) {
        errors.push('projectName max 80 characters');
    }

    if (!membersText || typeof membersText !== 'string') {
        errors.push('membersText is required');
    } else {
        const members = parseMembers(membersText);
        if (members.length < 1 || members.length > 15) {
            errors.push('Must have 1–15 members');
        }
        for (const m of members) {
            if (m.length > 60) {
                errors.push('Each member name max 60 characters');
                break;
            }
        }
    }

    return errors;
}

// GET /api/teams
router.get('/', async (req, res) => {
    try {
        const db = await getDb();
        const teams = await allRows(db, 'SELECT * FROM Team ORDER BY teamName');
        res.json(teams.map(t => ({
            ...t,
            members: parseMembers(t.membersText),
            memberCount: parseMembers(t.membersText).length,
        })));
    } catch (e) {
        console.error('GET /api/teams error:', e);
        res.status(500).json({ errors: ['Internal server error'] });
    }
});

// POST /api/teams
router.post('/', async (req, res) => {
    try {
        const db = await getDb();
        const countResult = await db.execute('SELECT COUNT(*) as cnt FROM Team');
        const teamCount = countResult.rows[0].cnt;
        if (teamCount >= 20) {
            return res.status(400).json({ errors: ['Maximum 20 teams allowed'] });
        }

        const errors = await validateTeam(req.body, db);
        if (errors.length) return res.status(400).json({ errors });

        const { teamName, projectName, membersText, repoUrl, demoUrl, description } = req.body;
        await db.execute({
            sql: `INSERT INTO Team (teamName, projectName, membersText, repoUrl, demoUrl, description, createdAt, updatedAt)
                  VALUES (?, ?, ?, ?, ?, ?, datetime('now'), datetime('now'))`,
            args: [
                teamName.trim(), projectName.trim(), membersText,
                (repoUrl || '').trim(), (demoUrl || '').trim(), (description || '').trim()
            ],
        });

        // Get the newly inserted row by unique teamName
        const team = await getRow(db, 'SELECT * FROM Team WHERE teamName = ?', [teamName.trim()]);
        res.status(201).json({ ...team, members: parseMembers(team.membersText), memberCount: parseMembers(team.membersText).length });
    } catch (e) {
        console.error('POST /api/teams error:', e);
        res.status(500).json({ errors: ['Internal server error'] });
    }
});

// PUT /api/teams/:id
router.put('/:id', async (req, res) => {
    try {
        const db = await getDb();
        const id = parseInt(req.params.id, 10);
        const existing = await getRow(db, 'SELECT * FROM Team WHERE id = ?', [id]);
        if (!existing) return res.status(404).json({ errors: ['Team not found'] });

        const errors = await validateTeam(req.body, db, id);
        if (errors.length) return res.status(400).json({ errors });

        const { teamName, projectName, membersText, repoUrl, demoUrl, description } = req.body;
        await db.execute({
            sql: `UPDATE Team SET teamName=?, projectName=?, membersText=?, repoUrl=?, demoUrl=?, description=?, updatedAt=datetime('now')
                  WHERE id=?`,
            args: [
                teamName.trim(), projectName.trim(), membersText,
                (repoUrl || '').trim(), (demoUrl || '').trim(), (description || '').trim(),
                id
            ],
        });

        const team = await getRow(db, 'SELECT * FROM Team WHERE id = ?', [id]);
        res.json({ ...team, members: parseMembers(team.membersText), memberCount: parseMembers(team.membersText).length });
    } catch (e) {
        console.error('PUT /api/teams error:', e);
        res.status(500).json({ errors: ['Internal server error'] });
    }
});

// DELETE /api/teams/:id
router.delete('/:id', async (req, res) => {
    try {
        const db = await getDb();
        const id = parseInt(req.params.id, 10);
        const existing = await getRow(db, 'SELECT * FROM Team WHERE id = ?', [id]);
        if (!existing) return res.status(404).json({ errors: ['Team not found'] });

        await db.execute({ sql: 'DELETE FROM Score WHERE teamId = ?', args: [id] });
        await db.execute({ sql: 'DELETE FROM Team WHERE id = ?', args: [id] });
        res.json({ success: true });
    } catch (e) {
        console.error('DELETE /api/teams error:', e);
        res.status(500).json({ errors: ['Internal server error'] });
    }
});

module.exports = router;
