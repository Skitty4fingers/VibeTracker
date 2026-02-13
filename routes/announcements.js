const express = require('express');
const router = express.Router();
const { getDb, save, allRows, getRow, lastInsertId } = require('../db/database');

// GET /api/announcements?published=true|false
router.get('/', async (req, res) => {
    try {
        const db = await getDb();
        let query = 'SELECT * FROM Announcement';
        const params = [];

        if (req.query.published === 'true') {
            query += ' WHERE published = 1';
        } else if (req.query.published === 'false') {
            query += ' WHERE published = 0';
        }

        query += ' ORDER BY pinned DESC, createdAt DESC';
        const rows = allRows(db, query, params);
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

        // Check pin limit (max 4)
        if (pinned) {
            const pinnedCount = db.exec('SELECT COUNT(*) FROM Announcement WHERE pinned = 1');
            if (pinnedCount[0].values[0][0] >= 4) {
                return res.status(400).json({ errors: ['Maximum 4 pinned announcements allowed. Unpin one first.'] });
            }
        }

        db.run(`
      INSERT INTO Announcement (title, body, published, pinned, createdAt, updatedAt)
      VALUES (?, ?, ?, ?, datetime('now'), datetime('now'))
    `, [title.trim(), body.trim(), published ? 1 : 0, pinned ? 1 : 0]);
        save();

        const maxResult = db.exec('SELECT MAX(id) as id FROM Announcement');
        const lastId = maxResult[0].values[0][0];
        const row = getRow(db, 'SELECT * FROM Announcement WHERE id = ?', [lastId]);
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
        const existing = getRow(db, 'SELECT * FROM Announcement WHERE id = ?', [id]);
        if (!existing) return res.status(404).json({ errors: ['Announcement not found'] });

        const { title, body, published, pinned } = req.body;
        const errors = [];
        if (title != null && (typeof title !== 'string' || title.trim().length === 0)) errors.push('title cannot be empty');
        if (body != null && (typeof body !== 'string' || body.trim().length === 0)) errors.push('body cannot be empty');
        if (errors.length) return res.status(400).json({ errors });

        // Check pin limit (max 4) — only if newly pinning
        if (pinned && !existing.pinned) {
            const pinnedCount = db.exec('SELECT COUNT(*) FROM Announcement WHERE pinned = 1');
            if (pinnedCount[0].values[0][0] >= 4) {
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

        db.run(`UPDATE Announcement SET ${sets.join(', ')} WHERE id = ?`, params);
        save();

        const row = getRow(db, 'SELECT * FROM Announcement WHERE id = ?', [id]);
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
        const existing = getRow(db, 'SELECT * FROM Announcement WHERE id = ?', [id]);
        if (!existing) return res.status(404).json({ errors: ['Announcement not found'] });

        db.run('DELETE FROM Announcement WHERE id = ?', [id]);
        save();
        res.json({ success: true });
    } catch (e) {
        console.error('DELETE /api/announcements error:', e);
        res.status(500).json({ errors: ['Internal server error'] });
    }
});

module.exports = router;
