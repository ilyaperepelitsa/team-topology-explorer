// ======================================================
// ANALYSIS LAB - UI RENDERING MODULE
// Builds HTML and manages DOM for Regression, Recommender,
// and Neo4j tabs in the Analysis Lab page.
// ======================================================
import { CATS } from '../data/categories.js';
import { TEAMS } from '../data/teams.js';
import { EDGE_COLORS, ROLE_COLORS, classifyRole } from '../data/colors.js';

// ── CSS constants (mirrors :root in styles.css) ──
const C = {
  brand:      '#0b1220',
  accent:     '#c88076',
  complement: '#80cbc4',
  slate200:   '#e2e8f0',
  slate400:   '#94a3b8',
  slate500:   '#64748b',
  cardBg:     'rgba(15, 23, 42, 0.55)',
  cardBorder: '1px solid rgba(51, 65, 85, 0.5)',
  cardRadius: '12px',
  pageBg:     '#0b0f0e',
  transition: '0.18s cubic-bezier(0.4, 0, 0.2, 1)',
};

const FONT_TEXT = "'Inter', system-ui, -apple-system, sans-serif";
const FONT_MONO = "'JetBrains Mono', monospace";

// Category color map (for scatter plot dots)
const CAT_COLORS = {};
Object.entries(CATS).forEach(([key, cat]) => { CAT_COLORS[key] = cat.color; });

// ══════════════════════════════════════════════════════
// SHARED STYLES
// ══════════════════════════════════════════════════════
const sectionTitleStyle = `
  font-size:9px; text-transform:uppercase; letter-spacing:2px;
  color:${C.slate500}; margin-bottom:10px; font-weight:600;
  font-family:${FONT_TEXT};
`;

const cardStyle = `
  background:${C.cardBg}; border:${C.cardBorder};
  border-radius:${C.cardRadius}; padding:16px;
  box-shadow:0 1px 3px rgba(0,0,0,0.15);
  margin-bottom:14px;
`;

const btnStyle = `
  display:inline-flex; align-items:center; gap:6px;
  padding:8px 18px; border-radius:8px; border:1px solid rgba(200,128,118,0.3);
  background:linear-gradient(180deg,rgba(200,128,118,0.15),rgba(179,109,100,0.1));
  color:${C.accent}; font-family:${FONT_MONO}; font-size:12px; font-weight:600;
  cursor:pointer; transition:all ${C.transition};
`;

const btnHover = `
  onmouseenter="this.style.background='rgba(200,128,118,0.25)';this.style.borderColor='${C.accent}'"
  onmouseleave="this.style.background='linear-gradient(180deg,rgba(200,128,118,0.15),rgba(179,109,100,0.1))';this.style.borderColor='rgba(200,128,118,0.3)'"
`;

const inputStyle = `
  width:100%; padding:8px 12px; border-radius:8px;
  border:1px solid rgba(51,65,85,0.5);
  background:rgba(15,23,42,0.5); color:${C.slate200};
  font:13px ${FONT_TEXT}; outline:none;
  transition:border-color ${C.transition}, box-shadow ${C.transition};
`;

const monoInputStyle = `
  width:100%; padding:10px 14px; border-radius:8px;
  border:1px solid rgba(51,65,85,0.5);
  background:rgba(11,18,32,0.7); color:${C.slate200};
  font:13px ${FONT_MONO}; outline:none; resize:vertical;
  transition:border-color ${C.transition}, box-shadow ${C.transition};
`;

const sliderTrackStyle = `
  -webkit-appearance:none; appearance:none; width:100%; height:4px;
  border-radius:2px; background:rgba(51,65,85,0.5); outline:none;
  cursor:pointer;
`;

// ══════════════════════════════════════════════════════
// 1. REGRESSION TAB
// ══════════════════════════════════════════════════════

/**
 * Render the Regression analysis tab.
 * @param {HTMLElement} container - DOM element to render into
 * @param {string[]} allFeatures - list of feature names
 * @param {Object} regressionFns - { correlationMatrix, tagCorrelations, linearRegression, groupAnalysis }
 */
