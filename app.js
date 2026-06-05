const API = 'http://localhost:8085';
let agentContext = '';
let agentData = null;
let currentTab = 'dashboard';
let lastNonLogsTab = 'dashboard';
let portfolioChart = null;
let performanceChart = null;
let rmdChart = null;
let reinvestChart = null;
let expLineQuestions = [];
let lastRmdRequired  = 0;
let lastAssetValues  = {};   // { symbol: value } for recalculating RMD coverage
let lastTaxData      = null; // original tax object for recalculating after advisor overrides

// ── Client Registry ───────────────────────────────────────────────────
// accounts[] — each client can have 1 or more IRA accounts
const CLIENTS = [
  {
    id: 'client_001', name: 'Robert & Margaret Chen', initials: 'RC', location: 'New York, NY',
    accounts: [
      { accountId: 'IRA-001-A', label: 'Traditional IRA',  type: 'Traditional IRA', age: 75, balance: 500000,  preference: 'sell'    },
      { accountId: 'IRA-001-B', label: 'Rollover IRA',     type: 'Rollover IRA',    age: 75, balance: 320000,  preference: 'in_kind' },
    ]
  },
  {
    id: 'client_002', name: 'William & Dorothy Davis', initials: 'WD', location: 'Boston, MA',
    accounts: [
      { accountId: 'IRA-002-A', label: 'Traditional IRA',  type: 'Traditional IRA', age: 78, balance: 750000,  preference: 'sell'    },
    ]
  },
  {
    id: 'client_003', name: 'James Harrison', initials: 'JH', location: 'Chicago, IL',
    accounts: [
      { accountId: 'IRA-003-A', label: 'Traditional IRA',  type: 'Traditional IRA', age: 73, balance: 250000,  preference: 'in_kind' },
    ]
  },
  {
    id: 'client_004', name: 'Patricia & John Kim', initials: 'PK', location: 'San Jose, CA',
    accounts: [
      { accountId: 'IRA-004-A', label: 'Traditional IRA',  type: 'Traditional IRA', age: 80, balance: 1200000, preference: 'sell'    },
    ]
  },
  {
    id: 'client_005', name: 'Barbara & Thomas Wilson', initials: 'BW', location: 'Austin, TX',
    accounts: [
      { accountId: 'IRA-005-A', label: 'Traditional IRA',  type: 'Traditional IRA', age: 74, balance: 425000,  preference: 'sell'    },
    ]
  },
];

let activeClient  = null;
let activeAccount = null;

function selectClient(idOrObj) {
  const c = typeof idOrObj === 'string' ? CLIENTS.find(x => x.id === idOrObj) : idOrObj;
  if (!c) return;
  activeClient = c;
  document.getElementById('clientSearch').value = c.name;
  closeDropdown();

  // Show client badge
  const badge = document.getElementById('selectedClientBadge');
  const acctCount = c.accounts.length;
  badge.innerHTML = `
    <div class="scb-avatar">${c.initials}</div>
    <div class="scb-info">
      <div class="scb-name">${c.name}</div>
      <div class="scb-meta">${c.id} &nbsp;·&nbsp; ${c.location} &nbsp;·&nbsp;
        <span class="scb-acct-count">${acctCount} IRA account${acctCount > 1 ? 's' : ''}</span>
      </div>
    </div>`;
  badge.style.display = 'flex';

  // Render account picker
  renderAccountPicker(c);

  // Auto-select single account; for multi-account show picker only (no auto-load)
  if (acctCount === 1) {
    selectAccount(c.accounts[0], true);
  } else {
    // Clear fields until user picks an account
    document.getElementById('clientId').value = c.id;
    document.getElementById('age').value = '';
    document.getElementById('balance').value = '';
  }
}

function renderAccountPicker(c) {
  const wrap = document.getElementById('accountPickerWrap');
  if (c.accounts.length === 1) { wrap.innerHTML = ''; return; }
  wrap.innerHTML = `
    <div class="acct-picker-label">Select Account</div>
    <div class="acct-cards" id="acctCards">
      ${c.accounts.map((a, i) => `
        <div class="acct-card" id="acct-card-${i}" onmousedown="selectAccount(getActiveAccount(${i}), false, ${i})">
          <div class="acct-card-type">${a.type}</div>
          <div class="acct-card-id">${a.accountId}</div>
          <div class="acct-card-bal">$${(a.balance/1000).toFixed(0)}K &nbsp;·&nbsp; ${a.preference === 'sell' ? 'Cash' : 'In-Kind'}</div>
        </div>`).join('')}
    </div>`;
}

function getActiveAccount(idx) {
  return activeClient ? activeClient.accounts[idx] : null;
}

function selectAccount(acct, silent, idx) {
  if (!acct) return;
  activeAccount = acct;
  document.getElementById('err-account').textContent = '';
  document.getElementById('accountPickerWrap').classList.remove('field-invalid');
  clearFieldError('field-age');
  clearFieldError('field-balance');
  clearFieldError('field-preference');
  document.getElementById('clientId').value = activeClient.id + '/' + acct.accountId;
  document.getElementById('age').value     = acct.age;
  document.getElementById('balance').value = acct.balance;
  document.getElementById('preference').value = acct.preference;

  // Highlight selected account card
  document.querySelectorAll('.acct-card').forEach((el, i) => {
    el.classList.toggle('acct-card-active', i === idx);
  });
}

function filterClients(q) {
  const lower = q.toLowerCase().trim();
  const matches = lower
    ? CLIENTS.filter(c => c.name.toLowerCase().includes(lower) || c.id.includes(lower))
    : CLIENTS;
  renderDropdown(matches);
  positionAndShowDropdown();
}

function positionAndShowDropdown() {
  const input = document.getElementById('clientSearch');
  const dd    = document.getElementById('clientDropdown');
  const rect  = input.getBoundingClientRect();
  dd.style.top   = (rect.bottom + 2) + 'px';
  dd.style.left  = rect.left + 'px';
  dd.style.width = rect.width + 'px';
  dd.style.display = 'block';
}

function renderDropdown(list) {
  const dd = document.getElementById('clientDropdown');
  if (!list.length) {
    dd.innerHTML = '<div class="dd-empty">No clients found</div>';
    return;
  }
  dd.innerHTML = list.map(c => {
    const acctCount = c.accounts.length;
    const totalBal  = c.accounts.reduce((s, a) => s + a.balance, 0);
    return `
    <div class="dd-item" onmousedown="selectClient('${c.id}')">
      <div class="dd-avatar">${c.initials}</div>
      <div class="dd-info">
        <div class="dd-name">${c.name}
          ${acctCount > 1 ? `<span class="dd-multi-badge">${acctCount} accounts</span>` : ''}
        </div>
        <div class="dd-meta">${c.id} &nbsp;·&nbsp; $${(totalBal/1000).toFixed(0)}K total IRA &nbsp;·&nbsp; ${c.location}</div>
      </div>
    </div>`;
  }).join('');
}

function openDropdown() {
  filterClients(document.getElementById('clientSearch').value);
}

function closeDropdown() {
  document.getElementById('clientDropdown').style.display = 'none';
}

// ── Boot ──────────────────────────────────────────────────────────────
window.onload = () => {
  checkBackend();
  setInterval(checkBackend, 10000);
};

async function checkBackend() {
  try {
    const r = await fetch(`${API}/agent/logs`);
    const dot = document.getElementById('backendStatus');
    const label = document.getElementById('backendLabel');
    if (r.ok) {
      dot.className = 'status-dot';
      label.textContent = 'Backend Online · port 8085';
    } else { throw new Error(); }
  } catch {
    document.getElementById('backendStatus').className = 'status-dot offline';
    document.getElementById('backendLabel').textContent = 'Backend Offline';
  }
}

// ── Tabs ──────────────────────────────────────────────────────────────
function showTab(name, el) {
  document.querySelectorAll('.tab-content').forEach(t => t.classList.remove('active'));
  document.querySelectorAll('.tab').forEach(t => t.classList.remove('active'));
  document.getElementById(`tab-${name}`).classList.add('active');
  if (el) el.classList.add('active');
  currentTab = name;
  if (name === 'logs') loadLogs();
  updateBotContext();
  const logsBtn = document.getElementById('logsToggleBtn');
  if (logsBtn) logsBtn.textContent = name === 'logs' ? '✕ Close Logs' : '📋 View Agent Logs';
}

function toggleLogsTab() {
  if (currentTab === 'logs') {
    const prev = lastNonLogsTab || 'dashboard';
    const tabBtn = document.querySelector(`.tab[onclick*="'${prev}'"]`);
    showTab(prev, tabBtn);
  } else {
    lastNonLogsTab = currentTab;
    showTab('logs', null);
  }
}

// ── Presets ───────────────────────────────────────────────────────────
function setPreset(age, balance) {
  document.getElementById('age').value = age;
  document.getElementById('balance').value = balance;
}

// ── Validation helpers ────────────────────────────────────────────────
function showFieldError(fieldId, errorId, msg) {
  document.getElementById(fieldId).classList.add('field-invalid');
  document.getElementById(errorId).textContent = msg;
}
function clearFieldError(fieldId) {
  document.getElementById(fieldId).classList.remove('field-invalid');
  const errEl = document.getElementById(fieldId).querySelector('.field-error');
  if (errEl) errEl.textContent = '';
}
function validateForm() {
  let valid = true;

  // Client selected
  const clientId = document.getElementById('clientId').value;
  if (!clientId) {
    showFieldError('field-client', 'err-client', 'Please search and select a client.');
    valid = false;
  }

  // Account selected (only for multi-account clients)
  if (activeClient && activeClient.accounts.length > 1 && !activeAccount) {
    document.getElementById('err-account').textContent = 'Please select an account above.';
    document.getElementById('accountPickerWrap').classList.add('field-invalid');
    valid = false;
  } else {
    document.getElementById('err-account').textContent = '';
    document.getElementById('accountPickerWrap').classList.remove('field-invalid');
  }

  // Age
  const age = parseInt(document.getElementById('age').value);
  if (!age || isNaN(age)) {
    showFieldError('field-age', 'err-age', 'Client age is required.');
    valid = false;
  } else if (age < 73) {
    showFieldError('field-age', 'err-age', 'RMDs apply to clients age 73 and above.');
    valid = false;
  } else if (age > 115) {
    showFieldError('field-age', 'err-age', 'Please enter a valid age.');
    valid = false;
  }

  // Balance
  const balance = parseFloat(document.getElementById('balance').value);
  if (!balance || isNaN(balance) || balance <= 0) {
    showFieldError('field-balance', 'err-balance', 'IRA balance must be greater than $0.');
    valid = false;
  }

  // Preference
  const pref = document.getElementById('preference').value;
  if (!pref) {
    showFieldError('field-preference', 'err-preference', 'Please select a distribution preference.');
    valid = false;
  }

  return valid;
}

