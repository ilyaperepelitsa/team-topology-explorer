// ======================================================
// TEAM STRUCTURE RECOMMENDER
// Scores and ranks team structures against user constraints
// using normalized feature distances, tag matching, and
// size compatibility.
// ======================================================

import { analyzeTeam } from '../analysis.js';

/**
 * Return default constraints with all sliders at neutral (3)
 * and no tag filters.
 */
export function getDefaultConstraints() {
  return {
    teamSize: 10,
    decisionSpeed: 3,
    riskTolerance: 3,
    autonomyDesired: 3,
    commOverheadOK: 3,
    hierarchyTolerance: 3,
    resilienceNeeded: 3,
    innovationFocus: 3,
    tags: [],
  };
}

// ── Size parsing ──────────────────────────────────────
// Team size strings come in forms like '4', '9-13', '100-100K+',
// '50-40K', '5+bench', '3-15/team', '1-10K+'. We extract a
// representative numeric midpoint.

function parseEffectiveSize(sizeStr) {
  const cleaned = String(sizeStr)
    .replace(/\+.*$/, '')   // '5+bench' -> '5', '20+' -> '20'
    .replace(/\/.*$/, '');  // '3-15/team' -> '3-15'

  function parseNum(s) {
    const trimmed = s.trim().toUpperCase();
    if (trimmed.endsWith('K')) {
      return parseFloat(trimmed) * 1000;
    }
    return parseFloat(trimmed) || 0;
  }

  if (cleaned.includes('-')) {
    const parts = cleaned.split('-');
    const lo = parseNum(parts[0]);
    const hi = parseNum(parts[1]);
    // Geometric mean for wide ranges
    if (lo > 0 && hi > 0) {
      return Math.sqrt(lo * hi);
    }
    return (lo + hi) / 2;
  }
  return parseNum(cleaned) || 5;
}

// ── Tag keyword mapping ───────────────────────────────
// Maps high-level outcome tags to keywords that may appear
// in a team's str[] (strengths) and wk[] (weaknesses).

const TAG_KEYWORDS = {
  speed:          ['fast', 'speed', 'quick', 'rapid', 'sub-3s', 'zero coordination'],
  cohesion:       ['cohesion', 'trust', 'bond', 'loyalty', 'ritual', 'family', 'pseudo-family', 'buddy pair'],
  autonomy:       ['autonomy', 'autonomous', 'self-sufficient', 'independent', 'decentralized', 'ownership'],
  accountability: ['accountability', 'clear', 'defined', 'ownership', 'authority', 'legitimacy'],
  redundancy:     ['redundancy', 'redundant', 'cross-training', 'paired', 'resilient', 'mesh'],
  scalable:       ['scalable', 'scalab', 'nesting', 'decimal', 'infinitely'],
  innovation:     ['innovation', 'innovati', 'creative', 'no bureaucracy', 'meritocratic'],
};

function textMatchesTag(text, tag) {
  const keywords = TAG_KEYWORDS[tag];
  if (!keywords) return false;
  const lower = text.toLowerCase();
  return keywords.some(kw => lower.includes(kw));
}

// ── Feature extraction ────────────────────────────────
// Builds a flat numeric feature vector from a team object
// and its analysis output.

function extractFeatures(team, analysis) {
  const m = analysis.metrics;
  return {
    teamId:           team.id,
    teamName:         team.name,
    effectiveSize:    parseEffectiveSize(team.size),
    density:          team.dens,
    clustering:       team.clust,
    avgPathLength:    m.avgPathLength,
    autonomyIndex:    m.autonomyIndex,
    commandEdgeRatio: m.commandEdgeRatio,
    commLines:        m.commLines,
    nodeCount:        m.nodeCount,
    resilienceScore:  analysis.resilience.score,
    bottleneckCount:  analysis.bottlenecks.length,
    bridgeCount:      analysis.bridges.length,
    strengths:        team.str || [],
    weaknesses:       team.wk || [],
  };
}

// ── Normalization helpers ─────────────────────────────

function minMaxNormalize(values) {
  const min = Math.min(...values);
  const max = Math.max(...values);
  const range = max - min;
  if (range === 0) return values.map(() => 0.5);
  return values.map(v => (v - min) / range);
}

function sliderToUnit(val) {
  // Map 1-5 slider to 0-1
  return (val - 1) / 4;
}

function sliderWeight(val) {
  // Extremes (1 or 5) get high weight, neutral (3) gets low weight.
  // Quadratic: distance from center, mapped so 3->0.1, 1 or 5->1.0
  const dist = Math.abs(val - 3);
  return 0.1 + 0.9 * (dist / 2) * (dist / 2);
}

// ── Core scoring ──────────────────────────────────────

