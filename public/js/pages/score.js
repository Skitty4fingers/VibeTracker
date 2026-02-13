/* ============================================
   VibeTracker — Score Page
   ============================================ */
async function ScorePage(app) {
  let rubric = [];
  let settings = {};
  let currentTeamId = null;

  const PROJECT_STATUSES = ['Planning', 'Design', 'Coding', 'Testing', 'Deployed!'];
  const PROJECT_STATUS_ICONS = { 'Planning': '📋', 'Design': '🎨', 'Coding': '💻', 'Testing': '🧪', 'Deployed!': '🚀' };

  try {
    [rubric, settings] = await Promise.all([
      API.getRubric(),
      API.getSettings(),
    ]);
  } catch (e) {
    app.innerHTML = '<div class="banner banner-danger">Failed to load scoring data</div>';
    return;
  }

  const teams = await API.getTeams();

  // Pre-fetch score status for all teams
  let scoreData = {};
  try {
    const allScores = await API.getScores();
    for (const t of allScores.teams) {
      scoreData[t.teamId] = t;
    }
  } catch (e) { /* fallback: no scores */ }

  // Build page
  let html = `
    <div class="page-header">
      <h1 class="page-title">📝 Score</h1>
      <p class="page-subtitle">Select a team to enter scores against the rubric criteria</p>
    </div>
  `;

  // Lock banner
  if (settings.scoringLocked) {
    html += `<div class="banner banner-danger">🔒 Scoring is locked — scores cannot be modified</div>`;
  }

  // Empty state
  if (teams.length === 0) {
    html += `<div class="empty-state"><span class="empty-state-icon">👥</span><span class="empty-state-text">No teams configured. Go to Setup to add teams.</span></div>`;
    app.innerHTML = html;
    return;
  }

  // Team tiles grid
  html += `<div class="team-tiles" id="team-tiles"></div>`;
  html += `<div id="team-detail-panel" style="display:none"></div>`;
  html += `<div id="score-form-panel" style="display:none"></div>`;
  app.innerHTML = html;

  function renderTiles() {
    const tilesEl = document.getElementById('team-tiles');
    tilesEl.innerHTML = teams.map(t => {
      const sd = scoreData[t.id];
      const status = sd ? sd.scoreStatus : (t.scoreStatus || 'In Progress');
      const projStatus = sd ? sd.projectStatus : (t.projectStatus || 'Planning');
      const total = sd ? sd.total : '—';
      const members = t.members || [];
      const isActive = t.id === currentTeamId;
      const projIcon = PROJECT_STATUS_ICONS[projStatus] || '📋';
      return `
        <div class="team-tile ${isActive ? 'team-tile-active' : ''} ${status === 'Complete' ? 'team-tile-complete' : ''}" data-team-id="${t.id}">
          <div class="team-tile-header">
            <div class="team-tile-name">${esc(t.teamName)}</div>
            <span class="badge ${status === 'Complete' ? 'badge-success' : 'badge-warning'}">${status}</span>
          </div>
          <div class="team-tile-project">${esc(t.projectName)}</div>
          <div class="project-status-pill project-status-${projStatus.toLowerCase().replace('!', '')}">${projIcon} ${projStatus}</div>
          ${t.description ? `<div class="team-tile-desc">${esc(t.description)}</div>` : ''}
          <div class="team-tile-footer">
            <div class="team-tile-members">${members.slice(0, 4).map(m => esc(m)).join(', ')}${members.length > 4 ? ` +${members.length - 4}` : ''}</div>
            <div class="team-tile-total">${total}</div>
          </div>
        </div>
      `;
    }).join('');

    tilesEl.querySelectorAll('.team-tile').forEach(tile => {
      tile.addEventListener('click', async () => {
        const id = parseInt(tile.dataset.teamId, 10);
        currentTeamId = id;
        renderTiles(); // re-render to update active state
        await loadTeamScores(id);
        // Scroll to the scoring form
        document.getElementById('team-detail-panel').scrollIntoView({ behavior: 'smooth', block: 'start' });
      });
    });
  }

  renderTiles();

  async function loadTeamScores(teamId) {
    const team = teams.find(t => t.id === teamId);
    const score = await API.getTeamScore(teamId);
    // Get current statuses from scoreData cache or team
    const currentScoreStatus = (scoreData[teamId] && scoreData[teamId].scoreStatus) || team.scoreStatus || 'In Progress';
    const currentProjectStatus = (scoreData[teamId] && scoreData[teamId].projectStatus) || team.projectStatus || 'Planning';
    const members = team.members || [];

    // Team detail panel
    const detailPanel = document.getElementById('team-detail-panel');
    detailPanel.style.display = 'block';
    detailPanel.innerHTML = `
      <div class="card" style="margin-top:1.5rem">
        <div class="team-detail">
          <div>
            <h2 style="margin-bottom:0.25rem;font-size:1.25rem">${esc(team.teamName)}</h2>
            <div style="color:var(--text-secondary);font-size:0.95rem;margin-bottom:0.75rem">${esc(team.projectName)}</div>
            ${team.description ? `<p style="font-size:0.9rem;color:var(--text-secondary);margin-bottom:0.75rem">${esc(team.description)}</p>` : ''}
            <div class="team-members-list">
              ${members.map(m => `<span class="member-chip">${esc(m)}</span>`).join('')}
            </div>
          </div>
          <div style="text-align:right">
            ${team.repoUrl ? `<a href="${esc(team.repoUrl)}" class="link-chip" target="_blank" style="margin-bottom:0.25rem;display:inline-flex">🔗 Repo</a>` : ''}
            ${team.demoUrl ? `<a href="${esc(team.demoUrl)}" class="link-chip" target="_blank" style="display:inline-flex">🌐 Demo</a>` : ''}
          </div>
        </div>

        <!-- Project Status Stepper -->
        <div class="status-section">
          <div class="status-label">Project Status</div>
          <div class="project-status-stepper" id="project-stepper">
            ${PROJECT_STATUSES.map(s => {
      const icon = PROJECT_STATUS_ICONS[s];
      const isActive = s === currentProjectStatus;
      const idx = PROJECT_STATUSES.indexOf(s);
      const currentIdx = PROJECT_STATUSES.indexOf(currentProjectStatus);
      const isPast = idx < currentIdx;
      return `<button class="stepper-step ${isActive ? 'stepper-active' : ''} ${isPast ? 'stepper-past' : ''}" data-status="${s}">
                <span class="stepper-icon">${icon}</span>
                <span class="stepper-text">${s}</span>
              </button>`;
    }).join('<span class="stepper-arrow">→</span>')}
          </div>
        </div>

        <!-- Score Status Toggle -->
        <div class="status-section">
          <div class="status-label">Scoring Status</div>
          <button class="score-status-toggle ${currentScoreStatus === 'Complete' ? 'score-status-complete' : 'score-status-progress'}" id="score-status-btn">
            <span class="score-status-icon">${currentScoreStatus === 'Complete' ? '✅' : '⏳'}</span>
            <span class="score-status-text">${currentScoreStatus}</span>
          </button>
        </div>
      </div>
    `;

    // Project status stepper clicks
    detailPanel.querySelectorAll('.stepper-step').forEach(btn => {
      btn.addEventListener('click', async () => {
        const newStatus = btn.dataset.status;
        try {
          await API.updateTeamStatus(teamId, { projectStatus: newStatus });
          if (scoreData[teamId]) scoreData[teamId].projectStatus = newStatus;
          team.projectStatus = newStatus;
          renderTiles();
          await loadTeamScores(teamId);
        } catch (e) { showToast('Failed to update project status', 'error'); }
      });
    });

    // Score status toggle click
    const statusBtn = document.getElementById('score-status-btn');
    statusBtn.addEventListener('click', async () => {
      const newStatus = currentScoreStatus === 'Complete' ? 'In Progress' : 'Complete';
      try {
        await API.updateTeamStatus(teamId, { scoreStatus: newStatus });
        if (scoreData[teamId]) scoreData[teamId].scoreStatus = newStatus;
        team.scoreStatus = newStatus;
        renderTiles();
        await loadTeamScores(teamId);
      } catch (e) { showToast('Failed to update score status', 'error'); }
    });

    // Score form
    const formPanel = document.getElementById('score-form-panel');
    formPanel.style.display = 'block';

    const businessRubrics = rubric.filter(r => r.groupName === 'Business');
    const technicalRubrics = rubric.filter(r => r.groupName === 'Technical');
    const disabled = settings.scoringLocked ? 'disabled' : '';

    const renderScoreGroup = (label, cats) => {
      let groupHtml = `<div class="rubric-group-label">${label}</div>`;
      for (const cat of cats) {
        const ci = cat.categoryIndex;
        const val = score[`c${ci}`];
        const hasVal = val != null;
        groupHtml += `
          <div class="slider-row">
            <div class="slider-header">
              <div class="slider-label">
                <span class="score-num">${ci}</span>
                <span class="score-name">${esc(cat.name)}</span>
              </div>
              <span class="slider-value ${hasVal ? '' : 'slider-value-empty'}" id="val-c${ci}">${hasVal ? val : '—'}</span>
            </div>
            ${cat.guidance ? `<div class="slider-guidance">${esc(cat.guidance)}</div>` : ''}
            <div class="slider-track-wrap">
              <span class="slider-bound">1</span>
              <input type="range" class="slider-input" id="score-c${ci}"
                     min="1" max="10" step="1" value="${hasVal ? val : 5}"
                     data-crit="${ci}" data-has-value="${hasVal ? '1' : '0'}" ${disabled}>
              <span class="slider-bound">10</span>
            </div>
          </div>
        `;
      }
      groupHtml += `<div class="score-subtotal"><span>${label} Subtotal</span><span id="subtotal-${label.toLowerCase()}" class="score-subtotal-value">—</span></div>`;
      return groupHtml;
    };

    formPanel.innerHTML = `
      <div class="card">
        <h2 class="card-title">Scores</h2>
        ${renderScoreGroup('Business', businessRubrics)}
        ${renderScoreGroup('Technical', technicalRubrics)}
        <div class="score-total"><span>Total</span><span id="total-display">—</span></div>
        ${!settings.scoringLocked ? `
          <div style="margin-top:1.5rem;display:flex;justify-content:flex-end">
            <button class="btn btn-success" id="save-scores" style="min-width:160px">💾 Save Scores</button>
          </div>
        ` : ''}
      </div>
    `;

    // Live calculation
    function recalculate() {
      let bizSum = 0, techSum = 0, bizCount = 0, techCount = 0;
      for (let i = 1; i <= 5; i++) {
        const slider = document.getElementById(`score-c${i}`);
        if (slider.dataset.hasValue === '1') {
          bizSum += parseInt(slider.value, 10);
          bizCount++;
        }
      }
      for (let i = 6; i <= 10; i++) {
        const slider = document.getElementById(`score-c${i}`);
        if (slider.dataset.hasValue === '1') {
          techSum += parseInt(slider.value, 10);
          techCount++;
        }
      }
      document.getElementById('subtotal-business').textContent = bizCount > 0 ? bizSum : '—';
      document.getElementById('subtotal-technical').textContent = techCount > 0 ? techSum : '—';
      document.getElementById('total-display').textContent = (bizCount + techCount) > 0 ? (bizSum + techSum) : '—';
    }

    recalculate();

    // Slider interaction
    formPanel.querySelectorAll('.slider-input').forEach(slider => {
      slider.addEventListener('input', () => {
        slider.dataset.hasValue = '1';
        const valEl = document.getElementById(`val-c${slider.dataset.crit}`);
        valEl.textContent = slider.value;
        valEl.classList.remove('slider-value-empty');
        updateSliderFill(slider);
        recalculate();
      });
      // Set initial fill
      if (slider.dataset.hasValue === '1') {
        updateSliderFill(slider);
      }
    });

    function updateSliderFill(slider) {
      const pct = ((slider.value - 1) / 9) * 100;
      slider.style.setProperty('--fill', `${pct}%`);
    }

    // Save
    const saveBtn = formPanel.querySelector('#save-scores');
    if (saveBtn) {
      saveBtn.addEventListener('click', async () => {
        const data = {};
        for (let i = 1; i <= 10; i++) {
          const slider = document.getElementById(`score-c${i}`);
          data[`c${i}`] = slider.dataset.hasValue === '1' ? parseInt(slider.value, 10) : null;
        }
        try {
          await API.updateScore(teamId, data);
          showToast('Scores saved');
          // Update local scoreData cache
          const updated = await API.getTeamScore(teamId);
          scoreData[teamId] = updated;
          renderTiles();
          await loadTeamScores(teamId);
        } catch (e) {
          showToast((e.errors || ['Save failed']).join(', '), 'error');
        }
      });
    }
  }
}
