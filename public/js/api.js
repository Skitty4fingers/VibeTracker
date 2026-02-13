/* ============================================
   VibeTracker — API Client
   ============================================ */
const API = {
    async get(url) {
        const res = await fetch(url);
        if (!res.ok) {
            const err = await res.json().catch(() => ({ errors: ['Request failed'] }));
            throw err;
        }
        return res.json();
    },

    async post(url, data) {
        const res = await fetch(url, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(data),
        });
        const json = await res.json();
        if (!res.ok) throw json;
        return json;
    },

    async put(url, data) {
        const res = await fetch(url, {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(data),
        });
        const json = await res.json();
        if (!res.ok) throw json;
        return json;
    },

    async del(url) {
        const res = await fetch(url, { method: 'DELETE' });
        const json = await res.json();
        if (!res.ok) throw json;
        return json;
    },

    // Settings
    getSettings: () => API.get('/api/settings'),
    updateSettings: (data) => API.put('/api/settings', data),

    // Teams
    getTeams: () => API.get('/api/teams'),
    createTeam: (data) => API.post('/api/teams', data),
    updateTeam: (id, data) => API.put(`/api/teams/${id}`, data),
    deleteTeam: (id) => API.del(`/api/teams/${id}`),

    // Rubric
    getRubric: () => API.get('/api/rubric'),
    updateRubric: (categories) => API.put('/api/rubric', { categories }),

    // Scores
    getScores: () => API.get('/api/scores'),
    getTeamScore: (teamId) => API.get(`/api/scores/${teamId}`),
    updateScore: (teamId, data) => API.put(`/api/scores/${teamId}`, data),

    // Announcements
    getAnnouncements: (published) => {
        const q = published != null ? `?published=${published}` : '';
        return API.get(`/api/announcements${q}`);
    },
    createAnnouncement: (data) => API.post('/api/announcements', data),
    updateAnnouncement: (id, data) => API.put(`/api/announcements/${id}`, data),
    deleteAnnouncement: (id) => API.del(`/api/announcements/${id}`),
};

/* Toast notifications */
function showToast(message, type = 'success') {
    const container = document.getElementById('toast-container');
    const toast = document.createElement('div');
    toast.className = `toast toast-${type}`;
    toast.textContent = message;
    container.appendChild(toast);
    setTimeout(() => toast.remove(), 3000);
}

/* Escape HTML */
function esc(str) {
    const div = document.createElement('div');
    div.textContent = str || '';
    return div.innerHTML;
}
