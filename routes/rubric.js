const express = require('express');
const router = express.Router();
const { getDb, save, allRows } = require('../db/database');

// GET /api/rubric
router.get('/', async (req, res) => {
    try {
        const db = await getDb();
        const rows = allRows(db, 'SELECT * FROM RubricCategory ORDER BY id');
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
            if (!cat.id || cat.id < 1 || cat.id > 10) errors.push(`Invalid category id: ${cat.id}`);
            if (!cat.name || typeof cat.name !== 'string' || cat.name.trim().length === 0) {
                errors.push(`Category ${cat.id}: name is required`);
            }
        }
        if (errors.length) return res.status(400).json({ errors });

        for (const item of categories) {
            db.run('UPDATE RubricCategory SET name = ?, guidance = ? WHERE id = ?',
                [item.name.trim(), (item.guidance || '').trim(), item.id]);
        }
        save();

        const rows = allRows(db, 'SELECT * FROM RubricCategory ORDER BY id');
        res.json(rows);
    } catch (e) {
        console.error('PUT /api/rubric error:', e);
        res.status(500).json({ errors: ['Internal server error'] });
    }
});

module.exports = router;
