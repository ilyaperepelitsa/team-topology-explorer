/**
 * regression.js — Pure math module for in-browser statistical analysis
 * of team structures. No external dependencies.
 *
 * Provides: pearsonCorrelation, correlationMatrix, linearRegression,
 *           tagCorrelations, groupAnalysis
 */

// ---------------------------------------------------------------------------
// Internal helpers
// ---------------------------------------------------------------------------

/**
 * Arithmetic mean of an array of numbers.
 */
function mean(arr) {
  if (arr.length === 0) return 0;
  let sum = 0;
  for (let i = 0; i < arr.length; i++) sum += arr[i];
  return sum / arr.length;
}

/**
 * Population variance (denominator = n) used internally for OLS.
 * For sample-based statistics the callers adjust as needed.
 */
function variance(arr, mu) {
  if (mu === undefined) mu = mean(arr);
  if (arr.length === 0) return 0;
  let ss = 0;
  for (let i = 0; i < arr.length; i++) {
    const d = arr[i] - mu;
    ss += d * d;
  }
  return ss / arr.length;
}

/**
 * Sample standard deviation (denominator = n-1).
 */
function sampleStd(arr, mu) {
  if (mu === undefined) mu = mean(arr);
  const n = arr.length;
  if (n < 2) return 0;
  let ss = 0;
  for (let i = 0; i < n; i++) {
    const d = arr[i] - mu;
    ss += d * d;
  }
  return Math.sqrt(ss / (n - 1));
}

/**
 * Sample covariance (denominator = n-1).
 */
function covariance(x, y, muX, muY) {
  const n = x.length;
  if (n < 2) return 0;
  let s = 0;
  for (let i = 0; i < n; i++) {
    s += (x[i] - muX) * (y[i] - muY);
  }
  return s / (n - 1);
}

// ---------------------------------------------------------------------------
// t-distribution p-value approximation
// ---------------------------------------------------------------------------

/**
 * Approximate the two-tailed p-value for a given t-statistic and
 * degrees of freedom using the regularised incomplete beta function.
 *
 * p = I_{x}(a, b)  where  x = df / (df + t^2),  a = df/2,  b = 0.5
 *
 * The incomplete beta is evaluated with a continued-fraction expansion
 * (Lentz's algorithm) which converges quickly for the range of df we
 * encounter (1 .. 27).
 */

function lnGamma(z) {
  // Lanczos approximation (g = 7, n = 9)
  const c = [
    0.99999999999980993,
    676.5203681218851,
    -1259.1392167224028,
    771.32342877765313,
    -176.61502916214059,
    12.507343278686905,
    -0.13857109526572012,
    9.9843695780195716e-6,
    1.5056327351493116e-7,
  ];
  if (z < 0.5) {
    // Reflection formula
    return (
      Math.log(Math.PI / Math.sin(Math.PI * z)) - lnGamma(1 - z)
    );
  }
  z -= 1;
  let x = c[0];
  for (let i = 1; i < 9; i++) x += c[i] / (z + i);
  const t = z + 7.5;
  return 0.5 * Math.log(2 * Math.PI) + (z + 0.5) * Math.log(t) - t + Math.log(x);
}

/**
 * Regularised incomplete beta function I_x(a, b) via continued fraction
 * (modified Lentz algorithm).
 */
function betaIncomplete(x, a, b) {
  if (x <= 0) return 0;
  if (x >= 1) return 1;

  // Use the symmetry relation when x > (a+1)/(a+b+2) for faster convergence
  if (x > (a + 1) / (a + b + 2)) {
    return 1 - betaIncomplete(1 - x, b, a);
  }

  const lnPrefactor =
    a * Math.log(x) + b * Math.log(1 - x) -
    Math.log(a) -
    (lnGamma(a) + lnGamma(b) - lnGamma(a + b));

  const prefactor = Math.exp(lnPrefactor);

  // Lentz continued fraction for I_x(a,b)
  const maxIter = 200;
  const eps = 1e-14;
  const tiny = 1e-30;

  let c = 1;
  let d = 1 - (a + b) * x / (a + 1);
  if (Math.abs(d) < tiny) d = tiny;
  d = 1 / d;
  let h = d;

  for (let m = 1; m <= maxIter; m++) {
    // Even step: d_{2m}
    let m2 = 2 * m;
    let num = (m * (b - m) * x) / ((a + m2 - 1) * (a + m2));
    d = 1 + num * d;
    if (Math.abs(d) < tiny) d = tiny;
    c = 1 + num / c;
    if (Math.abs(c) < tiny) c = tiny;
    d = 1 / d;
    h *= d * c;

    // Odd step: d_{2m+1}
    num = -((a + m) * (a + b + m) * x) / ((a + m2) * (a + m2 + 1));
    d = 1 + num * d;
    if (Math.abs(d) < tiny) d = tiny;
    c = 1 + num / c;
    if (Math.abs(c) < tiny) c = tiny;
    d = 1 / d;
    const delta = d * c;
    h *= delta;

    if (Math.abs(delta - 1) < eps) break;
  }

  return prefactor * h;
}

