// ======================================================
// CYTOSCAPE GRAPH RENDERER
// ======================================================
import { CATS } from '../data/categories.js';
import { EDGE_COLORS, ROLE_COLORS, classifyRole } from '../data/colors.js';

let cyInstance = null;

/**
 * Destroy any existing graph instance
 */
export function destroyGraph() {
  if (cyInstance) {
    try { cyInstance.destroy(); } catch (e) {}
    cyInstance = null;
  }
  document.getElementById('graph-container').innerHTML = '';
}

/**
 * Get the current Cytoscape instance
 */
export function getCy() {
  return cyInstance;
}

/**
 * Render the team graph
 * @param {Object} team - team data object
 * @param {Object} callbacks - { onNodeTap, onBackgroundTap, onEdgeTap }
 */
export function renderGraph(team, callbacks) {
  destroyGraph();

  const cat = CATS[team.cat];
  const catColor = cat.color;

  // Build Cytoscape elements
  const elements = [];
  team.roles.forEach(r => {
    const roleClass = classifyRole(r);
    const nodeColor = ROLE_COLORS[roleClass] || catColor;
    elements.push({
      data: {
        id: r.id,
        label: r.label,
        desc: r.desc,
        isLeader: r.leader || false,
        roleClass: roleClass,
        nodeColor: nodeColor,
      },
      classes: (r.leader ? 'leader' : '') + ' role-' + roleClass,
    });
  });

  team.edges.forEach(e => {
    const ec = EDGE_COLORS[e.type] || '#707070';
    elements.push({
      data: {
        id: e.s + '->' + e.t + ':' + e.type,
        source: e.s,
        target: e.t,
        type: e.type,
        edgeColor: ec,
      },
      classes: e.type === 'command' ? 'command' : 'noncommand',
    });
  });

  const container = document.getElementById('graph-container');

  cyInstance = cytoscape({
    container,
    elements,
    style: [
      { selector: 'core', style: { 'active-bg-size': 0 } },

      // Nodes
      {
        selector: 'node', style: {
          'background-color': 'data(nodeColor)',
          'background-opacity': 0.9,
          'label': 'data(label)',
          'color': '#e2e8f0',
          'font-size': '12px',
          'font-family': 'Inter, sans-serif',
          'font-weight': 500,
          'text-valign': 'bottom',
          'text-halign': 'center',
          'text-margin-y': 6,
          'text-background-color': '#0b1220',
          'text-background-opacity': 0.75,
          'text-background-padding': '4px',
          'text-background-shape': 'roundrectangle',
          'width': 30,
          'height': 30,
          'shape': 'ellipse',
          'border-width': 2,
          'border-color': 'data(nodeColor)',
          'border-opacity': 0.4,
          'text-wrap': 'wrap',
          'text-max-width': '130px',
          'overlay-opacity': 0,
        },
      },

      // Leader nodes
      {
        selector: 'node.leader', style: {
          'width': 42,
          'height': 42,
          'shape': 'diamond',
          'border-width': 2.5,
          'border-opacity': 0.8,
          'background-opacity': 1,
          'font-size': '13px',
          'font-weight': 700,
        },
      },

      // Edges
      {
        selector: 'edge', style: {
          'curve-style': 'bezier',
          'width': 1.5,
          'line-color': 'data(edgeColor)',
          'line-opacity': 0.6,
          'target-arrow-shape': 'triangle',
          'target-arrow-color': 'data(edgeColor)',
          'arrow-scale': 0.9,
          'label': 'data(type)',
          'font-family': "'JetBrains Mono', monospace",
          'font-size': '10px',
          'color': 'data(edgeColor)',
          'text-rotation': 'autorotate',
          'text-margin-y': -10,
          'text-background-color': '#0b1220',
          'text-background-opacity': 0.85,
          'text-background-padding': '3px',
          'text-background-shape': 'roundrectangle',
          'text-opacity': 0.75,
          'overlay-opacity': 0,
        },
      },

      // Command edges — solid, thicker
      {
        selector: 'edge.command', style: {
          'line-style': 'solid',
          'width': 2.5,
          'line-opacity': 0.8,
          'font-size': '10px',
          'text-opacity': 0.85,
        },
      },

      // Non-command edges — dashed
      {
        selector: 'edge.noncommand', style: {
          'line-style': 'dashed',
          'line-dash-pattern': [6, 4],
          'line-opacity': 0.5,
        },
      },

      // Selection
      {
        selector: 'node:selected', style: {
          'border-width': 3,
          'border-color': '#c88076',
          'border-opacity': 1,
          'background-opacity': 1,
          'overlay-opacity': 0.08,
          'overlay-color': '#c88076',
        },
      },

      { selector: '.dimmed', style: { 'opacity': 0.2, 'text-opacity': 0.35 } },
      {
        selector: '.highlighted', style: {
          'opacity': 1,
          'line-opacity': 1,
          'text-opacity': 1,
          'z-index': 10,
        },
      },
    ],
    wheelSensitivity: 0.2,
    motionBlur: false,
  });

  // Layout — consider both density and node count
  const nodeCount = team.roles.length;
  const density = team.dens;
  let layoutOpts;
  if (nodeCount <= 6 && density < 0.85) {
    layoutOpts = { name: 'dagre', rankDir: 'TB', nodeSep: 60, rankSep: 90, animate: false, fit: true, padding: 40 };
  } else if (nodeCount <= 15 && density < 0.65) {
    layoutOpts = { name: 'dagre', rankDir: 'TB', nodeSep: 50, rankSep: 70, animate: false, fit: true, padding: 40 };
  } else if (density >= 0.75) {
    layoutOpts = { name: 'circle', animate: false, fit: true, padding: 40 };
  } else {
    layoutOpts = { name: 'dagre', rankDir: 'TB', nodeSep: 70, rankSep: 100, animate: false, fit: true, padding: 40 };
  }

  cyInstance.layout(layoutOpts).run();

  // Lock nodes on drag
  cyInstance.on('dragfree', 'node', e => {
    try { e.target.lock(); } catch (ex) {}
  });

  // Node tap
  cyInstance.on('tap', 'node', e => {
    const node = e.target;
    cyInstance.elements().removeClass('dimmed');
    const neighborhood = node.neighborhood().add(node);
    cyInstance.elements().not(neighborhood).addClass('dimmed');
    if (callbacks.onNodeTap) {
      callbacks.onNodeTap({
        id: node.id(),
        name: node.data('label'),
        desc: node.data('desc'),
        isLeader: node.data('isLeader'),
      });
    }
  });

  // Background tap
  cyInstance.on('tap', e => {
    if (e.target === cyInstance) {
      cyInstance.elements().removeClass('dimmed');
      cyInstance.nodes().unselect();
      if (callbacks.onBackgroundTap) callbacks.onBackgroundTap();
    }
  });

  // Edge tap
  cyInstance.on('tap', 'edge', e => {
    const edge = e.target;
    cyInstance.elements().removeClass('dimmed');
    const connected = edge.connectedNodes().add(edge);
    cyInstance.elements().not(connected).addClass('dimmed');
  });

  // Fit after layout
  setTimeout(() => {
    try { cyInstance.fit(undefined, 40); } catch (e) {}
  }, 200);
}

/**
 * Select and highlight a specific role in the graph
 */
export function selectRoleInGraph(id) {
  if (!cyInstance) return;
  const cyNode = cyInstance.getElementById(id);
  if (cyNode && cyNode.length) {
    cyInstance.elements().removeClass('dimmed');
    cyInstance.nodes().unselect();
    cyNode.select();
    const neighborhood = cyNode.neighborhood().add(cyNode);
    cyInstance.elements().not(neighborhood).addClass('dimmed');
    cyInstance.animate({ center: { eles: cyNode }, duration: 250, easing: 'ease-in-out-cubic' });
    return {
      id: cyNode.id(),
      name: cyNode.data('label'),
      desc: cyNode.data('desc'),
      isLeader: cyNode.data('isLeader'),
    };
  }
  return null;
}

/**
 * Reset graph layout
 */
export function resetGraph() {
  if (cyInstance) {
    try {
      cyInstance.nodes().unlock();
      cyInstance.fit(undefined, 40);
    } catch (e) {}
  }
}

/**
 * Clear dimming
 */
export function clearDimming() {
  if (cyInstance) {
    cyInstance.elements().removeClass('dimmed');
    cyInstance.nodes().unselect();
  }
}
