// ======================================================
// RIGHT DETAIL PANEL + TOP ROLES BAR
// ======================================================
import { CATS } from '../data/categories.js';
import { TEAMS } from '../data/teams.js';
import { XLINKS } from '../data/crosslinks.js';
import { EDGE_COLORS, ROLE_COLORS, classifyRole } from '../data/colors.js';
import { analyzeTeam } from '../analysis.js';

/**
 * Render the roles bar (horizontal strip above graph)
 */
export function renderRolesBar(team, selectedRoleId) {
  if (!team) return;
  const cat = CATS[team.cat];
  const bar = document.getElementById('rolesbar');
  const rolesEl = document.getElementById('rolesbar-roles');
  const legendsEl = document.getElementById('rolesbar-legends');
  bar.style.display = 'flex';

  // Roles as compact chips
  let rolesHtml = '';
  team.roles.forEach(r => {
    const rc = classifyRole(r);
    const nc = ROLE_COLORS[rc] || cat.color;
    const isActive = selectedRoleId === r.id;
    rolesHtml += `<button class="rb-role ${isActive ? 'active' : ''}" onclick="window.__selectRole('${r.id}')" style="--rc:${nc}" title="${r.desc}">
      <span class="rb-dot" style="background:${nc};${r.leader ? 'border-radius:2px' : ''}"></span>
      <span class="rb-label">${r.label}</span>
      ${r.leader ? '<span class="rb-leader">L</span>' : ''}
    </button>`;
  });
  rolesEl.innerHTML = rolesHtml;

  // Legends: node types + edge types inline
  const usedRoleClasses = [...new Set(team.roles.map(r => classifyRole(r)))];
  const edgeTypes = [...new Set(team.edges.map(e => e.type))];

  let legendHtml = '<div class="rb-legend-group">';
  usedRoleClasses.forEach(rc => {
    const c = ROLE_COLORS[rc] || cat.color;
    legendHtml += `<span class="rb-legend" style="color:${c}"><span class="rb-ldot" style="background:${c}"></span>${rc}</span>`;
  });
  legendHtml += '</div><div class="rb-legend-sep"></div><div class="rb-legend-group">';
  edgeTypes.forEach(et => {
    const ec = EDGE_COLORS[et] || '#707070';
    const isCmd = et === 'command';
    legendHtml += `<span class="rb-legend rb-edge" style="color:${ec}"><span class="rb-eline ${isCmd ? '' : 'dashed'}" style="background:${ec}"></span>${et}</span>`;
  });
  legendHtml += '</div>';
  legendsEl.innerHTML = legendHtml;
}

/**
 * Render team detail view — TEXT ONLY (intelligence, description, comms, strengths)
 */