// ── Run Agent ─────────────────────────────────────────────────────────
async function runAgent() {
  if (!validateForm()) return;

  const btn    = document.getElementById('runBtn');
  const icon   = document.getElementById('runBtnIcon');
  const spin   = document.getElementById('runBtnSpinner');
  const label  = document.getElementById('runBtnLabel');
  btn.disabled = true;
  btn.classList.add('btn-circle-running');
  icon.style.display = 'none';
  spin.style.display = 'block';
  label.textContent  = 'Running...';

  const body = {
    age: parseInt(document.getElementById('age').value),
    balance: parseFloat(document.getElementById('balance').value),
    clientId: document.getElementById('clientId').value,
    preference: document.getElementById('preference').value
  };

  try {
    const res = await fetch(`${API}/agent/run`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body)
    });
    const data = await res.json();
    agentData = data;
    renderResults(data);
    agentContext = buildContext(data, body);
    updateBotContext();
  } catch (e) {
    document.getElementById('err-client').textContent = 'Agent run failed — is the backend running on port 8085?';
    document.getElementById('field-client').classList.add('field-invalid');
  } finally {
    btn.disabled = false;
    btn.classList.remove('btn-circle-running');
    icon.style.display  = 'block';
    spin.style.display  = 'none';
    label.textContent   = 'Optimize & Execute';
  }
}

function buildContext(data, req) {
  return `Client age: ${req.age}, IRA balance: $${req.balance.toLocaleString()}, ` +
    `RMD amount: $${Number(data.rmdAmount).toFixed(2)}, ` +
    `Strategy: ${data.strategy}, ` +
    `Selected assets: ${JSON.stringify(data.selectedAssets)}, ` +
    `Reasoning: ${data.reasoning}`;
}

// ── Render Results ────────────────────────────────────────────────────
function renderResults(data) {
  const rmd = Number(data.rmdAmount || 0);
  const strategy = data.strategy || '—';
  const assets = data.selectedAssets || [];
  const portfolio = data.portfolio || [];
  const totalLiquidated = assets.reduce((s, a) => s + Number(a.value || 0), 0);

  // Store for post-execute recalculation
  lastRmdRequired = rmd;
  lastAssetValues = {};
  assets.forEach(a => { lastAssetValues[a.symbol] = Number(a.value || 0); });

  // Cards
  document.getElementById('rmdValue').textContent = '$' + rmd.toLocaleString('en-US', { minimumFractionDigits: 2 });
  const sv  = document.getElementById('strategyValue');
  const ssl = document.getElementById('strategySubLabel');
  if (strategy === 'sell') {
    sv.textContent  = 'CASH SALE';
    sv.className    = 'card-value orange';
    ssl.textContent = 'Assets sold — cash distributed to client';
  } else {
    sv.textContent  = 'IN-KIND TRANSFER';
    sv.className    = 'card-value green';
    ssl.textContent = 'Shares moved to taxable account — client stays invested';
  }
  document.getElementById('totalValue').textContent = '$' + totalLiquidated.toLocaleString('en-US', { minimumFractionDigits: 2 });
  document.getElementById('assetsCount').textContent = assets.length;

  // Explanation — two-table layout with inline sources and bot discuss buttons
  const expBox = document.getElementById('explanationBox');
  expBox.innerHTML = data.explanation ? renderExplanationTable(data) : 'Run the agent to see the AI-generated explanation.';
  const sourcesBox = document.getElementById('sourcesBox');
  if (sourcesBox) sourcesBox.innerHTML = '';
  document.getElementById('reasoningBox').textContent = '🤖 AI Reasoning: ' + (data.reasoning || '');

  // Portfolio chart
  renderPortfolioChart(portfolio);

  // Holdings table
  renderHoldingsTable(portfolio, assets);

  // Selected assets table — normalise execution to array (in_kind returns a single object)
  const rawExec  = data.execution;
  const executions = Array.isArray(rawExec) ? rawExec : (rawExec ? [rawExec] : []);
  renderSelectedTable(assets, executions, strategy);

  // RMD coverage chart
  renderRMDChart(rmd, totalLiquidated);

  // JSON raw output
  document.getElementById('executionJson').textContent = JSON.stringify(data, null, 2);

  // Reinvestment tab
  const clientAge = parseInt(document.getElementById('age').value) || 75;
  if (data.reinvestment) renderReinvestment(data.reinvestment, clientAge);

  // Tax analysis
  if (data.taxAnalysis) {
    lastTaxData = data.taxAnalysis;
    renderTaxAnalysis(data.taxAnalysis);
  }

  // Intelligence strip
  renderIntelStrip(portfolio, assets);
}

// ── Explanation Sources ───────────────────────────────────────────────
const SOURCE_LIBRARY = [
  {
    id: 'rmd-rules',
    label: 'IRS — Required Minimum Distributions',
    shortLabel: 'IRS: RMD Rules',
    icon: '📋',
    type: 'gov',
    url: 'https://www.irs.gov/retirement-plans/retirement-topics-required-minimum-distributions-rmds',
    reason: 'Basis for RMD calculation rules and deadlines',
    keywords: ['rmd', 'required minimum', 'withdrawal', 'age 73']
  },
  {
    id: 'pub590b',
    label: 'IRS Publication 590-B — IRA Distributions',
    shortLabel: 'IRS Pub. 590-B',
    icon: '📖',
    type: 'gov',
    url: 'https://www.irs.gov/publications/p590b',
    reason: 'Uniform Lifetime Table used for RMD divisor at each age',
    keywords: ['uniform lifetime', 'factor', 'ira distribution', 'in-kind', 'in_kind', 'divisor']
  },
  {
    id: 'topic409',
    label: 'IRS Topic 409 — Capital Gains and Losses',
    shortLabel: 'IRS Topic 409',
    icon: '💹',
    type: 'gov',
    url: 'https://www.irs.gov/taxtopics/tc409',
    reason: 'Defines how realized gains and losses are taxed on asset sales',
    keywords: ['gain', 'loss', 'capital', 'tax', 'liquidat', 'sell', 'realized']
  },
  {
    id: 'tax-brackets',
    label: 'IRS — Tax Rate Schedules',
    shortLabel: 'IRS Tax Rates',
    icon: '💰',
    type: 'gov',
    url: 'https://www.irs.gov/newsroom/irs-provides-tax-inflation-adjustments-for-tax-year-2024',
    reason: '24% marginal rate applied to calculate tax impact of each distribution',
    keywords: ['24%', 'tax rate', 'marginal', 'tax bill', 'bracket']
  },
  {
    id: 'tax-loss-harvesting',
    label: 'Investopedia — Tax-Loss Harvesting',
    shortLabel: 'Investopedia: TLH',
    icon: '🌱',
    type: 'pro',
    url: 'https://www.investopedia.com/terms/t/taxgainlossharvesting.asp',
    reason: 'Professional explanation of loss-first liquidation strategy used by the agent',
    keywords: ['tax-loss', 'tax loss', 'harvest', 'scoring', 'minimize tax', 'locks in a tax']
  },
  {
    id: 'inkind-transfer',
    label: 'Fidelity — In-Kind IRA Distributions',
    shortLabel: 'Fidelity: In-Kind',
    icon: '🔄',
    type: 'pro',
    url: 'https://www.fidelity.com/retirement-ira/required-minimum-distribution-ira',
    reason: 'How in-kind transfers from IRA to taxable brokerage satisfy RMD requirements',
    keywords: ['in-kind', 'in_kind', 'transfer', 'brokerage', 'shares moved']
  },
  {
    id: 'rmd-penalty',
    label: 'IRS — Excess Accumulation Penalty (25%)',
    shortLabel: 'IRS: 25% Penalty',
    icon: '⚠️',
    type: 'gov',
    url: 'https://www.irs.gov/retirement-plans/plan-participant-employee/retirement-topics-exceptions-to-tax-on-early-distributions',
    reason: 'IRS imposes a 25% excise tax on RMD shortfalls — automation eliminates this risk',
    keywords: ['penalty', '25%', 'excise', 'missed', 'deadline']
  },
];

function getSourcesForLine(text) {
  const t = text.toLowerCase();
  return SOURCE_LIBRARY.filter(s => s.keywords.some(kw => t.includes(kw)));
}

function renderIconLinks(sources) {
  return sources.map(s =>
    `<a class="src-icon-link src-${s.type}" href="${s.url}" target="_blank" rel="noopener" title="${s.label} — ${s.reason}">${s.icon}</a>`
  ).join('');
}

function buildExpTable(bulletLines) {
  if (!bulletLines.length) return '';
  const rows = bulletLines.map(line => {
    const text = line.replace(/^\s*•\s*/, '');
    const sources = getSourcesForLine(line);
    const icons = renderIconLinks(sources);
    const qIdx = expLineQuestions.length;
    expLineQuestions.push(`Explain this specific RMD decision in detail: "${text}"`);
    return `<div class="exp-trow">
      <div class="exp-tcell-item">• ${text}</div>
      <div class="exp-tcell-src">${icons || '<span class="src-none">—</span>'}</div>
      <div class="exp-tcell-bot"><button class="btn-discuss" onclick="askBotLine(${qIdx})">💬 Discuss</button></div>
    </div>`;
  }).join('');
  return `<div class="exp-table">
    <div class="exp-thead">
      <span class="exp-th-item">Asset &amp; Rationale</span>
      <span class="exp-th-src">Sources</span>
      <span class="exp-th-bot"></span>
    </div>
    ${rows}
  </div>`;
}

