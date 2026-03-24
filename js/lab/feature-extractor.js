// ======================================================
// FEATURE EXTRACTOR
// Extracts numeric feature vectors from all 29 teams
// for downstream ML/analysis pipelines
// ======================================================

import { TEAMS } from '../data/teams.js';
import { analyzeTeam } from '../analysis.js';

// ── Analysis cache ──
const analysisCache = new Map();

function getCachedAnalysis(team) {
  if (!analysisCache.has(team.id)) {
    analysisCache.set(team.id, analyzeTeam(team));
  }
  return analysisCache.get(team.id);
}

// ══════════════════════════════════════════════════
// SIZE PARSER
// Handles: '4', '9-13', '5+bench', '100-5K', '50-40K',
//   '1-10K+', '100-100K+', '3-15/team', '2-3', '20+',
//   '5-50', '60-100', '5+coach', '4500-5500', '300-400'
// ══════════════════════════════════════════════════

function parseNumber(raw) {
  // Trim whitespace
  let s = raw.trim();

  // Remove trailing '+' (e.g. "100K+" -> "100K", "20+" -> "20")
  s = s.replace(/\+$/, '');

  // Handle K suffix: "5K" -> 5000, "40K" -> 40000, "100K" -> 100000, "10K" -> 10000
  const kMatch = s.match(/^(\d+(?:\.\d+)?)K$/i);
  if (kMatch) {
    return parseFloat(kMatch[1]) * 1000;
  }

  const num = parseFloat(s);
  return isNaN(num) ? null : num;
}

function parseSize(sizeStr) {
  if (!sizeStr || typeof sizeStr !== 'string') {
    return { minSize: 0, maxSize: 0, effectiveSize: 0 };
  }

  let cleaned = sizeStr.trim();

  // Strip annotations like "+bench", "+coach", "/team"
  // e.g. "5+bench" -> "5", "5+coach" -> "5", "3-15/team" -> "3-15"
  cleaned = cleaned.replace(/\+(?:bench|coach)\b/i, '');
  cleaned = cleaned.replace(/\/team\b/i, '');
  cleaned = cleaned.trim();

  // Check for range pattern: "min-max" (possibly with K suffixes and trailing +)
  // Must handle: "9-13", "100-5K", "50-40K", "1-10K+", "100-100K+", "4500-5500"
  const rangeMatch = cleaned.match(/^(\d+(?:\.\d+)?K?\+?)\s*-\s*(\d+(?:\.\d+)?K?\+?)$/i);
  if (rangeMatch) {
    const min = parseNumber(rangeMatch[1]);
    const max = parseNumber(rangeMatch[2]);
    if (min !== null && max !== null) {
      return {
        minSize: min,
        maxSize: max,
        effectiveSize: Math.round((min + max) / 2),
      };
    }
  }

  // Check for single number with optional trailing + (e.g. "20+", "4", "16")
  const singleMatch = cleaned.match(/^(\d+(?:\.\d+)?K?)\+?$/i);
  if (singleMatch) {
    const val = parseNumber(singleMatch[1]);
    if (val !== null) {
      return {
        minSize: val,
        maxSize: val,
        effectiveSize: val,
      };
    }
  }

  // Fallback
  return { minSize: 0, maxSize: 0, effectiveSize: 0 };
}

// ══════════════════════════════════════════════════
// SEMANTIC BUCKET NORMALIZATION (~15 buckets)
// Maps diverse strength/weakness phrases into
// canonical semantic categories via keyword matching
// ══════════════════════════════════════════════════

