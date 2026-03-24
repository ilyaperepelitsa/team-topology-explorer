// ======================================================
// TEAM STRUCTURE INTELLIGENCE ENGINE
// Computes graph-theoretic properties and generates
// natural-language insights about organizational structures
// ======================================================

/**
 * Compute full structural analysis for a team
 */
export function analyzeTeam(team) {
  const n = team.roles.length;
  const edges = team.edges;
  const leaders = team.roles.filter(r => r.leader);

  // Build adjacency list (undirected)
  const adj = {};
  team.roles.forEach(r => { adj[r.id] = new Set(); });
  edges.forEach(e => {
    if (adj[e.s] && adj[e.t]) {
      adj[e.s].add(e.t);
      adj[e.t].add(e.s);
    }
  });

  // Degree centrality
  const degrees = {};
  let maxDegree = 0;
  let maxDegreeNode = null;
  team.roles.forEach(r => {
    degrees[r.id] = adj[r.id].size;
    if (adj[r.id].size > maxDegree) {
      maxDegree = adj[r.id].size;
      maxDegreeNode = r;
    }
  });

  // Betweenness centrality (Brandes, corrected normalization)
  const betweenness = computeBetweenness(team.roles, adj);

  // Local clustering coefficients
  const localClustering = computeLocalClustering(team.roles, adj);
  const globalClustering = Object.values(localClustering).reduce((a, b) => a + b, 0) / n;

  // Degree distribution analysis
  const degreeAnalysis = analyzeDegreeDistribution(degrees);

  // Hub detection
  const hubs = detectHubs(team.roles, degrees, degreeAnalysis);

  // Bridge edge detection
  const bridges = detectBridges(team.roles, edges, adj);

  // Span of control
  const spanOfControl = leaders.map(l => {
    const directReports = edges.filter(e => e.s === l.id && e.type === 'command').length;
    return { role: l, reports: directReports };
  });

  // Bottleneck detection (improved threshold)
  const bottlenecks = findBottlenecks(team.roles, adj, betweenness);

  // Shortest paths
  const paths = computeShortestPaths(team.roles, adj);

  // Average path length & diameter
  let totalPathLen = 0, pathCount = 0, diameter = 0;
  Object.values(paths.distances).forEach(dists => {
    Object.values(dists).forEach(d => {
      if (d !== Infinity && d > 0) { totalPathLen += d; pathCount++; }
      if (d !== Infinity && d > diameter) diameter = d;
    });
  });
  const avgPathLength = pathCount > 0 ? totalPathLen / pathCount : 0;

  // Edge type distribution
  const edgeTypeCounts = {};
  edges.forEach(e => { edgeTypeCounts[e.type] = (edgeTypeCounts[e.type] || 0) + 1; });
  const dominantEdgeType = Object.entries(edgeTypeCounts).sort((a, b) => b[1] - a[1])[0];

  // Autonomy index
  const commandEdges = edges.filter(e => e.type === 'command' || e.type.includes('command')).length;
  const lateralEdges = edges.length - commandEdges;
  const autonomyIndex = edges.length > 0 ? lateralEdges / edges.length : 0;

  // Leader ratio
  const leaderRatio = n > 0 ? leaders.length / n : 0;

  // Brooks's Law communication lines
  const commLines = n * (n - 1) / 2;

  // Dunbar layer
  const dunbarLayer = getDunbarLayer(n);

  // Resilience
  const resilience = assessResilience(team.roles, adj, betweenness);

  // Generate insights
  const insights = generateInsights(team, {
    n, leaders, degrees, maxDegreeNode, maxDegree,
    betweenness, bottlenecks, spanOfControl, avgPathLength,
    diameter, edgeTypeCounts, dominantEdgeType, autonomyIndex,
    leaderRatio, resilience, commandEdges, lateralEdges,
    localClustering, globalClustering, degreeAnalysis, hubs,
    bridges, commLines, dunbarLayer,
  });

  return {
    metrics: {
      nodeCount: n,
      edgeCount: edges.length,
      leaderCount: leaders.length,
      leaderRatio,
      avgPathLength,
      diameter,
      autonomyIndex,
      commandEdgeRatio: edges.length > 0 ? commandEdges / edges.length : 0,
      globalClustering,
      commLines,
    },
    spanOfControl,
    bottlenecks,
    resilience,
    edgeTypeCounts,
    hubs,
    bridges,
    dunbarLayer,
    insights,
  };
}

