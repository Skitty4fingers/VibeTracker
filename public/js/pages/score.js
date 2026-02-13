/* ============================================
   VibeTracker — Score Page
   ============================================ */
async function ScorePage(app) {
  let rubric = [];
  let settings = {};
  let currentTeamId = null;

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
      const status = sd ? sd.status : 'Not Scored';
      const total = sd ? sd.total : '—';
      const members = t.members || [];
      const isActive = t.id === currentTeamId;
      return `
        <div class="team-tile ${isActive ? 'team-tile-active' : ''} ${status === 'Complete' ? 'team-tile-complete' : ''}" data-team-id="${t.id}">
          <div class="team-tile-header">
            <div class="team-tile-name">${esc(t.teamName)}</div>
            <span class="badge ${status === 'Complete' ? 'badge-success' : status === 'Partial' ? 'badge-warning' : 'badge-accent'}">${status}</span>
          </div>
          <div class="team-tile-project">${esc(t.projectName)}</div>
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
            <div style="margin-top:0.5rem">
              <span class="badge ${score.status === 'Complete' ? 'badge-success' : 'badge-warning'}">${score.status}</span>
            </div>
          </div>
        </div>
      </div>
    `;

    // Score form
    const formPanel = document.getElementById('score-form-panel');
    formPanel.style.display = 'block';

    const businessRubrics = rubric.filter(r => r.groupName === 'Business');
    const technicalRubrics = rubric.filter(r => r.groupName === 'Technical');
    const disabled = settings.scoringLocked ? 'disabled' : '';

    const renderScoreGroup = (label, cats) => {
      let groupHtml = `<div class="rubric-group-label">${label}</div>`;
      for (const cat of cats) {
        const val = score[`c${cat.id}`];
        const hasVal = val != null;
        groupHtml += `
          <div class="slider-row">
            <div class="slider-header">
              <div class="slider-label">
                <span class="score-num">${cat.id}</span>
                <span class="score-name">${esc(cat.name)}</span>
              </div>
              <span class="slider-value ${hasVal ? '' : 'slider-value-empty'}" id="val-c${cat.id}">${hasVal ? val : '—'}</span>
            </div>
            ${cat.guidance ? `<div class="slider-guidance">${esc(cat.guidance)}</div>` : ''}
            <div class="slider-track-wrap">
              <span class="slider-bound">1</span>
              <input type="range" class="slider-input" id="score-c${cat.id}"
                     min="1" max="10" step="1" value="${hasVal ? val : 5}"
                     data-crit="${cat.id}" data-has-value="${hasVal ? '1' : '0'}" ${disabled}>
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
