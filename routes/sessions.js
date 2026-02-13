const express = require('express');
const router = express.Router();
const { getDb, createSession, getSession } = require('../db/database');

// POST /api/sessions — Create a new Vibe
router.post('/', async (req, res) => {
    try {
        const db = await getDb();
        const sessionKey = await createSession(db);

        // Set cookie (30 days, httpOnly for security)
        res.cookie('vt_session', sessionKey, {
            maxAge: 30 * 24 * 60 * 60 * 1000,
            httpOnly: false, // needs to be readable by client JS
            sameSite: 'lax',
            path: '/',
        });

        res.status(201).json({ sessionKey });
    } catch (e) {
        console.error('POST /api/sessions error:', e);
        res.status(500).json({ errors: ['Internal server error'] });
    }
});

// GET /api/sessions/:key — Join an existing Vibe
router.get('/:key', async (req, res) => {
    try {
        const db = await getDb();
        const key = req.params.key.toLowerCase().trim();

        if (!/^[0-9a-f]{5}$/.test(key)) {
            return res.status(400).json({ errors: ['Session key must be a 5-character hex string'] });
        }

        const session = await getSession(db, key);
        if (!session) {
            return res.status(404).json({ errors: ['Vibe not found. Check your code and try again.'] });
        }

        // Set cookie
        res.cookie('vt_session', key, {
            maxAge: 30 * 24 * 60 * 60 * 1000,
            httpOnly: false,
            sameSite: 'lax',
            path: '/',
        });

        res.json({ sessionKey: session.sessionKey, createdAt: session.createdAt });
    } catch (e) {
        console.error('GET /api/sessions/:key error:', e);
        res.status(500).json({ errors: ['Internal server error'] });
    }
});

module.exports = router;