// ── Betweenness Centrality (Brandes, FIXED normalization) ──
function computeBetweenness(roles, adj) {
  const bc = {};
  roles.forEach(r => { bc[r.id] = 0; });

  roles.forEach(source => {
    const stack = [];
    const pred = {}, sigma = {}, dist = {}, delta = {};

    roles.forEach(r => {
      pred[r.id] = [];
      sigma[r.id] = 0;
      dist[r.id] = -1;
      delta[r.id] = 0;
    });

    sigma[source.id] = 1;
    dist[source.id] = 0;
    const queue = [source.id];

    while (queue.length > 0) {
      const v = queue.shift();
      stack.push(v);
      for (const w of adj[v]) {
        if (dist[w] < 0) {
          queue.push(w);
          dist[w] = dist[v] + 1;
        }
        if (dist[w] === dist[v] + 1) {
          sigma[w] += sigma[v];
          pred[w].push(v);
        }
      }
    }

    while (stack.length > 0) {
      const w = stack.pop();
      for (const v of pred[w]) {
        if (sigma[w] > 0) { // Safety: avoid division by zero
          delta[v] += (sigma[v] / sigma[w]) * (1 + delta[w]);
        }
      }
      if (w !== source.id) bc[w] += delta[w];
    }
  });

  // Normalize for undirected graph: (n-1)(n-2)/2
  const n = roles.length;
  if (n > 2) {
    const norm = (n - 1) * (n - 2) / 2;
    roles.forEach(r => { bc[r.id] /= norm; });
  }

  return bc;
}

// ── Local Clustering Coefficient ──
function computeLocalClustering(roles, adj) {
  const cc = {};
  roles.forEach(node => {
    const neighbors = Array.from(adj[node.id]);
    const k = neighbors.length;
    if (k < 2) { cc[node.id] = 0; return; }
    let triangles = 0;
    for (let i = 0; i < neighbors.length; i++) {
      for (let j = i + 1; j < neighbors.length; j++) {
        if (adj[neighbors[i]].has(neighbors[j])) triangles++;
      }
    }
    cc[node.id] = (2 * triangles) / (k * (k - 1));
  });
  return cc;
}

// ── Degree Distribution Analysis ──
function analyzeDegreeDistribution(degrees) {
  const values = Object.values(degrees);
  const sorted = [...values].sort((a, b) => a - b);
  const n = values.length;
  const mean = values.reduce((a, b) => a + b, 0) / n;
  const variance = values.reduce((a, b) => a + Math.pow(b - mean, 2), 0) / n;
  const stdDev = Math.sqrt(variance);
  const max = sorted[n - 1];
  const powerLawIndicator = max / mean;
  return {
    mean, stdDev, min: sorted[0], max, median: sorted[Math.floor(n / 2)],
    gini: calculateGini(sorted),
    isPowerLaw: powerLawIndicator > 2.5,
    maxRatio: powerLawIndicator,
  };
}

function calculateGini(sorted) {
  const n = sorted.length;
  const sum = sorted.reduce((a, b) => a + b, 0);
  if (sum === 0) return 0;
  const num = sorted.reduce((acc, val, i) => acc + (i + 1) * val, 0) * 2;
  return (num / (n * sum)) - (n + 1) / n;
}

// ── Hub Detection ──
function detectHubs(roles, degrees, analysis) {
  const threshold = analysis.mean + 1.5 * analysis.stdDev;
  return roles
    .filter(r => degrees[r.id] > threshold)
    .map(r => ({
      role: r,
      degree: degrees[r.id],
      zscore: analysis.stdDev > 0 ? (degrees[r.id] - analysis.mean) / analysis.stdDev : 0,
    }))
    .sort((a, b) => b.degree - a.degree);
}

// ── Bridge Edge Detection ──
function detectBridges(roles, edges, adj) {
  const bridges = [];
  edges.forEach(edge => {
    if (edge.s === edge.t) return; // Skip self-loops
    adj[edge.s].delete(edge.t);
    adj[edge.t].delete(edge.s);
    const visited = new Set();
    const stack = [roles[0].id];
    while (stack.length > 0) {
      const node = stack.pop();
      if (visited.has(node)) continue;
      visited.add(node);
      for (const nb of adj[node]) { if (!visited.has(nb)) stack.push(nb); }
    }
    const isDisconnected = visited.size < roles.length;
    adj[edge.s].add(edge.t);
    adj[edge.t].add(edge.s);
    if (isDisconnected) {
      bridges.push({ source: edge.s, target: edge.t, type: edge.type });
    }
  });
  return bridges;
}

