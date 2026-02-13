const express = require('express');
const router = express.Router();
const { getDb, getRow } = require('../db/database');

// GET /api/settings
router.get('/', async (req, res) => {
    try {
        const db = await getDb();
        const row = await getRow(db, 'SELECT * FROM EventSettings WHERE id = 1');
        res.json({
            eventName: row.eventName,
            eventIcon: row.eventIcon || '⚡',
            tagline: row.tagline || '',
            countdownTarget: row.countdownTarget || null,
            scoringLocked: !!row.scoringLocked,
            showPartial: !!row.showPartial,
            tvRefreshSeconds: row.tvRefreshSeconds,
            updatedAt: row.updatedAt,
        });
    } catch (e) {
        console.error('GET /api/settings error:', e);
        res.status(500).json({ errors: ['Internal server error'] });
    }
});

// PUT /api/settings
router.put('/', async (req, res) => {
    try {
        const db = await getDb();
        const { eventName, eventIcon, tagline, countdownTarget, scoringLocked, showPartial, tvRefreshSeconds } = req.body;

        const errors = [];
        if (eventName != null && (typeof eventName !== 'string' || eventName.trim().length === 0 || eventName.length > 120)) {
            errors.push('eventName must be 1–120 characters');
        }
        if (tagline != null && (typeof tagline !== 'string' || tagline.length > 200)) {
            errors.push('tagline must be max 200 characters');
        }
        if (tvRefreshSeconds != null && (!Number.isInteger(tvRefreshSeconds) || tvRefreshSeconds < 5 || tvRefreshSeconds > 120)) {
            errors.push('tvRefreshSeconds must be integer 5–120');
        }
        if (errors.length) return res.status(400).json({ errors });

        // Build dynamic update
        const sets = [];
        const params = [];
        if (eventName != null) { sets.push('eventName = ?'); params.push(eventName); }
        if (eventIcon != null) { sets.push('eventIcon = ?'); params.push(eventIcon); }
        if (tagline != null) { sets.push('tagline = ?'); params.push(tagline); }
        if (countdownTarget !== undefined) { sets.push('countdownTarget = ?'); params.push(countdownTarget || null); }
        if (scoringLocked != null) { sets.push('scoringLocked = ?'); params.push(scoringLocked ? 1 : 0); }
        if (showPartial != null) { sets.push('showPartial = ?'); params.push(showPartial ? 1 : 0); }
        if (tvRefreshSeconds != null) { sets.push('tvRefreshSeconds = ?'); params.push(tvRefreshSeconds); }
        sets.push("updatedAt = datetime('now')");

        if (sets.length > 1) {
            await db.execute({ sql: `UPDATE EventSettings SET ${sets.join(', ')} WHERE id = 1`, args: params });
        }

        const row = await getRow(db, 'SELECT * FROM EventSettings WHERE id = 1');
        res.json({
            eventName: row.eventName,
            eventIcon: row.eventIcon || '⚡',
            tagline: row.tagline || '',
            countdownTarget: row.countdownTarget || null,
            scoringLocked: !!row.scoringLocked,
            showPartial: !!row.showPartial,
            tvRefreshSeconds: row.tvRefreshSeconds,
            updatedAt: row.updatedAt,
        });
    } catch (e) {
        console.error('PUT /api/settings error:', e);
        res.status(500).json({ errors: ['Internal server error'] });
    }
});

module.exports = router;
