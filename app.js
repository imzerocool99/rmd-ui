const API = 'http://localhost:8085';
let agentContext = '';
let agentData = null;
let currentTab = 'dashboard';
let portfolioChart = null;
let performanceChart = null;
let rmdChart = null;
let reinvestChart = null;

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

  // Explanation — render with line breaks and section highlighting
  const expBox = document.getElementById('explanationBox');
  const expText = data.explanation || 'No explanation returned.';
  expBox.innerHTML = expText
    .split('\n')
    .map(line => {
      if (line.startsWith('SELECTION CRITERIA:'))
        return `<div class="exp-section criteria">${line}</div>`;
      if (line.startsWith('SELECTED FOR LIQUIDATION:'))
        return `<div class="exp-header sell">📋 ${line}</div>`;
      if (line.startsWith('PROTECTED'))
        return `<div class="exp-header protect">🛡 ${line}</div>`;
      if (line.startsWith('RESULT:'))
        return `<div class="exp-result">${line}</div>`;
      if (line.trim().startsWith('•'))
        return `<div class="exp-item">${line.trim()}</div>`;
      return line ? `<div>${line}</div>` : '<br/>';
    })
    .join('') + renderExplanationSources(data);
  document.getElementById('reasoningBox').textContent = '🤖 AI Reasoning: ' + (data.reasoning || '');

  // Portfolio chart
  renderPortfolioChart(portfolio);

  // Holdings table
  renderHoldingsTable(portfolio, assets);

  // Selected assets table
  const executions = data.execution || [];
  renderSelectedTable(assets, executions);

  // RMD coverage chart
  renderRMDChart(rmd, totalLiquidated);

  // JSON raw output
  document.getElementById('executionJson').textContent = JSON.stringify(data, null, 2);

  // Reinvestment tab
  const clientAge = parseInt(document.getElementById('age').value) || 75;
  if (data.reinvestment) renderReinvestment(data.reinvestment, clientAge);

  // Tax analysis
  if (data.taxAnalysis) renderTaxAnalysis(data.taxAnalysis);

  // Intelligence strip
  renderIntelStrip(portfolio, assets);
}

// ── Explanation Sources ───────────────────────────────────────────────
const SOURCE_LIBRARY = [
  {
    id: 'rmd-rules',
    label: 'IRS — Required Minimum Distributions',
    type: 'gov',
    url: 'https://www.irs.gov/retirement-plans/retirement-topics-required-minimum-distributions-rmds',
    reason: 'Basis for RMD calculation rules and deadlines',
    keywords: ['rmd', 'required minimum', 'withdrawal', 'irs', 'age 73']
  },
  {
    id: 'pub590b',
    label: 'IRS Publication 590-B — IRA Distributions',
    type: 'gov',
    url: 'https://www.irs.gov/publications/p590b',
    reason: 'Uniform Lifetime Table used for RMD divisor at each age',
    keywords: ['uniform lifetime', 'factor', 'ira distribution', 'in-kind', 'in_kind', 'divisor']
  },
  {
    id: 'topic409',
    label: 'IRS Topic 409 — Capital Gains and Losses',
    type: 'gov',
    url: 'https://www.irs.gov/taxtopics/tc409',
    reason: 'Defines how realized gains and losses are taxed on asset sales',
    keywords: ['gain', 'loss', 'capital', 'tax', 'liquidat', 'sell', 'realized']
  },
  {
    id: 'tax-brackets',
    label: 'IRS — Tax Rate Schedules',
    type: 'gov',
    url: 'https://www.irs.gov/newsroom/irs-provides-tax-inflation-adjustments-for-tax-year-2024',
    reason: '24% marginal rate applied to calculate tax impact of each distribution',
    keywords: ['24%', 'tax rate', 'marginal', 'tax bill', 'bracket']
  },
  {
    id: 'tax-loss-harvesting',
    label: 'Investopedia — Tax-Loss Harvesting Explained',
    type: 'pro',
    url: 'https://www.investopedia.com/terms/t/taxgainlossharvesting.asp',
    reason: 'Professional explanation of loss-first liquidation strategy used by the agent',
    keywords: ['loss', 'harvest', 'tax-loss', 'tax loss', 'scoring', 'minimize tax']
  },
  {
    id: 'inkind-transfer',
    label: 'Fidelity — In-Kind IRA Distributions',
    type: 'pro',
    url: 'https://www.fidelity.com/retirement-ira/required-minimum-distribution-ira',
    reason: 'How in-kind transfers from IRA to taxable brokerage satisfy RMD requirements',
    keywords: ['in-kind', 'in_kind', 'transfer', 'brokerage', 'shares moved']
  },
  {
    id: 'rmd-penalty',
    label: 'IRS — Excess Accumulation Penalty (25%)',
    type: 'gov',
    url: 'https://www.irs.gov/retirement-plans/plan-participant-employee/retirement-topics-exceptions-to-tax-on-early-distributions',
    reason: 'IRS imposes a 25% excise tax on RMD shortfalls — automation eliminates this risk',
    keywords: ['penalty', '25%', 'excise', 'missed', 'deadline']
  },
];