export function renderRegressionTab(container, allFeatures, regressionFns) {
  const { correlationMatrix, tagCorrelations, linearRegression } = regressionFns;

  // Extract feature names and build numeric matrix from allFeatures objects
  const featureNames = allFeatures.length > 0 ? Object.keys(allFeatures[0].features) : [];
  const featureMatrix = allFeatures.map(item => item.features);

  // Compute correlation matrix (expects: featureNames[], featureMatrix[])
  const { labels: corrLabels, matrix } = correlationMatrix(featureNames, featureMatrix);

  // Compute tag correlations (expects: allFeatures[], tagType)
  const strengthTags = tagCorrelations(allFeatures, 'strengths');
  const weaknessTags = tagCorrelations(allFeatures, 'weaknesses');
  const tagData = { strengths: strengthTags, weaknesses: weaknessTags };

  // Cache feature data arrays for scatter plots
  const featureArrays = {};
  featureNames.forEach(name => {
    featureArrays[name] = allFeatures.map(item => item.features[name] || 0);
  });

  // Build heatmap HTML
  let html = '';

  // ── Correlation Heatmap ──
  html += `<div style="${cardStyle}">
    <h3 style="${sectionTitleStyle}">Correlation Heatmap</h3>
    <div style="overflow-x:auto;overflow-y:auto;max-height:520px;">
      <table id="lab-heatmap" style="border-collapse:collapse;font:10px ${FONT_MONO};">
        <thead><tr>
          <th style="padding:4px 6px;position:sticky;top:0;left:0;z-index:2;background:${C.brand};"></th>`;

  featureNames.forEach(f => {
    html += `<th style="
      padding:4px 6px;writing-mode:vertical-lr;text-orientation:mixed;
      max-width:28px;color:${C.slate400};font-weight:500;
      position:sticky;top:0;z-index:1;background:${C.brand};
      white-space:nowrap;font-size:9px;
    ">${f}</th>`;
  });

  html += '</tr></thead><tbody>';

  featureNames.forEach((rowF, ri) => {
    html += `<tr><td style="
      padding:4px 8px;white-space:nowrap;color:${C.slate400};font-weight:500;
      position:sticky;left:0;z-index:1;background:${C.brand};font-size:9px;
    ">${rowF}</td>`;

    featureNames.forEach((colF, ci) => {
      const r = matrix[ri][ci];
      const bg = _corrColor(r);
      const textColor = Math.abs(r) > 0.6 ? '#fff' : C.slate200;
      html += `<td
        class="hm-cell"
        data-row="${ri}" data-col="${ci}"
        data-row-feature="${rowF}" data-col-feature="${colF}"
        style="
          padding:3px 5px;text-align:center;cursor:pointer;
          background:${bg};color:${textColor};min-width:36px;
          font-size:10px;font-family:${FONT_MONO};
          border:1px solid rgba(51,65,85,0.15);
          transition:transform 0.1s ease;
        "
        onmouseenter="this.style.transform='scale(1.15)';this.style.zIndex='5';this.style.boxShadow='0 2px 8px rgba(0,0,0,0.4)'"
        onmouseleave="this.style.transform='scale(1)';this.style.zIndex='0';this.style.boxShadow='none'"
      >${r.toFixed(2)}</td>`;
    });

    html += '</tr>';
  });

  html += '</tbody></table></div></div>';

  // ── Tag Analysis ──
  html += `<div style="${cardStyle}">
    <h3 style="${sectionTitleStyle}">Tag Analysis</h3>`;

  if (tagData.strengths && tagData.strengths.length > 0) {
    html += _renderTagTable('Strengths', tagData.strengths, C.complement);
  }
  if (tagData.weaknesses && tagData.weaknesses.length > 0) {
    html += _renderTagTable('Weaknesses', tagData.weaknesses, '#f07068');
  }

  html += '</div>';

  // ── Scatter Plot Area ──
  html += `<div id="lab-scatter-wrap" style="${cardStyle}display:none;">
    <h3 style="${sectionTitleStyle}" id="lab-scatter-title">Scatter Plot</h3>
    <div style="display:flex;gap:16px;align-items:flex-start;flex-wrap:wrap;">
      <canvas id="lab-scatter-canvas" width="500" height="400"
        style="border-radius:8px;background:rgba(11,18,32,0.6);border:1px solid rgba(51,65,85,0.3);"></canvas>
      <div id="lab-scatter-stats" style="
        font:12px ${FONT_MONO};color:${C.slate400};line-height:2;
        padding:12px 16px;background:rgba(11,18,32,0.4);
        border-radius:8px;border:1px solid rgba(51,65,85,0.25);
        min-width:200px;
      "></div>
    </div>
    <div id="lab-scatter-legend" style="
      display:flex;flex-wrap:wrap;gap:8px;margin-top:12px;
    "></div>
  </div>`;

  container.innerHTML = html;

  // ── Heatmap cell click handler ──
  container.querySelectorAll('.hm-cell').forEach(cell => {
    cell.addEventListener('click', () => {
      const rowFeature = cell.dataset.rowFeature;
      const colFeature = cell.dataset.colFeature;
      if (rowFeature === colFeature) return;

      // Get actual numeric arrays for the two features
      const xArr = featureArrays[rowFeature];
      const yArr = featureArrays[colFeature];
      if (!xArr || !yArr) return;

      const result = linearRegression(xArr, yArr);
      if (!result) return;

      const scatterWrap = document.getElementById('lab-scatter-wrap');
      scatterWrap.style.display = 'block';
      document.getElementById('lab-scatter-title').textContent =
        `${rowFeature} vs ${colFeature}`;

      const canvas = document.getElementById('lab-scatter-canvas');
      const statsEl = document.getElementById('lab-scatter-stats');
      const legendEl = document.getElementById('lab-scatter-legend');

      const teamObjs = allFeatures.map(item => item.team);
      renderScatterPlot(canvas, xArr, yArr, rowFeature, colFeature, teamObjs, Object.keys(CATS));

      // Stats — use actual return property names from regression.js: slope, intercept, r2, p, equation
      const r = Math.sqrt(Math.abs(result.r2)) * (result.slope >= 0 ? 1 : -1);
      statsEl.innerHTML = `
        <div style="color:${C.accent};font-weight:700;margin-bottom:6px;">Regression</div>
        <div>y = <span style="color:${C.slate200}">${result.slope.toFixed(4)}</span>x +
             <span style="color:${C.slate200}">${result.intercept.toFixed(4)}</span></div>
        <div>R&sup2; = <span style="color:${C.complement};font-weight:700;">${result.r2.toFixed(4)}</span></div>
        <div>r = <span style="color:${C.slate200}">${r.toFixed(4)}</span></div>
        <div>p-value = <span style="color:${result.p < 0.05 ? C.complement : '#f07068'};font-weight:700;">
          ${result.p < 0.001 ? result.p.toExponential(2) : result.p.toFixed(4)}</span></div>
        <div>n = <span style="color:${C.slate200}">${allFeatures.length}</span></div>
        <div style="margin-top:8px;font-size:10px;color:${C.slate500};">
          ${result.p < 0.05 ? 'Statistically significant (p < 0.05)' : 'Not statistically significant'}
        </div>
      `;

      // Legend
      const usedCats = [...new Set(teamObjs.map(t => t.cat))];
      legendEl.innerHTML = usedCats.map(catKey => {
        const cat = CATS[catKey];
        if (!cat) return '';
        return `<span style="
          display:inline-flex;align-items:center;gap:5px;
          font-size:11px;font-weight:500;color:${C.slate400};
          padding:2px 8px;border-radius:5px;
          border:1px solid rgba(51,65,85,0.25);
          background:rgba(15,23,42,0.3);
        "><span style="
          width:8px;height:8px;border-radius:50%;background:${cat.color};
        "></span>${cat.label}</span>`;
      }).join('');

      scatterWrap.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
    });
  });
}


