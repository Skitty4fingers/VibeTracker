const express = require('express');
const path = require('path');
const { getDb, getSession } = require('./db/database');
const app = express();
const PORT = process.env.PORT || 3000;

// Middleware
app.use(express.json());
app.use(express.static(path.join(__dirname, 'public'), {
    etag: false,
    lastModified: false,
    setHeaders: (res) => {
        res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate');
    }
}));

// Lightweight cookie parser (no dependency needed)
app.use((req, res, next) => {
    req.cookies = {};
    const cookieHeader = req.headers.cookie;
    if (cookieHeader) {
        cookieHeader.split(';').forEach(pair => {
            const [name, ...rest] = pair.trim().split('=');
            if (name) req.cookies[name.trim()] = decodeURIComponent(rest.join('=').trim());
        });
    }
    // cookie setter helper
    res.cookie = (name, value, opts = {}) => {
        let cookie = `${name}=${encodeURIComponent(value)}`;
        if (opts.maxAge) cookie += `; Max-Age=${Math.round(opts.maxAge / 1000)}`;
        if (opts.path) cookie += `; Path=${opts.path}`;
        if (opts.sameSite) cookie += `; SameSite=${opts.sameSite}`;
        if (opts.httpOnly) cookie += '; HttpOnly';
        if (opts.secure) cookie += '; Secure';
        // Append to existing Set-Cookie headers
        const existing = res.getHeader('Set-Cookie') || [];
        const arr = Array.isArray(existing) ? existing : (existing ? [existing] : []);
        arr.push(cookie);
        res.setHeader('Set-Cookie', arr);
    };
    next();
});

// Session routes (no session middleware needed)
app.use('/api/sessions', require('./routes/sessions'));

// Session-scoping middleware for all other /api/* routes
app.use('/api', async (req, res, next) => {
    const sessionKey = req.cookies.vt_session || req.query.session;
    if (!sessionKey) {
        return res.status(401).json({ errors: ['No session. Create or join a Vibe first.'] });
    }

    try {
        const db = await getDb();
        const session = await getSession(db, sessionKey);
        if (!session) {
            return res.status(401).json({ errors: ['Invalid session. Create or join a Vibe first.'] });
        }
        req.sessionKey = session.sessionKey;
        next();
    } catch (e) {
        console.error('Session middleware error:', e);
        res.status(500).json({ errors: ['Internal server error'] });
    }
});

// API routes
app.use('/api/settings', require('./routes/settings'));
app.use('/api/teams', require('./routes/teams'));
app.use('/api/rubric', require('./routes/rubric'));
app.use('/api/scores', require('./routes/scores'));
app.use('/api/announcements', require('./routes/announcements'));

// SPA fallback — serve index.html for page routes
app.get(/^\/(setup|score|tv)?$/, (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

// Error handler
app.use((err, req, res, next) => {
    console.error('Unhandled error:', err);
    res.status(500).json({ errors: ['Internal server error'] });
});

// Only listen when run directly (not when imported by Vercel)
if (require.main === module) {
    app.listen(PORT, () => {
        console.log(`VibeTracker running at http://localhost:${PORT}`);
        console.log(`  /setup  — Configure event`);
        console.log(`  /score  — Enter scores`);
        console.log(`  /tv     — Leaderboard (TV mode)`);
    });
}

module.exports = app;