function renderExplanationSources(data) {
  const text = ((data.explanation || '') + ' ' + (data.reasoning || '') + ' ' + (data.strategy || '')).toLowerCase();
  const matched = SOURCE_LIBRARY.filter(s => s.keywords.some(kw => text.includes(kw)));
  if (!matched.length) return '';

  const chips = matched.map(s => `
    <a class="source-chip source-${s.type}" href="${s.url}" target="_blank" rel="noopener">
      <span class="source-chip-icon">${s.type === 'gov' ? '🏛' : '📘'}</span>
      <span class="source-chip-body">
        <span class="source-chip-label">${s.label}</span>
        <span class="source-chip-reason">${s.reason}</span>
      </span>
      <span class="source-chip-arrow">↗</span>
    </a>`).join('');

  return `
    <div class="sources-section">
      <div class="sources-header">
        <span class="sources-icon">📎</span>
        Regulatory &amp; Professional Sources
        <span class="sources-count">${matched.length} reference${matched.length > 1 ? 's' : ''}</span>
      </div>
      <div class="sources-chips">${chips}</div>
    </div>`;
}

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
    const div = document.createElement('div');
    div.className = 'product-card';
    div.innerHTML = `
      <div class="product-card-name">${s.name}</div>
      <div class="product-card-type">${s.type}</div>
      <div class="product-card-yield">${s.yieldPct}% yield</div>
      <div class="product-card-amount">$${Number(s.allocationAmount).toLocaleString('en-US',{minimumFractionDigits:2})} allocated · $${Number(s.annualIncome).toFixed(2)}/yr</div>
      <div class="product-card-desc">${s.description}</div>
      <div class="product-card-footer">
        <span class="risk-badge ${riskClass}">${s.risk} risk</span>
        <span class="acct-badge">${s.account}</span>
      </div>
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
          position: 'right',
          labels: { color: '#8b949e', font: { size: 10 }, boxWidth: 10, padding: 8 }
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
  const selectedSymbols = selectedAssets.map(a => a.symbol);
  const tbody = document.getElementById('holdingsBody');
  tbody.innerHTML = '';

  // Sort by asset class for grouping
  const sorted = [...portfolio].sort((a, b) => (a.assetClass || '').localeCompare(b.assetClass || ''));
  let lastClass = null;

  sorted.forEach(p => {
    const value = Number(p.qty) * Number(p.price);
    const gain = Number(p.gain);
    const isSelected = selectedSymbols.includes(p.symbol);
    const cls = p.assetClass || 'Other';

    if (cls !== lastClass) {
      const sep = document.createElement('tr');
      sep.innerHTML = `<td colspan="8" style="background:#1c2128;color:#58a6ff;font-size:11px;font-weight:700;text-transform:uppercase;letter-spacing:1px;padding:6px 12px;">${cls}</td>`;
      tbody.appendChild(sep);
      lastClass = cls;
    }

    const acct = p.account || '—';
    const tr = document.createElement('tr');
    tr.innerHTML = `
      <td><span class="acct-pill">${acct}</span></td>
      <td><strong>${p.symbol}</strong></td>
      <td style="color:#8b949e;font-size:11px">${cls}</td>
      <td>${p.qty}</td>
      <td>$${Number(p.price).toLocaleString()}</td>
      <td>$${value.toLocaleString()}</td>
      <td style="color:${gain >= 0 ? '#3fb950' : '#f85149'}">${gain >= 0 ? '+' : ''}$${gain.toLocaleString()}</td>
      <td>${isSelected ? '<span class="badge sell">Recommend Sell</span>' : '<span class="badge hold">Hold</span>'}</td>
    `;
    tbody.appendChild(tr);
  });

  renderPerformanceChart(sorted);
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

function renderSelectedTable(assets, executions) {
  const tbody = document.getElementById('selectedBody');
  tbody.innerHTML = '';

  // Map execution results by symbol for status lookup
  const execMap = {};
  (executions || []).forEach(e => {
    if (e && e.symbol) execMap[e.symbol] = e.status || 'simulated';
  });

  assets.forEach(a => {
    const execStatus = execMap[a.symbol] || 'selected';
    const { badge, label, tooltip } = resolveStatus(execStatus);
    const gain = a.gain !== undefined ? Number(a.gain) : null;

    const acct = a.account || activeAccount?.label || '—';
    const tr = document.createElement('tr');
    tr.innerHTML = `
      <td><span class="acct-pill">${acct}</span></td>
      <td><strong>${a.symbol}</strong></td>
      <td>${a.qty} shares</td>
      <td>$${Number(a.price).toLocaleString()}</td>
      <td><strong>$${Number(a.value).toLocaleString()}</strong></td>
      <td>${gain !== null
        ? `<span style="color:${gain >= 0 ? '#d29922' : '#3fb950'}">${gain >= 0 ? '+' : ''}$${gain.toFixed(2)}</span>`
        : '—'}</td>
      <td><span class="badge ${badge}" title="${tooltip}">${label}</span></td>
    `;
    tbody.appendChild(tr);
  });

  // Summary row
  const total = assets.reduce((s, a) => s + Number(a.value || 0), 0);
  const totalGain = assets.reduce((s, a) => s + (a.gain !== undefined ? Number(a.gain) : 0), 0);
  const tr = document.createElement('tr');
  tr.style.borderTop = '2px solid #30363d';
  tr.innerHTML = `
    <td colspan="4" style="font-weight:700;color:#c9d1d9">Total</td>
    <td style="font-weight:700;color:#58a6ff">$${total.toLocaleString('en-US',{minimumFractionDigits:2})}</td>
    <td style="color:${totalGain >= 0 ? '#d29922' : '#3fb950'};font-weight:700">${totalGain >= 0 ? '+' : ''}$${totalGain.toFixed(2)}</td>
    <td></td>
  `;
  tbody.appendChild(tr);
}

function resolveStatus(status) {
  switch ((status || '').toLowerCase()) {
    case 'filled':
      return { badge: 'done',   label: '✅ Advisor Approved',   tooltip: 'Approved and executed by advisor' };
    case 'new':
    case 'pending_new':
    case 'accepted':
      return { badge: 'inkind', label: '🔄 Pending Approval',   tooltip: 'Awaiting advisor review and approval' };
    case 'simulated':
      return { badge: 'sim',    label: '👁 Pending Review',     tooltip: 'Recommended by agent — awaiting advisor approval before execution' };
    case 'selected':
    default:
      return { badge: 'hold',   label: '👁 Pending Review',     tooltip: 'Recommended by agent — awaiting advisor approval before execution' };
  }
}

function renderRMDChart(rmd, liquidated) {
  const ctx = document.getElementById('rmdChart').getContext('2d');
  if (rmdChart) rmdChart.destroy();

  const coverage  = Math.min(liquidated, rmd);
  const shortfall = Math.max(0, rmd - liquidated);
  const surplus   = Math.max(0, liquidated - rmd);

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
    value:      'Context: Business Value — POC Showcase',
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
      `This is the Business Value tab showing POC benefits: regulatory compliance, tax efficiency, client retention, operational savings, revenue protection, and strategic differentiation.`,

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
