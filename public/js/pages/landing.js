/* ============================================
   VibeTracker — Landing Page
   ============================================ */
async function LandingPage(app) {
    document.body.classList.add('landing-mode');

    app.innerHTML = `
    <div class="landing-container">
        <div class="landing-hero">
            <div class="landing-icon">⚡</div>
            <h1 class="landing-title">VibeTracker</h1>
            <p class="landing-subtitle">Hackathon scoring & leaderboard</p>
        </div>

        <div class="landing-cards">
            <div class="landing-card landing-card-new" id="landing-new-vibe">
                <div class="landing-card-icon">🚀</div>
                <h2 class="landing-card-title">New Vibe</h2>
                <p class="landing-card-desc">Start a fresh hackathon session with sample data</p>
                <button class="btn btn-primary landing-btn" id="btn-new-vibe">
                    Create Vibe
                </button>
            </div>

            <div class="landing-divider">
                <span>or</span>
            </div>

            <div class="landing-card landing-card-join">
                <div class="landing-card-icon">🔗</div>
                <h2 class="landing-card-title">Enter Vibe</h2>
                <p class="landing-card-desc">Join an existing session with a 5-character code</p>
                <div class="landing-input-group">
                    <input type="text"
                           id="input-session-key"
                           class="form-input landing-hex-input"
                           placeholder="a1b2c"
                           maxlength="5"
                           spellcheck="false"
                           autocomplete="off" />
                    <button class="btn btn-primary landing-btn" id="btn-join-vibe" disabled>
                        Join
                    </button>
                </div>
                <p class="landing-error" id="join-error"></p>
            </div>
        </div>
    </div>
    `;

    // New Vibe button
    const btnNew = document.getElementById('btn-new-vibe');
    btnNew.addEventListener('click', async () => {
        btnNew.disabled = true;
        btnNew.textContent = 'Creating…';
        try {
            const data = await API.createSession();
            setSessionCookie(data.sessionKey);
            Router.navigate('/setup');
        } catch (e) {
            showToast('Failed to create session', 'error');
            btnNew.disabled = false;
            btnNew.textContent = 'Create Vibe';
        }
    });

    // Join Vibe input + button
    const input = document.getElementById('input-session-key');
    const btnJoin = document.getElementById('btn-join-vibe');
    const joinError = document.getElementById('join-error');

    input.addEventListener('input', () => {
        // Only allow hex chars
        input.value = input.value.replace(/[^0-9a-fA-F]/g, '').toLowerCase();
        btnJoin.disabled = input.value.length !== 5;
        joinError.textContent = '';
    });

    input.addEventListener('keydown', (e) => {
        if (e.key === 'Enter' && input.value.length === 5) {
            btnJoin.click();
        }
    });

    btnJoin.addEventListener('click', async () => {
        const key = input.value.trim().toLowerCase();
        if (key.length !== 5) return;

        btnJoin.disabled = true;
        btnJoin.textContent = 'Joining…';
        joinError.textContent = '';

        try {
            await API.joinSession(key);
            setSessionCookie(key);
            Router.navigate('/setup');
        } catch (e) {
            joinError.textContent = (e && e.errors && e.errors[0]) || 'Vibe not found';
            btnJoin.disabled = false;
            btnJoin.textContent = 'Join';
            input.focus();
        }
    });

    // Auto-focus the input
    setTimeout(() => input.focus(), 100);

    return () => {
        document.body.classList.remove('landing-mode');
    };
}
