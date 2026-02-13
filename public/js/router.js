/* ============================================
   VibeTracker — Simple SPA Router
   ============================================ */
const Router = {
    routes: {},
    currentCleanup: null,

    register(path, handler) {
        this.routes[path] = handler;
    },

    async navigate(path) {
        // Cleanup previous page
        if (this.currentCleanup) {
            this.currentCleanup();
            this.currentCleanup = null;
        }

        const app = document.getElementById('app');
        const sessionKey = getSessionCookie();

        // Session gating: if no session and not on landing or TV, redirect to landing
        if (!sessionKey && path !== '/' && path !== '/tv') {
            path = '/';
        }

        // If user has a session and hits /, redirect to /setup
        if (sessionKey && path === '/') {
            path = '/setup';
        }

        // Toggle TV mode
        if (path === '/tv') {
            document.body.classList.add('tv-mode');
        } else {
            document.body.classList.remove('tv-mode');
        }

        // Update nav active state
        document.querySelectorAll('.nav-link').forEach(link => {
            link.classList.toggle('active', link.getAttribute('href') === path);
        });

        // Update session badge in nav
        this.updateSessionBadge(sessionKey, path);

        // Run handler
        const handler = this.routes[path] || this.routes['/'];
        if (handler) {
            const cleanup = await handler(app);
            if (typeof cleanup === 'function') {
                this.currentCleanup = cleanup;
            }
        }

        // Update URL without reload
        if (window.location.pathname !== path) {
            history.pushState(null, '', path);
        }
    },

    updateSessionBadge(sessionKey, path) {
        const badge = document.getElementById('session-badge');
        if (!badge) return;

        if (sessionKey && path !== '/' && path !== '/tv') {
            badge.innerHTML = `<span class="session-key-label">VIBE</span><span class="session-key-value">${esc(sessionKey.toUpperCase())}</span>`;
            badge.style.display = 'flex';
            badge.title = 'Click to leave this Vibe';
            badge.onclick = () => {
                if (confirm('Leave this Vibe? You can rejoin with the code.')) {
                    clearSessionCookie();
                    this.navigate('/');
                }
            };
        } else {
            badge.style.display = 'none';
        }
    },

    init() {
        // Handle nav clicks
        document.querySelectorAll('[data-route]').forEach(link => {
            link.addEventListener('click', (e) => {
                e.preventDefault();
                this.navigate(link.getAttribute('href'));
            });
        });

        // Handle browser back/forward
        window.addEventListener('popstate', () => {
            this.navigate(window.location.pathname);
        });

        // Initial route
        const path = window.location.pathname;
        const validPaths = Object.keys(this.routes);
        this.navigate(validPaths.includes(path) ? path : '/');
    },
};

// Register pages and init
Router.register('/', LandingPage);
Router.register('/setup', SetupPage);
Router.register('/score', ScorePage);
Router.register('/tv', TvPage);

document.addEventListener('DOMContentLoaded', () => Router.init());