function askBotLine(idx) {
  const q = expLineQuestions[idx];
  if (q) askBot(q);
}

function buildSourcesLegend(usedIds) {
  const items = SOURCE_LIBRARY.filter(s => usedIds.has(s.id));
  if (!items.length) return '';
  const chips = items.map(s =>
    `<a class="legend-chip legend-${s.type}" href="${s.url}" target="_blank" rel="noopener" title="${s.reason}">
      <span class="legend-icon">${s.icon}</span>
      <span class="legend-label">${s.shortLabel}</span>
      <span class="legend-arrow">↗</span>
    </a>`
  ).join('');
  return `<div class="sources-legend">
    <span class="legend-title">📎 Source Key</span>
    <div class="legend-chips">${chips}</div>
  </div>`;
}

function renderExplanationTable(data) {
  expLineQuestions = [];
  const lines = (data.explanation || '').split('\n');
  let html = '';
  let section = null;
  let buffer = [];
  const usedIds = new Set();

  function flush() {
    if (!buffer.length) return;
    buffer.forEach(l => getSourcesForLine(l).forEach(s => usedIds.add(s.id)));
    html += buildExpTable(buffer);
    buffer = [];
  }

  for (const raw of lines) {
    const line = raw.trim();
    if (!line) continue;
    if (line.startsWith('SELECTION CRITERIA:')) {
      flush(); section = null;
      html += `<div class="exp-section criteria">${line}</div>`;
    } else if (line.startsWith('SELECTED FOR LIQUIDATION:')) {
      flush(); section = 'sel';
      html += `<div class="exp-header sell">📋 ${line}</div>`;
    } else if (line.startsWith('PROTECTED')) {
      flush(); section = 'pro';
      html += `<div class="exp-header protect">🛡 ${line}</div>`;
    } else if (line.startsWith('RESULT:')) {
      flush(); section = null;
      html += `<div class="exp-result">${line}</div>`;
    } else if (line.startsWith('•') && (section === 'sel' || section === 'pro')) {
      buffer.push(line);
    } else if (!section) {
      html += `<div>${line}</div>`;
    }
  }
  flush();
  html += buildSourcesLegend(usedIds);
  return html;
}

function renderExplanationSources(data) {
  return '';
}

// ── Analyst Research Data (per symbol) ───────────────────────────────
const ANALYST_DATA = {
  'AAPL': { rating:'Buy',         tone:'pos', target:225, firm:'Morgan Stanley',          url:'https://finance.yahoo.com/quote/AAPL/analysis/', catalyst:'Services revenue accelerating — AI integration driving upgrade cycle' },
  'TSLA': { rating:'Neutral',     tone:'neu', target:200, firm:'Morgan Stanley',          url:'https://finance.yahoo.com/quote/TSLA/analysis/', catalyst:'Delivery miss — margin pressure persists amid EV price war' },
  'EEM':  { rating:'Underweight', tone:'neg', target:38,  firm:'JPMorgan EM Strategy',   url:'https://finance.yahoo.com/quote/EEM/analysis/',  catalyst:'Dollar strength and China slowdown weigh on EM returns' },
  'TLT':  { rating:'Buy',         tone:'pos', target:95,  firm:'BlackRock',              url:'https://finance.yahoo.com/quote/TLT/analysis/',  catalyst:'Fed pause signals recovery — long-duration bonds to rally' },
  'LQD':  { rating:'Hold',        tone:'neu', target:108, firm:'PIMCO',                  url:'https://finance.yahoo.com/quote/LQD/analysis/',  catalyst:'IG spreads stable — carry attractive relative to Treasuries' },
  'MUB':  { rating:'Buy',         tone:'pos', target:106, firm:'Vanguard Fixed Income',  url:'https://finance.yahoo.com/quote/MUB/analysis/',  catalyst:'Tax-exempt income demand rising — munis outperform in high-rate env.' },
  'HYG':  { rating:'Sell',        tone:'neg', target:70,  firm:'Fidelity Fixed Income',  url:'https://finance.yahoo.com/quote/HYG/analysis/',  catalyst:'High-yield spreads widen on recession concerns — reduce exposure' },
  'VNQ':  { rating:'Hold',        tone:'neu', target:84,  firm:'CBRE Research',          url:'https://finance.yahoo.com/quote/VNQ/analysis/',  catalyst:'REITs stabilising — selective opportunities as rate pressure eases' },
  'GLD':  { rating:'Buy',         tone:'pos', target:245, firm:'Goldman Sachs',          url:'https://finance.yahoo.com/quote/GLD/analysis/',  catalyst:'Inflation hedge in demand — gold at 6-month high, further upside' },
  'USO':  { rating:'Hold',        tone:'neu', target:76,  firm:'Barclays Commodities',   url:'https://finance.yahoo.com/quote/USO/analysis/',  catalyst:'Oil above $85 supports energy — geopolitical risk premium intact' },
  'VTI':  { rating:'Buy',         tone:'pos', target:258, firm:'BlackRock',              url:'https://finance.yahoo.com/quote/VTI/analysis/',  catalyst:'Broad market resilience — earnings season beats 72% of estimates' },
  'XLV':  { rating:'Buy',         tone:'pos', target:148, firm:'Wells Fargo Healthcare', url:'https://finance.yahoo.com/quote/XLV/analysis/',  catalyst:'Healthcare defensive outperformance expected in late-cycle environment' },
  'BND':  { rating:'Buy',         tone:'pos', target:77,  firm:'Vanguard Research',      url:'https://finance.yahoo.com/quote/BND/analysis/',  catalyst:'Bond fund inflows at 12-month high — flight to quality underway' },
  'GOVT': { rating:'Buy',         tone:'pos', target:25,  firm:'iShares Fixed Income',   url:'https://finance.yahoo.com/quote/GOVT/analysis/', catalyst:'Treasury demand rising as Fed signals end of rate-hike cycle' },
  'TIP':  { rating:'Hold',        tone:'neu', target:112, firm:'BlackRock',              url:'https://finance.yahoo.com/quote/TIP/analysis/',  catalyst:'Inflation expectations ticking up — TIPS offer real return protection' },
  'SCHD': { rating:'Buy',         tone:'pos', target:87,  firm:'Morningstar',            url:'https://finance.yahoo.com/quote/SCHD/analysis/', catalyst:'Dividend growth ETF outperforms in volatile markets — strong yield' },
  'JNJ':  { rating:'Hold',        tone:'neu', target:158, firm:'Bank of America',        url:'https://finance.yahoo.com/quote/JNJ/analysis/',  catalyst:'Pharma spin-off complete — Kenvue separation adds clarity to valuation' },
  'PG':   { rating:'Buy',         tone:'pos', target:175, firm:'Barclays',               url:'https://finance.yahoo.com/quote/PG/analysis/',   catalyst:'Consumer staples resilient — pricing power intact, margin recovery' },
  'VYM':  { rating:'Buy',         tone:'pos', target:125, firm:'Vanguard Research',      url:'https://finance.yahoo.com/quote/VYM/analysis/',  catalyst:'High-dividend ETF in demand — income-seeking investors rotating in' },
  'AGG':  { rating:'Hold',        tone:'neu', target:99,  firm:'PIMCO',                  url:'https://finance.yahoo.com/quote/AGG/analysis/',  catalyst:'Core bonds range-bound — mixed economic data keeps market cautious' },
  'SPY':  { rating:'Buy',         tone:'pos', target:512, firm:'FactSet Earnings',       url:'https://finance.yahoo.com/quote/SPY/analysis/',  catalyst:'S&P 500 earnings beat consensus — 72% of reporters above estimates' },
  'QQQ':  { rating:'Buy',         tone:'pos', target:448, firm:'Morningstar Equity',     url:'https://finance.yahoo.com/quote/QQQ/analysis/',  catalyst:'Mega-cap tech drives Nasdaq — AI capex cycle sustains growth outlook' },
  'KO':   { rating:'Hold',        tone:'neu', target:65,  firm:'Bernstein Research',     url:'https://finance.yahoo.com/quote/KO/analysis/',   catalyst:'Volumes soft globally — pricing offsets volume but growth is limited' },
  'XOM':  { rating:'Hold',        tone:'neu', target:122, firm:'Goldman Sachs Energy',   url:'https://finance.yahoo.com/quote/XOM/analysis/',  catalyst:'Energy sector outperforms — oil above $85 supports integrated majors' },
  'PFE':  { rating:'Sell',        tone:'neg', target:24,  firm:'JPMorgan Healthcare',    url:'https://finance.yahoo.com/quote/PFE/analysis/',  catalyst:'Guidance cut — pipeline delays weigh heavily on near-term outlook' },
  'VZ':   { rating:'Hold',        tone:'neu', target:43,  firm:'Wells Fargo Telecom',    url:'https://finance.yahoo.com/quote/VZ/analysis/',   catalyst:'Subscriber losses stabilise — yield attractive but growth limited' },
  'SHY':  { rating:'Hold',        tone:'neu', target:83,  firm:'iShares',                url:'https://finance.yahoo.com/quote/SHY/analysis/',  catalyst:'Short-duration Treasuries stable — preserve capital in rate uncertainty' },
  'VMFXX':{ rating:'N/A',         tone:'neu', target:1,   firm:'Vanguard',               url:'https://finance.yahoo.com/quote/VMFXX/',         catalyst:'Money market fund — capital preservation, daily liquidity' },
};

let portfolioLineQuestions = [];

