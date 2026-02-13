const express = require('express');
const router = express.Router();
const { getDb, allRows } = require('../db/database');

// GET /api/rubric
router.get('/', async (req, res) => {
    try {
        const db = await getDb();
        const rows = await allRows(db, 'SELECT * FROM RubricCategory WHERE sessionKey = ? ORDER BY categoryIndex', [req.sessionKey]);
        res.json(rows);
    } catch (e) {
        console.error('GET /api/rubric error:', e);
        res.status(500).json({ errors: ['Internal server error'] });
    }
});

// PUT /api/rubric  (bulk update all 10)
router.put('/', async (req, res) => {
    try {
        const db = await getDb();
        const { categories } = req.body;

        if (!Array.isArray(categories) || categories.length !== 10) {
            return res.status(400).json({ errors: ['Must provide exactly 10 categories'] });
        }

        const errors = [];
        for (const cat of categories) {
            if (!cat.id) errors.push('Category id is required');
            if (!cat.name || typeof cat.name !== 'string' || cat.name.trim().length === 0) {
                errors.push(`Category ${cat.id}: name is required`);
            }
        }
        if (errors.length) return res.status(400).json({ errors });

        for (const item of categories) {
            await db.execute({
                sql: 'UPDATE RubricCategory SET name = ?, guidance = ? WHERE id = ? AND sessionKey = ?',
                args: [item.name.trim(), (item.guidance || '').trim(), item.id, req.sessionKey],
            });
        }

        const rows = await allRows(db, 'SELECT * FROM RubricCategory WHERE sessionKey = ? ORDER BY categoryIndex', [req.sessionKey]);
        res.json(rows);
    } catch (e) {
        console.error('PUT /api/rubric error:', e);
        res.status(500).json({ errors: ['Internal server error'] });
    }
});

module.exports = router;
