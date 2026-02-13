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

        // Run handler
        const handler = this.routes[path] || this.routes['/setup'];
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
        this.navigate(validPaths.includes(path) ? path : '/setup');
    },
};

// Register pages and init
Router.register('/setup', SetupPage);
Router.register('/score', ScorePage);
Router.register('/tv', TvPage);

document.addEventListener('DOMContentLoaded', () => Router.init());