// ── Advisory Intelligence Strip ───────────────────────────────────────
const MARKET_CATALYSTS = [
  { sym:'TSLA', tone:'neg', headline:'Tesla misses delivery estimates — analyst downgrades to Neutral', source:'Morgan Stanley Research', age:'2h ago' },
  { sym:'TLT',  tone:'pos', headline:'Fed signals pause — long-duration Treasuries rally on rate outlook', source:'Bloomberg Intelligence', age:'3h ago' },
  { sym:'GLD',  tone:'pos', headline:'Gold hits 6-month high as inflation expectations tick up', source:'Goldman Sachs Commodities', age:'4h ago' },
  { sym:'EEM',  tone:'neg', headline:'EM equities under pressure — dollar strength weighs on returns', source:'JPMorgan EM Strategy', age:'5h ago' },
  { sym:'VTI',  tone:'pos', headline:'Broad market resilience — S&P 500 holds key support level', source:'BlackRock Investment Institute', age:'1h ago' },
  { sym:'HYG',  tone:'neg', headline:'High-yield spreads widen on recession concerns — credit caution advised', source:'Fidelity Fixed Income', age:'6h ago' },
  { sym:'VNQ',  tone:'neu', headline:'REITs stabilise after rate-driven selloff — selective opportunities emerging', source:'CBRE Research', age:'7h ago' },
  { sym:'SPY',  tone:'pos', headline:'S&P 500 earnings season beats consensus — 72% of reporters above estimates', source:'FactSet Earnings Insight', age:'2h ago' },
  { sym:'BND',  tone:'pos', headline:'Total bond market fund inflows at 12-month high amid flight to quality', source:'Vanguard Research', age:'3h ago' },
  { sym:'AGG',  tone:'neu', headline:'Core bonds hold steady as mixed economic data keeps market range-bound', source:'PIMCO Strategy', age:'5h ago' },
  { sym:'PFE',  tone:'neg', headline:'Pfizer guidance cut — pipeline delays weigh on healthcare sector outlook', source:'Wells Fargo Healthcare', age:'4h ago' },
  { sym:'XOM',  tone:'pos', headline:'Energy sector outperforms — oil above $85 supports integrated majors', source:'Barclays Commodities', age:'1h ago' },
];

const AGENT_SIGNALS = [
  { sym:'TSLA',  badge:'caution', text:'Continued downside momentum. Loss position may deepen — monitor closely.' },
  { sym:'VTI',   badge:'hold',    text:'Core holding. Strong long-term fundamentals — protect from liquidation.' },
  { sym:'GLD',   badge:'hold',    text:'Inflation hedge performing. Maintain exposure in volatile environments.' },
  { sym:'EEM',   badge:'review',  text:'Underperforming vs benchmark. Consider reducing on next rebalance.' },
  { sym:'TLT',   badge:'watch',   text:'Rate sensitivity high. Positive catalyst if Fed holds — watch closely.' },
  { sym:'HYG',   badge:'caution', text:'Credit risk elevated. Spread widening signals stress — reduce weight.' },
  { sym:'SPY',   badge:'hold',    text:'Broad index anchor. No action recommended — core portfolio position.' },
  { sym:'BND',   badge:'watch',   text:'Duration risk moderate. Benefiting from rate pause narrative.' },
  { sym:'PFE',   badge:'caution', text:'Guidance cut adds uncertainty — review allocation ahead of earnings.' },
  { sym:'XOM',   badge:'hold',    text:'Energy exposure providing portfolio diversification — maintain.' },
  { sym:'AGG',   badge:'watch',   text:'Stable income generator. Rate environment improving for bond holders.' },
  { sym:'SCHD',  badge:'hold',    text:'Dividend yield supportive. Quality factor providing downside buffer.' },
];

const PRODUCT_INFO = {
  'T-Bill': {
    icon: '📋', color: '#58a6ff',
    purpose: 'U.S. Treasury Bills are short-term government securities (4–52 weeks) backed by the full faith and credit of the U.S. government. Zero default risk. Returns track the Fed funds rate — currently one of the most attractive low-risk options for retirees.',
    institutions: [
      { name: 'Same Bank Portal',    same: true,  note: 'No transfer needed — stays within your firm relationship', url: 'https://www.treasurydirect.gov' },
      { name: 'Fidelity',            same: false, note: 'Commission-free T-Bills, auto-roll on maturity',           url: 'https://www.fidelity.com' },
      { name: 'Schwab',              same: false, note: 'Competitive brokered T-Bill rates, easy ladder setup',     url: 'https://www.schwab.com' },
    ]
  },
  'Savings': {
    icon: '🏦', color: '#3fb950',
    purpose: 'High-Yield Savings Accounts earn 10–15× the national average. FDIC insured up to $250K per depositor. Fully liquid — client can access any time. Ideal as a cash buffer for near-term living expenses post-RMD.',
    institutions: [
      { name: 'Same Bank (HYSA)',     same: true,  note: 'Instant transfer — existing relationship, no paperwork',  url: '#' },
      { name: 'Marcus by Goldman',    same: false, note: 'Consistently top-rated HYSA rate, no fees',               url: 'https://www.marcus.com' },
      { name: 'Ally Bank',           same: false, note: 'No minimums, 24/7 access, strong mobile app',             url: 'https://www.ally.com' },
    ]
  },
  'CD': {
    icon: '🔐', color: '#d29922',
    purpose: 'Certificates of Deposit lock in a guaranteed fixed rate for a set term (3 months–5 years). FDIC insured. Higher yield than savings in exchange for locking the funds. Best for money the client won\'t need until the CD matures.',
    institutions: [
      { name: 'Same Bank CD',        same: true,  note: 'Relationship rate — often 0.10–0.25% above posted rate',  url: '#' },
      { name: 'Discover Bank',       same: false, note: 'High CD rates, no minimum balance required',              url: 'https://www.discover.com' },
      { name: 'Bread Financial',     same: false, note: 'Flexible multi-term CD ladder options',                   url: 'https://www.breadfinancial.com' },
    ]
  },
  'ETF': {
    icon: '📈', color: '#bc8cff',
    purpose: 'Dividend ETFs hold baskets of income-paying stocks (e.g., SCHD, VYM). Pay quarterly dividends. Lower volatility than individual stocks. Good for clients who want equity exposure alongside steady income — and can ride short-term market moves.',
    institutions: [
      { name: 'Same Brokerage',      same: true,  note: 'Commission-free trading — no transfer, stays managed',    url: '#' },
      { name: 'Vanguard',            same: false, note: 'Lowest expense ratios in the industry (VYM, VIGI)',       url: 'https://www.vanguard.com' },
      { name: 'iShares (BlackRock)', same: false, note: 'Largest ETF provider globally — DVY, HDV options',        url: 'https://www.ishares.com' },
    ]
  },
  'Municipal': {
    icon: '🏛', color: '#ff7b54',
    purpose: 'Municipal Bonds are issued by state and local governments. Interest is exempt from federal income tax — and often state tax too. Especially powerful for clients in the 22%+ bracket who just triggered a taxable RMD distribution.',
    institutions: [
      { name: 'Same Bank Muni Fund', same: true,  note: 'Managed fund — diversified, no individual bond risk',     url: '#' },
      { name: 'Fidelity Muni Funds', same: false, note: 'Wide state-specific selection, very low minimums',        url: 'https://www.fidelity.com' },
      { name: 'Vanguard VTEB',       same: false, note: 'Tax-Exempt Bond ETF — ultra low 0.05% expense ratio',    url: 'https://www.vanguard.com' },
    ]
  },
  'Money Market': {
    icon: '💰', color: '#39d0d8',
    purpose: 'Money Market Funds invest in short-term, high-quality instruments (Treasury bills, commercial paper). Near-instant liquidity like a checking account but with a meaningfully higher yield. SEC-regulated. Good parking spot while the advisor finalizes a longer-term plan.',
    institutions: [
      { name: 'Same Bank MMF',       same: true,  note: 'Same-day sweep into existing account — zero friction',    url: '#' },
      { name: 'Fidelity SPAXX',      same: false, note: 'One of the largest, most liquid government MMFs',         url: 'https://www.fidelity.com' },
      { name: 'Vanguard VMFXX',      same: false, note: 'Federal MMF — extremely stable $1 NAV',                  url: 'https://www.vanguard.com' },
    ]
  },
  'Bond': {
    icon: '📊', color: '#a8ff78',
    purpose: 'Short-Term Bond Funds invest in investment-grade bonds with 1–3 year maturities. More resilient than long-duration bonds in rising-rate environments. Better yield than cash or money market. Good middle ground for clients who want income without full equity risk.',
    institutions: [
      { name: 'Same Bank Bond Fund', same: true,  note: 'Institutional pricing — better entry through your firm',  url: '#' },
      { name: 'iShares SHY',         same: false, note: '1–3 Year Treasury Bond ETF, highly liquid',              url: 'https://www.ishares.com' },
      { name: 'Vanguard BSV',        same: false, note: 'Short-Term Bond ETF, 0.04% expense ratio',               url: 'https://www.vanguard.com' },
    ]
  },
};

function getProductInfo(s) {
  const key = ((s.type || '') + ' ' + (s.name || '')).toLowerCase();
  if (key.includes('t-bill') || key.includes('treasury bill')) return PRODUCT_INFO['T-Bill'];
  if (key.includes('saving'))                                  return PRODUCT_INFO['Savings'];
  if (key.includes('cd') || key.includes('certificate'))       return PRODUCT_INFO['CD'];
  if (key.includes('etf') || key.includes('dividend'))         return PRODUCT_INFO['ETF'];
  if (key.includes('municipal') || key.includes('muni'))       return PRODUCT_INFO['Municipal'];
  if (key.includes('money market'))                            return PRODUCT_INFO['Money Market'];
  if (key.includes('bond'))                                    return PRODUCT_INFO['Bond'];
  return { icon: '💼', color: '#8b949e', purpose: 'A fixed-income or cash-equivalent product suggested by the agent based on the client\'s age and risk profile.', institutions: [
    { name: 'Same Bank', same: true, note: 'No transfer required — keeps assets within your firm', url: '#' },
  ]};
}

function toggleProductInfo(id) {
  const el = document.getElementById(id);
  if (!el) return;
  el.style.display = el.style.display === 'none' ? 'block' : 'none';
}