// ══════════════════════════════════════════════════════
// 2. RECOMMENDER TAB
// ══════════════════════════════════════════════════════

/**
 * Render the Recommender tab.
 * @param {HTMLElement} container - DOM element to render into
 * @param {string[]} allFeatures - list of feature names
 * @param {Function} recommendFn - recommendStructures(params)
 * @param {Function} getDefaultsFn - getDefaultConstraints()
 */
export function renderRecommenderTab(container, allFeatures, recommendFn, getDefaultsFn) {
  const defaults = getDefaultsFn ? getDefaultsFn() : {};

  const sliders = [
    { key: 'decisionSpeed',     label: 'Decision Speed',        desc: 'How fast must decisions be made?' },
    { key: 'riskTolerance',     label: 'Risk Tolerance',        desc: 'Willingness to accept failure' },
    { key: 'autonomyDesired',   label: 'Autonomy Desired',      desc: 'Team self-governance level' },
    { key: 'commOverheadOK',    label: 'Comm Overhead OK',      desc: 'Tolerance for coordination cost' },
    { key: 'hierarchyTolerance',label: 'Hierarchy Tolerance',   desc: 'Comfort with chain of command' },
    { key: 'resilienceNeeded',  label: 'Resilience Needed',     desc: 'How critical is fault tolerance?' },
    { key: 'innovationFocus',   label: 'Innovation Focus',      desc: 'Priority on novel solutions' },
  ];

  const outcomes = [
    { key: 'speed',          label: 'Speed' },
    { key: 'cohesion',       label: 'Cohesion' },
    { key: 'autonomy',       label: 'Autonomy' },
    { key: 'accountability', label: 'Accountability' },
    { key: 'redundancy',     label: 'Redundancy' },
    { key: 'scalable',       label: 'Scalable' },
    { key: 'innovation',     label: 'Innovation' },
  ];

  let html = '';

  // ── Input form ──
  html += `<div style="${cardStyle}">
    <h3 style="${sectionTitleStyle}">Configuration</h3>

    <div style="margin-bottom:16px;">
      <label style="display:block;font-size:11px;color:${C.slate400};margin-bottom:6px;font-weight:600;letter-spacing:0.5px;">
        Team Size
      </label>
      <input id="rec-team-size" type="number" min="2" max="1000" value="${defaults.teamSize || 10}"
        style="${inputStyle}max-width:160px;font-family:${FONT_MONO};"
        onfocus="this.style.borderColor='${C.accent}';this.style.boxShadow='0 0 0 3px rgba(200,128,118,0.1)'"
        onblur="this.style.borderColor='rgba(51,65,85,0.5)';this.style.boxShadow='none'"
      >
    </div>

    <div style="display:grid;grid-template-columns:1fr 1fr;gap:14px 24px;margin-bottom:20px;">`;

  sliders.forEach(s => {
    const defaultVal = (defaults[s.key] != null) ? defaults[s.key] : 3;
    html += `
      <div>
        <div style="display:flex;justify-content:space-between;align-items:baseline;margin-bottom:4px;">
          <label style="font-size:11px;color:${C.slate400};font-weight:600;">${s.label}</label>
          <span id="rec-val-${s.key}" style="font:12px ${FONT_MONO};color:${C.accent};font-weight:700;">${defaultVal}</span>
        </div>
        <input id="rec-${s.key}" type="range" min="1" max="5" value="${defaultVal}"
          style="${sliderTrackStyle}"
          oninput="document.getElementById('rec-val-${s.key}').textContent=this.value"
        >
        <div style="font-size:9px;color:${C.slate500};margin-top:2px;">${s.desc}</div>
      </div>`;
  });

  html += `</div>

    <div style="margin-bottom:16px;">
      <label style="display:block;font-size:11px;color:${C.slate400};margin-bottom:8px;font-weight:600;letter-spacing:0.5px;">
        Desired Outcomes
      </label>
      <div style="display:flex;flex-wrap:wrap;gap:8px;">`;

  outcomes.forEach(o => {
    const checked = defaults.outcomes?.includes(o.key) ? 'checked' : '';
    html += `
      <label style="
        display:inline-flex;align-items:center;gap:6px;
        padding:6px 12px;border-radius:8px;cursor:pointer;
        border:1px solid rgba(51,65,85,0.4);
        background:rgba(15,23,42,0.4);color:${C.slate400};
        font-size:12px;font-weight:500;
        transition:all ${C.transition};
      "
        onmouseenter="this.style.borderColor='rgba(128,203,196,0.3)';this.style.background='rgba(128,203,196,0.06)'"
        onmouseleave="if(!this.querySelector('input').checked){this.style.borderColor='rgba(51,65,85,0.4)';this.style.background='rgba(15,23,42,0.4)';this.style.color='${C.slate400}'}"
      >
        <input type="checkbox" class="rec-outcome" value="${o.key}" ${checked}
          style="accent-color:${C.complement};width:14px;height:14px;"
          onchange="const l=this.parentElement;if(this.checked){l.style.borderColor='rgba(128,203,196,0.4)';l.style.background='rgba(128,203,196,0.1)';l.style.color='${C.complement}'}else{l.style.borderColor='rgba(51,65,85,0.4)';l.style.background='rgba(15,23,42,0.4)';l.style.color='${C.slate400}'}"
        >
        ${o.label}
      </label>`;
  });

  html += `</div>
    </div>

    <button id="rec-run-btn" style="${btnStyle}" ${btnHover}>
      Recommend
    </button>
  </div>`;

  // ── Results area ──
  html += `<div id="rec-results" style="display:flex;flex-direction:column;gap:12px;"></div>`;

  container.innerHTML = html;

  // ── Run button handler ──
  document.getElementById('rec-run-btn').addEventListener('click', () => {
    const params = {
      teamSize: parseInt(document.getElementById('rec-team-size').value, 10) || 10,
      tags: [...container.querySelectorAll('.rec-outcome:checked')].map(cb => cb.value),
    };

    sliders.forEach(s => {
      params[s.key] = parseInt(document.getElementById(`rec-${s.key}`).value, 10);
    });

    const results = recommendFn(params, allFeatures);
    _renderRecommenderResults(results);
  });
}

