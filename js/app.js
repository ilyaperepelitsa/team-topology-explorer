// ======================================================
// APP STATE & INITIALIZATION
// Main entry point for the Team Topology Explorer
// ======================================================
import { TEAMS } from './data/teams.js';
import { CATS } from './data/categories.js';
import { buildNav, getGlobalStats } from './components/nav.js';
import { renderGraph, selectRoleInGraph, resetGraph as resetGraphLayout, clearDimming } from './components/graph.js';
import { showTeamDetail, showRoleDetail } from './components/detail.js';

// ── State ──
let currentTeam = null;
let selectedRoleId = null;

// ── Public API (accessible from inline onclick handlers) ──
window.__loadTeam = loadTeam;
window.__selectRole = selectRole;
window.__showTeamDetail = () => {
  selectedRoleId = null;
  clearDimming();
  showTeamDetail(currentTeam, selectedRoleId, selectRole, loadTeam);
};
window.__resetGraph = resetGraphLayout;

// ── Load Team ──
function loadTeam(id) {
  const team = TEAMS.find(t => t.id === id);
  if (!team) return;
  currentTeam = team;
  selectedRoleId = null;
  const cat = CATS[team.cat];

  // Hide welcome
  document.getElementById('welcome').classList.add('hidden');

  // Info bar
  const ib = document.getElementById('infobar');
  ib.style.display = 'flex';
  document.getElementById('ib-name').textContent = team.name;
  document.getElementById('ib-cat').textContent = cat.label;
  document.getElementById('ib-size').textContent = team.size;
  document.getElementById('ib-dens').textContent = team.dens.toFixed(2);
  document.getElementById('ib-clust').textContent = team.clust.toFixed(2);
  document.getElementById('ib-topo').textContent = team.topo;

  // Render graph
  renderGraph(team, {
    onNodeTap: (node) => {
      selectedRoleId = node.id;
      showRoleDetail(node, currentTeam, () => {
        selectedRoleId = null;
        clearDimming();
        showTeamDetail(currentTeam, selectedRoleId, selectRole, loadTeam);
      }, selectRole);
    },
    onBackgroundTap: () => {
      selectedRoleId = null;
      showTeamDetail(currentTeam, selectedRoleId, selectRole, loadTeam);
    },
  });

  // Show detail panel
  showTeamDetail(currentTeam, selectedRoleId, selectRole, loadTeam);

  // Rebuild nav to highlight active
  buildNav(document.getElementById('search').value, currentTeam, loadTeam);
}

// ── Select Role ──
function selectRole(id) {
  selectedRoleId = id;
  const nodeData = selectRoleInGraph(id);
  if (nodeData) {
    showRoleDetail(nodeData, currentTeam, () => {
      selectedRoleId = null;
      clearDimming();
      showTeamDetail(currentTeam, selectedRoleId, selectRole, loadTeam);
    }, selectRole);
  }
  buildNav(document.getElementById('search').value, currentTeam, loadTeam);
}

// ── Welcome Screen Stats ──
function renderWelcomeStats() {
  const stats = getGlobalStats();
  const statsEl = document.getElementById('welcome-stats');
  if (statsEl) {
    statsEl.innerHTML = `
      <div class="welcome-stat">
        <div class="welcome-stat-v">${stats.totalTeams}</div>
        <div class="welcome-stat-l">Structures</div>
      </div>
      <div class="welcome-stat">
        <div class="welcome-stat-v">${stats.totalCategories}</div>
        <div class="welcome-stat-l">Domains</div>
      </div>
      <div class="welcome-stat">
        <div class="welcome-stat-v">${stats.totalRoles}</div>
        <div class="welcome-stat-l">Roles</div>
      </div>
      <div class="welcome-stat">
        <div class="welcome-stat-v">${stats.totalEdges}</div>
        <div class="welcome-stat-l">Relationships</div>
      </div>`;
  }
}

// ── Init ──
buildNav('', null, loadTeam);
renderWelcomeStats();

// Search
document.getElementById('search').oninput = e => buildNav(e.target.value, currentTeam, loadTeam);

// Keyboard
document.addEventListener('keydown', e => {
  if (e.key === 'Escape') {
    if (selectedRoleId) {
      selectedRoleId = null;
      clearDimming();
      showTeamDetail(currentTeam, selectedRoleId, selectRole, loadTeam);
    }
  }
});