const FIRM_PRODUCTS = [
  { name:'Capital Preservation Fund', yield:'4.85%', desc:'AAA-rated short-duration bond fund. Designed for capital protection with consistent income generation.', tags:['Low Risk','Liquid','AAA Rated'] },
  { name:'Managed Income Portfolio', yield:'5.20%', desc:'Actively managed blend of investment-grade corporates and government bonds. Institutional-grade execution.', tags:['Medium Risk','Income Focus','Quarterly Distribution'] },
  { name:'Strategic Tax-Exempt Fund', yield:'3.95%', desc:'Municipal bond fund — interest income exempt from federal tax. Ideal for clients in higher tax brackets post-RMD.', tags:['Low Risk','Tax-Exempt','State Bonds'] },
  { name:'Diversified Real Assets', yield:'6.10%', desc:'Inflation-linked portfolio spanning infrastructure, TIPS, and commodity futures. Protects purchasing power.', tags:['Medium Risk','Inflation Hedge','Quarterly'] },
  { name:'Short Duration Treasury', yield:'4.40%', desc:'1–3 year US Treasury ladder. Government-backed, zero credit risk, rolling maturities for liquidity management.', tags:['Very Low Risk','Govt Backed','Liquid'] },
];

function renderIntelStrip(portfolio, selectedAssets) {
  const heldSymbols = portfolio.map(p => p.symbol);
  const now = new Date();
  document.getElementById('intelTimestamp').textContent =
    now.toLocaleTimeString('en-US', { hour:'2-digit', minute:'2-digit' }) + ' · ' +
    now.toLocaleDateString('en-US', { month:'short', day:'numeric', year:'numeric' });

  // Catalysts — only show items relevant to held symbols, max 3
  const relevantCatalysts = MARKET_CATALYSTS.filter(c => heldSymbols.includes(c.sym)).slice(0, 3);
  document.getElementById('catalystCards').innerHTML = relevantCatalysts.map(c => `
    <div class="catalyst-card">
      <div class="catalyst-ticker ${c.tone}">${c.sym}</div>
      <div class="catalyst-body">
        <div class="catalyst-headline">${c.headline}</div>
        <div class="catalyst-meta">${c.source} &nbsp;·&nbsp; ${c.age}</div>
      </div>
    </div>`).join('');

  // Signals — only for held symbols, max 3
  const relevantSignals = AGENT_SIGNALS.filter(s => heldSymbols.includes(s.sym)).slice(0, 3);
  document.getElementById('signalCards').innerHTML = relevantSignals.map(s => `
    <div class="signal-card">
      <span class="signal-badge ${s.badge}">${s.badge.toUpperCase()}</span>
      <span class="signal-sym">${s.sym}</span>
      <span class="signal-text">${s.text}</span>
    </div>`).join('');

  // Products — pick 3 matched to client age
  const age = parseInt(document.getElementById('age').value) || 75;
  const products = age >= 78 ? FIRM_PRODUCTS.slice(0, 3) : FIRM_PRODUCTS.slice(1, 4);
  document.getElementById('productCards2').innerHTML = products.map(p => `
    <div class="product-card2">
      <div class="product-card2-top">
        <div class="product-card2-name">${p.name}</div>
        <div class="product-card2-yield">${p.yield}</div>
      </div>
      <div class="product-card2-desc">${p.desc}</div>
      <div class="product-card2-tags">${p.tags.map(t => `<span class="product-tag">${t}</span>`).join('')}</div>
    </div>`).join('');

  document.getElementById('intelStrip').style.display = 'block';
}

function renderReinvestment(r, age) {
  const rmd = Number(r.totalAmount || 0);
  const income = Number(r.totalAnnualIncome || 0);
  const suggestions = r.suggestions || [];

  // Flow boxes
  document.getElementById('flow-rmd-amt').textContent = '$' + rmd.toLocaleString('en-US', { minimumFractionDigits: 2 });
  document.getElementById('flow-bank-amt').textContent = '$' + rmd.toLocaleString('en-US', { minimumFractionDigits: 2 });
  document.getElementById('flow-income-amt').textContent = '$' + income.toFixed(2) + ' / yr income';

  // AI Agent advice
  document.getElementById('agentAdviceBox').textContent = r.agentAdvice || 'No AI advice returned.';
  document.getElementById('adviceMeta').textContent =
    `🤖 Generated by Agentic AI (Ollama/Phi-3) · ${suggestions.length} products analysed · Age ${age} profile`;

  // Table
  const tbody = document.getElementById('reinvestBody');
  tbody.innerHTML = '';
  suggestions.forEach(s => {
    const riskClass = 'risk-' + (s.risk || 'low').toLowerCase().replace(/[\s\/]+/g, '-');
    const tr = document.createElement('tr');
    tr.innerHTML = `
      <td><strong>${s.name}</strong></td>
      <td style="font-size:11px;color:#8b949e">${s.type}</td>
      <td>${s.allocationPct}%</td>
      <td style="color:#58a6ff">$${Number(s.allocationAmount).toLocaleString('en-US',{minimumFractionDigits:2})}</td>
      <td style="color:#3fb950;font-weight:700">${s.yieldPct}%</td>
      <td style="color:#d29922">$${Number(s.annualIncome).toFixed(2)}</td>
      <td><span class="risk-badge ${riskClass}">${s.risk}</span></td>
      <td><span class="acct-badge">${s.account}</span></td>
    `;
    tbody.appendChild(tr);
  });

  // Donut chart
  const ctx = document.getElementById('reinvestChart').getContext('2d');
  if (reinvestChart) reinvestChart.destroy();
  const colors = ['#3fb950','#58a6ff','#d29922','#f85149','#bc8cff','#ff7b54','#39d0d8'];
  reinvestChart = new Chart(ctx, {
    type: 'doughnut',
    data: {
      labels: suggestions.map(s => s.name),
      datasets: [{
        data: suggestions.map(s => s.allocationPct),
        backgroundColor: colors.slice(0, suggestions.length),
        borderColor: '#0d1117',
        borderWidth: 3
      }]
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      plugins: {
        legend: { position: 'bottom', labels: { color: '#8b949e', font: { size: 11 }, boxWidth: 12 } },
        tooltip: {
          callbacks: {
            label: c => ` ${c.label}: ${c.parsed}% — $${Number(suggestions[c.dataIndex].allocationAmount).toLocaleString()}`
          }
        }
      }
    }
  });

  // Product cards
  const cards = document.getElementById('productCards');
  cards.innerHTML = '';
  suggestions.forEach((s, i) => {
    const riskClass = 'risk-' + (s.risk || 'low').toLowerCase().replace(/[\s\/]+/g, '-');
    const pi        = getProductInfo(s);
    const popupId   = 'product-popup-' + i;

    const instHtml  = pi.institutions.map(inst => `
      <div class="inst-chip ${inst.same ? 'inst-same' : 'inst-other'}">
        <div class="inst-chip-top">
          ${inst.same ? '<span class="inst-star">⭐</span>' : ''}
          <a class="inst-name" href="${inst.url}" target="_blank" rel="noopener">${inst.name}</a>
        </div>
        <div class="inst-note">${inst.note}</div>
      </div>`).join('');

    const div = document.createElement('div');
    div.className = 'product-card';
    div.innerHTML = `
      <div class="product-card-header">
        <button class="product-icon-btn" style="color:${pi.color}" onclick="toggleProductInfo('${popupId}')" title="What is this product?">
          ${pi.icon}
        </button>
        <div>
          <div class="product-card-name">${s.name}</div>
          <div class="product-card-type">${s.type} · <span class="risk-badge ${riskClass}">${s.risk} risk</span></div>
        </div>
      </div>
      <div class="product-purpose-popup" id="${popupId}" style="display:none">${pi.purpose}</div>
      <div class="product-card-yield">${s.yieldPct}% <span style="font-size:13px;font-weight:400;color:#8b949e">yield</span></div>
      <div class="product-card-amount">$${Number(s.allocationAmount).toLocaleString('en-US',{minimumFractionDigits:2})} allocated · <span style="color:#d29922">$${Number(s.annualIncome).toFixed(2)}/yr income</span></div>
      <div class="product-card-desc">${s.description}</div>
      <div class="product-card-inst-label">Where to open:</div>
      <div class="inst-chips">${instHtml}</div>
    `;
    cards.appendChild(div);
  });
}

function renderPortfolioChart(portfolio) {
  const ctx = document.getElementById('portfolioChart').getContext('2d');
  if (portfolioChart) portfolioChart.destroy();

  // Group by asset class
  const classMap = {};
  portfolio.forEach(p => {
    const cls = p.assetClass || 'Other';
    const val = Number(p.qty) * Number(p.price);
    classMap[cls] = (classMap[cls] || 0) + val;
  });

  const labels = Object.keys(classMap);
  const values = Object.values(classMap);
  const colors = ['#58a6ff','#3fb950','#d29922','#f85149','#bc8cff','#ff7b54','#39d0d8','#a8ff78','#ff6b9d','#c0ca33'];

  portfolioChart = new Chart(ctx, {
    type: 'doughnut',
    data: {
      labels,
      datasets: [{ data: values, backgroundColor: colors.slice(0, labels.length), borderColor: '#0d1117', borderWidth: 2 }]
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      plugins: {
        legend: {
          position: 'bottom',
          align: 'start',
          labels: { color: '#ffffff', font: { size: 11 }, boxWidth: 12, padding: 6, boxHeight: 12 }
        },
        tooltip: {
          callbacks: {
            label: c => ` ${c.label}: $${Number(c.parsed).toLocaleString()}`
          }
        }
      }
    }
  });
}