/**
 * Two-tailed p-value from t-distribution with `df` degrees of freedom.
 */
function tDistPValue(t, df) {
  if (!isFinite(t) || df <= 0) return 1;
  const x = df / (df + t * t);
  const p = betaIncomplete(x, df / 2, 0.5);
  return p; // already two-tailed because I_x(df/2, 1/2) gives the two-tail area
}

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

/**
 * Pearson product-moment correlation coefficient.
 *
 * @param {number[]} x
 * @param {number[]} y
 * @returns {{ r: number, p: number, n: number }}
 */
export function pearsonCorrelation(x, y) {
  const n = Math.min(x.length, y.length);
  if (n < 3) {
    return { r: NaN, p: NaN, n };
  }

  const muX = mean(x);
  const muY = mean(y);
  const sdX = sampleStd(x, muX);
  const sdY = sampleStd(y, muY);

  if (sdX === 0 || sdY === 0) {
    return { r: 0, p: 1, n };
  }

  const cov = covariance(x, y, muX, muY);
  let r = cov / (sdX * sdY);

  // Clamp to [-1, 1] to guard against floating-point drift
  r = Math.max(-1, Math.min(1, r));

  // t-statistic for significance test
  const denom = 1 - r * r;
  let p;
  if (denom <= 0) {
    // Perfect correlation — p ~ 0
    p = 0;
  } else {
    const t = r * Math.sqrt((n - 2) / denom);
    p = tDistPValue(t, n - 2);
  }

  return { r, p, n };
}

/**
 * Pairwise Pearson correlation matrix for a set of named features.
 *
 * @param {string[]} featureNames
 * @param {Object[]} featureMatrix - array of objects keyed by feature name
 * @returns {{ labels: string[], matrix: number[][] }}
 */
export function correlationMatrix(featureNames, featureMatrix) {
  const k = featureNames.length;
  const n = featureMatrix.length;

  // Extract columns once
  const columns = featureNames.map((name) => {
    const col = new Array(n);
    for (let i = 0; i < n; i++) {
      col[i] = Number(featureMatrix[i][name]) || 0;
    }
    return col;
  });

  const matrix = [];
  for (let i = 0; i < k; i++) {
    const row = new Array(k);
    for (let j = 0; j < k; j++) {
      if (i === j) {
        row[j] = 1;
      } else if (j < i) {
        // Already computed — symmetric
        row[j] = matrix[j][i];
      } else {
        row[j] = pearsonCorrelation(columns[i], columns[j]).r;
      }
    }
    matrix.push(row);
  }

  return { labels: featureNames.slice(), matrix };
}

/**
 * Simple ordinary least-squares linear regression.
 *
 * @param {number[]} x - predictor
 * @param {number[]} y - response
 * @returns {{ slope: number, intercept: number, r2: number, p: number, equation: string }}
 */
export function linearRegression(x, y) {
  const n = Math.min(x.length, y.length);
  if (n < 3) {
    return { slope: NaN, intercept: NaN, r2: NaN, p: NaN, equation: 'insufficient data' };
  }

  const muX = mean(x);
  const muY = mean(y);

  // Population variance for OLS slope (sum of squares / n)
  const varX = variance(x, muX);
  if (varX === 0) {
    return { slope: NaN, intercept: muY, r2: NaN, p: NaN, equation: `y = ${muY.toFixed(4)}` };
  }

  // Population covariance for OLS (sum of cross-products / n)
  let covXY = 0;
  for (let i = 0; i < n; i++) {
    covXY += (x[i] - muX) * (y[i] - muY);
  }
  covXY /= n;

  const slope = covXY / varX;
  const intercept = muY - slope * muX;

  // R-squared
  const { r, p } = pearsonCorrelation(x, y);
  const r2 = r * r;

  // Human-readable equation
  const sign = intercept >= 0 ? '+' : '-';
  const equation = `y = ${slope.toFixed(4)}x ${sign} ${Math.abs(intercept).toFixed(4)}`;

  return { slope, intercept, r2, p, equation };
}

/**
 * Point-biserial (= Pearson) correlations between binary tag indicators
 * and all numeric features.
 *
 * @param {Object[]} allFeatures - output of feature-extractor.js
 * @param {'strengths'|'weaknesses'} tagType
 * @returns {Array<{ tag: string, count: number, correlations: Array<{feature: string, r: number, p: number}> }>}
 */
