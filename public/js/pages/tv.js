/* ============================================
   VibeTracker — TV Leaderboard Page
   ============================================ */
async function TvPage(app) {
  let refreshInterval = null;
  let clockInterval = null;
  let currentPage = 0;
  let pageCount = 1;
  let currentSettings = null; // Store settings for clock update
  const TEAMS_PER_PAGE = 8;
  const PROJECT_STATUS_ICONS = { 'Planning': '📋', 'Design': '🎨', 'Coding': '💻', 'Testing': '🧪', 'Deployed!': '🚀' };

  // Full-screen container
  app.innerHTML = `<div class="tv-container" id="tv-root"></div>`;
  app.style.maxWidth = 'none';
  app.style.padding = '0';

  // Render markdown safely
  function renderMd(text) {
    try {
      if (typeof marked !== 'undefined') return marked.parse(text);
      return esc(text);
    } catch (e) {
      return esc(text);
    }
  }

  function updateClock() {
    const el = document.getElementById('tv-timestamp');
    if (!el) return;

    const now = new Date();
    const timeStr = now.toLocaleTimeString(undefined, { hour: '2-digit', minute: '2-digit', second: '2-digit' });
    let content = `<span style="font-variant-numeric: tabular-nums;">${timeStr}</span>`;

    if (currentSettings && currentSettings.countdownTarget) {
      const target = new Date(currentSettings.countdownTarget);
      if (target > now) {
        const diff = target - now;
        const h = Math.floor(diff / 3600000);
        const m = Math.floor((diff % 3600000) / 60000);
        const s = Math.floor((diff % 60000) / 1000);
        const cdStr = `${h}:${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`;
        content = `<span class="tv-countdown">⏱️ ${cdStr}</span><span style="margin:0 0.5rem;opacity:0.3">|</span>` + content;
      }
    }
    el.innerHTML = content;
  }

  async function refresh() {
    try {
      const [scoreData, settings, announcements] = await Promise.all([
        API.getScores(),
        API.getSettings(),
        API.getAnnouncements(true),
      ]);

      currentSettings = settings;

      const { teams, showPartial } = scoreData;
      const pinnedAnns = announcements.filter(a => a.pinned).slice(0, 4);
      const icon = settings.eventIcon || '⚡';

      // Filter teams based on showPartial
      let displayTeams = teams;
      let inProgressTeams = [];
      if (!showPartial) {
        displayTeams = teams.filter(t => t.scoreStatus === 'Complete');
        inProgressTeams = teams.filter(t => t.scoreStatus !== 'Complete');
      }

      // Pagination
      pageCount = Math.max(1, Math.ceil(displayTeams.length / TEAMS_PER_PAGE));
      if (currentPage >= pageCount) currentPage = 0;
      const startIdx = currentPage * TEAMS_PER_PAGE;
      const pageTeams = displayTeams.slice(startIdx, startIdx + TEAMS_PER_PAGE);

      // Build pinned announcements grid (no pin icon)
      let announcementsHtml = '';
      if (pinnedAnns.length > 0) {
        const cards = pinnedAnns.map(ann => `
          <div class="tv-announcement">
            <div class="tv-announcement-title">${esc(ann.title)}</div>
            <div class="tv-announcement-body md-content">${renderMd(ann.body)}</div>
          </div>
        `).join('');
        announcementsHtml = `<div class="tv-announcements-grid tv-announcements-${pinnedAnns.length}">${cards}</div>`;
      }

      const root = document.getElementById('tv-root');
      // Only rebuild if meaningful content changed? For now, rebuild is fine, but we update clock immediately
      root.innerHTML = `
        <div class="tv-header">
          <div>
            <div class="tv-event-name">${esc(icon)} ${esc(settings.eventName)}</div>
            ${settings.tagline ? `<div class="tv-tagline">${esc(settings.tagline)}</div>` : ''}
          </div>
          <div class="tv-meta">
            <div class="tv-timestamp" id="tv-timestamp"></div>
            <div style="font-size:0.8rem;color:var(--text-muted)">Auto-refresh ${settings.tvRefreshSeconds}s</div>
          </div>
        </div>
        ${announcementsHtml}
        <div class="tv-table-wrap">
          <table class="tv-table">
            <thead>
              <tr>
                <th class="rank-cell">Rank</th>
                <th>Team</th>
                <th>Project</th>
                <th>Members</th>
                <th style="text-align:center">Business</th>
                <th style="text-align:center">Technical</th>
                <th style="text-align:center">Total</th>
                ${showPartial ? '<th style="text-align:center">Status</th>' : ''}
              </tr>
            </thead>
            <tbody>
              ${pageTeams.length === 0 ? `
                <tr><td colspan="${showPartial ? 8 : 7}" style="text-align:center;padding:3rem;color:var(--text-muted)">
                  No teams to display
                </td></tr>
              ` : pageTeams.map(team => {
        const projStatus = team.projectStatus || 'Planning';
        const projIcon = PROJECT_STATUS_ICONS[projStatus] || '📋';
        const statusClass = `project-status-${projStatus.toLowerCase().replace('!', '')}`;
        return `
                <tr>
                  <td class="rank-cell">
                    <span class="tv-rank ${team.rank <= 3 ? `tv-rank-${team.rank}` : 'tv-rank-other'}">${team.rank}</span>
                  </td>
                  <td>
                    <div class="tv-team-name">${esc(team.teamName)}</div>
                  </td>
                  <td>
                    <div class="tv-project-name">${esc(team.projectName)}</div>
                    <div class="project-status-pill ${statusClass}" style="margin-bottom:0.3rem">${projIcon} ${esc(projStatus)}</div>
                    ${team.description ? `<div class="tv-project-desc">${esc(team.description)}</div>` : ''}
                  </td>
                  <td>
                    <div class="tv-members">${team.members.map(m => esc(m)).join(', ')}</div>
                  </td>
                  <td class="tv-score">${team.businessSubtotal}</td>
                  <td class="tv-score">${team.technicalSubtotal}</td>
                  <td class="tv-score tv-total">${team.total}</td>
                  ${showPartial ? `<td style="text-align:center"><span class="badge ${team.scoreStatus === 'Complete' ? 'badge-success' : 'badge-warning'}">${team.scoreStatus}</span></td>` : ''}
                </tr>
              `}).join('')}
            </tbody>
          </table>
        </div>
        ${pageCount > 1 ? `
          <div class="tv-page-indicator">
            ${Array.from({ length: pageCount }, (_, i) => `
              <div class="tv-page-dot ${i === currentPage ? 'active' : ''}"></div>
            `).join('')}
          </div>
        ` : ''}
        ${!showPartial && inProgressTeams.length > 0 ? `
          <div style="margin-top:1rem;padding:0.75rem 1.25rem;background:var(--bg-card);border:1px solid var(--border);border-radius:var(--radius-lg)">
            <div style="font-size:0.85rem;color:var(--text-muted);margin-bottom:0.35rem">In Progress</div>
            <div style="color:var(--text-secondary);font-size:0.9rem">
              ${inProgressTeams.map(t => esc(t.teamName)).join(' · ')}
            </div>
          </div>
        ` : ''}
      `;

      updateClock(); // Initial update after render

      // Advance page for next refresh
      currentPage = (currentPage + 1) % pageCount;

      // Update refresh interval if settings changed
      const newInterval = (settings.tvRefreshSeconds || 15) * 1000;
      if (refreshInterval && refreshInterval._interval !== newInterval) {
        clearInterval(refreshInterval);
        refreshInterval = setInterval(refresh, newInterval);
        refreshInterval._interval = newInterval;
      }

    } catch (e) {
      console.error('TV refresh error:', e);
    }
  }

  // Initial load
  await refresh();

  // Start auto-refresh
  const settings = await API.getSettings();
  const intervalMs = (settings.tvRefreshSeconds || 15) * 1000;
  refreshInterval = setInterval(refresh, intervalMs);
  refreshInterval._interval = intervalMs;

  // Start clock interval
  clockInterval = setInterval(updateClock, 1000);

  // Return cleanup function
  return () => {
    if (refreshInterval) clearInterval(refreshInterval);
    if (clockInterval) clearInterval(clockInterval);
    app.style.maxWidth = '';
    app.style.padding = '';
  };
}