// ── Improved Bottleneck Detection ──
function findBottlenecks(roles, adj, betweenness) {
  const values = Object.values(betweenness);
  const avg = values.reduce((a, b) => a + b, 0) / roles.length;
  const variance = values.reduce((a, b) => a + Math.pow(b - avg, 2), 0) / roles.length;
  const stdDev = Math.sqrt(variance);
  const threshold = Math.max(avg * 1.5, avg + 1.5 * stdDev);

  return roles
    .filter(r => betweenness[r.id] > threshold)
    .map(r => ({
      role: r,
      score: betweenness[r.id],
      connections: adj[r.id].size,
    }))
    .sort((a, b) => b.score - a.score);
}

// ── Shortest Paths ──
function computeShortestPaths(roles, adj) {
  const distances = {};
  roles.forEach(source => {
    distances[source.id] = {};
    const visited = new Set([source.id]);
    const queue = [{ id: source.id, dist: 0 }];
    while (queue.length > 0) {
      const { id, dist } = queue.shift();
      distances[source.id][id] = dist;
      for (const nb of adj[id]) {
        if (!visited.has(nb)) {
          visited.add(nb);
          queue.push({ id: nb, dist: dist + 1 });
        }
      }
    }
    roles.forEach(r => {
      if (!(r.id in distances[source.id])) distances[source.id][r.id] = Infinity;
    });
  });
  return { distances };
}

// ── Resilience (improved scoring) ──
function assessResilience(roles, adj, betweenness) {
  let criticalNode = null, maxBC = -1;
  roles.forEach(r => {
    if (betweenness[r.id] > maxBC) { maxBC = betweenness[r.id]; criticalNode = r; }
  });
  if (!criticalNode) return { criticalNode: null, impact: 'none', score: 1.0 };

  const remaining = roles.filter(r => r.id !== criticalNode.id);
  const remAdj = {};
  remaining.forEach(r => {
    remAdj[r.id] = new Set([...adj[r.id]].filter(id => id !== criticalNode.id));
  });

  const visited = new Set();
  let components = 0;
  remaining.forEach(r => {
    if (!visited.has(r.id)) {
      components++;
      const queue = [r.id];
      while (queue.length > 0) {
        const v = queue.shift();
        if (visited.has(v)) continue;
        visited.add(v);
        for (const w of remAdj[v]) { if (!visited.has(w)) queue.push(w); }
      }
    }
  });

  const fragmentsOnRemoval = components > 1;
  const score = Math.max(0.05, 1 - maxBC);

  return {
    criticalNode, fragmentsOnRemoval,
    componentsAfterRemoval: components,
    score,
    impact: fragmentsOnRemoval ? 'severe' : (maxBC > 0.3 ? 'moderate' : 'low'),
    betweennessScore: maxBC,
  };
}

// ── Dunbar Layer ──
function getDunbarLayer(n) {
  if (n <= 5) return { layer: 'Intimate group', limit: 5, desc: 'Deep trust, daily interaction. Maximum emotional closeness.' };
  if (n <= 15) return { layer: 'Sympathy group', limit: 15, desc: 'Close allies. You grieve their loss. Daily working relationships.' };
  if (n <= 50) return { layer: 'Band', limit: 50, desc: 'You know everyone personally. Campfire-sized group.' };
  if (n <= 150) return { layer: "Dunbar's number", limit: 150, desc: 'Maximum stable social relationships. Beyond this, formal structure required.' };
  return { layer: 'Clan+', limit: 500, desc: 'Requires formal hierarchy, rules, and roles to maintain coherence.' };
}

