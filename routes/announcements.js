const express = require('express');
const router = express.Router();
const { getDb, allRows, getRow } = require('../db/database');

// GET /api/announcements?published=true|false
router.get('/', async (req, res) => {
    try {
        const db = await getDb();
        let query = 'SELECT * FROM Announcement WHERE sessionKey = ?';
        const params = [req.sessionKey];

        if (req.query.published === 'true') {
            query += ' AND published = 1';
        } else if (req.query.published === 'false') {
            query += ' AND published = 0';
        }

        query += ' ORDER BY pinned DESC, createdAt DESC';
        const rows = await allRows(db, query, params);
        res.json(rows.map(r => ({ ...r, published: !!r.published, pinned: !!r.pinned })));
    } catch (e) {
        console.error('GET /api/announcements error:', e);
        res.status(500).json({ errors: ['Internal server error'] });
    }
});

// POST /api/announcements
router.post('/', async (req, res) => {
    try {
        const db = await getDb();
        const { title, body, published, pinned } = req.body;

        const errors = [];
        if (!title || typeof title !== 'string' || title.trim().length === 0) errors.push('title is required');
        if (!body || typeof body !== 'string' || body.trim().length === 0) errors.push('body is required');
        if (errors.length) return res.status(400).json({ errors });

        // Check pin limit (max 4) within session
        if (pinned) {
            const pinnedCount = await db.execute({ sql: 'SELECT COUNT(*) as cnt FROM Announcement WHERE pinned = 1 AND sessionKey = ?', args: [req.sessionKey] });
            if (pinnedCount.rows[0].cnt >= 4) {
                return res.status(400).json({ errors: ['Maximum 4 pinned announcements allowed. Unpin one first.'] });
            }
        }

        await db.execute({
            sql: `INSERT INTO Announcement (sessionKey, title, body, published, pinned, createdAt, updatedAt)
                  VALUES (?, ?, ?, ?, ?, datetime('now'), datetime('now'))`,
            args: [req.sessionKey, title.trim(), body.trim(), published ? 1 : 0, pinned ? 1 : 0],
        });

        const maxResult = await db.execute({ sql: 'SELECT MAX(id) as id FROM Announcement WHERE sessionKey = ?', args: [req.sessionKey] });
        const lastId = maxResult.rows[0].id;
        const row = await getRow(db, 'SELECT * FROM Announcement WHERE id = ?', [lastId]);
        res.status(201).json({ ...row, published: !!row.published, pinned: !!row.pinned });
    } catch (e) {
        console.error('POST /api/announcements error:', e);
        res.status(500).json({ errors: ['Internal server error'] });
    }
});

// PUT /api/announcements/:id
router.put('/:id', async (req, res) => {
    try {
        const db = await getDb();
        const id = parseInt(req.params.id, 10);
        const existing = await getRow(db, 'SELECT * FROM Announcement WHERE id = ? AND sessionKey = ?', [id, req.sessionKey]);
        if (!existing) return res.status(404).json({ errors: ['Announcement not found'] });

        const { title, body, published, pinned } = req.body;
        const errors = [];
        if (title != null && (typeof title !== 'string' || title.trim().length === 0)) errors.push('title cannot be empty');
        if (body != null && (typeof body !== 'string' || body.trim().length === 0)) errors.push('body cannot be empty');
        if (errors.length) return res.status(400).json({ errors });

        // Check pin limit (max 4) — only if newly pinning
        if (pinned && !existing.pinned) {
            const pinnedCount = await db.execute({ sql: 'SELECT COUNT(*) as cnt FROM Announcement WHERE pinned = 1 AND sessionKey = ?', args: [req.sessionKey] });
            if (pinnedCount.rows[0].cnt >= 4) {
                return res.status(400).json({ errors: ['Maximum 4 pinned announcements allowed. Unpin one first.'] });
            }
        }

        // Build dynamic update
        const sets = [];
        const params = [];
        if (title != null) { sets.push('title = ?'); params.push(title.trim()); }
        if (body != null) { sets.push('body = ?'); params.push(body.trim()); }
        if (published != null) { sets.push('published = ?'); params.push(published ? 1 : 0); }
        if (pinned != null) { sets.push('pinned = ?'); params.push(pinned ? 1 : 0); }
        sets.push("updatedAt = datetime('now')");
        params.push(id);
        params.push(req.sessionKey);

        await db.execute({ sql: `UPDATE Announcement SET ${sets.join(', ')} WHERE id = ? AND sessionKey = ?`, args: params });

        const row = await getRow(db, 'SELECT * FROM Announcement WHERE id = ? AND sessionKey = ?', [id, req.sessionKey]);
        res.json({ ...row, published: !!row.published, pinned: !!row.pinned });
    } catch (e) {
        console.error('PUT /api/announcements error:', e);
        res.status(500).json({ errors: ['Internal server error'] });
    }
});

// DELETE /api/announcements/:id
router.delete('/:id', async (req, res) => {
    try {
        const db = await getDb();
        const id = parseInt(req.params.id, 10);
        const existing = await getRow(db, 'SELECT * FROM Announcement WHERE id = ? AND sessionKey = ?', [id, req.sessionKey]);
        if (!existing) return res.status(404).json({ errors: ['Announcement not found'] });

        await db.execute({ sql: 'DELETE FROM Announcement WHERE id = ? AND sessionKey = ?', args: [id, req.sessionKey] });
        res.json({ success: true });
    } catch (e) {
        console.error('DELETE /api/announcements error:', e);
        res.status(500).json({ errors: ['Internal server error'] });
    }
});

module.exports = router;