/**
 * Render recommender results as ranked team cards.
 */
function _renderRecommenderResults(results) {
  const el = document.getElementById('rec-results');
  if (!results || results.length === 0) {
    el.innerHTML = `<div style="${cardStyle}text-align:center;padding:32px;">
      <div style="font-size:14px;color:${C.slate500};">No matching structures found.</div>
      <div style="font-size:11px;color:${C.slate500};margin-top:6px;">Try adjusting your parameters.</div>
    </div>`;
    return;
  }

  let html = `<div style="font-size:11px;color:${C.slate500};margin-bottom:4px;font-weight:500;">
    ${results.length} structure${results.length !== 1 ? 's' : ''} ranked by fit score
  </div>`;

  results.forEach((item, idx) => {
    const team = item.team || {};
    const cat = CATS[team.cat] || {};
    const score = Math.round((item.score || 0) * 100);
    const scoreColor = score >= 70 ? C.complement : score >= 40 ? '#ffcc44' : '#f07068';

    html += `<div style="${cardStyle}position:relative;overflow:hidden;">
      <div style="position:absolute;top:0;left:0;right:0;height:2px;background:linear-gradient(90deg,${scoreColor},transparent);"></div>

      <div style="display:flex;align-items:center;gap:12px;margin-bottom:10px;">
        <span style="
          font:24px ${FONT_MONO};font-weight:800;color:rgba(255,255,255,0.08);
          min-width:36px;text-align:right;
        ">${idx + 1}</span>
        <div style="flex:1;">
          <div style="font-size:15px;font-weight:700;color:${cat.color || C.slate200};letter-spacing:-0.01em;">
            ${team.name || 'Unknown'}
          </div>
          <div style="display:flex;align-items:center;gap:8px;margin-top:3px;">
            <span style="font-size:10px;text-transform:uppercase;letter-spacing:1.5px;color:${C.slate500};font-weight:600;">
              ${cat.label || team.cat || ''}
            </span>
            <span style="font-size:10px;color:${C.slate500};">&middot;</span>
            <span style="
              font-size:10px;font-family:${FONT_MONO};
              padding:2px 8px;border-radius:6px;
              background:${cat.color ? cat.color + '12' : 'rgba(51,65,85,0.3)'};
              color:${cat.color || C.slate400};
              border:1px solid ${cat.color ? cat.color + '30' : 'rgba(51,65,85,0.4)'};
            ">${team.topo || ''}</span>
          </div>
        </div>
      </div>

      <!-- Score bar -->
      <div style="margin-bottom:12px;">
        <div style="display:flex;justify-content:space-between;align-items:baseline;margin-bottom:4px;">
          <span style="font-size:9px;text-transform:uppercase;letter-spacing:1px;color:${C.slate500};font-weight:600;">Fit Score</span>
          <span style="font:14px ${FONT_MONO};font-weight:700;color:${scoreColor};">${score}%</span>
        </div>
        <div style="height:6px;border-radius:3px;background:rgba(255,255,255,0.06);overflow:hidden;">
          <div style="height:100%;width:${score}%;border-radius:3px;background:${scoreColor};
            transition:width 0.5s ease;"></div>
        </div>
      </div>`;

    // Matched tags
    if (item.matchedTags && item.matchedTags.length > 0) {
      html += `<div style="margin-bottom:10px;">
        <span style="font-size:9px;text-transform:uppercase;letter-spacing:1px;color:${C.slate500};font-weight:600;display:block;margin-bottom:6px;">Matched Tags</span>
        <div style="display:flex;flex-wrap:wrap;gap:4px;">`;
      item.matchedTags.forEach(tag => {
        html += `<span style="
          padding:3px 9px;border-radius:6px;font-size:10px;
          color:${C.complement};
          border:1px solid rgba(128,203,196,0.2);
          background:rgba(128,203,196,0.06);
        ">${tag}</span>`;
      });
      html += '</div></div>';
    }

    // Feature breakdown
    if (item.featureBreakdown && item.featureBreakdown.length > 0) {
      html += `<div style="margin-bottom:10px;">
        <span style="font-size:9px;text-transform:uppercase;letter-spacing:1px;color:${C.slate500};font-weight:600;display:block;margin-bottom:6px;">Feature Breakdown</span>
        <div style="display:grid;grid-template-columns:1fr 1fr;gap:4px;">`;
      item.featureBreakdown.forEach(fb => {
        const matchColor = fb.matched ? C.complement : '#f07068';
        const matchIcon = fb.matched ? '&#10003;' : '&#10007;';
        html += `<div style="
          display:flex;align-items:center;gap:6px;
          padding:5px 8px;border-radius:6px;
          background:rgba(11,18,32,0.4);
          border:1px solid rgba(51,65,85,0.25);
          font-size:11px;color:${C.slate400};
        ">
          <span style="color:${matchColor};font-size:10px;">${matchIcon}</span>
          <span style="flex:1;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;">${fb.feature}</span>
          <span style="font-family:${FONT_MONO};font-size:10px;color:${matchColor};">${typeof fb.value === 'number' ? fb.value.toFixed(2) : fb.value || ''}</span>
        </div>`;
      });
      html += '</div></div>';
    }

    // View in Explorer link
    html += `<a href="index.html?team=${team.id}" style="
      display:inline-flex;align-items:center;gap:4px;
      font-size:11px;font-weight:600;color:${C.accent};
      text-decoration:none;margin-top:4px;
      transition:color ${C.transition};
    "
      onmouseenter="this.style.color='${C.complement}'"
      onmouseleave="this.style.color='${C.accent}'"
    >View in Explorer &#8594;</a>`;

    html += '</div>';
  });

  el.innerHTML = html;
}