// ══════════════════════════════════════════════════
// NATURAL LANGUAGE INSIGHTS
// ══════════════════════════════════════════════════
function generateInsights(team, s) {
  const insights = [];

  // 1. Dunbar classification (most immediately relatable)
  insights.push({
    title: 'Dunbar Scale',
    icon: '&#9899;',
    text: `At <strong>${s.n} roles</strong>, this sits in the <strong>${s.dunbarLayer.layer}</strong> range (up to ${s.dunbarLayer.limit}). ${s.dunbarLayer.desc} Brooks's Law: ${s.commLines} potential communication lines (n(n-1)/2). ${s.commLines > 30 ? 'High coordination overhead — formal protocols help.' : 'Manageable with informal communication.'}`,
  });

  // 2. Topology explanation
  insights.push({
    title: 'Topology Pattern',
    icon: '&#9678;',
    text: getTopologyExplanation(team.topo, team.dens),
  });

  // 3. Conway's Law
  insights.push({
    title: "Conway's Law",
    icon: '&#9881;',
    text: getConwayInsight(team.topo, s.autonomyIndex),
  });

  // 4. Decision flow
  insights.push({
    title: 'Decision Flow',
    icon: '&#9654;',
    text: getDecisionPattern(s),
  });

  // 5. Bottleneck
  if (s.bottlenecks.length > 0) {
    const bn = s.bottlenecks[0];
    insights.push({
      title: 'Critical Bottleneck',
      icon: '&#9888;',
      text: `<strong>${bn.role.label}</strong> is the structural bottleneck — ${(bn.score * 100).toFixed(0)}% of shortest paths flow through this role. ${s.resilience.fragmentsOnRemoval ? `Removing them fragments the team into ${s.resilience.componentsAfterRemoval} disconnected groups.` : 'The team stays connected but slows significantly.'}`,
    });
  }

  // 6. Hub detection
  if (s.hubs.length > 0) {
    const hub = s.hubs[0];
    insights.push({
      title: 'Network Hub',
      icon: '&#10038;',
      text: `<strong>${hub.role.label}</strong> has unusually high connectivity (${hub.degree} links, z-score ${hub.zscore.toFixed(1)}). This role bridges functional areas — ensure they have sufficient bandwidth and consider cross-training a backup.`,
    });
  }

  // 7. Subgroup cohesion
  insights.push({
    title: 'Subgroup Cohesion',
    icon: '&#9670;',
    text: `Computed clustering: <strong>${(s.globalClustering * 100).toFixed(0)}%</strong>. ${s.globalClustering > 0.6 ? "Your contacts know each other well — tight-knit cliques form. Risk: echo chambers and groupthink." : s.globalClustering > 0.3 ? 'Balanced local cohesion with inter-group bridges.' : "Low clustering — a network of weak ties. More information diversity but harder spontaneous coordination."}`,
  });

  // 8. Span of control
  const highSpan = s.spanOfControl.filter(x => x.reports > 3);
  if (highSpan.length > 0) {
    const highest = highSpan.sort((a, b) => b.reports - a.reports)[0];
    insights.push({
      title: 'Span of Control',
      icon: '&#8801;',
      text: `<strong>${highest.role.label}</strong> directly commands ${highest.reports} people. ${highest.reports > 7 ? 'Exceeds research-backed limit (5-7). Cognitive overload risk.' : highest.reports > 5 ? 'At the upper bound of effective management.' : 'Within optimal range.'}`,
    });
  }

  // 9. Communication paths
  insights.push({
    title: 'Communication Paths',
    icon: '&#8644;',
    text: `Avg path: <strong>${s.avgPathLength.toFixed(1)} hops</strong>. Diameter: <strong>${s.diameter}</strong>. ${s.avgPathLength < 1.5 ? 'Near-instant propagation. Minimal intermediary filtering.' : s.avgPathLength < 2.5 ? 'Efficient with some intermediate filtering.' : 'Multiple intermediaries increase latency and distortion (telephone game effect).'}`,
  });

  // 10. Autonomy
  insights.push({
    title: 'Autonomy Index',
    icon: '&#9733;',
    text: `<strong>${(s.autonomyIndex * 100).toFixed(0)}%</strong> lateral relationships. ${s.autonomyIndex > 0.6 ? 'Highly autonomous — most interaction is peer-to-peer. Risk: unclear accountability.' : s.autonomyIndex > 0.3 ? 'Balanced hierarchy and lateral collaboration.' : 'Command-driven hierarchy dominates. Risk: slower adaptation.'}`,
  });

  // 11. Bridge edges
  if (s.bridges.length > 0) {
    const b = s.bridges[0];
    const srcRole = team.roles.find(r => r.id === b.source);
    const tgtRole = team.roles.find(r => r.id === b.target);
    insights.push({
      title: 'Critical Links',
      icon: '&#9889;',
      text: `<strong>${s.bridges.length} bridge relationship${s.bridges.length > 1 ? 's' : ''}</strong> — if severed, the team fragments. ${srcRole && tgtRole ? `Most critical: <strong>${srcRole.label}</strong> ↔ <strong>${tgtRole.label}</strong> (${b.type}).` : ''} Build redundancy around these links.`,
    });
  }

  // 12. Degree distribution
  if (s.degreeAnalysis.isPowerLaw) {
    insights.push({
      title: 'Power Structure',
      icon: '&#9202;',
      text: `Connections follow a <strong>power-law pattern</strong> — a few hubs control most communication (max degree is ${s.degreeAnalysis.maxRatio.toFixed(1)}x average). This mirrors real-world organizations but concentrates risk.`,
    });
  }

  // 13. Resilience
  if (s.resilience.criticalNode) {
    const r = s.resilience;
    insights.push({
      title: 'Resilience Score',
      icon: '&#9730;',
      text: `Score: <strong>${(r.score * 100).toFixed(0)}/100</strong>. Single point of failure: <strong>${r.criticalNode.label}</strong>. ${r.fragmentsOnRemoval ? `Removal FRAGMENTS the team into ${r.componentsAfterRemoval} groups — cross-train immediately.` : 'Team stays connected but loses efficiency.'}`,
    });
  }

  return insights;
}

