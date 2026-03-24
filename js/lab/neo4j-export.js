// ======================================================
// NEO4J EXPORT - generates Neo4j-compatible exports
// from team topology data (Cypher, CSV, query engine)
// ======================================================

import { TEAMS } from '../data/teams.js';
import { CATS } from '../data/categories.js';
import { XLINKS } from '../data/crosslinks.js';
import { classifyRole } from '../data/colors.js';

// ── Helpers ──────────────────────────────────────────────

/** Escape a string for Cypher single-quoted literals */
function cypherEsc(s) {
  if (s == null) return '';
  return String(s).replace(/\\/g, '\\\\').replace(/'/g, "\\'");
}

/** Escape a value for CSV (RFC 4180) */
function csvEsc(v) {
  if (v == null) return '';
  const s = String(v);
  if (s.includes(',') || s.includes('"') || s.includes('\n')) {
    return '"' + s.replace(/"/g, '""') + '"';
  }
  return s;
}

/** Build a lookup from allFeatures by team id */
function featuresByTeamId(allFeatures) {
  const map = {};
  if (!allFeatures) return map;
  for (const entry of allFeatures) {
    const id = entry.team && entry.team.id;
    if (id) map[id] = entry;
  }
  return map;
}

// ══════════════════════════════════════════════════════════
// 1. CYPHER EXPORT
// ══════════════════════════════════════════════════════════

/**
 * Generate a complete Cypher script that creates the full
 * team topology graph in Neo4j.
 *
 * @param {Array}  teams       - TEAMS array
 * @param {Array}  xlinks      - XLINKS array
 * @param {Object} cats        - CATS object
 * @param {Array}  allFeatures - [{team, features, outcomes}, ...]
 * @returns {string} Cypher script
 */
export function generateCypherExport(teams, xlinks, cats, allFeatures) {
  const lines = [];
  const fMap = featuresByTeamId(allFeatures);

  lines.push('// ── Neo4j Cypher Export ─ Team Topology Explorer ──');
  lines.push('// Generated ' + new Date().toISOString());
  lines.push('');

  // ── Indexes ──
  lines.push('// Indexes');
  lines.push('CREATE INDEX team_id IF NOT EXISTS FOR (t:Team) ON (t.id);');
  lines.push('CREATE INDEX role_id IF NOT EXISTS FOR (r:Role) ON (r.id);');
  lines.push('CREATE INDEX cat_name IF NOT EXISTS FOR (c:Category) ON (c.name);');
  lines.push('');

  // ── Category nodes ──
  lines.push('// Category nodes');
  for (const [key, cat] of Object.entries(cats)) {
    lines.push(
      `CREATE (:Category {name: '${cypherEsc(key)}', label: '${cypherEsc(cat.label)}', color: '${cypherEsc(cat.color)}', shape: '${cypherEsc(cat.shape)}'});`
    );
  }
  lines.push('');

  // ── Team nodes ──
  lines.push('// Team nodes');
  for (const team of teams) {
    const props = [
      `id: '${cypherEsc(team.id)}'`,
      `name: '${cypherEsc(team.name)}'`,
      `category: '${cypherEsc(team.cat)}'`,
      `density: ${team.dens}`,
      `clustering: ${team.clust}`,
      `topology: '${cypherEsc(team.topo)}'`,
      `hierarchy: '${cypherEsc(team.hier)}'`,
      `size: '${cypherEsc(team.size)}'`,
    ];

    // Append computed features / outcomes from allFeatures
    const entry = fMap[team.id];
    if (entry) {
      if (entry.features) {
        for (const [k, v] of Object.entries(entry.features)) {
          if (typeof v === 'number') {
            props.push(`${k}: ${v}`);
          } else if (typeof v === 'string') {
            props.push(`${k}: '${cypherEsc(v)}'`);
          } else if (typeof v === 'boolean') {
            props.push(`${k}: ${v}`);
          }
        }
      }
      if (entry.outcomes) {
        for (const [k, v] of Object.entries(entry.outcomes)) {
          if (typeof v === 'number') {
            props.push(`outcome_${k}: ${v}`);
          } else if (typeof v === 'string') {
            props.push(`outcome_${k}: '${cypherEsc(v)}'`);
          } else if (typeof v === 'boolean') {
            props.push(`outcome_${k}: ${v}`);
          }
        }
      }
    }

    lines.push(`CREATE (:Team {${props.join(', ')}});`);
  }
  lines.push('');

  // ── Category -> Team links ──
  lines.push('// Category-Team relationships');
  for (const team of teams) {
    lines.push(
      `MATCH (t:Team {id: '${cypherEsc(team.id)}'}), (c:Category {name: '${cypherEsc(team.cat)}'})` +
      ` CREATE (t)-[:IN_CATEGORY]->(c);`
    );
  }
  lines.push('');

  // ── Role nodes + BELONGS_TO ──
  lines.push('// Role nodes and BELONGS_TO relationships');
  for (const team of teams) {
    for (const role of team.roles) {
      const roleClass = classifyRole(role);
      const globalRoleId = `${team.id}__${role.id}`;
      const rProps = [
        `id: '${cypherEsc(globalRoleId)}'`,
        `localId: '${cypherEsc(role.id)}'`,
        `label: '${cypherEsc(role.label)}'`,
        `desc: '${cypherEsc(role.desc)}'`,
        `isLeader: ${!!role.leader}`,
        `roleClass: '${cypherEsc(roleClass)}'`,
        `teamId: '${cypherEsc(team.id)}'`,
      ];
      lines.push(`CREATE (:Role {${rProps.join(', ')}});`);
    }
  }
  lines.push('');

  lines.push('// BELONGS_TO relationships (Role -> Team)');
  for (const team of teams) {
    for (const role of team.roles) {
      const globalRoleId = `${team.id}__${role.id}`;
      lines.push(
        `MATCH (r:Role {id: '${cypherEsc(globalRoleId)}'}), (t:Team {id: '${cypherEsc(team.id)}'})` +
        ` CREATE (r)-[:BELONGS_TO]->(t);`
      );
    }
  }
  lines.push('');

  // ── Intra-team edges ──
  lines.push('// Intra-team relationships');
  for (const team of teams) {
    for (const edge of team.edges) {
      const srcId = `${team.id}__${edge.s}`;
      const tgtId = `${team.id}__${edge.t}`;
      const relType = edge.type
        .toUpperCase()
        .replace(/[^A-Z0-9_]/g, '_')
        .replace(/_+/g, '_')
        .replace(/^_|_$/g, '');
      lines.push(
        `MATCH (a:Role {id: '${cypherEsc(srcId)}'}), (b:Role {id: '${cypherEsc(tgtId)}'})` +
        ` CREATE (a)-[:${relType} {originalType: '${cypherEsc(edge.type)}'}]->(b);`
      );
    }
  }
  lines.push('');

  // ── Cross-team relationships ──
  lines.push('// Cross-team RELATED_TO relationships');
  for (const link of xlinks) {
    lines.push(
      `MATCH (a:Team {id: '${cypherEsc(link.s)}'}), (b:Team {id: '${cypherEsc(link.t)}'})` +
      ` CREATE (a)-[:RELATED_TO {description: '${cypherEsc(link.r)}'}]->(b);`
    );
  }
  lines.push('');

  return lines.join('\n');
}

// ══════════════════════════════════════════════════════════
// 2. CSV EXPORT
// ══════════════════════════════════════════════════════════

/**
 * Generate three CSV strings following Neo4j admin import format.
 *
 * @param {Array}  teams       - TEAMS array
 * @param {Array}  xlinks      - XLINKS array
 * @param {Object} cats        - CATS object
 * @param {Array}  allFeatures - [{team, features, outcomes}, ...]
 * @returns {{ teams: string, roles: string, relationships: string }}
 */
export function generateCSVExport(teams, xlinks, cats, allFeatures) {
  const fMap = featuresByTeamId(allFeatures);

  // ── teams.csv ──
  const teamHeader = 'teamId:ID,name,category,density:float,clustering:float,topology,hierarchy,:LABEL';
  const teamRows = teams.map(t => {
    return [
      csvEsc(t.id),
      csvEsc(t.name),
      csvEsc(t.cat),
      t.dens,
      t.clust,
      csvEsc(t.topo),
      csvEsc(t.hier),
      'Team',
    ].join(',');
  });
  const teamsCSV = [teamHeader, ...teamRows].join('\n');

  // ── roles.csv ──
  const roleHeader = 'roleId:ID,teamId,label,description,isLeader:boolean,roleClass,:LABEL';
  const roleRows = [];
  for (const team of teams) {
    for (const role of team.roles) {
      const globalId = `${team.id}__${role.id}`;
      const roleClass = classifyRole(role);
      roleRows.push([
        csvEsc(globalId),
        csvEsc(team.id),
        csvEsc(role.label),
        csvEsc(role.desc),
        !!role.leader,
        csvEsc(roleClass),
        'Role',
      ].join(','));
    }
  }
  const rolesCSV = [roleHeader, ...roleRows].join('\n');

  // ── relationships.csv ──
  const relHeader = ':START_ID,:END_ID,:TYPE,description,originalType';
  const relRows = [];

  // BELONGS_TO
  for (const team of teams) {
    for (const role of team.roles) {
      const globalId = `${team.id}__${role.id}`;
      relRows.push([
        csvEsc(globalId),
        csvEsc(team.id),
        'BELONGS_TO',
        '',
        '',
      ].join(','));
    }
  }

  // Intra-team edges
  for (const team of teams) {
    for (const edge of team.edges) {
      const srcId = `${team.id}__${edge.s}`;
      const tgtId = `${team.id}__${edge.t}`;
      const relType = edge.type
        .toUpperCase()
        .replace(/[^A-Z0-9_]/g, '_')
        .replace(/_+/g, '_')
        .replace(/^_|_$/g, '');
      relRows.push([
        csvEsc(srcId),
        csvEsc(tgtId),
        csvEsc(relType),
        '',
        csvEsc(edge.type),
      ].join(','));
    }
  }

  // Cross-team RELATED_TO
  for (const link of xlinks) {
    relRows.push([
      csvEsc(link.s),
      csvEsc(link.t),
      'RELATED_TO',
      csvEsc(link.r),
      '',
    ].join(','));
  }

  // IN_CATEGORY
  for (const team of teams) {
    relRows.push([
      csvEsc(team.id),
      csvEsc(team.cat),
      'IN_CATEGORY',
      '',
      '',
    ].join(','));
  }

  const relationshipsCSV = [relHeader, ...relRows].join('\n');

  return {
    teams: teamsCSV,
    roles: rolesCSV,
    relationships: relationshipsCSV,
  };
}

// ══════════════════════════════════════════════════════════
// 3. SIMPLIFIED CYPHER-LIKE QUERY ENGINE
// ══════════════════════════════════════════════════════════

/**
 * Execute a simplified Cypher query against teams data.
 *
 * Supported patterns:
 *   MATCH (t:Team) WHERE <condition> RETURN <fields> ORDER BY <field> [DESC] LIMIT <n>
 *   MATCH (t:Team) RETURN <fields/aggregates> ORDER BY <field> [DESC] LIMIT <n>
 *
 * @param {string} queryString - simplified Cypher query
 * @param {Array}  teams       - TEAMS array
 * @param {Array}  allFeatures - [{team, features, outcomes}, ...]
 * @returns {{ columns: string[], rows: any[][], error: string|null }}
 */
export function executeCypherLikeQuery(queryString, teams, allFeatures) {
  try {
    const q = queryString.trim();
    const fMap = featuresByTeamId(allFeatures);

    // ── Parse MATCH clause ──
    const matchRe = /MATCH\s+\((\w+):Team\)/i;
    const matchM = q.match(matchRe);
    if (!matchM) {
      return { columns: [], rows: [], error: 'Only MATCH (alias:Team) patterns are supported.' };
    }
    const alias = matchM[1];

    // ── Parse WHERE clause ──
    const whereRe = new RegExp(`WHERE\\s+(.+?)\\s+RETURN`, 'i');
    const whereM = q.match(whereRe);
    const whereClause = whereM ? whereM[1].trim() : null;

    // ── Parse RETURN clause ──
    const returnRe = /RETURN\s+(.+?)(?:\s+ORDER\s+BY|\s+LIMIT|\s*$)/i;
    const returnM = q.match(returnRe);
    if (!returnM) {
      return { columns: [], rows: [], error: 'Missing RETURN clause.' };
    }
    const returnClause = returnM[1].trim();

    // ── Parse ORDER BY ──
    const orderRe = /ORDER\s+BY\s+(.+?)(?:\s+LIMIT|\s*$)/i;
    const orderM = q.match(orderRe);
    let orderField = null;
    let orderDesc = false;
    if (orderM) {
      let ob = orderM[1].trim();
      if (/\bDESC\s*$/i.test(ob)) {
        orderDesc = true;
        ob = ob.replace(/\s+DESC\s*$/i, '').trim();
      } else if (/\bASC\s*$/i.test(ob)) {
        ob = ob.replace(/\s+ASC\s*$/i, '').trim();
      }
      orderField = ob;
    }

    // ── Parse LIMIT ──
    const limitRe = /LIMIT\s+(\d+)/i;
    const limitM = q.match(limitRe);
    const limit = limitM ? parseInt(limitM[1], 10) : null;

    // ── Resolve a dotted property like t.density ──
    function resolveProperty(propExpr, team) {
      const dotRe = new RegExp(`^${alias}\\.(.+)$`);
      const dm = propExpr.trim().match(dotRe);
      if (!dm) return undefined;
      const prop = dm[1];
      return getTeamProperty(team, prop, fMap);
    }

    // ── Build data rows from teams ──
    let data = teams.map(t => ({ _team: t }));

    // ── Apply WHERE filter ──
    if (whereClause) {
      const filterFn = buildFilterFunction(whereClause, alias, fMap);
      data = data.filter(row => filterFn(row._team));
    }

    // ── Detect aggregation ──
    const aggRe = /\b(count|avg|sum|min|max)\s*\(\s*(\*|[\w.]+)\s*\)/gi;
    const returnFields = parseReturnFields(returnClause, alias);
    const hasAgg = returnFields.some(f => f.aggregate);

    if (hasAgg) {
      // Group by non-aggregate fields
      const groupByFields = returnFields.filter(f => !f.aggregate);
      const aggFields = returnFields.filter(f => f.aggregate);

      if (groupByFields.length === 0) {
        // Global aggregation
        const row = [];
        const columns = [];
        for (const f of returnFields) {
          columns.push(f.display);
          if (f.aggregate) {
            row.push(computeAggregate(f.aggregate, f.aggProp, data, alias, fMap));
          }
        }
        return { columns, rows: [row], error: null };
      }

      // Grouped aggregation
      const groups = {};
      for (const row of data) {
        const key = groupByFields.map(f => {
          const val = getTeamProperty(row._team, f.prop, fMap);
          return val == null ? '' : String(val);
        }).join('|||');
        if (!groups[key]) groups[key] = [];
        groups[key].push(row);
      }

      const columns = returnFields.map(f => f.display);
      let rows = [];
      for (const [key, groupRows] of Object.entries(groups)) {
        const keyParts = key.split('|||');
        const outRow = [];
        let gbIdx = 0;
        for (const f of returnFields) {
          if (f.aggregate) {
            outRow.push(computeAggregate(f.aggregate, f.aggProp, groupRows, alias, fMap));
          } else {
            outRow.push(keyParts[gbIdx++]);
          }
        }
        rows.push(outRow);
      }

      // ORDER BY for aggregated results
      if (orderField) {
        const orderIdx = columns.findIndex(c => {
          const normalizedOrder = orderField.replace(new RegExp(`^${alias}\\.`, 'i'), '');
          return c === orderField || c === normalizedOrder ||
                 c.toLowerCase() === orderField.toLowerCase();
        });
        if (orderIdx >= 0) {
          rows.sort((a, b) => {
            const va = a[orderIdx], vb = b[orderIdx];
            const na = typeof va === 'number' ? va : parseFloat(va);
            const nb = typeof vb === 'number' ? vb : parseFloat(vb);
            if (!isNaN(na) && !isNaN(nb)) return orderDesc ? nb - na : na - nb;
            return orderDesc
              ? String(vb).localeCompare(String(va))
              : String(va).localeCompare(String(vb));
          });
        }
      }

      if (limit != null) rows = rows.slice(0, limit);
      return { columns, rows, error: null };
    }

    // ── Non-aggregate: simple property selection ──
    // Check if RETURN is just the alias (return full object)
    const returnsWholeNode = returnFields.length === 1 && returnFields[0].wholeNode;

    let columns;
    if (returnsWholeNode) {
      columns = ['id', 'name', 'category', 'density', 'clustering', 'topology', 'hierarchy', 'size'];
    } else {
      columns = returnFields.map(f => f.display);
    }

    let rows = data.map(row => {
      if (returnsWholeNode) {
        const t = row._team;
        return [t.id, t.name, t.cat, t.dens, t.clust, t.topo, t.hier, t.size];
      }
      return returnFields.map(f => {
        const v = getTeamProperty(row._team, f.prop, fMap);
        return v == null ? null : v;
      });
    });

    // ── ORDER BY ──
    if (orderField) {
      const resolvedOrderProp = orderField.replace(new RegExp(`^${alias}\\.`, 'i'), '');
      if (returnsWholeNode) {
        // Map order property to column index
        const propToCol = { id: 0, name: 1, category: 2, cat: 2, density: 3, dens: 3,
          clustering: 4, clust: 4, topology: 5, topo: 5, hierarchy: 6, hier: 6, size: 7 };
        const colIdx = propToCol[resolvedOrderProp];
        if (colIdx != null) {
          const paired = rows.map((r, i) => ({ r, t: data[i]._team }));
          paired.sort((a, b) => {
            const va = a.r[colIdx], vb = b.r[colIdx];
            const na = typeof va === 'number' ? va : parseFloat(va);
            const nb = typeof vb === 'number' ? vb : parseFloat(vb);
            if (!isNaN(na) && !isNaN(nb)) return orderDesc ? nb - na : na - nb;
            return orderDesc
              ? String(vb).localeCompare(String(va))
              : String(va).localeCompare(String(vb));
          });
          rows = paired.map(p => p.r);
          data = paired.map(p => ({ _team: p.t }));
        }
      } else {
        const colIdx = columns.findIndex(c =>
          c === resolvedOrderProp || c.toLowerCase() === resolvedOrderProp.toLowerCase()
        );
        if (colIdx >= 0) {
          const paired = rows.map((r, i) => ({ r, t: data[i]._team }));
          paired.sort((a, b) => {
            const va = a.r[colIdx], vb = b.r[colIdx];
            const na = typeof va === 'number' ? va : parseFloat(va);
            const nb = typeof vb === 'number' ? vb : parseFloat(vb);
            if (!isNaN(na) && !isNaN(nb)) return orderDesc ? nb - na : na - nb;
            return orderDesc
              ? String(vb).localeCompare(String(va))
              : String(va).localeCompare(String(vb));
          });
          rows = paired.map(p => p.r);
        } else {
          // Order field not in columns; resolve from team data
          const paired = rows.map((r, i) => ({ r, t: data[i]._team }));
          paired.sort((a, b) => {
            const va = getTeamProperty(a.t, resolvedOrderProp, fMap);
            const vb = getTeamProperty(b.t, resolvedOrderProp, fMap);
            const na = typeof va === 'number' ? va : parseFloat(va);
            const nb = typeof vb === 'number' ? vb : parseFloat(vb);
            if (!isNaN(na) && !isNaN(nb)) return orderDesc ? nb - na : na - nb;
            return orderDesc
              ? String(vb || '').localeCompare(String(va || ''))
              : String(va || '').localeCompare(String(vb || ''));
          });
          rows = paired.map(p => p.r);
        }
      }
    }

    // ── LIMIT ──
    if (limit != null) rows = rows.slice(0, limit);

    return { columns, rows, error: null };
  } catch (err) {
    return { columns: [], rows: [], error: err.message || String(err) };
  }
}

// ── Property resolver ─────────────────────────────────────

/** Map friendly/alias property names to actual team fields */
function getTeamProperty(team, prop, fMap) {
  // Direct team fields
  const directMap = {
    id: team.id,
    name: team.name,
    category: team.cat,
    cat: team.cat,
    density: team.dens,
    dens: team.dens,
    clustering: team.clust,
    clust: team.clust,
    topology: team.topo,
    topo: team.topo,
    hierarchy: team.hier,
    hier: team.hier,
    size: team.size,
  };

  if (prop in directMap) return directMap[prop];

  // Check allFeatures for computed metrics
  const entry = fMap[team.id];
  if (entry) {
    if (entry.features && prop in entry.features) return entry.features[prop];
    if (entry.outcomes && prop in entry.outcomes) return entry.outcomes[prop];
    // Check prefixed outcomes
    if (prop.startsWith('outcome_') && entry.outcomes) {
      const inner = prop.slice(8);
      if (inner in entry.outcomes) return entry.outcomes[inner];
    }
  }

  return undefined;
}

// ── WHERE clause filter builder ──────────────────────────

function buildFilterFunction(whereClause, alias, fMap) {
  // Handle CONTAINS
  const containsRe = new RegExp(
    `${alias}\\.(\\w+)\\s+CONTAINS\\s+(?:'([^']*)'|"([^"]*)")`, 'i'
  );
  const containsM = whereClause.match(containsRe);
  if (containsM) {
    const prop = containsM[1];
    const val = containsM[2] != null ? containsM[2] : containsM[3];
    return (team) => {
      const v = getTeamProperty(team, prop, fMap);
      return v != null && String(v).toLowerCase().includes(val.toLowerCase());
    };
  }

  // Handle AND conditions
  if (/\bAND\b/i.test(whereClause)) {
    const parts = whereClause.split(/\bAND\b/i).map(p => p.trim());
    const fns = parts.map(p => buildFilterFunction(p, alias, fMap));
    return (team) => fns.every(fn => fn(team));
  }

  // Handle OR conditions
  if (/\bOR\b/i.test(whereClause)) {
    const parts = whereClause.split(/\bOR\b/i).map(p => p.trim());
    const fns = parts.map(p => buildFilterFunction(p, alias, fMap));
    return (team) => fns.some(fn => fn(team));
  }

  // Comparison: alias.prop OP value
  const cmpRe = new RegExp(
    `${alias}\\.(\\w+)\\s*(>=|<=|<>|!=|>|<|=)\\s*(?:'([^']*)'|"([^"]*)"|([\\d.eE+-]+))`,
    'i'
  );
  const cmpM = whereClause.match(cmpRe);
  if (cmpM) {
    const prop = cmpM[1];
    const op = cmpM[2];
    const strVal = cmpM[3] != null ? cmpM[3] : cmpM[4];
    const numVal = cmpM[5] != null ? parseFloat(cmpM[5]) : null;
    const isString = strVal != null;

    return (team) => {
      const v = getTeamProperty(team, prop, fMap);
      if (v == null) return false;

      if (isString) {
        const sv = String(v);
        switch (op) {
          case '=':  return sv === strVal;
          case '<>': case '!=': return sv !== strVal;
          case '>':  return sv > strVal;
          case '<':  return sv < strVal;
          case '>=': return sv >= strVal;
          case '<=': return sv <= strVal;
          default:   return false;
        }
      }

      const nv = typeof v === 'number' ? v : parseFloat(v);
      if (isNaN(nv)) return false;
      switch (op) {
        case '=':  return nv === numVal;
        case '<>': case '!=': return nv !== numVal;
        case '>':  return nv > numVal;
        case '<':  return nv < numVal;
        case '>=': return nv >= numVal;
        case '<=': return nv <= numVal;
        default:   return false;
      }
    };
  }

  // Fallback: always true
  return () => true;
}

// ── RETURN clause parser ────────────────────────────────

function parseReturnFields(returnClause, alias) {
  const fields = [];
  // Split on commas but not inside parentheses
  const parts = splitOutsideParens(returnClause);

  for (const raw of parts) {
    const part = raw.trim();

    // Check for whole-node return: just the alias
    if (part === alias) {
      fields.push({ wholeNode: true, display: alias });
      continue;
    }

    // Check for aggregate: count(*), avg(t.density), etc.
    const aggRe = /^(count|avg|sum|min|max)\s*\(\s*(\*|[\w.]+)\s*\)$/i;
    const aggM = part.match(aggRe);
    if (aggM) {
      const fn = aggM[1].toLowerCase();
      const inner = aggM[2];
      let aggProp = null;
      if (inner !== '*') {
        const dotRe = new RegExp(`^${alias}\\.(\\w+)$`);
        const dm = inner.match(dotRe);
        aggProp = dm ? dm[1] : inner;
      }
      fields.push({
        aggregate: fn,
        aggProp,
        display: part,
      });
      continue;
    }

    // Property: alias.prop
    const propRe = new RegExp(`^${alias}\\.(\\w+)$`);
    const propM = part.match(propRe);
    if (propM) {
      fields.push({ prop: propM[1], display: propM[1] });
      continue;
    }

    // Fallback: treat as literal label
    fields.push({ prop: part, display: part });
  }

  return fields;
}

/** Split a string by commas that are not inside parentheses */
function splitOutsideParens(s) {
  const parts = [];
  let depth = 0;
  let current = '';
  for (const ch of s) {
    if (ch === '(') { depth++; current += ch; }
    else if (ch === ')') { depth--; current += ch; }
    else if (ch === ',' && depth === 0) { parts.push(current); current = ''; }
    else { current += ch; }
  }
  if (current.trim()) parts.push(current);
  return parts;
}

// ── Aggregate computation ───────────────────────────────

function computeAggregate(fn, prop, dataRows, alias, fMap) {
  if (fn === 'count') {
    if (!prop) return dataRows.length; // count(*)
    return dataRows.filter(r => getTeamProperty(r._team, prop, fMap) != null).length;
  }

  const nums = [];
  for (const row of dataRows) {
    const v = getTeamProperty(row._team, prop, fMap);
    const n = typeof v === 'number' ? v : parseFloat(v);
    if (!isNaN(n)) nums.push(n);
  }

  if (nums.length === 0) return null;

  switch (fn) {
    case 'avg': return Math.round((nums.reduce((a, b) => a + b, 0) / nums.length) * 10000) / 10000;
    case 'sum': return Math.round(nums.reduce((a, b) => a + b, 0) * 10000) / 10000;
    case 'min': return Math.min(...nums);
    case 'max': return Math.max(...nums);
    default: return null;
  }
}