// ══════════════════════════════════════════════════════
// 3. NEO4J TAB
// ══════════════════════════════════════════════════════

/**
 * Render the Neo4j export/query tab.
 * @param {HTMLElement} container - DOM element to render into
 * @param {string[]} allFeatures - list of feature names
 * @param {Object} neo4jFns - { generateCypherExport, generateCSVExport, executeCypherLikeQuery }
 */
export function renderNeo4jTab(container, allFeatures, neo4jFns) {
  const { generateCypherExport, generateCSVExport, executeCypherLikeQuery } = neo4jFns;

  const exampleQueries = [
    { label: 'All teams', query: 'MATCH (t:Team) RETURN t.name, t.category, t.topology' },
    { label: 'High density teams', query: 'MATCH (t:Team) WHERE t.density > 0.7 RETURN t.name, t.density ORDER BY t.density DESC' },
    { label: 'Teams with mesh topology', query: "MATCH (t:Team) WHERE t.topology CONTAINS 'Mesh' RETURN t.name, t.size, t.topology" },
    { label: 'Role counts per team', query: 'MATCH (t:Team)-[:HAS_ROLE]->(r:Role) RETURN t.name, count(r) AS roles ORDER BY roles DESC' },
    { label: 'Leaders only', query: 'MATCH (t:Team)-[:HAS_ROLE]->(r:Role) WHERE r.leader = true RETURN t.name, r.label' },
    { label: 'Command relationships', query: "MATCH (a:Role)-[e:CONNECTS {type: 'command'}]->(b:Role) RETURN a.label, e.type, b.label LIMIT 20" },
  ];

  let html = '';

  // ── Export Section ──
  html += `<div style="${cardStyle}">
    <h3 style="${sectionTitleStyle}">Export Data</h3>
    <div style="display:flex;gap:12px;flex-wrap:wrap;">
      <button id="neo4j-cypher-btn" style="${btnStyle}" ${btnHover}>
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/></svg>
        Download Cypher
      </button>
      <button id="neo4j-csv-btn" style="${btnStyle}" ${btnHover}>
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/></svg>
        Download CSV
      </button>
    </div>
    <div style="font-size:10px;color:${C.slate500};margin-top:10px;line-height:1.6;">
      Cypher: single .cypher file with CREATE statements for all teams, roles, and edges.<br>
      CSV: generates teams.csv, roles.csv, and edges.csv for Neo4j LOAD CSV import.
    </div>
  </div>`;

  // ── Query Section ──
  html += `<div style="${cardStyle}">
    <h3 style="${sectionTitleStyle}">Query Engine</h3>
    <textarea id="neo4j-query-input" rows="4"
      style="${monoInputStyle}"
      placeholder="MATCH (t:Team) WHERE t.density > 0.5 RETURN t.name, t.density"
      onfocus="this.style.borderColor='${C.accent}';this.style.boxShadow='0 0 0 3px rgba(200,128,118,0.1)'"
      onblur="this.style.borderColor='rgba(51,65,85,0.5)';this.style.boxShadow='none'"
    ></textarea>
    <div style="display:flex;align-items:center;gap:12px;margin-top:10px;">
      <button id="neo4j-run-btn" style="${btnStyle}" ${btnHover}>
        Run Query
      </button>
      <span id="neo4j-query-status" style="font-size:10px;color:${C.slate500};font-family:${FONT_MONO};"></span>
    </div>
  </div>`;

  // ── Results Table ──
  html += `<div id="neo4j-results-wrap" style="${cardStyle}display:none;">
    <h3 style="${sectionTitleStyle}">Results</h3>
    <div id="neo4j-results" style="overflow-x:auto;"></div>
  </div>`;

  // ── Error Display ──
  html += `<div id="neo4j-error-wrap" style="
    ${cardStyle}display:none;
    background:rgba(240,112,104,0.06);
    border:1px solid rgba(240,112,104,0.2);
  ">
    <h3 style="${sectionTitleStyle}color:#f07068;">Error</h3>
    <div id="neo4j-error" style="font:12px ${FONT_MONO};color:#f07068;line-height:1.6;"></div>
  </div>`;

  // ── Example Queries ──
  html += `<div style="${cardStyle}">
    <h3 style="${sectionTitleStyle}">Example Queries</h3>
    <div style="display:flex;flex-direction:column;gap:6px;">`;

  exampleQueries.forEach(eq => {
    html += `<button class="neo4j-example-btn" data-query="${_escapeAttr(eq.query)}" style="
      display:flex;flex-direction:column;gap:3px;
      padding:10px 14px;border-radius:8px;text-align:left;
      border:1px solid rgba(51,65,85,0.35);cursor:pointer;
      background:rgba(11,18,32,0.5);
      transition:all ${C.transition};
    "
      onmouseenter="this.style.background='rgba(200,128,118,0.06)';this.style.borderColor='rgba(200,128,118,0.2)'"
      onmouseleave="this.style.background='rgba(11,18,32,0.5)';this.style.borderColor='rgba(51,65,85,0.35)'"
    >
      <span style="font-size:11px;font-weight:600;color:${C.slate200};">${eq.label}</span>
      <code style="font:10px ${FONT_MONO};color:${C.slate500};word-break:break-all;">${eq.query}</code>
    </button>`;
  });

  html += '</div></div>';

  container.innerHTML = html;

  // ── Export: Cypher download ──
  document.getElementById('neo4j-cypher-btn').addEventListener('click', () => {
    const cypher = generateCypherExport();
    _downloadFile('team-topology-export.cypher', cypher, 'text/plain');
  });

  // ── Export: CSV download ──
  document.getElementById('neo4j-csv-btn').addEventListener('click', () => {
    const csvData = generateCSVExport();
    if (csvData.teams) _downloadFile('teams.csv', csvData.teams, 'text/csv');
    if (csvData.roles) _downloadFile('roles.csv', csvData.roles, 'text/csv');
    if (csvData.edges) _downloadFile('edges.csv', csvData.edges, 'text/csv');
  });

  // ── Run query ──
  document.getElementById('neo4j-run-btn').addEventListener('click', () => {
    _executeNeo4jQuery(executeCypherLikeQuery);
  });

  // ── Enter key in textarea runs query ──
  document.getElementById('neo4j-query-input').addEventListener('keydown', (e) => {
    if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)) {
      e.preventDefault();
      _executeNeo4jQuery(executeCypherLikeQuery);
    }
  });

  // ── Example query click ──
  container.querySelectorAll('.neo4j-example-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      document.getElementById('neo4j-query-input').value = btn.dataset.query;
    });
  });
}

