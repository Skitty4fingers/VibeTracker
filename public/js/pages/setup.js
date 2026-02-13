/* ============================================
   VibeTracker — Setup Page
   ============================================ */
async function SetupPage(app) {
  app.innerHTML = `
    <div class="page-header">
      <h1 class="page-title">⚙️ Setup</h1>
      <p class="page-subtitle">Configure your event, teams, rubric, and announcements</p>
    </div>
    <div class="tabs">
      <button class="tab active" data-tab="settings">Event Settings</button>
      <button class="tab" data-tab="teams">Teams</button>
      <button class="tab" data-tab="rubric">Rubric</button>
      <button class="tab" data-tab="announcements">Announcements</button>
    </div>
    <div id="tab-settings" class="tab-content active"></div>
    <div id="tab-teams" class="tab-content"></div>
    <div id="tab-rubric" class="tab-content"></div>
    <div id="tab-announcements" class="tab-content"></div>
  `;

  // Tab switching
  app.querySelectorAll('.tab').forEach(tab => {
    tab.addEventListener('click', () => {
      app.querySelectorAll('.tab').forEach(t => t.classList.remove('active'));
      app.querySelectorAll('.tab-content').forEach(c => c.classList.remove('active'));
      tab.classList.add('active');
      document.getElementById(`tab-${tab.dataset.tab}`).classList.add('active');
    });
  });

  // ======== Icon options ========
  const EVENT_ICONS = [
    '', '⚡', '🚀', '💡', '🏆', '🎯', '🔥', '✨', '🌟', '💻', '🛠️',
    '🎮', '🧠', '🤖', '🌐', '📡', '🧬', '🔬', '🎨', '📊', '🏗️',
    '⚙️', '🔒', '🎪', '🎸', '🏁',
  ];

  await Promise.all([
    loadSettings(),
    loadTeams(),
    loadRubric(),
    loadAnnouncements(),
  ]);

  // ======== SETTINGS TAB ========

  async function loadSettings() {
    const settings = await API.getSettings();
    const container = document.getElementById('tab-settings');
    const currentIcon = settings.eventIcon || '⚡';
    container.innerHTML = `
      <div class="card">
        <h2 class="card-title">Event Configuration</h2>
        <div class="form-group">
          <label class="form-label">Event Icon</label>
          <div class="icon-picker" id="icon-picker">
            ${EVENT_ICONS.map(icon => `
              <button type="button" class="icon-option ${icon === currentIcon ? 'icon-option-active' : ''}" data-icon="${icon}">
                ${icon || '<span style="font-size:0.65rem;color:var(--text-muted)">None</span>'}
              </button>
            `).join('')}
          </div>
          <input type="hidden" id="setting-eventIcon" value="${esc(currentIcon)}">
        </div>
        <div class="form-group">
          <label class="form-label">Event Name</label>
          <input type="text" class="form-input" id="setting-eventName" value="${esc(settings.eventName)}" maxlength="120">
        </div>
        <div class="form-group">
          <label class="form-label">Tagline (optional)</label>
          <input type="text" class="form-input" id="setting-tagline" value="${esc(settings.tagline)}" maxlength="200" placeholder="e.g. Q1 2026 Innovation Day">
        </div>
        <div class="toggle-group" style="margin-top:1rem;margin-bottom:0.5rem">
          <label class="toggle">
            <input type="checkbox" id="setting-countdownEnabled" ${settings.countdownTarget ? 'checked' : ''}>
            <span class="toggle-slider"></span>
          </label>
          <span class="toggle-label">Enable Countdown Timer</span>
        </div>
        <div class="form-group" id="countdown-picker-group" style="display:${settings.countdownTarget ? 'block' : 'none'}; margin-left: 3.5rem;">
          <input type="datetime-local" class="form-input" id="setting-countdown" value="${settings.countdownTarget ? settings.countdownTarget.replace(' ', 'T').slice(0, 16) : ''}">
        </div>
        <div class="toggle-group">
          <label class="toggle">
            <input type="checkbox" id="setting-scoringLocked" ${settings.scoringLocked ? 'checked' : ''}>
            <span class="toggle-slider"></span>
          </label>
          <span class="toggle-label">🔒 Scoring Locked</span>
        </div>
        <div class="toggle-group">
          <label class="toggle">
            <input type="checkbox" id="setting-showPartial" ${settings.showPartial ? 'checked' : ''}>
            <span class="toggle-slider"></span>
          </label>
          <span class="toggle-label">Show partial scores on leaderboard</span>
        </div>
        <div class="form-group" style="margin-top:1rem">
          <label class="form-label">TV Refresh Interval (seconds)</label>
          <input type="number" class="form-input" id="setting-tvRefresh" value="${settings.tvRefreshSeconds}" min="5" max="120" style="width:120px">
        </div>
        <button class="btn btn-primary" id="save-settings">Save Settings</button>
      </div>
    `;

    // Icon picker interaction
    container.querySelectorAll('.icon-option').forEach(btn => {
      btn.addEventListener('click', () => {
        container.querySelectorAll('.icon-option').forEach(b => b.classList.remove('icon-option-active'));
        btn.classList.add('icon-option-active');
        document.getElementById('setting-eventIcon').value = btn.dataset.icon;
      });
    });

    // Countdown toggle
    const cdToggle = document.getElementById('setting-countdownEnabled');
    cdToggle.addEventListener('change', () => {
      document.getElementById('countdown-picker-group').style.display = cdToggle.checked ? 'block' : 'none';
      if (cdToggle.checked && !document.getElementById('setting-countdown').value) {
        // Default to now + 1 hour
        const now = new Date(Date.now() + 3600000);
        const iso = new Date(now.getTime() - (now.getTimezoneOffset() * 60000)).toISOString().slice(0, 16);
        document.getElementById('setting-countdown').value = iso;
      }
    });

    document.getElementById('save-settings').addEventListener('click', async () => {
      try {
        const cdEnabled = document.getElementById('setting-countdownEnabled').checked;
        const cdVal = document.getElementById('setting-countdown').value;
        const cdTarget = (cdEnabled && cdVal) ? cdVal.replace('T', ' ') : '';

        await API.updateSettings({
          eventName: document.getElementById('setting-eventName').value,
          eventIcon: document.getElementById('setting-eventIcon').value,
          tagline: document.getElementById('setting-tagline').value,
          countdownTarget: cdTarget,
          scoringLocked: document.getElementById('setting-scoringLocked').checked,
          showPartial: document.getElementById('setting-showPartial').checked,
          tvRefreshSeconds: parseInt(document.getElementById('setting-tvRefresh').value, 10),
        });
        showToast('Settings saved');
      } catch (e) {
        showToast((e.errors || ['Save failed']).join(', '), 'error');
      }
    });
  }

  // ======== TEAMS TAB ========
  async function loadTeams() {
    const teams = await API.getTeams();
    const container = document.getElementById('tab-teams');
    const teamCount = teams.length;

    let bannerHtml = '';
    if (teamCount < 2) {
      bannerHtml = `<div class="banner banner-warning">⚠️ Setup incomplete — add at least 2 teams to begin scoring</div>`;
    } else if (teamCount >= 20) {
      bannerHtml = `<div class="banner banner-info">ℹ️ Maximum of 20 teams reached</div>`;
    }

    container.innerHTML = `
      ${bannerHtml}
      <div class="card-header">
        <h2 class="section-title" style="margin:0">Teams <span class="badge badge-accent">${teamCount}/20</span></h2>
        <button class="btn btn-primary" id="add-team-btn" ${teamCount >= 20 ? 'disabled' : ''}>+ Add Team</button>
      </div>
      <div id="team-list">${teams.length ? '' : '<div class="empty-state"><span class="empty-state-icon">👥</span><span class="empty-state-text">No teams yet — add your first team</span></div>'}</div>
    `;

    const listEl = document.getElementById('team-list');
    for (const team of teams) {
      listEl.appendChild(createTeamItem(team));
    }

    document.getElementById('add-team-btn').addEventListener('click', () => showTeamModal());
  }

  function createTeamItem(team) {
    const div = document.createElement('div');
    div.className = 'team-list-item';
    div.innerHTML = `
      <div class="team-list-info">
        <div class="team-list-name">${esc(team.teamName)}</div>
        <div class="team-list-project">${esc(team.projectName)} <span class="badge badge-accent" style="margin-left:0.5rem">${team.memberCount} member${team.memberCount !== 1 ? 's' : ''}</span></div>
        ${team.repoUrl ? `<a href="${esc(team.repoUrl)}" class="link-chip" target="_blank">Repo</a>` : ''}
        ${team.demoUrl ? `<a href="${esc(team.demoUrl)}" class="link-chip" target="_blank">Demo</a>` : ''}
      </div>
      <div class="team-list-actions">
        <button class="btn btn-secondary btn-sm edit-team" data-id="${team.id}">Edit</button>
        <button class="btn btn-danger btn-sm delete-team" data-id="${team.id}">Delete</button>
      </div>
    `;
    div.querySelector('.edit-team').addEventListener('click', () => showTeamModal(team));
    div.querySelector('.delete-team').addEventListener('click', async () => {
      if (!confirm(`Delete team "${team.teamName}"?`)) return;
      try {
        await API.deleteTeam(team.id);
        showToast('Team deleted');
        await loadTeams();
      } catch (e) {
        showToast((e.errors || ['Delete failed']).join(', '), 'error');
      }
    });
    return div;
  }

  function showTeamModal(team = null) {
    const isEdit = !!team;
    const overlay = document.createElement('div');
    overlay.className = 'modal-overlay';
    overlay.innerHTML = `
      <div class="modal">
        <h2 class="modal-title">${isEdit ? 'Edit Team' : 'Add Team'}</h2>
        <div class="form-group">
          <label class="form-label">Team Name *</label>
          <input type="text" class="form-input" id="modal-teamName" value="${isEdit ? esc(team.teamName) : ''}" maxlength="60" placeholder="e.g. Team Aurora">
        </div>
        <div class="form-group">
          <label class="form-label">Project Name *</label>
          <input type="text" class="form-input" id="modal-projectName" value="${isEdit ? esc(team.projectName) : ''}" maxlength="80" placeholder="e.g. SmartWidget AI">
        </div>
        <div class="form-group">
          <label class="form-label">Members * <span style="font-weight:400;color:var(--text-muted)">(one per line, 1–15)</span></label>
          <textarea class="form-textarea" id="modal-members" placeholder="Alice Johnson&#10;Bob Smith&#10;Charlie Lee">${isEdit ? esc(team.membersText) : ''}</textarea>
        </div>
        <div class="form-row">
          <div class="form-group">
            <label class="form-label">Repo URL</label>
            <input type="url" class="form-input" id="modal-repoUrl" value="${isEdit ? esc(team.repoUrl || '') : ''}" placeholder="https://github.com/...">
          </div>
          <div class="form-group">
            <label class="form-label">Demo URL</label>
            <input type="url" class="form-input" id="modal-demoUrl" value="${isEdit ? esc(team.demoUrl || '') : ''}" placeholder="https://demo.example.com">
          </div>
        </div>
        <div class="form-group">
          <label class="form-label">Description</label>
          <textarea class="form-textarea" id="modal-description" placeholder="Brief project description..." style="min-height:60px">${isEdit ? esc(team.description || '') : ''}</textarea>
        </div>
        <div class="modal-actions">
          <button class="btn btn-secondary" id="modal-cancel">Cancel</button>
          <button class="btn btn-primary" id="modal-save">${isEdit ? 'Update' : 'Create'}</button>
        </div>
      </div>
    `;
    document.body.appendChild(overlay);

    overlay.querySelector('#modal-cancel').addEventListener('click', () => overlay.remove());
    overlay.addEventListener('click', (e) => { if (e.target === overlay) overlay.remove(); });

    overlay.querySelector('#modal-save').addEventListener('click', async () => {
      const data = {
        teamName: document.getElementById('modal-teamName').value,
        projectName: document.getElementById('modal-projectName').value,
        membersText: document.getElementById('modal-members').value,
        repoUrl: document.getElementById('modal-repoUrl').value,
        demoUrl: document.getElementById('modal-demoUrl').value,
        description: document.getElementById('modal-description').value,
      };
      try {
        if (isEdit) {
          await API.updateTeam(team.id, data);
          showToast('Team updated');
        } else {
          await API.createTeam(data);
          showToast('Team created');
        }
        overlay.remove();
        await loadTeams();
      } catch (e) {
        showToast((e.errors || ['Save failed']).join(', '), 'error');
      }
    });
  }

  // ======== RUBRIC TAB ========
  async function loadRubric() {
    const categories = await API.getRubric();
    const container = document.getElementById('tab-rubric');
    const businessCats = categories.filter(c => c.groupName === 'Business');
    const technicalCats = categories.filter(c => c.groupName === 'Technical');

    const renderGroup = (label, cats) => {
      let html = `<div class="rubric-group-label">${label} (Criteria ${cats[0].id}–${cats[cats.length - 1].id})</div>`;
      for (const cat of cats) {
        html += `
          <div class="rubric-row">
            <span class="score-num">${cat.id}</span>
            <div class="form-group" style="margin:0">
              <input type="text" class="form-input" id="rubric-name-${cat.id}" value="${esc(cat.name)}" placeholder="Criterion name">
            </div>
            <div class="form-group" style="margin:0">
              <textarea class="form-textarea rubric-guidance-textarea" id="rubric-guidance-${cat.id}" placeholder="Scoring guidance (e.g. 1: low · 10: high)" rows="2">${esc(cat.guidance)}</textarea>
            </div>
          </div>
        `;
      }
      return html;
    };

    container.innerHTML = `
      <div class="card">
        <h2 class="card-title">Scoring Rubric</h2>
        <p style="color:var(--text-secondary);font-size:0.9rem;margin-bottom:1.5rem">
          Define the 10 scoring criteria. Each criterion is scored 1–10.
        </p>
        ${renderGroup('Business', businessCats)}
        ${renderGroup('Technical', technicalCats)}
        <div style="margin-top:1.5rem">
          <button class="btn btn-primary" id="save-rubric">Save Rubric</button>
        </div>
      </div>
    `;

    document.getElementById('save-rubric').addEventListener('click', async () => {
      const updated = categories.map(cat => ({
        id: cat.id,
        name: document.getElementById(`rubric-name-${cat.id}`).value,
        guidance: document.getElementById(`rubric-guidance-${cat.id}`).value,
      }));
      try {
        await API.updateRubric(updated);
        showToast('Rubric saved');
      } catch (e) {
        showToast((e.errors || ['Save failed']).join(', '), 'error');
      }
    });
  }

  // ======== ANNOUNCEMENTS TAB ========
  async function loadAnnouncements() {
    const announcements = await API.getAnnouncements();
    const container = document.getElementById('tab-announcements');

    container.innerHTML = `
      <div class="card-header">
        <h2 class="section-title" style="margin:0">Announcements</h2>
        <button class="btn btn-primary" id="add-announcement-btn">+ New Announcement</button>
      </div>
      <div id="announcement-list">
        ${announcements.length === 0 ? '<div class="empty-state"><span class="empty-state-icon">📢</span><span class="empty-state-text">No announcements yet</span></div>' : ''}
      </div>
    `;

    const listEl = document.getElementById('announcement-list');
    for (const ann of announcements) {
      const item = document.createElement('div');
      item.className = 'announcement-item';
      item.innerHTML = `
        <div class="announcement-item-header">
          <div>
            <span class="announcement-item-title">${esc(ann.title)}</span>
            ${ann.pinned ? '<span class="badge badge-accent" style="margin-left:0.5rem">📌 Pinned</span>' : ''}
            ${ann.published ? '<span class="badge badge-success" style="margin-left:0.25rem">Published</span>' : '<span class="badge badge-warning" style="margin-left:0.25rem">Draft</span>'}
          </div>
          <div class="btn-group">
            <button class="btn btn-secondary btn-sm edit-ann" data-id="${ann.id}">Edit</button>
            <button class="btn btn-danger btn-sm delete-ann" data-id="${ann.id}">Delete</button>
          </div>
        </div>
        <div class="announcement-item-body md-content">${typeof marked !== 'undefined' ? marked.parse(ann.body) : esc(ann.body)}</div>
      `;
      item.querySelector('.edit-ann').addEventListener('click', () => showAnnouncementModal(ann));
      item.querySelector('.delete-ann').addEventListener('click', async () => {
        if (!confirm('Delete this announcement?')) return;
        try {
          await API.deleteAnnouncement(ann.id);
          showToast('Announcement deleted');
          await loadAnnouncements();
        } catch (e) {
          showToast((e.errors || ['Delete failed']).join(', '), 'error');
        }
      });
      listEl.appendChild(item);
    }

    document.getElementById('add-announcement-btn').addEventListener('click', () => showAnnouncementModal());
  }

  function showAnnouncementModal(ann = null) {
    const isEdit = !!ann;
    const overlay = document.createElement('div');
    overlay.className = 'modal-overlay';
    overlay.innerHTML = `
      <div class="modal">
        <h2 class="modal-title">${isEdit ? 'Edit Announcement' : 'New Announcement'}</h2>
        <div class="form-group">
          <label class="form-label">Title *</label>
          <input type="text" class="form-input" id="modal-ann-title" value="${isEdit ? esc(ann.title) : ''}" placeholder="Announcement title">
        </div>
        <div class="form-group">
          <label class="form-label">Body * <span style="font-weight:400;color:var(--text-muted);text-transform:none;letter-spacing:0">(Markdown supported)</span></label>
          <textarea class="form-textarea" id="modal-ann-body" placeholder="Supports **bold**, *italic*, - lists, etc.">${isEdit ? esc(ann.body) : ''}</textarea>
        </div>
        <div class="toggle-group">
          <label class="toggle">
            <input type="checkbox" id="modal-ann-published" ${isEdit ? (ann.published ? 'checked' : '') : 'checked'}>
            <span class="toggle-slider"></span>
          </label>
          <span class="toggle-label">Published</span>
        </div>
        <div class="toggle-group">
          <label class="toggle">
            <input type="checkbox" id="modal-ann-pinned" ${isEdit && ann.pinned ? 'checked' : ''}>
            <span class="toggle-slider"></span>
          </label>
          <span class="toggle-label">📌 Pinned (shows on TV page, max 4)</span>
        </div>
        <div class="modal-actions">
          <button class="btn btn-secondary" id="modal-ann-cancel">Cancel</button>
          <button class="btn btn-primary" id="modal-ann-save">${isEdit ? 'Update' : 'Create'}</button>
        </div>
      </div>
    `;
    document.body.appendChild(overlay);

    overlay.querySelector('#modal-ann-cancel').addEventListener('click', () => overlay.remove());
    overlay.addEventListener('click', (e) => { if (e.target === overlay) overlay.remove(); });

    overlay.querySelector('#modal-ann-save').addEventListener('click', async () => {
      const data = {
        title: document.getElementById('modal-ann-title').value,
        body: document.getElementById('modal-ann-body').value,
        published: document.getElementById('modal-ann-published').checked,
        pinned: document.getElementById('modal-ann-pinned').checked,
      };
      try {
        if (isEdit) {
          await API.updateAnnouncement(ann.id, data);
          showToast('Announcement updated');
        } else {
          await API.createAnnouncement(data);
          showToast('Announcement created');
        }
        overlay.remove();
        await loadAnnouncements();
      } catch (e) {
        showToast((e.errors || ['Save failed']).join(', '), 'error');
      }
    });
  }
}