export function showTeamDetail(team, selectedRoleId, onRoleClick, onTeamClick) {
  if (!team) return;
  const cat = CATS[team.cat];
  const panel = document.getElementById('detail');
  const dp = document.getElementById('dp');
  panel.classList.add('open');

  // Run intelligence analysis
  const analysis = analyzeTeam(team);

  // Cross-links
  const conns = XLINKS
    .filter(x => x.s === team.id || x.t === team.id)
    .map(x => {
      const oid = x.s === team.id ? x.t : x.s;
      const other = TEAMS.find(tt => tt.id === oid);
      return other ? { team: other, rel: x.r } : null;
    })
    .filter(Boolean);

  let html = '';

  // Team header (compact)
  html += `
    <div class="detail-header" style="--cat-color:${cat.color}">
      <div class="detail-title" style="color:${cat.color}">${team.name}</div>
      <div class="detail-meta">
        <span class="detail-cat" style="color:${cat.color}">${cat.label}</span>
        <span class="detail-sep">&middot;</span>
        <span class="detail-size">${team.size} people</span>
        <span class="detail-sep">&middot;</span>
        <span class="detail-topo-badge" style="background:${cat.color}12;color:${cat.color};border-color:${cat.color}30">${team.topo}</span>
      </div>
    </div>`;

  // STRUCTURAL INTELLIGENCE — FIRST
  html += `<div class="d-section intelligence-section">
    <div class="section-badge">Structural Intelligence</div>
    <h3>${analysis.insights.length} Insights Computed</h3>`;

  analysis.insights.forEach(insight => {
    html += `
      <div class="insight-card">
        <div class="insight-header">
          <span class="insight-icon">${insight.icon}</span>
          <span class="insight-title">${insight.title}</span>
        </div>
        <div class="insight-text">${insight.text}</div>
      </div>`;
  });
  html += '</div>';

  // Network Properties (compact 3x2 grid)
  html += `
    <div class="d-section">
      <h3>Network Properties</h3>
      <div class="dp-props">
        <div class="dp-prop">
          <div class="dp-prop-l">Density</div>
          <div class="dp-prop-v">${team.dens.toFixed(2)}</div>
          <div class="prop-bar"><div class="prop-bar-fill" style="width:${team.dens * 100}%;background:${cat.color}"></div></div>
        </div>
        <div class="dp-prop">
          <div class="dp-prop-l">Clustering</div>
          <div class="dp-prop-v">${team.clust.toFixed(2)}</div>
          <div class="prop-bar"><div class="prop-bar-fill" style="width:${team.clust * 100}%;background:var(--complement)"></div></div>
        </div>
        <div class="dp-prop">
          <div class="dp-prop-l">Avg Path</div>
          <div class="dp-prop-v">${analysis.metrics.avgPathLength.toFixed(1)}</div>
          <div class="prop-bar"><div class="prop-bar-fill" style="width:${Math.min(analysis.metrics.avgPathLength / 5 * 100, 100)}%;background:#aa88ff"></div></div>
        </div>
        <div class="dp-prop">
          <div class="dp-prop-l">Autonomy</div>
          <div class="dp-prop-v">${(analysis.metrics.autonomyIndex * 100).toFixed(0)}%</div>
          <div class="prop-bar"><div class="prop-bar-fill" style="width:${analysis.metrics.autonomyIndex * 100}%;background:#88ff88"></div></div>
        </div>
        <div class="dp-prop">
          <div class="dp-prop-l">Hierarchy</div>
          <div class="dp-prop-v">${team.hier}</div>
        </div>
        <div class="dp-prop">
          <div class="dp-prop-l">Comm Lines</div>
          <div class="dp-prop-v">${analysis.metrics.commLines}</div>
        </div>
      </div>
    </div>`;

  // Description
  html += `
    <div class="d-section">
      <h3>Description</h3>
      <div class="dp-desc">${team.desc}</div>
    </div>`;

  // Communication
  if (team.comms) {
    html += `<div class="d-section"><h3>Communication Pattern</h3><div class="dp-desc">${team.comms}</div></div>`;
  }

  // Real-world examples
  if (team.ex) {
    html += `<div class="d-section"><h3>Real-World Examples</h3><div class="dp-desc" style="color:var(--accent)">${team.ex}</div></div>`;
  }

  // Strengths & Weaknesses side by side
  if (team.str?.length || team.wk?.length) {
    html += '<div class="d-section">';
    if (team.str?.length) {
      html += `<h3>Strengths</h3><div class="dp-tags" style="margin-bottom:10px">${team.str.map(s => `<span class="dp-tag g">${s}</span>`).join('')}</div>`;
    }
    if (team.wk?.length) {
      html += `<h3>Weaknesses</h3><div class="dp-tags">${team.wk.map(w => `<span class="dp-tag r">${w}</span>`).join('')}</div>`;
    }
    html += '</div>';
  }

  // Related Structures
  if (conns.length) {
    html += `<div class="d-section"><h3>Related Structures (${conns.length})</h3>`;
    conns.forEach(c => {
      const cc = CATS[c.team.cat];
      html += `<div class="dp-conn" onclick="window.__loadTeam('${c.team.id}')"><span style="color:${cc.color}">${c.team.name}</span><span class="dp-conn-rel">${c.rel}</span></div>`;
    });
    html += '</div>';
  }

  dp.innerHTML = html;

  // Also render the roles bar
  renderRolesBar(team, selectedRoleId);
}

/**
 * Render role detail view — shows role info + connections in right panel
 */