function computeFeatureScore(constraints, feat, normMap) {
  // Each slider maps to one or more normalized features.
  // We compute weighted distance for each.
  const scores = [];
  const weights = [];

  // decisionSpeed: prefer low avgPathLength and high density
  {
    const desired = sliderToUnit(constraints.decisionSpeed);
    const w = sliderWeight(constraints.decisionSpeed);
    // Low avgPathLength = fast decisions -> invert so high = fast
    const actualPath = 1 - normMap.avgPathLength[feat._idx];
    const actualDens = normMap.density[feat._idx];
    const actual = 0.6 * actualPath + 0.4 * actualDens;
    scores.push(1 - Math.abs(desired - actual));
    weights.push(w);
  }

  // riskTolerance: low = prefer high resilience; high = don't penalize
  {
    const desired = sliderToUnit(constraints.riskTolerance);
    const w = sliderWeight(constraints.riskTolerance);
    const actualResilience = normMap.resilienceScore[feat._idx];
    // At low risk tolerance (desired near 0), strongly prefer high resilience.
    // At high risk tolerance (desired near 1), resilience doesn't matter much.
    // Score = 1 when resilience matches need.
    if (desired < 0.5) {
      // Low tolerance for risk -> need high resilience
      const need = 1 - desired; // 1.0 at slider=1, 0.5 at slider=3
      scores.push(1 - Math.max(0, need - actualResilience));
      weights.push(w);
    } else {
      // High risk tolerance -> anything is fine, slight bonus for daring (low resilience)
      scores.push(0.7 + 0.3 * (1 - actualResilience));
      weights.push(w * 0.5);
    }
  }

  // autonomyDesired: prefer high autonomyIndex
  {
    const desired = sliderToUnit(constraints.autonomyDesired);
    const w = sliderWeight(constraints.autonomyDesired);
    const actual = normMap.autonomyIndex[feat._idx];
    scores.push(1 - Math.abs(desired - actual));
    weights.push(w);
  }

  // commOverheadOK: high = accept high commLines/nodeCount; low = prefer sparse
  {
    const desired = sliderToUnit(constraints.commOverheadOK);
    const w = sliderWeight(constraints.commOverheadOK);
    // commLines relative to nodeCount, normalized
    const actual = normMap.commDensity[feat._idx];
    scores.push(1 - Math.abs(desired - actual));
    weights.push(w);
  }

  // hierarchyTolerance: high = accept high commandEdgeRatio; low = prefer lateral
  {
    const desired = sliderToUnit(constraints.hierarchyTolerance);
    const w = sliderWeight(constraints.hierarchyTolerance);
    const actual = normMap.commandEdgeRatio[feat._idx];
    scores.push(1 - Math.abs(desired - actual));
    weights.push(w);
  }

  // resilienceNeeded: prefer high resilienceScore, low bottleneckCount, low bridgeCount
  {
    const desired = sliderToUnit(constraints.resilienceNeeded);
    const w = sliderWeight(constraints.resilienceNeeded);
    const rScore = normMap.resilienceScore[feat._idx];
    const invBottle = 1 - normMap.bottleneckCount[feat._idx];
    const invBridge = 1 - normMap.bridgeCount[feat._idx];
    const actual = 0.5 * rScore + 0.25 * invBottle + 0.25 * invBridge;
    scores.push(1 - Math.abs(desired - actual));
    weights.push(w);
  }

  // innovationFocus: prefer high clustering, low commandEdgeRatio, high autonomyIndex
  {
    const desired = sliderToUnit(constraints.innovationFocus);
    const w = sliderWeight(constraints.innovationFocus);
    const clust = normMap.clustering[feat._idx];
    const invCmd = 1 - normMap.commandEdgeRatio[feat._idx];
    const auto = normMap.autonomyIndex[feat._idx];
    const actual = 0.4 * clust + 0.3 * invCmd + 0.3 * auto;
    scores.push(1 - Math.abs(desired - actual));
    weights.push(w);
  }

  // Weighted average
  const totalWeight = weights.reduce((a, b) => a + b, 0);
  if (totalWeight === 0) return 0.5;
  return scores.reduce((sum, s, i) => sum + s * weights[i], 0) / totalWeight;
}

function computeTagScore(constraints, feat) {
  const tags = constraints.tags || [];
  if (tags.length === 0) return { score: 0.5, matched: [], unmatched: [] };

  const allText = [...feat.strengths, ...feat.weaknesses].join(' ');
  const strengthText = feat.strengths.join(' ');

  const matched = [];
  const unmatched = [];

  tags.forEach(tag => {
    // Check strengths first (full match), then all text (partial)
    if (textMatchesTag(strengthText, tag)) {
      matched.push(tag);
    } else if (textMatchesTag(allText, tag)) {
      // Present in weaknesses but not strengths — half credit
      matched.push(tag);
    } else {
      unmatched.push(tag);
    }
  });

  const score = tags.length > 0 ? matched.length / tags.length : 0.5;
  return { score, matched, unmatched };
}

function computeSizeScore(desiredSize, effectiveSize) {
  // Log-scale distance: handles wide range (2 to 10K+)
  if (desiredSize <= 0 || effectiveSize <= 0) return 0.5;
  const logDesired = Math.log10(desiredSize);
  const logActual = Math.log10(effectiveSize);
  const dist = Math.abs(logDesired - logActual);
  // Map distance to 0-1 score. dist=0 -> 1.0, dist=3 (1000x) -> ~0
  return Math.max(0, 1 - dist / 3);
}