export function tagCorrelations(allFeatures, tagType) {
  const n = allFeatures.length;
  if (n === 0) return [];

  // Determine which bucket field to read. Accept both plain tag arrays and
  // the pre-bucketed variants.
  const bucketField = tagType === 'strengths' ? 'strengthBuckets' : 'weaknessBuckets';

  // Collect every unique tag
  const tagSet = new Set();
  for (let i = 0; i < n; i++) {
    const outcomes = allFeatures[i].outcomes;
    const tags = outcomes[bucketField] || outcomes[tagType] || [];
    for (let j = 0; j < tags.length; j++) tagSet.add(tags[j]);
  }

  // Enumerate numeric feature names from the first entry
  const featureKeys = Object.keys(allFeatures[0].features).filter(
    (k) => typeof allFeatures[0].features[k] === 'number'
  );

  // Pre-extract numeric columns
  const featureCols = {};
  for (const key of featureKeys) {
    const col = new Array(n);
    for (let i = 0; i < n; i++) {
      col[i] = Number(allFeatures[i].features[key]) || 0;
    }
    featureCols[key] = col;
  }

  const results = [];

  for (const tag of tagSet) {
    // Build binary indicator vector for this tag
    const indicator = new Array(n);
    let count = 0;
    for (let i = 0; i < n; i++) {
      const outcomes = allFeatures[i].outcomes;
      const tags = outcomes[bucketField] || outcomes[tagType] || [];
      const present = tags.indexOf(tag) !== -1 ? 1 : 0;
      indicator[i] = present;
      count += present;
    }

    // Skip tags that are constant (present everywhere or nowhere)
    if (count === 0 || count === n) continue;

    const correlations = [];
    for (const key of featureKeys) {
      const { r, p } = pearsonCorrelation(indicator, featureCols[key]);
      correlations.push({ feature: key, r, p });
    }

    // Sort by absolute r descending
    correlations.sort((a, b) => Math.abs(b.r) - Math.abs(a.r));

    results.push({ tag, count, correlations });
  }

  // Sort result tags by highest absolute correlation found
  results.sort((a, b) => {
    const maxA = a.correlations.length > 0 ? Math.abs(a.correlations[0].r) : 0;
    const maxB = b.correlations.length > 0 ? Math.abs(b.correlations[0].r) : 0;
    return maxB - maxA;
  });

  return results;
}

/**
 * One-way between-groups analysis for a categorical field.
 *
 * @param {Object[]} allFeatures - output of feature-extractor.js
 * @param {'topologyType'|'hierarchyType'|'category'} groupField
 * @returns {Array<{ group: string, count: number, means: Object, fStatistic: number }>}
 */
export function groupAnalysis(allFeatures, groupField) {
  const n = allFeatures.length;
  if (n === 0) return [];

  // Enumerate numeric feature keys
  const featureKeys = Object.keys(allFeatures[0].features).filter(
    (k) => typeof allFeatures[0].features[k] === 'number'
  );

  // Partition into groups
  const groups = {};
  for (let i = 0; i < n; i++) {
    const label = String(allFeatures[i].outcomes[groupField] || 'unknown');
    if (!groups[label]) groups[label] = [];
    groups[label].push(allFeatures[i]);
  }

  const groupLabels = Object.keys(groups);
  const k = groupLabels.length;

  // Compute grand means per feature
  const grandMeans = {};
  for (const feat of featureKeys) {
    let s = 0;
    for (let i = 0; i < n; i++) s += Number(allFeatures[i].features[feat]) || 0;
    grandMeans[feat] = s / n;
  }

  // Compute F-statistic per feature (one-way ANOVA)
  // F = (SSB / (k-1)) / (SSW / (n-k))
  const fStats = {};
  for (const feat of featureKeys) {
    let ssb = 0; // between-group sum of squares
    let ssw = 0; // within-group sum of squares
    for (const label of groupLabels) {
      const members = groups[label];
      const nj = members.length;
      let groupSum = 0;
      for (let i = 0; i < nj; i++) {
        groupSum += Number(members[i].features[feat]) || 0;
      }
      const groupMean = groupSum / nj;
      ssb += nj * (groupMean - grandMeans[feat]) * (groupMean - grandMeans[feat]);
      for (let i = 0; i < nj; i++) {
        const val = Number(members[i].features[feat]) || 0;
        ssw += (val - groupMean) * (val - groupMean);
      }
    }
    const dfBetween = k - 1;
    const dfWithin = n - k;
    if (dfBetween <= 0 || dfWithin <= 0 || ssw === 0) {
      fStats[feat] = ssb > 0 ? Infinity : 0;
    } else {
      fStats[feat] = (ssb / dfBetween) / (ssw / dfWithin);
    }
  }

  // Build result per group
  const results = [];
  for (const label of groupLabels) {
    const members = groups[label];
    const count = members.length;
    const means = {};
    for (const feat of featureKeys) {
      let s = 0;
      for (let i = 0; i < count; i++) {
        s += Number(members[i].features[feat]) || 0;
      }
      means[feat] = s / count;
    }

    // Assign the average F-statistic across all features as a summary measure
    // for this group. Individual per-feature F values are the same across groups
    // (F is a property of the partition, not of a single group), so we attach
    // the maximum F to highlight the most discriminating feature.
    let maxF = 0;
    for (const feat of featureKeys) {
      if (fStats[feat] > maxF) maxF = fStats[feat];
    }

    results.push({ group: label, count, means, fStatistic: maxF });
  }

  // Sort groups by count descending
  results.sort((a, b) => b.count - a.count);

  // Attach per-feature F-statistics to each group for downstream consumers
  for (const entry of results) {
    entry.featureFStats = { ...fStats };
  }

  return results;
}