/**
 * Execute a Neo4j-like query and render results.
 */
function _executeNeo4jQuery(executeFn) {
  const input = document.getElementById('neo4j-query-input');
  const query = input.value.trim();
  const statusEl = document.getElementById('neo4j-query-status');
  const resultsWrap = document.getElementById('neo4j-results-wrap');
  const resultsEl = document.getElementById('neo4j-results');
  const errorWrap = document.getElementById('neo4j-error-wrap');
  const errorEl = document.getElementById('neo4j-error');

  if (!query) {
    statusEl.textContent = 'Enter a query first';
    statusEl.style.color = '#f07068';
    return;
  }

  errorWrap.style.display = 'none';
  resultsWrap.style.display = 'none';
  statusEl.textContent = 'Executing...';
  statusEl.style.color = C.slate500;

  try {
    const startTime = performance.now();
    const result = executeFn(query);
    const elapsed = (performance.now() - startTime).toFixed(1);

    if (!result || !result.rows || result.rows.length === 0) {
      statusEl.textContent = `Completed in ${elapsed}ms - no results`;
      statusEl.style.color = C.slate500;
      resultsWrap.style.display = 'block';
      resultsEl.innerHTML = `<div style="text-align:center;padding:20px;color:${C.slate500};font-size:12px;">
        Empty result set
      </div>`;
      return;
    }

    statusEl.textContent = `${result.rows.length} row${result.rows.length !== 1 ? 's' : ''} in ${elapsed}ms`;
    statusEl.style.color = C.complement;

    // Build results table
    const columns = result.columns || Object.keys(result.rows[0]);
    let tableHtml = `<table style="
      width:100%;border-collapse:collapse;
      font:12px ${FONT_MONO};
    ">
    <thead><tr>`;

    columns.forEach(col => {
      tableHtml += `<th style="
        padding:8px 12px;text-align:left;
        font-size:10px;text-transform:uppercase;letter-spacing:1px;
        color:${C.accent};font-weight:600;
        border-bottom:1px solid rgba(51,65,85,0.4);
        background:rgba(11,18,32,0.5);
        position:sticky;top:0;
      ">${col}</th>`;
    });

    tableHtml += '</tr></thead><tbody>';

    result.rows.forEach((row, i) => {
      const stripeBg = i % 2 === 0 ? 'rgba(11,18,32,0.3)' : 'rgba(15,23,42,0.4)';
      tableHtml += `<tr style="background:${stripeBg};transition:background ${C.transition};"
        onmouseenter="this.style.background='rgba(200,128,118,0.06)'"
        onmouseleave="this.style.background='${stripeBg}'"
      >`;
      columns.forEach(col => {
        const val = row[col] != null ? row[col] : '';
        const displayVal = typeof val === 'number' ? val.toFixed(val % 1 === 0 ? 0 : 2) : String(val);
        tableHtml += `<td style="
          padding:7px 12px;color:${C.slate200};
          border-bottom:1px solid rgba(51,65,85,0.15);
          white-space:nowrap;
        ">${_escapeHtml(displayVal)}</td>`;
      });
      tableHtml += '</tr>';
    });

    tableHtml += '</tbody></table>';

    resultsWrap.style.display = 'block';
    resultsEl.innerHTML = tableHtml;

  } catch (err) {
    statusEl.textContent = 'Error';
    statusEl.style.color = '#f07068';
    errorWrap.style.display = 'block';
    errorEl.textContent = err.message || String(err);
  }
}


// ══════════════════════════════════════════════════════
// SCATTER PLOT HELPER
// ══════════════════════════════════════════════════════

