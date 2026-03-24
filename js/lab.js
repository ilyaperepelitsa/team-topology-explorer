// ======================================================
// ANALYSIS LAB – Entry Point
// Wires together all lab modules for lab.html
// ======================================================
import { TEAMS } from './data/teams.js';
import { CATS } from './data/categories.js';
import { XLINKS } from './data/crosslinks.js';
import { extractAllFeatures } from './lab/feature-extractor.js';
import { correlationMatrix, tagCorrelations, linearRegression, groupAnalysis } from './lab/regression.js';
import { recommendStructures, getDefaultConstraints } from './lab/recommender.js';
import { generateCypherExport, generateCSVExport, executeCypherLikeQuery } from './lab/neo4j-export.js';
import { renderRegressionTab, renderRecommenderTab, renderNeo4jTab } from './lab/lab-ui.js';

// ── Feature Extraction ──
const t0 = performance.now();
const allFeatures = extractAllFeatures(TEAMS);
const t1 = performance.now();
console.log(`Analysis Lab: computed features for ${TEAMS.length} teams in ${(t1 - t0).toFixed(1)}ms`);

// ── Tab State ──
const getContent = () => document.getElementById('lab-content');

const TABS = {
  regression: {
    render: () => renderRegressionTab(getContent(), allFeatures, {
      correlationMatrix,
      tagCorrelations,
      linearRegression,
      groupAnalysis,
    }),
  },
  recommender: {
    render: () => renderRecommenderTab(getContent(), allFeatures, recommendStructures, getDefaultConstraints),
  },
  neo4j: {
    render: () => renderNeo4jTab(getContent(), allFeatures, {
      generateCypherExport: () => generateCypherExport(TEAMS, XLINKS, CATS, allFeatures),
      generateCSVExport: () => generateCSVExport(TEAMS, XLINKS, CATS, allFeatures),
      executeCypherLikeQuery: (q) => executeCypherLikeQuery(q, TEAMS, allFeatures),
    }),
  },
};

let activeTab = 'regression';

// ── Tab Switching ──
function switchTab(tabName) {
  if (!TABS[tabName]) return;
  activeTab = tabName;

  // Update tab button active states
  const tabButtons = document.querySelectorAll('.lab-tab');
  tabButtons.forEach(btn => {
    btn.classList.remove('active');
    if (btn.dataset.tab === tabName) {
      btn.classList.add('active');
    }
  });

  // Render the selected tab into the content area
  const contentEl = document.getElementById('lab-content');
  if (contentEl) {
    TABS[tabName].render();
  }
}

// ── Init ──
function init() {
  // Wire tab click handlers
  const tabButtons = document.querySelectorAll('.lab-tab');
  tabButtons.forEach(btn => {
    btn.addEventListener('click', () => {
      const tabName = btn.dataset.tab;
      if (tabName) {
        switchTab(tabName);
      }
    });
  });

  // Render the default active tab
  switchTab(activeTab);

  // "Back to Explorer" link
  const backLink = document.getElementById('back-to-explorer');
  if (backLink) {
    backLink.addEventListener('click', (e) => {
      e.preventDefault();
      window.location.href = backLink.getAttribute('href') || 'index.html';
    });
  }
}

// Run on DOM ready
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', init);
} else {
  init();
}