function renderHoldingsTable(portfolio, selectedAssets) {
  portfolioLineQuestions = [];
  const selectedSymbols = selectedAssets.map(a => a.symbol);
  const tbody = document.getElementById('holdingsBody');
  tbody.innerHTML = '';

  const sorted = [...portfolio].sort((a, b) => (a.assetClass || '').localeCompare(b.assetClass || ''));
  let lastClass = null;

  sorted.forEach(p => {
    const value = Number(p.qty) * Number(p.price);
    const gain  = Number(p.gain);
    const isSelected = selectedSymbols.includes(p.symbol);
    const cls   = p.assetClass || 'Other';
    const ad    = ANALYST_DATA[p.symbol] || { rating:'N/A', tone:'neu', target:null, firm:'—', url:'#', catalyst:'No analyst data available' };

    if (cls !== lastClass) {
      const sep = document.createElement('tr');
      sep.innerHTML = `<td colspan="13" class="holdings-class-sep">${cls}</td>`;
      tbody.appendChild(sep);
      lastClass = cls;
    }

    const ratingClass = ad.tone === 'pos' ? 'rating-buy' : ad.tone === 'neg' ? 'rating-sell' : 'rating-hold';
    const targetDiff  = ad.target && ad.target !== 1
      ? (ad.target - Number(p.price))
      : null;
    const targetHtml  = ad.target && ad.target !== 1
      ? `<span class="target-price">$${ad.target}
           <span class="target-arrow ${targetDiff >= 0 ? 'up' : 'down'}">${targetDiff >= 0 ? '▲' : '▼'} $${Math.abs(targetDiff).toFixed(0)}</span>
         </span>`
      : '<span style="color:#6e7681">—</span>';

    const qIdx = portfolioLineQuestions.length;
    portfolioLineQuestions.push(
      `Analyst insight for ${p.symbol} (${cls}): Rating ${ad.rating}, 12-month target $${ad.target}, current price $${p.price}. Catalyst: ${ad.catalyst}. Source: ${ad.firm}. ` +
      `Unrealized gain/loss: $${gain}. ${isSelected ? 'This asset is RECOMMENDED FOR SALE by the RMD agent.' : 'This asset is being HELD (not liquidated).'}. ` +
      `Should I agree with the agent's decision given this analyst outlook?`
    );

    const acct = p.account || '—';
    const tr = document.createElement('tr');
    tr.innerHTML = `
      <td><span class="acct-pill">${acct}</span></td>
      <td><strong>${p.symbol}</strong></td>
      <td class="cell-dim">${cls}</td>
      <td>${p.qty}</td>
      <td>$${Number(p.price).toLocaleString()}</td>
      <td>$${value.toLocaleString()}</td>
      <td class="${gain >= 0 ? 'gain-pos' : 'gain-neg'}">${gain >= 0 ? '+' : ''}$${gain.toLocaleString()}</td>
      <td><span class="rating-badge ${ratingClass}">${ad.rating}</span></td>
      <td>${targetHtml}</td>
      <td class="cell-catalyst" title="${ad.catalyst}">${ad.catalyst}</td>
      <td><a class="research-link" href="${ad.url}" target="_blank" rel="noopener">${ad.firm} ↗</a></td>
      <td>${isSelected ? '<span class="badge sell">Recommend Sell</span>' : '<span class="badge hold">Hold</span>'}</td>
      <td><button class="btn-discuss" onclick="askBotPortfolio(${qIdx})">💬 Discuss</button></td>
    `;
    tbody.appendChild(tr);
  });

  renderPerformanceChart(sorted);
}

function askBotPortfolio(idx) {
  const q = portfolioLineQuestions[idx];
  if (q) askBot(q);
}

function onActionChange(sel) {
  sel.className = 'action-dropdown action-' + sel.value;
}

function executeActions() {
  const dropdowns = document.querySelectorAll('#selectedBody .action-dropdown');
  if (!dropdowns.length) return;

  const btn = document.getElementById('executeBtn');
  btn.disabled = true;
  btn.textContent = '⏳ Submitting…';

  const actions = Array.from(dropdowns).map(sel => {
    const row    = sel.closest('tr');
    const symbol = row.querySelector('td:nth-child(2) strong')?.textContent || '—';
    const qty    = row.querySelector('td:nth-child(3)')?.textContent || '—';
    const value  = row.querySelector('td:nth-child(5) strong')?.textContent || '—';
    return { symbol, qty, value, action: sel.value };
  });

  // Simulate execution delay
  setTimeout(() => {
    btn.disabled  = false;
    btn.textContent = '✅ Executed';
    btn.className   = 'btn-execute btn-executed';

    // Lock dropdowns to show submitted state
    dropdowns.forEach(sel => {
      sel.disabled = true;
      sel.classList.add('action-submitted');
    });

    // Build result summary
    const sells     = actions.filter(a => a.action === 'sell');
    const transfers = actions.filter(a => a.action === 'transfer');
    const holds     = actions.filter(a => a.action === 'hold');

    const rows = [
      ...sells.map(a =>     `<div class="exec-row exec-sell">🔴 <strong>${a.symbol}</strong> — Sell ${a.qty} · Value ${a.value} · <span class="exec-status">Order Submitted</span></div>`),
      ...transfers.map(a => `<div class="exec-row exec-transfer">🔵 <strong>${a.symbol}</strong> — In-Kind Transfer ${a.qty} · Value ${a.value} · <span class="exec-status">Transfer Initiated</span></div>`),
      ...holds.map(a =>     `<div class="exec-row exec-hold">🟡 <strong>${a.symbol}</strong> — Held · Excluded from this RMD cycle · <span class="exec-status">No Action</span></div>`),
    ].join('');

    const resultBox = document.getElementById('executeResult');
    resultBox.style.display = 'block';
    resultBox.innerHTML = `
      <div class="exec-header">
        <span class="exec-title">✅ Advisor Actions Submitted</span>
        <span class="exec-meta">${sells.length} sell · ${transfers.length} transfer · ${holds.length} hold · ${new Date().toLocaleTimeString()}</span>
      </div>
      <div class="exec-rows">${rows}</div>
    `;

    // Recalculate RMD coverage based on advisor selections
    // Hold = excluded from distribution; Sell + Transfer both count toward RMD
    if (lastRmdRequired > 0) {
      const activeLiquidated = actions
        .filter(a => a.action === 'sell' || a.action === 'transfer')
        .reduce((sum, a) => sum + (lastAssetValues[a.symbol] || 0), 0);

      renderRMDChart(lastRmdRequired, activeLiquidated);

      // Expand the RMD panel so the advisor sees the update
      const rmdBody    = document.getElementById('rmdPanelBody');
      const rmdChevron = document.getElementById('rmdPanelChevron');
      if (rmdBody && rmdBody.style.display === 'none') {
        rmdBody.style.display    = 'block';
        if (rmdChevron) rmdChevron.textContent = '▼';
      }
    }

    // Recalculate Tax Efficiency based on advisor selections
    // Held assets are no longer sold → their gains/losses drop out of the smart calculation
    if (lastTaxData) {
      const activeSymbols = new Set(
        actions.filter(a => a.action === 'sell' || a.action === 'transfer').map(a => a.symbol)
      );
      const heldSymbols = new Set(actions.filter(a => a.action === 'hold').map(a => a.symbol));

      const activeAssets  = (lastTaxData.optimizedAssets || []).filter(a => activeSymbols.has(a.symbol));
      const taxRate       = Number(lastTaxData.taxRatePct || 0) / 100;
      const newSmartGain  = activeAssets.reduce((s, a) => s + Number(a.gain || 0), 0);
      const newSmartTax   = Math.max(0, newSmartGain * taxRate);
      const newTaxSaved   = Math.max(0, Number(lastTaxData.naiveTaxBill || 0) - newSmartTax);

      const heldNote = heldSymbols.size > 0
        ? ` (${[...heldSymbols].join(', ')} excluded — marked Hold by advisor)`
        : '';

      renderTaxAnalysis({
        ...lastTaxData,
        optimizedAssets:  activeAssets,
        smartGain:        newSmartGain,
        smartTaxBill:     newSmartTax,
        taxSaved:         newTaxSaved,
        savingsExplanation: lastTaxData.savingsExplanation + heldNote
      });

      // Expand the Tax Efficiency panel
      const taxBody    = document.getElementById('taxPanelBody');
      const taxChevron = document.getElementById('taxPanelChevron');
      if (taxBody && taxBody.style.display === 'none') {
        taxBody.style.display    = 'block';
        if (taxChevron) taxChevron.textContent = '▼';
      }
    }
  }, 1200);
}

function renderPerformanceChart(portfolio) {
  const ctx = document.getElementById('performanceChart').getContext('2d');
  if (performanceChart) performanceChart.destroy();

  performanceChart = new Chart(ctx, {
    type: 'bar',
    data: {
      labels: portfolio.map(p => p.symbol),
      datasets: [
        {
          label: 'Unrealized Gain ($)',
          data: portfolio.map(p => Number(p.gain) >= 0 ? Number(p.gain) : 0),
          backgroundColor: '#238636',
          borderRadius: 4
        },
        {
          label: 'Unrealized Loss ($)',
          data: portfolio.map(p => Number(p.gain) < 0 ? Number(p.gain) : 0),
          backgroundColor: '#da3633',
          borderRadius: 4
        }
      ]
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      plugins: {
        legend: {
          display: true,
          position: 'bottom',
          labels: { color: '#8b949e', font: { size: 11 }, boxWidth: 12, padding: 10 }
        }
      },
      scales: {
        x: { ticks: { color: '#8b949e', font: { size: 10 } }, grid: { color: '#21262d' } },
        y: {
          ticks: { color: '#8b949e', callback: v => '$' + v.toLocaleString() },
          grid: { color: '#21262d' }
        }
      }
    }
  });
}