/**
 * Draw a scatter plot on a canvas element.
 * @param {HTMLCanvasElement} canvas - target canvas (500x400)
 * @param {number[]} xData - x-axis values
 * @param {number[]} yData - y-axis values
 * @param {string} xLabel - x-axis label
 * @param {string} yLabel - y-axis label
 * @param {Object[]} teams - team objects (need .cat for color)
 * @param {string[]} categories - category keys
 */
export function renderScatterPlot(canvas, xData, yData, xLabel, yLabel, teams, categories) {
  const ctx = canvas.getContext('2d');
  const W = canvas.width;
  const H = canvas.height;

  // Layout margins
  const margin = { top: 24, right: 24, bottom: 52, left: 60 };
  const plotW = W - margin.left - margin.right;
  const plotH = H - margin.top - margin.bottom;

  // Clear
  ctx.clearRect(0, 0, W, H);

  // Background
  ctx.fillStyle = 'rgba(11, 18, 32, 0.6)';
  ctx.fillRect(0, 0, W, H);

  if (!xData || !yData || xData.length === 0) return;

  // Data bounds
  const xMin = Math.min(...xData);
  const xMax = Math.max(...xData);
  const yMin = Math.min(...yData);
  const yMax = Math.max(...yData);
  const xRange = xMax - xMin || 1;
  const yRange = yMax - yMin || 1;
  const xPad = xRange * 0.08;
  const yPad = yRange * 0.08;

  // Map data to pixel coordinates
  function toPixelX(val) {
    return margin.left + ((val - (xMin - xPad)) / (xRange + 2 * xPad)) * plotW;
  }
  function toPixelY(val) {
    return margin.top + plotH - ((val - (yMin - yPad)) / (yRange + 2 * yPad)) * plotH;
  }

  // ── Grid lines ──
  ctx.strokeStyle = 'rgba(51, 65, 85, 0.25)';
  ctx.lineWidth = 0.5;
  const xTicks = _niceTickCount(xMin, xMax, 6);
  const yTicks = _niceTickCount(yMin, yMax, 6);

  ctx.font = `10px ${FONT_MONO}`;
  ctx.fillStyle = C.slate500;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'top';

  xTicks.forEach(v => {
    const px = toPixelX(v);
    if (px < margin.left || px > W - margin.right) return;
    ctx.beginPath();
    ctx.moveTo(px, margin.top);
    ctx.lineTo(px, H - margin.bottom);
    ctx.stroke();
    ctx.fillText(v.toFixed(xRange < 5 ? 2 : 0), px, H - margin.bottom + 6);
  });

  ctx.textAlign = 'right';
  ctx.textBaseline = 'middle';

  yTicks.forEach(v => {
    const py = toPixelY(v);
    if (py < margin.top || py > H - margin.bottom) return;
    ctx.beginPath();
    ctx.moveTo(margin.left, py);
    ctx.lineTo(W - margin.right, py);
    ctx.stroke();
    ctx.fillText(v.toFixed(yRange < 5 ? 2 : 0), margin.left - 6, py);
  });

  // ── Axes ──
  ctx.strokeStyle = 'rgba(51, 65, 85, 0.5)';
  ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.moveTo(margin.left, margin.top);
  ctx.lineTo(margin.left, H - margin.bottom);
  ctx.lineTo(W - margin.right, H - margin.bottom);
  ctx.stroke();

  // ── Axis labels ──
  ctx.fillStyle = C.slate400;
  ctx.font = `11px ${FONT_TEXT}`;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'top';
  ctx.fillText(xLabel, margin.left + plotW / 2, H - 16);

  ctx.save();
  ctx.translate(14, margin.top + plotH / 2);
  ctx.rotate(-Math.PI / 2);
  ctx.textAlign = 'center';
  ctx.textBaseline = 'bottom';
  ctx.fillText(yLabel, 0, 0);
  ctx.restore();

  // ── Compute linear regression for the line ──
  const n = xData.length;
  let sumX = 0, sumY = 0, sumXY = 0, sumX2 = 0;
  for (let i = 0; i < n; i++) {
    sumX += xData[i];
    sumY += yData[i];
    sumXY += xData[i] * yData[i];
    sumX2 += xData[i] * xData[i];
  }
  const denom = n * sumX2 - sumX * sumX;
  const slope = denom !== 0 ? (n * sumXY - sumX * sumY) / denom : 0;
  const intercept = (sumY - slope * sumX) / n;

  // ── Regression line ──
  const lineX0 = xMin - xPad;
  const lineX1 = xMax + xPad;
  const lineY0 = slope * lineX0 + intercept;
  const lineY1 = slope * lineX1 + intercept;

  ctx.strokeStyle = C.accent;
  ctx.lineWidth = 2;
  ctx.setLineDash([6, 4]);
  ctx.beginPath();
  ctx.moveTo(toPixelX(lineX0), toPixelY(lineY0));
  ctx.lineTo(toPixelX(lineX1), toPixelY(lineY1));
  ctx.stroke();
  ctx.setLineDash([]);

  // ── Data points ──
  for (let i = 0; i < n; i++) {
    const team = teams[i];
    const catKey = team ? team.cat : null;
    const color = (catKey && CAT_COLORS[catKey]) ? CAT_COLORS[catKey] : C.accent;

    const px = toPixelX(xData[i]);
    const py = toPixelY(yData[i]);

    // Dot shadow
    ctx.beginPath();
    ctx.arc(px, py, 6, 0, Math.PI * 2);
    ctx.fillStyle = color + '30';
    ctx.fill();

    // Dot
    ctx.beginPath();
    ctx.arc(px, py, 4, 0, Math.PI * 2);
    ctx.fillStyle = color;
    ctx.fill();

    // Outline
    ctx.strokeStyle = color + '80';
    ctx.lineWidth = 1;
    ctx.stroke();
  }

  // ── Regression line label ──
  const eqText = `y = ${slope.toFixed(3)}x + ${intercept.toFixed(3)}`;
  ctx.font = `10px ${FONT_MONO}`;
  ctx.fillStyle = C.accent;
  ctx.textAlign = 'left';
  ctx.textBaseline = 'bottom';
  const labelX = margin.left + 8;
  const labelY = margin.top + 16;
  ctx.fillStyle = 'rgba(11, 18, 32, 0.75)';
  const eqMetrics = ctx.measureText(eqText);
  ctx.fillRect(labelX - 3, labelY - 13, eqMetrics.width + 6, 16);
  ctx.fillStyle = C.accent;
  ctx.fillText(eqText, labelX, labelY);
}


