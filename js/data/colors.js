// ======================================================
// EDGE COLORS - visual encoding of relationship types
// ======================================================
export const EDGE_COLORS = {
  command: '#ff6666',
  peer: '#6699ff',
  advisory: '#ffcc44',
  loyalty: '#ff66aa',
  kinship: '#ff88cc',
  patronage: '#ffaa44',
  elected: '#44ddff',
  'buddy pair': '#88ff88',
  support: '#66ccaa',
  coordination: '#aa88ff',
  'cross-team': '#8888ff',
  'cross-functional': '#88ccff',
  paired: '#88ffcc',
  comms: '#66aaff',
  chapter: '#44ff88',
  alignment: '#44ccff',
  coaching: '#ffaa88',
  guild: '#ccaa44',
  project: '#8888cc',
  informal: '#666699',
  partner: '#44ff88',
  fiduciary: '#ffcc88',
  mentorship: '#ffaa66',
  technical: '#8888ff',
  direct: '#aaaaff',
  feedback: '#ffaa44',
  adversarial: '#ff4444',
  authority: '#ff8844',
  strategy: '#ffcc66',
  play: '#ff8844',
  switch: '#88aacc',
  frontcourt: '#cc8844',
  'pick-and-roll': '#ffaa66',
  call: '#ff8866',
  trade: '#88cc66',
  utility: '#66aaaa',
  info: '#66cccc',
  crossfire: '#ff6644',
  sequence: '#ff8833',
  sync: '#ffcc33',
  alliance: '#4488ff',
  rivalry: '#ff4444',
  diplomatic: '#44ccff',
  procedural: '#88aacc',
  coalition: '#44aa88',
  hires: '#88ccff',
  'creative direction': '#ff88ff',
  scheduling: '#ffaa44',
  logistics: '#88aa44',
  continuity: '#ccaa88',
  notes: '#aa88cc',
  budget: '#ffcc44',
  direction: '#ff88ff',
  lead: '#ffaa88',
  section: '#cccc88',
  cue: '#ffcc88',
  harmony: '#88ccaa',
  delegates: '#7c8aff',
  reviews: '#88aacc',
  PR: '#44ff88',
  issues: '#ffaa44',
  vision: '#aa88ff',
  governance: '#44ccaa',
  employment: '#88aacc',
  'articles of agreement': '#ffcc44',
  'command (battle only)': '#ff4444',
  'command (daily)': '#ff8844',
  checks: '#44ddff',
  'work direction': '#88aacc',
  medical: '#44ff88',
  NSC: '#4488ff',
  constitutional: '#44ccff',
  'collective punishment': '#ff4444',
  collaboration: '#88ccff',
};

// ======================================================
// ROLE COLORS - visual encoding of role classifications
// ======================================================
export const ROLE_COLORS = {
  leader:    '#e8c444',   // gold — appointed/designated leaders
  commander: '#f07040',   // burnt orange — command authority
  operator:  '#44d4b0',   // mint — frontline operators
  fighter:   '#30b888',   // darker green — combat roles
  support:   '#6ec8e8',   // sky blue — support/logistics
  medic:     '#44e888',   // bright green — medical
  specialist:'#58b0d8',   // steel blue — technical specialist
  intel:     '#7088ff',   // indigo — intelligence
  comms:     '#40a0f0',   // cerulean — communications
  signals:   '#5898e0',   // mid blue — signals
  engineer:  '#b8d84c',   // lime — engineering/build
  technical: '#90c040',   // olive green — technical
  builder:   '#a8c848',   // yellow-green — construction
  admin:     '#e888c0',   // pink — administrative
  advisory:  '#c888e8',   // lavender — advisory/counsel
  advisor:   '#b878d8',   // purple-pink — advisor
  member:    '#8898b0',   // slate — rank and file
  crew:      '#7080a0',   // darker slate — crew
  political: '#a878f0',   // purple — political
  elected:   '#8860e0',   // deeper purple — elected roles
  creative:  '#f080b8',   // rose — creative roles
};

// ======================================================
// ROLE CLASSIFIER - regex-based role type detection
// ======================================================
export function classifyRole(role) {
  const label = (role.label || '').toLowerCase();
  const desc = (role.desc || '').toLowerCase();
  const all = label + ' ' + desc;

  if (role.leader) return 'leader';
  if (/medic|surgeon|doctor|medical/.test(all)) return 'medic';
  if (/intel|intelligence|scout|recon|analyst|spy/.test(all)) return 'intel';
  if (/comms?|signal|radio|commu/.test(all)) return 'comms';
  if (/engineer|demolit|sapper|machin|build|construct/.test(all)) return 'engineer';
  if (/advis|counsel|consig|mentor|coach/.test(all)) return 'advisory';
  if (/operator|fighter|warrior|soldier|troop|assault|entry|frag|sniper|awp|gun|rifleman|grenadier/.test(all)) return 'operator';
  if (/support|utility|logistics|supply|stab/.test(all)) return 'support';
  if (/elect|vote|democrat|president|member.*e10|rotating/.test(all)) return 'elected';
  if (/director|producer|creative|design|art|editor|conductor/.test(all)) return 'creative';
  if (/admin|secretary|paper|fan|warden|manager/.test(all)) return 'admin';
  if (/crew|legionar|pirate|common|rank.and.file|worker|player|apprentice|junior|associate|contributor|user/.test(all)) return 'member';
  if (/captain|chief|boss|don|oyabun|khan|king|head|lead|command|general|colonel|sergeant|legate|prince/.test(all)) return 'commander';
  return 'operator';
}