// ── Unmatched feature detection ───────────────────────
// Identifies which constraint dimensions are poorly served
// by a given team.

function findUnmatchedFeatures(constraints, feat, normMap) {
  const unmatched = [];
  const THRESHOLD = 0.35; // Distance above which we flag a mismatch

  const checks = [
    { name: 'decisionSpeed',     desired: sliderToUnit(constraints.decisionSpeed),     actual: 0.6 * (1 - normMap.avgPathLength[feat._idx]) + 0.4 * normMap.density[feat._idx] },
    { name: 'autonomyDesired',   desired: sliderToUnit(constraints.autonomyDesired),   actual: normMap.autonomyIndex[feat._idx] },
    { name: 'hierarchyTolerance',desired: sliderToUnit(constraints.hierarchyTolerance),actual: normMap.commandEdgeRatio[feat._idx] },
    { name: 'resilienceNeeded',  desired: sliderToUnit(constraints.resilienceNeeded),  actual: 0.5 * normMap.resilienceScore[feat._idx] + 0.25 * (1 - normMap.bottleneckCount[feat._idx]) + 0.25 * (1 - normMap.bridgeCount[feat._idx]) },
    { name: 'innovationFocus',   desired: sliderToUnit(constraints.innovationFocus),   actual: 0.4 * normMap.clustering[feat._idx] + 0.3 * (1 - normMap.commandEdgeRatio[feat._idx]) + 0.3 * normMap.autonomyIndex[feat._idx] },
  ];

  checks.forEach(({ name, desired, actual }) => {
    if (Math.abs(desired - actual) > THRESHOLD) {
      unmatched.push(name);
    }
  });

  return unmatched;
}

// ── Main entry point ──────────────────────────────────

/**
 * Recommend team structures based on user constraints.
 *
 * @param {Object} constraints - Slider values and tags (see getDefaultConstraints)
 * @param {Array}  allFeatures - Array of { team, analysis } objects for all 29 teams,
 *                               OR the raw TEAMS array (analysis will be computed).
 * @returns {Array<{team, score, featureScore, tagScore, sizeScore, matchedTags, unmatchedFeatures}>}
 *          Sorted by score descending.
 */
export function recommendStructures(constraints, allFeatures) {
  // Determine whether caller passed pre-analyzed data or raw teams
  const entries = allFeatures.map(item => {
    if (item.analysis && item.team) {
      return item;
    }
    // Assume raw team object — compute analysis on the fly
    const team = item;
    const analysis = analyzeTeam(team);
    return { team, analysis };
  });

  // Extract feature vectors
  const features = entries.map(({ team, analysis }) => extractFeatures(team, analysis));

  // Tag each with its index for normalization lookup
  features.forEach((f, i) => { f._idx = i; });

  // Build normalization maps (one array per feature, normalized 0-1)
  const normMap = {
    density:          minMaxNormalize(features.map(f => f.density)),
    clustering:       minMaxNormalize(features.map(f => f.clustering)),
    avgPathLength:    minMaxNormalize(features.map(f => f.avgPathLength)),
    autonomyIndex:    minMaxNormalize(features.map(f => f.autonomyIndex)),
    commandEdgeRatio: minMaxNormalize(features.map(f => f.commandEdgeRatio)),
    resilienceScore:  minMaxNormalize(features.map(f => f.resilienceScore)),
    bottleneckCount:  minMaxNormalize(features.map(f => f.bottleneckCount)),
    bridgeCount:      minMaxNormalize(features.map(f => f.bridgeCount)),
    commDensity:      minMaxNormalize(features.map(f => {
      // Communication overhead relative to team size
      return f.nodeCount > 1 ? f.commLines / (f.nodeCount * (f.nodeCount - 1) / 2) : 0;
    })),
  };

  // Score each team
  const results = features.map((feat, i) => {
    const featureScore = computeFeatureScore(constraints, feat, normMap);
    const tagResult = computeTagScore(constraints, feat);
    const sizeScore = computeSizeScore(constraints.teamSize, feat.effectiveSize);
    const unmatchedFeatures = findUnmatchedFeatures(constraints, feat, normMap);

    // Composite: 50% features, 35% tags, 15% size
    const hasTags = (constraints.tags || []).length > 0;
    const score = hasTags
      ? 0.50 * featureScore + 0.35 * tagResult.score + 0.15 * sizeScore
      : 0.65 * featureScore + 0.35 * sizeScore;

    return {
      team:              entries[i].team,
      score:             Math.round(score * 1000) / 1000,
      featureScore:      Math.round(featureScore * 1000) / 1000,
      tagScore:          Math.round(tagResult.score * 1000) / 1000,
      sizeScore:         Math.round(sizeScore * 1000) / 1000,
      matchedTags:       tagResult.matched,
      unmatchedFeatures: unmatchedFeatures,
    };
  });

  // Sort descending by composite score
  results.sort((a, b) => b.score - a.score);

  return results;
}