const SEMANTIC_BUCKETS = [
  {
    bucket: 'speed',
    keywords: ['fast', 'speed', 'quick', 'rapid', 'sub-3s', 'maximum speed', 'zero coordination cost', 'real-time'],
  },
  {
    bucket: 'cohesion',
    keywords: ['cohesion', 'trust', 'bonding', 'bonds', 'family', 'loyalty', 'omerta', 'ritual', 'pseudo-family', 'cultural roots'],
  },
  {
    bucket: 'redundancy',
    keywords: ['redundancy', 'redundant', 'cross-training', 'cross-train', 'buddy pair', 'paired', 'connectivity', 'mesh'],
  },
  {
    bucket: 'autonomy',
    keywords: ['autonomy', 'autonomous', 'self-sufficient', 'self-contained', 'independent', 'no bureaucracy', 'no org boundaries'],
  },
  {
    bucket: 'clarity',
    keywords: ['clear', 'clarity', 'role clarity', 'accountability', 'defined', 'zero ambiguity', 'ownership'],
  },
  {
    bucket: 'scalability',
    keywords: ['scalab', 'infinitely scalable', 'career paths', 'nesting', 'nested'],
  },
  {
    bucket: 'resilience',
    keywords: ['resilient', 'resilience', 'redundancy', 'fault', 'backup'],
  },
  {
    bucket: 'innovation',
    keywords: ['innovation', 'creative', 'vision', 'knowledge', 'preservation', 'protocol', 'shared protocol'],
  },
  {
    bucket: 'specialization',
    keywords: ['specializ', 'expertise', 'deep', 'domain', 'force multiplier', 'language-trained'],
  },
  {
    bucket: 'legitimacy',
    keywords: ['legitimacy', 'democratic', 'constitutional', 'legal', 'authority', 'meritocratic', 'fair'],
  },
  {
    bucket: 'coordination',
    keywords: ['coordination', 'alignment', 'maneuver', 'cross-cutting', 'movement', 'transition'],
  },
  {
    bucket: 'security',
    keywords: ['compartment', 'insulation', 'insulated', 'security', 'defense', 'vulnerabilit'],
  },
  {
    bucket: 'focus',
    keywords: ['focus', 'intense', 'hardest problem', 'best on', 'execution'],
  },
  {
    bucket: 'cost',
    keywords: ['cheap', 'cost', 'incentive', 'aligned incentive', 'deal flow', 'network', 'quality control', 'safety net'],
  },
  {
    bucket: 'fragility',
    keywords: [
      'single point', 'dependency', 'dependent', 'bus factor', 'burnout', 'fragil',
      'casualty', 'loss', 'small', 'only 4', 'zero casualty', 'no heavy',
      'cognitive load', 'skill ceiling', 'autocracy', 'no adaptability',
      'error', 'race-losing', 'matchup', 'star dominance',
      'expensive', 'pipeline', 'hostile', 'no continuity', 'disrupts',
      'slow decision', 'silo', 'filtering', 'clique', 'hidden hierarch',
      'groupthink', 'duplication', 'inter-team gap', 'over-hyped', 'maturity',
      'succession', 'political', 'exclusionary', 'resisted', 'gatekeeper',
      'go native', 'veto', 'paralysis', '1945', 'power distribution',
      'long hours', 'adversarial culture', 'lockup', 'power law returns',
      'aging', 'anti-exclusion', 'rico', 'witness', 'broke omerta',
      'not scalable', 'champion',
    ],
  },
];

function classifyPhrase(phrase) {
  const lower = phrase.toLowerCase();
  const matches = [];
  for (const { bucket, keywords } of SEMANTIC_BUCKETS) {
    for (const kw of keywords) {
      if (lower.includes(kw.toLowerCase())) {
        matches.push(bucket);
        break; // one match per bucket is enough
      }
    }
  }
  // If nothing matched, return 'other'
  return matches.length > 0 ? matches : ['other'];
}

function normalizePhrases(phrases) {
  const bucketSet = new Set();
  for (const phrase of phrases) {
    const buckets = classifyPhrase(phrase);
    buckets.forEach(b => bucketSet.add(b));
  }
  return Array.from(bucketSet).sort();
}

// ══════════════════════════════════════════════════
// FEATURE VECTOR EXTRACTION
// ══════════════════════════════════════════════════

function extractFeatures(team, analysis) {
  const m = analysis.metrics;
  const { minSize, maxSize, effectiveSize } = parseSize(team.size);

  return {
    // Graph metrics
    density: team.dens,
    clustering: team.clust,
    nodeCount: m.nodeCount,
    edgeCount: m.edgeCount,
    avgPathLength: m.avgPathLength,
    diameter: m.diameter,

    // Structural metrics
    autonomyIndex: m.autonomyIndex,
    commandEdgeRatio: m.commandEdgeRatio,
    leaderRatio: m.leaderRatio,
    globalClustering: m.globalClustering,

    // Scale metrics
    commLines: m.commLines,
    resilienceScore: analysis.resilience.score,
    bottleneckCount: analysis.bottlenecks.length,
    hubCount: analysis.hubs.length,
    bridgeCount: analysis.bridges.length,

    // Parsed size
    effectiveSize,
  };
}

function extractOutcomes(team) {
  const rawStrengths = team.str || [];
  const rawWeaknesses = team.wk || [];

  return {
    topologyType: team.topo,
    hierarchyType: team.hier,
    strengths: rawStrengths,
    weaknesses: rawWeaknesses,
    strengthBuckets: normalizePhrases(rawStrengths),
    weaknessBuckets: normalizePhrases(rawWeaknesses),
    category: team.cat,
  };
}

// ══════════════════════════════════════════════════
// PUBLIC API
// ══════════════════════════════════════════════════

/**
 * Extract standardized feature vectors, outcome vectors,
 * and cached analysis for every team.
 *
 * @param {Array} teams - The TEAMS array from data/teams.js
 * @returns {Array<{ team: object, features: object, outcomes: object, analysis: object }>}
 */
export function extractAllFeatures(teams) {
  return teams.map(team => {
    const analysis = getCachedAnalysis(team);
    return {
      team,
      features: extractFeatures(team, analysis),
      outcomes: extractOutcomes(team),
      analysis,
    };
  });
}

// Default export using the canonical TEAMS array
export default extractAllFeatures(TEAMS);
