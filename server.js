const express = require('express');
const path = require('path');
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