// ══════════════════════════════════════════════════════
// PRIVATE HELPERS
// ══════════════════════════════════════════════════════

/**
 * Map a correlation coefficient r to an HSL color.
 * Blue (r<0) -> White (r=0) -> Red (r>0)
 */
function _corrColor(r) {
  const abs = Math.min(Math.abs(r), 1);
  if (r >= 0) {
    // White to red: hue=0, sat 0->80%, lum 95%->40%
    const sat = Math.round(abs * 80);
    const lum = Math.round(95 - abs * 55);
    return `hsl(0, ${sat}%, ${lum}%)`;
  } else {
    // White to blue: hue=220, sat 0->80%, lum 95%->40%
    const sat = Math.round(abs * 80);
    const lum = Math.round(95 - abs * 55);
    return `hsl(220, ${sat}%, ${lum}%)`;
  }
}

/**
 * Render a tag correlation table.
 */
function _renderTagTable(title, tags, accentColor) {
  let html = `<div style="margin-bottom:16px;">
    <div style="
      font-size:10px;font-weight:700;text-transform:uppercase;
      letter-spacing:1.5px;color:${accentColor};margin-bottom:8px;
    ">${title}</div>
    <div style="overflow-x:auto;">
      <table style="width:100%;border-collapse:collapse;font-size:11px;">
        <thead><tr>
          <th style="
            padding:6px 10px;text-align:left;color:${C.slate500};
            font-weight:600;font-size:9px;text-transform:uppercase;letter-spacing:1px;
            border-bottom:1px solid rgba(51,65,85,0.3);
          ">Tag</th>
          <th style="
            padding:6px 10px;text-align:center;color:${C.slate500};
            font-weight:600;font-size:9px;text-transform:uppercase;letter-spacing:1px;
            border-bottom:1px solid rgba(51,65,85,0.3);
            font-family:${FONT_MONO};
          ">Count</th>
          <th style="
            padding:6px 10px;text-align:left;color:${C.slate500};
            font-weight:600;font-size:9px;text-transform:uppercase;letter-spacing:1px;
            border-bottom:1px solid rgba(51,65,85,0.3);
          ">Top Correlated Features</th>
        </tr></thead>
        <tbody>`;

  tags.forEach((tag, i) => {
    const stripeBg = i % 2 === 0 ? 'rgba(11,18,32,0.3)' : 'rgba(15,23,42,0.4)';
    const name = tag.tag || tag.name || '';
    const count = tag.count != null ? tag.count : '';
    const top3 = (tag.correlations || tag.topFeatures || []).slice(0, 3);

    html += `<tr style="background:${stripeBg};">
      <td style="padding:6px 10px;color:${accentColor};font-weight:500;white-space:nowrap;">${_escapeHtml(name)}</td>
      <td style="padding:6px 10px;text-align:center;font-family:${FONT_MONO};color:${C.slate200};">${count}</td>
      <td style="padding:6px 10px;">
        <div style="display:flex;gap:6px;flex-wrap:wrap;">`;

    top3.forEach(feat => {
      const featureName = feat.feature || feat.name || '';
      const rVal = feat.r != null ? feat.r : feat.correlation;
      const rColor = rVal >= 0 ? C.complement : '#f07068';
      html += `<span style="
        display:inline-flex;align-items:center;gap:4px;
        padding:2px 7px;border-radius:5px;
        background:rgba(51,65,85,0.2);
        font-size:10px;color:${C.slate400};
      ">
        ${_escapeHtml(featureName)}
        <span style="font-family:${FONT_MONO};color:${rColor};font-weight:600;font-size:9px;">
          ${rVal != null ? (rVal >= 0 ? '+' : '') + rVal.toFixed(2) : ''}
        </span>
      </span>`;
    });

    html += `</div></td></tr>`;
  });

  html += '</tbody></table></div></div>';
  return html;
}

/**
 * Generate evenly spaced tick values for an axis.
 */
function _niceTickCount(min, max, count) {
  const range = max - min || 1;
  const rough = range / (count - 1);
  const magnitude = Math.pow(10, Math.floor(Math.log10(rough)));
  const residual = rough / magnitude;
  let nice;
  if (residual <= 1.5) nice = 1;
  else if (residual <= 3) nice = 2;
  else if (residual <= 7) nice = 5;
  else nice = 10;
  const step = nice * magnitude;
  const start = Math.floor(min / step) * step;
  const ticks = [];
  for (let v = start; v <= max + step * 0.5; v += step) {
    ticks.push(parseFloat(v.toPrecision(10)));
  }
  return ticks;
}

/**
 * Trigger a file download in the browser.
 */
function _downloadFile(filename, content, mimeType) {
  const blob = new Blob([content], { type: mimeType });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  setTimeout(() => URL.revokeObjectURL(url), 200);
}

/**
 * Escape HTML entities.
 */
function _escapeHtml(str) {
  const div = document.createElement('div');
  div.textContent = String(str);
  return div.innerHTML;
}

/**
 * Escape a string for use in an HTML attribute.
 */
function _escapeAttr(str) {
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');
}
