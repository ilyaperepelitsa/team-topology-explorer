// ======================================================
// SIDEBAR NAVIGATION
// ======================================================
import { CATS } from '../data/categories.js';
import { TEAMS } from '../data/teams.js';

/**
 * Build the sidebar navigation with category groups and team items
 * @param {string} query - search filter
 * @param {Object|null} currentTeam - currently selected team
 * @param {Function} onTeamSelect - callback when team is clicked
 */
export function buildNav(query = '', currentTeam = null, onTeamSelect) {
  const el = document.getElementById('sidebar-scroll');
  el.innerHTML = '';
  const q = query.toLowerCase();

  Object.entries(CATS).forEach(([key, cat]) => {
    const teams = TEAMS.filter(t => t.cat === key && (!q || t.name.toLowerCase().includes(q)));
    if (!teams.length) return;

    const g = document.createElement('div');
    g.className = 'cat-group';
    g.innerHTML = `
      <div class="cat-hdr">
        <span class="cat-dot" style="background:${cat.color};box-shadow:0 0 5px ${cat.color}44"></span>
        <span class="cat-lbl">${cat.label}</span>
        <span class="cat-cnt">${teams.length}</span>
        <span class="cat-chv">&#9660;</span>
      </div>
      <div class="cat-items"></div>`;

    const items = g.querySelector('.cat-items');
    teams.forEach(t => {
      const d = document.createElement('div');
      d.className = 't-item' + (currentTeam?.id === t.id ? ' active' : '');
      d.innerHTML = `<span class="t-name">${t.name}</span><span class="t-topo">${t.topo}</span>`;
      d.onclick = () => onTeamSelect(t.id);
      items.appendChild(d);
    });

    g.querySelector('.cat-hdr').onclick = () => g.classList.toggle('closed');
    el.appendChild(g);
  });
}

/**
 * Get summary stats for the welcome screen
 */
export function getGlobalStats() {
  const totalTeams = TEAMS.length;
  const totalCategories = Object.keys(CATS).length;
  const totalRoles = TEAMS.reduce((sum, t) => sum + t.roles.length, 0);
  const totalEdges = TEAMS.reduce((sum, t) => sum + t.edges.length, 0);
  const avgDensity = TEAMS.reduce((sum, t) => sum + t.dens, 0) / totalTeams;

  return { totalTeams, totalCategories, totalRoles, totalEdges, avgDensity };
}