function getTopologyExplanation(topo, density) {
  const t = topo.toLowerCase();
  if (t.includes('star'))
    return `<strong>Star topology</strong> — central hub connects to all others. <strong>Pro:</strong> fast decisions from center. <strong>Con:</strong> hub is single point of failure. Density ${density.toFixed(2)} confirms hub-spoke dominance.`;
  if (t.includes('mesh') || t.includes('complete'))
    return `<strong>${topo}</strong> — ${(density * 100).toFixed(0)}% of all possible connections exist. <strong>Pro:</strong> many redundant paths ensure resilience. <strong>Con:</strong> high coordination overhead. Works for small expert teams.`;
  if (t.includes('tree'))
    return `<strong>Tree topology</strong> — hierarchical branching. Each role has exactly one path to every other. <strong>Pro:</strong> clear authority, minimal overhead. <strong>Con:</strong> removing any internal node disconnects the subtree below.`;
  if (t.includes('cluster') || t.includes('overlapping'))
    return `<strong>${topo}</strong> — dense subgroups with sparse inter-group links. <strong>Pro:</strong> balances local autonomy with coordination. <strong>Con:</strong> inter-cluster communication is the bottleneck.`;
  if (t.includes('chain') || t.includes('parallel'))
    return `<strong>${topo}</strong> — sequential/parallel workflows. <strong>Pro:</strong> clear handoffs. <strong>Con:</strong> any blocked step stalls the chain. Density ${density.toFixed(2)} reflects linear connectivity.`;
  if (t.includes('dual'))
    return `<strong>${topo}</strong> — two co-equal leaders with paired specialties below. <strong>Pro:</strong> resilience from dual leadership. <strong>Con:</strong> potential authority confusion. Requires strong coordination.`;
  return `<strong>${topo}</strong> — ${(density * 100).toFixed(0)}% connectivity. ${density > 0.7 ? 'Highly connected with redundant paths.' : density > 0.3 ? 'Moderately connected with selective relationships.' : 'Sparse — communication follows defined channels.'}`;
}

function getConwayInsight(topo, autonomyIndex) {
  const t = topo.toLowerCase();
  let archType;
  if (t.includes('star') || t.includes('tree')) archType = 'monolithic or layered';
  else if (t.includes('mesh') || t.includes('complete')) archType = 'microservices or event-driven';
  else if (t.includes('cluster') || t.includes('overlapping')) archType = 'modular with well-defined APIs';
  else if (t.includes('chain') || t.includes('parallel')) archType = 'pipeline or assembly-line';
  else archType = 'hybrid';

  return `Conway's Law: organizations design systems that mirror their communication structures. This <strong>${topo}</strong> topology would naturally produce a <strong>${archType}</strong> architecture. ${autonomyIndex > 0.5 ? 'High autonomy suggests decoupled components.' : 'Hierarchical structure suggests tighter coupling.'} The <strong>Inverse Conway Maneuver</strong> says: design your teams to match your desired system architecture.`;
}

function getDecisionPattern(s) {
  const edgeType = s.dominantEdgeType ? s.dominantEdgeType[0] : 'command';
  if (s.leaderRatio > 0.4)
    return `<strong>Distributed decisions</strong> — ${(s.leaderRatio * 100).toFixed(0)}% leadership ratio. Authority shared across multiple nodes. Pro: faster, more adaptive. Con: potential inconsistency. Dominant link: <strong>${edgeType}</strong>.`;
  if (s.autonomyIndex > 0.6)
    return `<strong>Peer consensus</strong> — ${(s.autonomyIndex * 100).toFixed(0)}% lateral relationships. Decisions emerge from dialogue, not command. Pro: buy-in. Con: slower consensus. Dominant link: <strong>${edgeType}</strong>.`;
  if (s.avgPathLength < 2)
    return `<strong>Direct access</strong> — most reach decision-makers in ~${s.avgPathLength.toFixed(1)} hops. Fast feedback, minimal distortion. Con: decision-makers may be overwhelmed. Dominant link: <strong>${edgeType}</strong>.`;
  return `<strong>Hierarchical delegation</strong> — ~${s.avgPathLength.toFixed(1)} hops average. Each layer filters information. Pro: scalability. Con: latency + distortion. Dominant link: <strong>${edgeType}</strong>.`;
}