function renderSelectedTable(assets, executions, strategy) {
  const tbody = document.getElementById('selectedBody');
  tbody.innerHTML = '';

  const strategyDefault = (strategy || '').toLowerCase() === 'in_kind' ? 'transfer' : 'sell';

  assets.forEach(a => {
    const execItem   = (executions || []).find(e => e && e.symbol === a.symbol) || {};
    const execStatus = execItem.status || 'selected';
    const execSide   = execItem.side;
    const defaultAction = execSide === 'sell' ? 'sell'
                        : execSide === 'buy'  ? 'transfer'
                        : strategyDefault;
    const gain = a.gain !== undefined ? Number(a.gain) : null;
    const ad   = ANALYST_DATA[a.symbol] || { rating:'N/A', tone:'neu', target:null, firm:'—', url:'#', catalyst:'No analyst data available' };

    const ratingClass = ad.tone === 'pos' ? 'rating-buy' : ad.tone === 'neg' ? 'rating-sell' : 'rating-hold';
    const targetDiff  = ad.target && ad.target !== 1 ? (ad.target - Number(a.price)) : null;
    const targetHtml  = targetDiff !== null
      ? `<span class="target-price">$${ad.target}<span class="target-arrow ${targetDiff >= 0 ? 'up' : 'down'}">${targetDiff >= 0 ? '▲' : '▼'} $${Math.abs(targetDiff).toFixed(0)}</span></span>`
      : '<span style="color:#6e7681">—</span>';

    const qIdx = portfolioLineQuestions.length;
    portfolioLineQuestions.push(
      `This asset was selected for RMD liquidation: ${a.symbol}, sell ${a.qty} shares @ $${a.price} = $${a.value}. ` +
      `Analyst: ${ad.rating} rating, 12-month target $${ad.target}. Catalyst: ${ad.catalyst}. Source: ${ad.firm}. ` +
      `Unrealized gain/loss: $${gain}. Why did the agent select this asset and do you agree with the analyst outlook?`
    );

    const acct = a.account || activeAccount?.label || '—';
    const tr = document.createElement('tr');
    tr.innerHTML = `
      <td><span class="acct-pill">${acct}</span></td>
      <td><strong>${a.symbol}</strong></td>
      <td>${a.qty} shares</td>
      <td>$${Number(a.price).toLocaleString()}</td>
      <td><strong>$${Number(a.value).toLocaleString()}</strong></td>
      <td class="${gain !== null && gain >= 0 ? 'gain-pos' : 'gain-neg'}">${gain !== null ? (gain >= 0 ? '+' : '') + '$' + gain.toFixed(2) : '—'}</td>
      <td><span class="rating-badge ${ratingClass}">${ad.rating}</span></td>
      <td>${targetHtml}</td>
      <td class="cell-catalyst" title="${ad.catalyst}">${ad.catalyst}</td>
      <td><a class="research-link" href="${ad.url}" target="_blank" rel="noopener">${ad.firm} ↗</a></td>
      <td>
        <select class="action-dropdown action-${defaultAction}" onchange="onActionChange(this)">
          <option value="sell"     ${defaultAction==='sell'     ? 'selected' : ''}>🔴 Sell — Cash Distribution</option>
          <option value="transfer" ${defaultAction==='transfer' ? 'selected' : ''}>🔵 In-Kind Transfer to Brokerage</option>
          <option value="hold"                                                    >🟡 Hold — Cover with Other Assets</option>
        </select>
      </td>
      <td><button class="btn-discuss" onclick="askBotPortfolio(${qIdx})">💬 Discuss</button></td>
    `;
    tbody.appendChild(tr);
  });

  // Summary row
  const total     = assets.reduce((s, a) => s + Number(a.value || 0), 0);
  const totalGain = assets.reduce((s, a) => s + (a.gain !== undefined ? Number(a.gain) : 0), 0);
  const tr = document.createElement('tr');
  tr.style.borderTop = '2px solid #30363d';
  tr.innerHTML = `
    <td colspan="5" style="font-weight:700;color:#ffffff">Total</td>
    <td class="${totalGain >= 0 ? 'gain-pos' : 'gain-neg'}" style="font-weight:700">${totalGain >= 0 ? '+' : ''}$${totalGain.toFixed(2)}</td>
    <td colspan="6"></td>
  `;
  tbody.appendChild(tr);
}

function resolveStatus(status, side) {
  switch ((status || '').toLowerCase()) {
    case 'filled':
      return { badge: 'done',   label: '✅ Advisor Approved',      tooltip: 'Approved and executed by advisor' };
    case 'new':
    case 'pending_new':
    case 'accepted':
      return { badge: 'inkind', label: '🔄 Pending Approval',      tooltip: 'Awaiting advisor review and approval' };
    case 'simulated':
      return side === 'sell'
        ? { badge: 'sell', label: '🔔 Recommend Sell',             tooltip: 'Agent recommends liquidation — awaiting advisor approval' }
        : { badge: 'sim',  label: '🔄 Recommend In-Kind',          tooltip: 'Agent recommends in-kind transfer — awaiting advisor approval' };
    case 'selected':
    default:
      return { badge: 'sell',   label: '🔔 Recommend Sell',        tooltip: 'Agent recommends liquidation — awaiting advisor approval before execution' };
  }
}

function renderRMDChart(rmd, liquidated) {
  const ctx = document.getElementById('rmdChart').getContext('2d');
  if (rmdChart) rmdChart.destroy();

  const coverage  = Math.min(liquidated, rmd);
  const shortfall = Math.max(0, rmd - liquidated);
  const surplus   = Math.max(0, liquidated - rmd);

  const fmt = v => '$' + Number(v).toLocaleString('en-US', {minimumFractionDigits: 2});
  const statusEl = document.getElementById('rmdStatusLine');
  if (statusEl) {
    let msg;
    if (shortfall > 0.01) {
      msg = `⚠️ Not fully covered — agent liquidated ${fmt(liquidated)} but the IRS requires ${fmt(rmd)}; still short by ${fmt(shortfall)}.`;
    } else if (surplus > rmd * 0.05) {
      msg = `✅ Fully covered with a buffer — agent liquidated ${fmt(liquidated)}, exceeding the ${fmt(rmd)} RMD requirement by ${fmt(surplus)}.`;
    } else {
      msg = `✅ RMD fully met — agent liquidated ${fmt(liquidated)}, satisfying the IRS-required ${fmt(rmd)} distribution for this year.`;
    }
    statusEl.textContent = msg;
  }

  rmdChart = new Chart(ctx, {
    type: 'bar',
    data: {
      labels: ['RMD Required', 'Liquidated', 'Covered', 'Surplus / Shortfall'],
      datasets: [
        {
          label: 'IRS Required Amount',
          data: [rmd, null, null, null],
          backgroundColor: '#58a6ff',
          borderRadius: 4
        },
        {
          label: 'Total Assets Liquidated',
          data: [null, liquidated, null, null],
          backgroundColor: '#3fb950',
          borderRadius: 4
        },
        {
          label: 'RMD Covered',
          data: [null, null, coverage, null],
          backgroundColor: '#238636',
          borderRadius: 4
        },
        {
          label: shortfall > 0 ? 'Shortfall' : 'Surplus',
          data: [null, null, null, shortfall > 0 ? shortfall : surplus],
          backgroundColor: shortfall > 0 ? '#f85149' : '#d29922',
          borderRadius: 4
        }
      ]
    },
    options: {
      indexAxis: 'y',
      responsive: true,
      maintainAspectRatio: false,
      plugins: {
        legend: {
          display: true,
          position: 'bottom',
          labels: { color: '#8b949e', font: { size: 11 }, boxWidth: 12, padding: 10 }
        },
        tooltip: {
          callbacks: { label: c => ` ${c.dataset.label}: $${Number(c.parsed.x).toLocaleString('en-US', {minimumFractionDigits:2})}` }
        }
      },
      scales: {
        x: { ticks: { color: '#8b949e', callback: v => '$' + v.toLocaleString() }, grid: { color: '#21262d' } },
        y: { ticks: { color: '#8b949e', font: { size: 11 } }, grid: { color: '#21262d' } }
      }
    }
  });
}

// ── Portfolio ─────────────────────────────────────────────────────────
async function loadPortfolio() {
  try {
    const res = await fetch(`${API}/agent/portfolio`);
    const data = await res.json();
    document.getElementById('executionJson').textContent = JSON.stringify(data, null, 2);
  } catch (e) {
    console.error('Portfolio load failed', e);
  }
}

// ── Logs ──────────────────────────────────────────────────────────────
async function loadLogs() {
  try {
    const res = await fetch(`${API}/agent/logs`);
    const logs = await res.json();
    const container = document.getElementById('logContainer');
    if (!logs.length) {
      container.innerHTML = '<div class="log-empty">No logs yet. Run the agent first.</div>';
      return;
    }
    container.innerHTML = logs.map(log => {
      const cls = log.includes('ALERT') ? 'alert' : log.includes('start') || log.includes('end') ? 'info' : '';
      return `<div class="log-line ${cls}">${log}</div>`;
    }).join('');
    container.scrollTop = container.scrollHeight;
  } catch (e) {
    document.getElementById('logContainer').innerHTML = '<div class="log-empty">Could not load logs.</div>';
  }
}

// ── Tax Analysis ─────────────────────────────────────────────────────
let taxChart = null;