export function showRoleDetail(node, team, onBackToTeam, onRoleClick) {
  if (!team) return;
  const cat = CATS[team.cat];
  const role = team.roles.find(r => r.id === node.id);
  const panel = document.getElementById('detail');
  const dp = document.getElementById('dp');
  panel.classList.add('open');

  const roleEdges = team.edges.filter(e => e.s === node.id || e.t === node.id);
  const rc = role ? classifyRole(role) : 'member';
  const nc = ROLE_COLORS[rc] || cat.color;

  let html = `
    <div class="dp-back" onclick="window.__showTeamDetail()">&#8592; Back to ${team.name}</div>
    <div class="detail-header" style="--cat-color:${nc}">
      <div style="display:flex;align-items:center;gap:10px;margin-bottom:6px">
        <span style="display:inline-block;width:14px;height:14px;border-radius:${role?.leader ? '3px' : '50%'};background:${nc};box-shadow:0 0 8px ${nc}66"></span>
        <span class="detail-title" style="color:${nc}">${role?.label || node.name}</span>
      </div>
      <div class="detail-meta">
        <span class="detail-cat" style="color:${nc}">${rc}</span>
        ${role?.leader ? '<span class="leader-badge-sm">Leader</span>' : ''}
        <span class="detail-sep">&middot;</span>
        <span style="font-size:11px;color:var(--slate-400)">${team.name}</span>
      </div>
    </div>

    <div class="d-section">
      <h3>Description</h3>
      <div class="dp-desc">${role?.desc || ''}</div>
    </div>

    <div class="d-section">
      <h3>Connections (${roleEdges.length})</h3>`;

  roleEdges.forEach(e => {
    const otherId = e.s === node.id ? e.t : e.s;
    const other = team.roles.find(r => r.id === otherId);
    const otherRc = other ? classifyRole(other) : 'member';
    const otherColor = ROLE_COLORS[otherRc] || cat.color;
    const ec = EDGE_COLORS[e.type] || '#707070';
    const isOutgoing = e.s === node.id;
    html += `<div class="dp-conn" onclick="window.__selectRole('${otherId}')">
      <span style="display:flex;align-items:center;gap:6px">
        <span style="display:inline-block;width:8px;height:8px;border-radius:50%;background:${otherColor}"></span>
        <span style="color:${otherColor}">${other?.label || otherId}</span>
      </span>
      <span style="display:flex;align-items:center;gap:6px">
        <span style="font-size:10px;color:${ec}">${isOutgoing ? '&#8594;' : '&#8592;'}</span>
        <span class="dp-conn-rel" style="color:${ec};border:1px solid ${ec}33">${e.type}</span>
      </span>
    </div>`;
  });

  html += '</div>';

  // Connection summary
  const outgoing = roleEdges.filter(e => e.s === node.id);
  const incoming = roleEdges.filter(e => e.t === node.id);
  html += `<div class="d-section">
    <h3>Connection Summary</h3>
    <div class="dp-props">
      <div class="dp-prop"><div class="dp-prop-l">Outgoing</div><div class="dp-prop-v">${outgoing.length}</div></div>
      <div class="dp-prop"><div class="dp-prop-l">Incoming</div><div class="dp-prop-v">${incoming.length}</div></div>
      <div class="dp-prop"><div class="dp-prop-l">Total</div><div class="dp-prop-v">${roleEdges.length}</div></div>
      <div class="dp-prop"><div class="dp-prop-l">Role Type</div><div class="dp-prop-v" style="color:${nc}">${rc}</div></div>
    </div>
  </div>`;

  // Relationship types
  const roleEdgeTypes = [...new Set(roleEdges.map(e => e.type))];
  html += `<div class="d-section"><h3>Relationship Types</h3><div class="legend-grid">`;
  roleEdgeTypes.forEach(et => {
    const ec = EDGE_COLORS[et] || '#707070';
    html += `<span class="legend-item edge-legend" style="color:${ec};font-family:'JetBrains Mono',monospace;padding:3px 8px;border-radius:5px;border:1px solid ${ec}33;background:${ec}08">${et}</span>`;
  });
  html += '</div></div>';

  dp.innerHTML = html;

  // Highlight selected role in the roles bar
  renderRolesBar(team, node.id);
}