function renderTaxAnalysis(tax) {
  document.getElementById('taxCompare').style.display = 'flex';
  document.getElementById('taxChartWrap').style.display = 'block';

  const fmt = v => '$' + Number(v).toLocaleString('en-US', { minimumFractionDigits: 2 });

  document.getElementById('naiveGain').textContent = fmt(tax.naiveGain);
  document.getElementById('naiveTax').textContent  = fmt(tax.naiveTaxBill);
  document.getElementById('smartGain').textContent = fmt(tax.smartGain);
  document.getElementById('smartTax').textContent  = fmt(tax.smartTaxBill);
  document.getElementById('taxSavedAmt').textContent = fmt(tax.taxSaved);
  document.getElementById('taxExplanation').textContent = tax.savingsExplanation;

  // Plain-language status line + source links
  const taxStatusEl = document.getElementById('taxStatusLine');
  if (taxStatusEl) {
    const saved    = Number(tax.taxSaved  || 0);
    const naive    = Number(tax.naiveTaxBill || 0);
    const smart    = Number(tax.smartTaxBill || 0);
    const ratePct  = tax.taxRatePct || '';

    const srcLinks = [
      { icon:'🌱', label:'Tax-Loss Harvesting (Investopedia)', url:'https://www.investopedia.com/terms/t/taxlossharvesting.asp' },
      { icon:'💹', label:'IRS Topic 409 — Capital Gains & Losses', url:'https://www.irs.gov/taxtopics/tc409' },
      { icon:'💰', label:'IRS Tax Rate Tables', url:'https://www.irs.gov/newsroom/irs-provides-tax-inflation-adjustments-for-tax-year-2024' }
    ];
    const linkHtml = srcLinks.map(s =>
      `<a class="src-icon-link" href="${s.url}" target="_blank" rel="noopener" title="${s.label}">${s.icon}</a>`
    ).join(' ');

    let msg;
    if (saved > 0.01) {
      msg = `✅ The agent saved <strong>${fmt(saved)}</strong> in taxes by selling loss-making assets first instead of winners — a technique called <em>tax-loss harvesting</em>. Without the agent the tax bill would have been ${fmt(naive)}; with it, ${fmt(smart)}${ratePct ? ' at a ' + ratePct + '% marginal rate' : ''}.`;
    } else if (smart < 0.01) {
      msg = `✅ No tax liability — selected assets had losses or zero gain, so no income tax is triggered on this distribution.`;
    } else {
      msg = `ℹ️ The agent minimized taxes as much as possible; both approaches result in a similar ${fmt(smart)} tax bill because all available assets carry gains.`;
    }

    taxStatusEl.innerHTML = `<span>${msg}</span>&nbsp;&nbsp;${linkHtml}`;
  }

  // Naive assets table
  const nb = document.getElementById('naiveAssetsBody');
  nb.innerHTML = '';
  (tax.naiveAssets || []).forEach(a => {
    const gain = Number(a.gain);
    const tr = document.createElement('tr');
    tr.innerHTML = `<td><strong>${a.symbol}</strong></td><td>${a.qty}</td>
      <td style="color:#f85149;font-weight:600">${gain >= 0 ? '+' : ''}${fmt(gain)}</td>`;
    nb.appendChild(tr);
  });

  // Smart assets table
  const sb = document.getElementById('smartAssetsBody');
  sb.innerHTML = '';
  (tax.optimizedAssets || []).forEach(a => {
    const gain = Number(a.gain || 0);
    const tr = document.createElement('tr');
    tr.innerHTML = `<td><strong>${a.symbol}</strong></td><td>${a.qty}</td>
      <td style="color:${gain >= 0 ? '#d29922' : '#3fb950'};font-weight:600">${gain >= 0 ? '+' : ''}${fmt(gain)}</td>`;
    sb.appendChild(tr);
  });

  // Bar chart
  const ctx = document.getElementById('taxChart').getContext('2d');
  if (taxChart) taxChart.destroy();
  taxChart = new Chart(ctx, {
    type: 'bar',
    data: {
      labels: ['Without Agent', 'With Agent', 'Tax Saved'],
      datasets: [
        { label: 'Naive Tax Bill (no AI)',  data: [tax.naiveTaxBill, null, null], backgroundColor: '#da3633', borderRadius: 4 },
        { label: 'Agent Tax Bill (AI)',      data: [null, tax.smartTaxBill, null], backgroundColor: '#238636', borderRadius: 4 },
        { label: 'Total Tax Saved by Agent', data: [null, null, tax.taxSaved],    backgroundColor: '#58a6ff', borderRadius: 4 }
      ]
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      plugins: {
        legend: {
          display: true,
          position: 'bottom',
          labels: { color: '#8b949e', font: { size: 11 }, boxWidth: 12, padding: 10 }
        },
        tooltip: {
          callbacks: { label: c => ` ${c.dataset.label}: $${Number(c.parsed.y).toLocaleString('en-US', {minimumFractionDigits:2})}` }
        }
      },
      scales: {
        x: { ticks: { color: '#8b949e', font: { size: 11 } }, grid: { color: '#21262d' } },
        y: { ticks: { color: '#8b949e', callback: v => '$' + v.toLocaleString() }, grid: { color: '#21262d' } }
      }
    }
  });
}

// ── Collapsible panels ────────────────────────────────────────────────
function togglePanel(panelId, chevronId) {
  const panel   = document.getElementById(panelId);
  const chevron = document.getElementById(chevronId);
  const open    = panel.style.display !== 'none';
  panel.style.display  = open ? 'none' : 'block';
  if (chevron) chevron.textContent = open ? '▶' : '▼';
}

// ── Floating Bot ──────────────────────────────────────────────────────
function toggleBot() {
  const panel = document.getElementById('botPanel');
  const badge = document.getElementById('botBadge');
  panel.classList.toggle('open');
  badge.classList.remove('active');
}

function updateBotContext() {
  const label = document.getElementById('botContextLabel');
  if (!agentData) { label.textContent = 'Awaiting agent run...'; return; }

  const tabLabels = {
    dashboard:  'Context: Dashboard — RMD & Portfolio Overview',
    portfolio:  'Context: Portfolio — Holdings & Performance',
    results:    'Context: Agent Results — Liquidation & Tax Savings',
    reinvest:   'Context: Reinvestment — Product Suggestions',
    value:      'Context: Business Value — Platform Overview',
    logs:       'Context: Agent Logs'
  };
  label.textContent = tabLabels[currentTab] || 'Context: RMD Agent';

  // Update quick questions per tab
  const quick = document.getElementById('botQuick');
  const tabQuestions = {
    dashboard: [
      ['Why these assets?',       'Why were these specific assets selected for my RMD?'],
      ['Cash vs In-Kind?',        'Should I choose cash distribution or in-kind transfer?'],
      ['How is RMD calculated?',  'How is my RMD amount calculated?'],
      ['What is my strategy?',    'Explain the strategy the agent chose for me']
    ],
    portfolio: [
      ['Best asset to sell?',     'Which asset in my portfolio is the best candidate for liquidation?'],
      ['Why keep AAPL?',          'Why is AAPL being held and not selected for liquidation?'],
      ['Portfolio risk?',         'What is the overall risk profile of my portfolio?'],
      ['What are my losses?',     'Which assets have unrealized losses in my portfolio?']
    ],
    results: [
      ['How much tax saved?',     'How much tax did the agent save compared to a random selection?'],
      ['Why these quantities?',   'Why were these specific share quantities chosen?'],
      ['What is naive approach?', 'What would have happened without the agent optimizing the selection?'],
      ['What is my tax bill?',    'What is my estimated tax bill on this RMD distribution?']
    ],
    reinvest: [
      ['Best product for me?',    'Which reinvestment product is best for my age and situation?'],
      ['What is a CD?',           'Explain the Certificate of Deposit option and its benefits'],
      ['Why municipal bonds?',    'Why are municipal bonds recommended and what is the tax benefit?'],
      ['Total income estimate?',  'What is my total projected annual income from reinvestment?']
    ],
    value: [
      ['How does agent save tax?','How exactly does the agent save taxes compared to manual processing?'],
      ['ROI of this solution?',   'What is the return on investment of deploying this RMD agent?'],
      ['Who benefits most?',      'Which type of client benefits the most from this agent?'],
      ['Scale to many clients?',  'How does this agent scale to thousands of IRA accounts?']
    ],
    logs: [
      ['What did agent do?',      'Summarize what the agent did in its last run'],
      ['Any errors?',             'Were there any errors or alerts in the agent execution?'],
      ['How long did it run?',    'How long did the agent take to complete?'],
      ['What is next step?',      'What will the agent do next?']
    ]
  };

  const questions = tabQuestions[currentTab] || tabQuestions.dashboard;
  quick.innerHTML = questions
    .map(([label, q]) => `<span class="qbtn" onclick="askBot('${q}')">${label}</span>`)
    .join('');
}

function buildTabContext() {
  if (!agentData) return 'No agent run yet.';
  const d = agentData;

  const base = `Client: age ${document.getElementById('age').value}, balance $${document.getElementById('balance').value}. ` +
    `RMD: $${Number(d.rmdAmount).toFixed(2)}. Strategy: ${d.strategy}. `;

  const contexts = {
    dashboard: base +
      `Explanation: ${d.explanation}. Reasoning: ${d.reasoning}.`,

    portfolio: base +
      `Portfolio holdings: ${(d.portfolio||[]).map(p => `${p.symbol}(${p.assetClass}, qty:${p.qty}, price:$${p.price}, gain:$${p.gain})`).join(', ')}.`,

    results: base +
      `Selected assets for liquidation: ${(d.selectedAssets||[]).map(a => `${a.symbol} qty:${a.qty} value:$${a.value}`).join(', ')}. ` +
      `Tax analysis: naive gain $${d.taxAnalysis?.naiveGain}, smart gain $${d.taxAnalysis?.smartGain}, tax saved $${d.taxAnalysis?.taxSaved} at ${d.taxAnalysis?.taxRatePct}% rate.`,

    reinvest: base +
      `Reinvestment: total $${d.reinvestment?.totalAmount?.toFixed(2)}, projected annual income $${d.reinvestment?.totalAnnualIncome}. ` +
      `Products: ${(d.reinvestment?.suggestions||[]).map(s => `${s.name}(${s.allocationPct}%, yield ${s.yieldPct}%, $${s.allocationAmount})`).join(', ')}.`,

    value: base +
      `This is the Business Value tab showing platform benefits: regulatory compliance, tax efficiency, client retention, operational savings, revenue protection, and strategic differentiation.`,

    logs: base + `User is viewing the agent execution logs tab.`
  };

  return contexts[currentTab] || base;
}

async function askBot(question) {
  const input = document.getElementById('botInput');
  const msg = question || input.value.trim();
  if (!msg) return;
  input.value = '';

  // Open bot if closed
  document.getElementById('botPanel').classList.add('open');

  appendBot('user', msg);
  const loading = appendBot('loading', '⏳ Thinking...');

  try {
    const res = await fetch(`${API}/agent/chat`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ message: msg, context: buildTabContext() })
    });
    const data = await res.json();
    loading.remove();
    appendBot('assistant', data.reply);

    // Show badge if panel is closed
    if (!document.getElementById('botPanel').classList.contains('open')) {
      document.getElementById('botBadge').classList.add('active');
    }
  } catch (e) {
    loading.remove();
    appendBot('assistant', 'Could not reach the AI assistant. Make sure the backend is running on port 8085.');
  }
}

function appendBot(role, text) {
  const box = document.getElementById('botMessages');
  const div = document.createElement('div');
  div.className = `chat-msg ${role}`;
  div.textContent = text;
  box.appendChild(div);
  box.scrollTop = box.scrollHeight;
  return div;
}
