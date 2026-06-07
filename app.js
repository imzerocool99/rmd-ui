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
let lastAssetValues  = {};
let lastTaxData      = null;
let rmdActionState       = {};   // { symbol: { orig, cur, value, gain } }
let rmdReoptTimer        = null;
let lastReinvestmentData  = null; // cached so re-render fires on pill changes
let lastClientAge         = 75;
let lastScaledSuggestions = [];   // used by reinvestUpdateTotals for live advice text
let lastCashToBank        = 0;

// ── Demo fallback data ────────────────────────────────────────────────
// Used automatically when the backend is unreachable (keeps demo alive)
const DEMO_DATA = {
  strategy: 'sell',
  rmdAmount: 20325.20,
  explanation: 'CASH SALE strategy selected. Assets were ranked by tax-efficiency score: losses and low-gain positions liquidated first to minimize Robert\'s 24% ordinary income tax. Total $20,325.20 distributed across 5 holdings.',
  reasoning: 'Stable market conditions — generating cash by liquidating underperforming and over-concentrated positions.',
  portfolio: [
    { symbol:'AAPL',  assetClass:'US Equity',            qty:10, price:213,  gain:1200  },
    { symbol:'TSLA',  assetClass:'US Equity',             qty: 6, price:248,  gain:-1800 },
    { symbol:'EEM',   assetClass:'Intl Equity',           qty:40, price: 42,  gain: -680 },
    { symbol:'TLT',   assetClass:'Bond',                  qty:20, price: 88,  gain: -420 },
    { symbol:'LQD',   assetClass:'Corporate Bond',        qty:18, price:107,  gain: -230 },
    { symbol:'MUB',   assetClass:'Municipal Bond',        qty:16, price:104,  gain:  180 },
    { symbol:'HYG',   assetClass:'High Yield Bond',       qty:22, price: 74,  gain: -510 },
    { symbol:'VNQ',   assetClass:'Real Estate',           qty:14, price: 82,  gain: -210 },
    { symbol:'GLD',   assetClass:'Commodity',             qty:12, price:225,  gain: 1850 },
    { symbol:'USO',   assetClass:'Commodity',             qty:25, price: 74,  gain: -640 },
    { symbol:'VTI',   assetClass:'US Broad Market ETF',  qty:18, price:242,  gain: 2800 },
    { symbol:'XLV',   assetClass:'Healthcare ETF',        qty:16, price:140,  gain:  620 },
    { symbol:'VMFXX', assetClass:'Money Market',         qty:100, price:  1,  gain:    0 }
  ],
  selectedAssets: [
    { symbol:'TSLA', assetClass:'US Equity',           qty: 6, price:248, value:1488, gain:-1800, account:'Traditional IRA' },
    { symbol:'EEM',  assetClass:'Intl Equity',         qty:40, price: 42, value:1680, gain: -680, account:'Traditional IRA' },
    { symbol:'USO',  assetClass:'Commodity',           qty:25, price: 74, value:1850, gain: -640, account:'Traditional IRA' },
    { symbol:'HYG',  assetClass:'High Yield Bond',     qty:22, price: 74, value:1628, gain: -510, account:'Traditional IRA' },
    { symbol:'TLT',  assetClass:'Bond',                qty:20, price: 88, value:1760, gain: -420, account:'Traditional IRA' },
    { symbol:'LQD',  assetClass:'Corporate Bond',      qty:18, price:107, value:1926, gain: -230, account:'Traditional IRA' },
    { symbol:'VNQ',  assetClass:'Real Estate',         qty:14, price: 82, value:1148, gain: -210, account:'Traditional IRA' },
    { symbol:'MUB',  assetClass:'Municipal Bond',      qty:16, price:104, value:1664, gain:  180, account:'Traditional IRA' },
    { symbol:'XLV',  assetClass:'Healthcare ETF',      qty:16, price:140, value:2240, gain:  620, account:'Traditional IRA' },
    { symbol:'VTI',  assetClass:'US Broad Market ETF', qty: 5, price:242, value:1210, gain:  780, account:'Traditional IRA' },
    { symbol:'GLD',  assetClass:'Commodity',           qty:12, price:225, value:2700, gain: 1850, account:'Traditional IRA' }
  ],
  execution: [
    { symbol:'TSLA', qty:6,  side:'sell', status:'simulated' },
    { symbol:'EEM',  qty:40, side:'sell', status:'simulated' },
    { symbol:'HYG',  qty:22, side:'sell', status:'simulated' }
  ],
  taxAnalysis: {
    smartTaxBill:  648.00,
    naiveTaxBill:  2868.00,
    taxSaved:      2220.00,
    smartGain:     2700.00,
    naiveGain:     11950.00,
    savingsExplanation: 'Agent selected loss-first assets (TSLA −$1,800, EEM −$680, HYG −$510) to offset $2,990 in gains. Without the agent a naive highest-gain-first approach would have triggered a $2,868 tax bill. Smart selection reduced this to $648 — saving Robert $2,220.'
  },
  reinvestment: {
    totalAmount: 20325.20,
    totalAnnualIncome: 862.14,
    agentAdvice: 'Given Robert\'s age of 75 and a $20,325 RMD, the recommended product mix prioritizes capital preservation and income generation. High-Yield Savings and CDs provide FDIC-insured liquidity at 4.5–4.85% yield, while T-Bills offer tax-efficient government-backed income. The 20% allocation to Dividend ETF (SCHD/VYM) adds equity exposure for inflation protection — appropriate for a client with a long time horizon and moderate risk tolerance.',
    suggestions: [
      { name:'High-Yield Savings Account',  type:'Cash / Savings',               allocationPct:20.0, allocationAmount:4065.04, yieldPct:4.50, annualIncome:182.93, risk:'Low',         liquidity:'Immediate',          description:'FDIC insured up to $250K. Best for emergency liquidity. No lock-in period.',                                                                                     account:'Same Bank' },
      { name:'Certificate of Deposit (CD)', type:'Fixed Income',                  allocationPct:15.0, allocationAmount:3048.78, yieldPct:4.85, annualIncome:147.87, risk:'Low',         liquidity:'Low (locked term)',   description:'12-month CD. FDIC insured. Fixed rate locked in for the term. Early withdrawal penalty applies.',                                                              account:'Same Bank' },
      { name:'US Treasury Bills (T-Bills)', type:'Government Securities',         allocationPct:15.0, allocationAmount:3048.78, yieldPct:4.20, annualIncome:128.05, risk:'Very Low',    liquidity:'High (3-12 months)', description:'Backed by the US government. Exempt from state and local tax. Ideal for capital preservation.',                                                              account:'Brokerage Account' },
      { name:'Municipal Bond Fund (MUB)',   type:'Tax-Advantaged Fixed Income',   allocationPct:15.0, allocationAmount:3048.78, yieldPct:3.80, annualIncome:115.85, risk:'Low-Medium',  liquidity:'Medium',             description:'Interest is federally tax-free. Excellent for clients in higher tax brackets.',                                                                               account:'Brokerage Account' },
      { name:'Dividend ETF (SCHD / VYM)',   type:'Equity Income',                 allocationPct:20.0, allocationAmount:4065.04, yieldPct:3.50, annualIncome:142.28, risk:'Medium',      liquidity:'High',               description:'Diversified dividend-paying stocks. Combines income yield with long-term growth potential. Taxable dividends.',                                               account:'Brokerage Account' },
      { name:'Fixed Annuity',               type:'Insurance / Guaranteed Income', allocationPct:10.0, allocationAmount:2032.52, yieldPct:5.20, annualIncome:105.69, risk:'Very Low',    liquidity:'Low (surrender)',     description:'Guaranteed interest rate. Tax-deferred growth. Option to convert to lifetime income stream. Ideal for longevity protection.',                                   account:'Insurance Product' },
      { name:'Money Market Fund (VMFXX)',   type:'Cash Equivalent',               allocationPct: 5.0, allocationAmount:1016.26, yieldPct:4.10, annualIncome: 41.67, risk:'Very Low',    liquidity:'Immediate',          description:'Near-cash stability with better yield than checking accounts. Invests in short-term government and corporate debt.',                                            account:'Brokerage Account' }
    ]
  },
  sources: [
    { title:'IRS Publication 590-B — Distributions from IRAs', url:'https://www.irs.gov/publications/p590b', icon:'📋' },
    { title:'IRS Uniform Lifetime Table — RMD Factors', url:'https://www.irs.gov/retirement-plans/plan-participant-employee/required-minimum-distribution-worksheets', icon:'📊' },
    { title:'IRC Section 408(d)(8) — Qualified Charitable Distributions', url:'https://www.law.cornell.edu/uscode/text/26/408', icon:'⚖️' }
  ]
};

// ── Client Registry ───────────────────────────────────────────────────
// accounts[] — each client can have 1 or more IRA accounts
const CLIENTS = [
  {
    id: 'client_001', name: 'Robert & Margaret Chen', initials: 'RC', location: 'New York, NY',
    accounts: [
      {
        accountId: 'IRA-001-A', label: 'Traditional IRA', type: 'Traditional IRA', age: 75, balance: 500000, preference: 'sell', charitablePct: 5,
        totalAssetValue: 498240, availableCash: 12400, fmv1231: 485000,
        curRmd: 19436, curDist: 0, priorRmd: 18750, priorDist: 18750,
        holdings: [
          { symbol: 'MSFT',  name: 'Microsoft Corp',       assetClass: 'Equity',       value: 142800, pct: 28.7, gain: 62400,  price: 418 },
          { symbol: 'AAPL',  name: 'Apple Inc',            assetClass: 'Equity',       value: 94600,  pct: 19.0, gain: 41200,  price: 195 },
          { symbol: 'VTI',   name: 'Vanguard Total Stock', assetClass: 'ETF',          value: 87200,  pct: 17.5, gain: 28900,  price: 275 },
          { symbol: 'VBTLX', name: 'Vanguard Total Bond',  assetClass: 'Fixed Income', value: 98400,  pct: 19.8, gain: 8200,   price: 9.8 },
          { symbol: 'INTC',  name: 'Intel Corp',           assetClass: 'Equity',       value: 62840,  pct: 12.6, gain: -18600, price: 22  },
          { symbol: 'CASH',  name: 'Cash & Equivalents',   assetClass: 'Cash',         value: 12400,  pct: 2.5,  gain: 0,      price: 1   },
        ]
      },
      {
        accountId: 'IRA-001-B', label: 'Rollover IRA', type: 'Rollover IRA', age: 75, balance: 320000, preference: 'in_kind', charitablePct: 5,
        totalAssetValue: 318750, availableCash: 8200, fmv1231: 310000,
        curRmd: 12451, curDist: 6000, priorRmd: 11960, priorDist: 11960,
        holdings: [
          { symbol: 'BRK.B', name: 'Berkshire Hathaway B', assetClass: 'Equity',       value: 112400, pct: 35.3, gain: 31800,  price: 448  },
          { symbol: 'GOOGL', name: 'Alphabet Inc',         assetClass: 'Equity',       value: 98200,  pct: 30.8, gain: 22400,  price: 175  },
          { symbol: 'APMXX', name: 'Apex Money Market',    assetClass: 'Fixed Income', value: 62100,  pct: 19.5, gain: 1200,   price: 1    },
          { symbol: 'APUSB', name: 'Apex US Bond',         assetClass: 'Fixed Income', value: 37850,  pct: 11.9, gain: 980,    price: 10   },
          { symbol: 'CASH',  name: 'Cash & Equivalents',   assetClass: 'Cash',         value: 8200,   pct: 2.6,  gain: 0,      price: 1    },
        ]
      },
    ]
  },
  {
    id: 'client_002', name: 'William & Dorothy Davis', initials: 'WD', location: 'Boston, MA',
    accounts: [
      {
        accountId: 'IRA-002-A', label: 'Traditional IRA', type: 'Traditional IRA', age: 78, balance: 750000, preference: 'sell', charitablePct: 7,
        totalAssetValue: 746500, availableCash: 18200, fmv1231: 728000,
        curRmd: 33455, curDist: 12000, priorRmd: 31740, priorDist: 31740,
        holdings: [
          { symbol: 'SPY',   name: 'S&P 500 ETF',          assetClass: 'ETF',          value: 224000, pct: 30.0, gain: 88400,  price: 560 },
          { symbol: 'QQQ',   name: 'Nasdaq-100 ETF',       assetClass: 'ETF',          value: 168200, pct: 22.5, gain: 61200,  price: 480 },
          { symbol: 'BND',   name: 'Vanguard Bond ETF',    assetClass: 'Fixed Income', value: 142600, pct: 19.1, gain: 9800,   price: 73  },
          { symbol: 'VNQ',   name: 'Vanguard Real Estate', assetClass: 'Real Estate',  value: 112200, pct: 15.0, gain: -4200,  price: 84  },
          { symbol: 'AMZN',  name: 'Amazon.com Inc',       assetClass: 'Equity',       value: 81300,  pct: 10.9, gain: 32600,  price: 188 },
          { symbol: 'CASH',  name: 'Cash & Equivalents',   assetClass: 'Cash',         value: 18200,  pct: 2.4,  gain: 0,      price: 1   },
        ]
      },
    ]
  },
  {
    id: 'client_003', name: 'James Harrison', initials: 'JH', location: 'Chicago, IL',
    accounts: [
      {
        accountId: 'IRA-003-A', label: 'Traditional IRA', type: 'Traditional IRA', age: 73, balance: 250000, preference: 'in_kind', charitablePct: 3,
        totalAssetValue: 248900, availableCash: 6400, fmv1231: 242000,
        curRmd: 9880, curDist: 0, priorRmd: 9560, priorDist: 9560,
        holdings: [
          { symbol: 'VTI',   name: 'Vanguard Total Stock', assetClass: 'ETF',          value: 84200,  pct: 33.8, gain: 22100,  price: 275 },
          { symbol: 'VXUS',  name: 'Vanguard Intl Stock',  assetClass: 'ETF',          value: 61400,  pct: 24.7, gain: 8400,   price: 62  },
          { symbol: 'BND',   name: 'Vanguard Bond ETF',    assetClass: 'Fixed Income', value: 52800,  pct: 21.2, gain: 3200,   price: 73  },
          { symbol: 'GLD',   name: 'SPDR Gold Shares',     assetClass: 'Commodity',    value: 44100,  pct: 17.7, gain: 6800,   price: 228 },
          { symbol: 'CASH',  name: 'Cash & Equivalents',   assetClass: 'Cash',         value: 6400,   pct: 2.6,  gain: 0,      price: 1   },
        ]
      },
    ]
  },
  {
    id: 'client_004', name: 'Patricia & John Kim', initials: 'PK', location: 'San Jose, CA',
    accounts: [
      {
        accountId: 'IRA-004-A', label: 'Traditional IRA', type: 'Traditional IRA', age: 80, balance: 1200000, preference: 'sell', charitablePct: 10,
        totalAssetValue: 1194200, availableCash: 42000, fmv1231: 1165000,
        curRmd: 62368, curDist: 20000, priorRmd: 58250, priorDist: 58250,
        holdings: [
          { symbol: 'NVDA',  name: 'NVIDIA Corp',          assetClass: 'Equity',       value: 312400, pct: 26.2, gain: 198200, price: 122  },
          { symbol: 'MSFT',  name: 'Microsoft Corp',       assetClass: 'Equity',       value: 228600, pct: 19.1, gain: 82400,  price: 418  },
          { symbol: 'AAPL',  name: 'Apple Inc',            assetClass: 'Equity',       value: 184200, pct: 15.4, gain: 68400,  price: 195  },
          { symbol: 'SPY',   name: 'S&P 500 ETF',          assetClass: 'ETF',          value: 168400, pct: 14.1, gain: 48200,  price: 560  },
          { symbol: 'AGG',   name: 'iShares Core Bond',    assetClass: 'Fixed Income', value: 142800, pct: 11.9, gain: 6400,   price: 99   },
          { symbol: 'CASH',  name: 'Cash & Equivalents',   assetClass: 'Cash',         value: 42000,  pct: 3.5,  gain: 0,      price: 1    },
        ]
      },
    ]
  },
  {
    id: 'client_005', name: 'Barbara & Thomas Wilson', initials: 'BW', location: 'Austin, TX',
    accounts: [
      {
        accountId: 'IRA-005-A', label: 'Traditional IRA', type: 'Traditional IRA', age: 74, balance: 425000, preference: 'sell', charitablePct: 3,
        totalAssetValue: 422800, availableCash: 11200, fmv1231: 412000,
        curRmd: 16680, curDist: 8000, priorRmd: 15920, priorDist: 15920,
        holdings: [
          { symbol: 'VTI',   name: 'Vanguard Total Stock', assetClass: 'ETF',          value: 148200, pct: 35.1, gain: 42100,  price: 275 },
          { symbol: 'AAPL',  name: 'Apple Inc',            assetClass: 'Equity',       value: 94600,  pct: 22.4, gain: 28400,  price: 195 },
          { symbol: 'BND',   name: 'Vanguard Bond ETF',    assetClass: 'Fixed Income', value: 84200,  pct: 19.9, gain: 4200,   price: 73  },
          { symbol: 'SCHD',  name: 'Schwab US Dividend',   assetClass: 'ETF',          value: 72400,  pct: 17.1, gain: 18200,  price: 82  },
          { symbol: 'CASH',  name: 'Cash & Equivalents',   assetClass: 'Cash',         value: 11200,  pct: 2.6,  gain: 0,      price: 1   },
        ]
      },
    ]
  },
];

let activeClient   = null;
let activeAccount  = null;        // last single selected (used for agent run fallback)
let selectedAccounts = [];        // array of selected account objects (multi-select)

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

  // Reset selections for this client
  selectedAccounts = [];

  // Render account picker (always shown now, even for 1 account)
  renderAccountPicker(c);

  // Auto-select all accounts and show summary immediately
  selectedAccounts = [...c.accounts];
  activeAccount = c.accounts[0];
  document.getElementById('clientId').value = c.id + '/' + c.accounts.map(a => a.accountId).join(',');
  renderAccountPickerSelections();
  populateAccountSummary(selectedAccounts);
}

function renderAccountPicker(c) {
  const wrap = document.getElementById('accountPickerWrap');
  wrap.innerHTML = `
    <div class="acct-picker-label">Accounts <span style="font-size:10px;color:#484f58;font-weight:400">— select one or more</span></div>
    <div class="acct-cards" id="acctCards">
      ${c.accounts.map((a, i) => `
        <div class="acct-card" id="acct-card-${i}" onmousedown="toggleAccountSelection(${i})">
          <div class="acct-card-cb" id="acct-cb-${i}"></div>
          <div class="acct-card-type">${a.type}</div>
          <div class="acct-card-id">${a.accountId}</div>
          <div class="acct-card-bal">$${(a.balance/1000).toFixed(0)}K</div>
        </div>`).join('')}
    </div>`;
}

function renderAccountPickerSelections() {
  if (!activeClient) return;
  activeClient.accounts.forEach((a, i) => {
    const card = document.getElementById('acct-card-' + i);
    const cb   = document.getElementById('acct-cb-'   + i);
    if (!card) return;
    const isSelected = selectedAccounts.includes(a);
    card.classList.toggle('acct-card-active', isSelected);
    cb.textContent = isSelected ? '✓' : '';
  });
}

function toggleAccountSelection(idx) {
  if (!activeClient) return;
  const acct = activeClient.accounts[idx];
  const pos  = selectedAccounts.indexOf(acct);
  if (pos === -1) {
    selectedAccounts.push(acct);
  } else if (selectedAccounts.length > 1) {
    // Don't allow deselecting the last account
    selectedAccounts.splice(pos, 1);
  }
  activeAccount = selectedAccounts[selectedAccounts.length - 1];
  document.getElementById('clientId').value =
    activeClient.id + '/' + selectedAccounts.map(a => a.accountId).join(',');
  document.getElementById('err-account').textContent = '';
  renderAccountPickerSelections();
  populateAccountSummary(selectedAccounts);
}

function getActiveAccount(idx) {
  return activeClient ? activeClient.accounts[idx] : null;
}

function selectAccount(acct, silent, idx) {
  // Kept for backward-compat; routes through toggle logic
  if (!acct) return;
  toggleAccountSelection(idx || 0);
}

// ── Account Summary (populated on account select) ────────────────────
function fmt(n) { return '$' + Math.round(n).toLocaleString(); }

function populateAccountSummary(accts) {
  // Accept single account or array
  const list = Array.isArray(accts) ? accts : [accts];
  if (list.length === 0) return;

  // Show cards and two-col section, hide notice
  document.getElementById('acctSummaryNotice').style.display = 'none';
  document.getElementById('summaryCards').style.display      = '';
  document.getElementById('dashTwoCol').style.display        = '';

  // ── Aggregate across all selected accounts ──
  const agg = {
    totalAssetValue: list.reduce((s, a) => s + a.totalAssetValue, 0),
    availableCash:   list.reduce((s, a) => s + a.availableCash, 0),
    fmv1231:         list.reduce((s, a) => s + a.fmv1231, 0),
    curRmd:          list.reduce((s, a) => s + a.curRmd, 0),
    curDist:         list.reduce((s, a) => s + a.curDist, 0),
    priorRmd:        list.reduce((s, a) => s + a.priorRmd, 0),
    priorDist:       list.reduce((s, a) => s + a.priorDist, 0),
  };

  // Merge holdings — same symbol across accounts adds up
  const holdingMap = {};
  list.forEach(a => {
    a.holdings.forEach(h => {
      if (holdingMap[h.symbol]) {
        holdingMap[h.symbol].value += h.value;
        holdingMap[h.symbol].gain  += h.gain;
      } else {
        holdingMap[h.symbol] = { ...h };
      }
    });
  });
  const mergedHoldings = Object.values(holdingMap).map(h => ({
    ...h, pct: (h.value / agg.totalAssetValue) * 100
  })).sort((a, b) => b.value - a.value);

  // ── Summary cards ──
  const remaining = agg.curRmd - agg.curDist;
  const acctLabel = list.length > 1 ? `${list.length} accounts combined` : `Age ${list[0].age} · Factor ${(list[0].fmv1231 / list[0].curRmd).toFixed(1)}`;

  document.getElementById('cardTotalAsset').textContent = fmt(agg.totalAssetValue);
  document.getElementById('cardAvailCash').textContent  = fmt(agg.availableCash);
  document.getElementById('cardFmv').textContent        = fmt(agg.fmv1231);
  document.getElementById('cardCurRmd').textContent     = fmt(agg.curRmd);
  document.getElementById('cardCurRmdSub').textContent  = acctLabel;
  document.getElementById('cardCurDist').textContent    = agg.curDist > 0 ? fmt(agg.curDist) : '$0';
  document.getElementById('cardCurDistSub').textContent = remaining > 0
    ? `${fmt(remaining)} remaining`
    : 'RMD fully satisfied ✓';
  document.getElementById('cardPriorRmd').textContent   = fmt(agg.priorRmd);
  document.getElementById('cardPriorDist').textContent  = fmt(agg.priorDist);
  document.getElementById('cardPriorDistSub').textContent =
    agg.priorDist >= agg.priorRmd ? 'Satisfied ✓' : `Shortfall ${fmt(agg.priorRmd - agg.priorDist)}`;

  document.getElementById('cardCurDist').className = 'card-value ' + (remaining > 0 ? 'orange' : 'green');

  // ── Holdings allocation table ──
  const tbody = document.getElementById('allocBody');
  tbody.innerHTML = mergedHoldings.map(h => {
    const barW    = Math.max(4, Math.round(h.pct * 1.8));
    const gainTxt = h.gain === 0 ? '—' : (h.gain > 0 ? '+' : '') + fmt(Math.abs(h.gain));
    const gainCol = h.gain > 0 ? '#4ade80' : h.gain < 0 ? '#f85149' : '#484f58';
    return `<tr>
      <td><strong>${h.symbol}</strong><br/><span style="font-size:10px;color:#8b949e">${h.name}</span></td>
      <td><span class="hc-class ${assetClassCss(h.assetClass)}">${h.assetClass}</span></td>
      <td style="text-align:right">${fmt(h.value)}</td>
      <td style="text-align:right">
        <div class="alloc-bar-wrap" style="justify-content:flex-end;gap:6px">
          <span style="font-size:11px;color:#c9d1d9;font-weight:700">${h.pct.toFixed(1)}%</span>
          <div class="alloc-bar" style="width:${barW}px"></div>
        </div>
      </td>
    </tr>`;
  }).join('');

  // ── Top 5 highlights ──
  const top5 = mergedHoldings.filter(h => h.symbol !== 'CASH').slice(0, 5);
  document.getElementById('holdingsHighlights').innerHTML = top5.map((h, i) => {
    const gainHtml = h.gain > 0
      ? `<span class="hc-gain-pos">+${fmt(h.gain)}</span>`
      : h.gain < 0
      ? `<span class="hc-gain-neg">-${fmt(Math.abs(h.gain))}</span>`
      : '';
    return `<div class="highlight-card">
      <div class="hc-rank">#${i+1}</div>
      <div class="hc-sym">${h.symbol}</div>
      <div class="hc-name">${h.name}</div>
      <span class="hc-class ${assetClassCss(h.assetClass)}">${h.assetClass}</span>
      <div class="hc-right">
        <div class="hc-val">${fmt(h.value)}</div>
        <div class="hc-pct">${h.pct.toFixed(1)}% of portfolio</div>
        ${gainHtml}
      </div>
    </div>`;
  }).join('');

  // ── Rebuild portfolio pie chart ──
  buildPortfolioChart(mergedHoldings);

  // ── Portfolio tab — populate from account data immediately ──
  renderHoldingsFromAccounts(list);

  // ── Advisory Intelligence strip — show immediately based on held symbols ──
  renderIntelStrip(mergedHoldings, []);
}

function assetClassCss(cls) {
  const map = { 'Equity':'eq', 'Fixed Income':'fi', 'ETF':'etf', 'Cash':'ca', 'Real Estate':'re', 'Commodity':'ca' };
  return map[cls] || 'etf';
}

function buildPortfolioChart(holdings) {
  const ctx = document.getElementById('portfolioChart').getContext('2d');
  if (portfolioChart) portfolioChart.destroy();
  const colors = ['#7EC8F5','#4ade80','#a78bfa','#f59e0b','#f85149','#34d399','#60a5fa'];
  portfolioChart = new Chart(ctx, {
    type: 'doughnut',
    data: {
      labels: holdings.map(h => h.symbol),
      datasets: [{ data: holdings.map(h => h.value), backgroundColor: colors, borderWidth: 2, borderColor: '#0d1117' }]
    },
    options: {
      responsive: true, maintainAspectRatio: false, cutout: '62%',
      plugins: {
        legend: { position: 'bottom', labels: { color: '#8b949e', font: { size: 10 }, padding: 10, boxWidth: 10 } },
        tooltip: { callbacks: { label: ctx => ` ${ctx.label}: $${ctx.raw.toLocaleString()} (${ctx.parsed.toFixed ? ((ctx.raw / ctx.dataset.data.reduce((a,b)=>a+b,0))*100).toFixed(1) : ''}%)` } }
      }
    }
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

  return valid;
}

// ── Run Agent ─────────────────────────────────────────────────────────
// ── Agent Overlay helpers ─────────────────────────────────────────────
const OVERLAY_AGENTS = [
  { id: 'tax',  label: 'Tax &amp; Gain Analysis Agent', dur: 900  },
  { id: 'risk', label: 'Risk &amp; IRMAA Guard Agent',  dur: 900  },
  { id: 'qcd',  label: 'QCD Optimization Agent',        dur: 900  },
  { id: 'ik',   label: 'In-Kind Transfer Agent',        dur: 900  },
  { id: 'cash', label: 'Cash Flow Agent',               dur: 900  },
  { id: 'orch', label: 'Advisor',                        dur: 900  }
];
// agents stagger by 300ms each, run 900ms, orch starts after last worker ends
// total: 4*300 + 900 + 900 + 400 = ~3.8 seconds

function showAgentOverlay() {
  const overlay = document.getElementById('agentOverlay');
  overlay.style.display = 'flex';
  OVERLAY_AGENTS.forEach(a => {
    const row  = document.getElementById('ova-'  + a.id);
    const icon = document.getElementById('ovai-' + a.id);
    const stat = document.getElementById('ovas-' + a.id);
    const time = document.getElementById('ovat-' + a.id);
    row.className  = 'ov-agent' + (a.id === 'orch' ? ' ov-orch' : '');
    icon.textContent = '···';
    stat.textContent = a.id === 'orch' ? 'Waiting for all agents…' : 'Queued';
    time.textContent = '—';
  });
  document.getElementById('overlayProgFill').style.width = '0%';
  document.getElementById('overlayProgPct').textContent  = '0%';
  document.getElementById('overlayProgLabel').textContent = 'Dispatching agents…';
  document.getElementById('overlaySubtitle').textContent  = 'Autonomous strategy selection in progress…';
}

function hideAgentOverlay() {
  document.getElementById('agentOverlay').style.display = 'none';
}

function runOverlayAnimation() {
  return new Promise(resolve => {
    const nonOrch = OVERLAY_AGENTS.filter(a => a.id !== 'orch');
    const STAGGER  = 300; // ms between each agent start
    const DURATION = 900; // ms each agent runs

    nonOrch.forEach((a, idx) => {
      const start = idx * STAGGER;
      const end   = start + DURATION;

      setTimeout(() => {
        const row  = document.getElementById('ova-'  + a.id);
        const icon = document.getElementById('ovai-' + a.id);
        const stat = document.getElementById('ovas-' + a.id);
        row.classList.add('ov-running');
        icon.textContent = '▶';
        stat.textContent = 'Analyzing…';
        const pct = Math.round((idx / (nonOrch.length + 1)) * 80);
        document.getElementById('overlayProgFill').style.width = pct + '%';
        document.getElementById('overlayProgPct').textContent  = pct + '%';
      }, start);

      setTimeout(() => {
        const row  = document.getElementById('ova-'  + a.id);
        const icon = document.getElementById('ovai-' + a.id);
        const stat = document.getElementById('ovas-' + a.id);
        const time = document.getElementById('ovat-' + a.id);
        row.classList.remove('ov-running');
        row.classList.add('ov-done');
        icon.textContent = '✓';
        stat.textContent = 'Complete';
        time.textContent = (DURATION / 1000).toFixed(1) + 's';
      }, end);
    });

    // Orchestrator starts after all workers finish (last start + duration)
    const orchStart = (nonOrch.length - 1) * STAGGER + DURATION;
    setTimeout(() => {
      document.getElementById('overlayProgFill').style.width = '85%';
      document.getElementById('overlayProgPct').textContent  = '85%';
      document.getElementById('overlayProgLabel').textContent = 'Advisor synthesizing…';
      const row  = document.getElementById('ova-orch');
      const icon = document.getElementById('ovai-orch');
      const stat = document.getElementById('ovas-orch');
      row.classList.add('ov-running');
      icon.textContent = '▶';
      stat.textContent = 'Synthesizing strategy…';
    }, orchStart);

    const orchEnd = orchStart + DURATION;
    setTimeout(() => {
      const row  = document.getElementById('ova-orch');
      const icon = document.getElementById('ovai-orch');
      const stat = document.getElementById('ovas-orch');
      const time = document.getElementById('ovat-orch');
      row.classList.remove('ov-running');
      row.classList.add('ov-done');
      icon.textContent = '✓';
      stat.textContent = 'Strategy selected';
      time.textContent = (DURATION / 1000).toFixed(1) + 's';
      document.getElementById('overlayProgFill').style.width = '100%';
      document.getElementById('overlayProgPct').textContent  = '100%';
      document.getElementById('overlayProgLabel').textContent = 'All agents complete';
      document.getElementById('overlaySubtitle').textContent  = 'Preparing RMD Advice…';
      setTimeout(resolve, 400);
    }, orchEnd);
  });
}

async function runAgent() {
  if (!validateForm()) return;

  const btn   = document.getElementById('runBtn');
  const spin  = document.getElementById('runBtnSpinner');
  const label = document.getElementById('runBtnLabel');
  btn.classList.add('btn-circle-running');
  spin.style.display  = 'block';
  label.style.display = 'none';

  const acct        = activeAccount || (selectedAccounts[0]) || (activeClient && activeClient.accounts[0]);
  const selAccts    = selectedAccounts.length > 0 ? selectedAccounts : (acct ? [acct] : []);
  const totalBal    = selAccts.reduce((s, a) => s + (a.balance || 0), 0) || (acct ? acct.balance : 500000);
  const acctIdList  = selAccts.map(a => a.accountId).join(',');
  const body = {
    age:        acct ? acct.age        : 75,
    balance:    totalBal,
    preference: acct ? acct.preference : 'sell',
    clientId:   (activeClient ? activeClient.id : 'default') + '/' + acctIdList
  };

  showAgentOverlay();

  // Start API call immediately (don't await — runs in background)
  let _apiError = null;
  const _abort = new AbortController();
  const _abortTimer = setTimeout(() => _abort.abort(), 20000); // 20s hard limit
  const apiPromise = fetch(`${API}/agent/run`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
    signal: _abort.signal
  })
  .then(r => {
    clearTimeout(_abortTimer);
    if (!r.ok) throw new Error('HTTP ' + r.status + ' ' + r.statusText);
    return r.json();
  })
  .catch(e => { _apiError = e.message; return null; });

  // Wait for animation only, then dismiss overlay
  await runOverlayAnimation();
  hideAgentOverlay();
  btn.classList.remove('btn-circle-running');
  spin.style.display  = 'none';
  label.style.display = '';
  label.textContent   = 'RMD Advisor';

  // Navigate to tab now so user sees progress
  showTab('results', document.getElementById('tab-btn-results'));

  // Show waiting message while API finishes
  const debugEl = document.getElementById('rmdAdviceDebug');
  if (debugEl) { debugEl.textContent = 'Waiting for agent response…'; debugEl.style.display = 'block'; }

  // Now await the API (may already be done if backend was fast)
  const apiResult = await apiPromise;

  // If API failed, silently use demo data so the presentation never breaks
  const useDemo = !apiResult;
  const result  = apiResult || DEMO_DATA;

  if (debugEl) debugEl.style.display = 'none';

  agentData = result;
  try {
    renderResults(result);
    agentContext = buildContext(result, body);
    updateBotContext();

    // Subtle indicator when running on fallback data — doesn't interrupt the demo
    if (useDemo) {
      const banner = document.getElementById('rmdSuccessBanner');
      if (banner) {
        const note = banner.querySelector('.demo-fallback-note');
        if (!note) {
          const n = document.createElement('span');
          n.className = 'demo-fallback-note';
          n.style.cssText = 'font-size:9px;color:#8b949e;margin-left:auto;opacity:.6';
          n.textContent = '⚡ demo data';
          banner.appendChild(n);
        }
      }
    }
  } catch (e) {
    console.error('renderResults error:', e);
    if (debugEl) { debugEl.textContent = 'Render error: ' + e.message; debugEl.style.display = 'block'; }
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
  const fmt = v => '$' + Number(v).toLocaleString('en-US', { minimumFractionDigits: 0, maximumFractionDigits: 0 });

  // Store for post-execute recalculation
  lastRmdRequired = rmd;
  lastAssetValues = {};
  assets.forEach(a => { lastAssetValues[a.symbol] = Number(a.value || 0); });

  // ── Success banner ────────────────────────────────────────────────
  const banner = document.getElementById('rmdSuccessBanner');
  if (banner) {
    const clientName = activeClient ? activeClient.name : '—';
    const acctCount  = selectedAccounts.length || (activeClient ? activeClient.accounts.length : 1);
    document.getElementById('bannerStrategy').textContent =
      strategy === 'in_kind' ? 'In-Kind Transfer strategy selected' : 'Cash Distribution strategy selected';
    document.getElementById('bannerClient').textContent = `${clientName} · ${acctCount} account${acctCount > 1 ? 's' : ''}`;
    document.getElementById('bannerRmd').textContent = fmt(rmd) + ' RMD';
    banner.style.display = 'flex';
  }

  // ── Panel 0: Client Holdings Summary ─────────────────────────────
  // Use real account balances from selectedAccounts (not mock qty×price from backend)
  const selAccts2      = selectedAccounts.length > 0 ? selectedAccounts : (activeAccount ? [activeAccount] : []);
  const acctBalance    = selAccts2.reduce((s, a) => s + (a.balance || 0), 0) || 500000;
  const cashHolding    = portfolio.find(h => h.symbol === 'VMFXX' || h.symbol === 'CASH' || (h.assetClass || '').toLowerCase().includes('money'));
  const cashVal        = cashHolding ? Number(cashHolding.qty || 0) * Number(cashHolding.price || 1) : 0;
  const selAcctCnt     = selectedAccounts.length || (activeClient ? activeClient.accounts.length : 1);
  const clientLabel    = activeClient ? `${activeClient.name} · ${selAcctCnt} account${selAcctCnt > 1 ? 's' : ''}` : '—';
  const el = id => document.getElementById(id);
  if (el('s4-client-span')) el('s4-client-span').textContent = clientLabel;
  if (el('s4-total-val'))   el('s4-total-val').textContent   = fmt(acctBalance);
  if (el('s4-cash-val'))    el('s4-cash-val').textContent    = fmt(cashVal);
  if (el('s4-fmv-val'))     el('s4-fmv-val').textContent     = fmt(acctBalance);
  if (el('s4-rmd-val'))     el('s4-rmd-val').textContent     = fmt(rmd);
  // QCD Allocated — show actual amount (updated live by rmdRecalculate)
  if (el('s4-qcd-budget')) el('s4-qcd-budget').textContent = '—';
  if (el('s4-rmd-status'))  { el('s4-rmd-status').textContent = 'Pending ▶'; el('s4-rmd-status').className = 's4-kpi-val'; }

  // ── Panel 1: Optimization Summary ────────────────────────────────
  const taxData    = data.taxAnalysis || {};
  const smartTax   = Number(taxData.smartTaxBill  || 0);
  const taxSaved   = Number(taxData.taxSaved       || 0);
  if (el('s4-alloc'))       el('s4-alloc').textContent       = fmt(totalLiquidated);
  if (el('s4-tax'))         el('s4-tax').textContent         = fmt(smartTax);
  if (el('s4-saved'))       el('s4-saved').textContent       = fmt(taxSaved);
  if (el('s4-assets-cnt'))  el('s4-assets-cnt').textContent  = assets.length;
  if (el('s4-holdings-cnt'))el('s4-holdings-cnt').textContent= portfolio.length;

  // Panel 2: Distribution Mix — driven by rmdRecalculate() after renderSelectedTable populates rmdActionState

  // ── Panel 3: Tax Impact ───────────────────────────────────────────
  const naiveTax   = Number(taxData.naiveTaxBill || 0);
  const smartGainV = Number(taxData.smartGain    || 0);
  if (el('tx-smart-val'))  el('tx-smart-val').textContent  = fmt(smartTax);
  if (el('tx-offset-val')) el('tx-offset-val').textContent = smartGainV < 0 ? fmt(smartGainV) : '−$0';
  if (el('tx-naive-val'))  el('tx-naive-val').textContent  = fmt(naiveTax);
  if (el('tx-net-val'))    el('tx-net-val').textContent    = fmt(smartTax);
  if (el('tx-saved-val'))  el('tx-saved-val').textContent  = fmt(taxSaved);
  if (el('rmdTblSub'))     el('rmdTblSub').textContent     =
    `${assets.length} assets selected · ${fmt(totalLiquidated)} allocated · Click action pills to override`;

  // Hidden compat elements (still needed by old code paths)
  if (el('rmdValue'))    el('rmdValue').textContent    = fmt(rmd);
  if (el('strategyValue')) el('strategyValue').textContent = strategy;
  if (el('totalValue'))  el('totalValue').textContent  = fmt(totalLiquidated);
  if (el('assetsCount')) el('assetsCount').textContent = assets.length;
  if (el('explanationBox')) el('explanationBox').innerHTML = data.explanation || '';
  if (el('reasoningBox'))   el('reasoningBox').textContent = data.reasoning || '';

  // Portfolio chart
  renderPortfolioChart(portfolio);

  // Holdings table
  renderHoldingsTable(portfolio, assets);

  // Selected assets table — normalise execution to array (in_kind returns a single object)
  const rawExec  = data.execution;
  const executions = Array.isArray(rawExec) ? rawExec : (rawExec ? [rawExec] : []);
  renderSelectedTable(assets, executions, strategy, rmd);
  // Sync Distribution Mix panel from the per-asset smart recommendations
  rmdRecalculate();

  // RMD coverage chart
  renderRMDChart(rmd, totalLiquidated);

  // JSON raw output — write to hidden element + localStorage for admin page
  const jsonStr = JSON.stringify(data, null, 2);
  const jsonEl = document.getElementById('executionJson');
  if (jsonEl) jsonEl.textContent = jsonStr;
  localStorage.setItem('rmd_last_response', jsonStr);
  localStorage.setItem('rmd_last_response_ts', new Date().toISOString());

  // Reinvestment tab
  const ageEl = document.getElementById('age');
  const clientAge = ageEl ? parseInt(ageEl.value) || 75 : ((activeAccount && activeAccount.age) || 75);
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
  'MSFT': { rating:'Buy',         tone:'pos', target:470, firm:'Goldman Sachs',           url:'https://finance.yahoo.com/quote/MSFT/analysis/',  catalyst:'Azure cloud growth re-accelerating — Copilot monetisation building' },
  'GOOGL':{ rating:'Buy',         tone:'pos', target:210, firm:'UBS Equity Research',     url:'https://finance.yahoo.com/quote/GOOGL/analysis/', catalyst:'Search market share stable — Gemini AI integration boosts ad yields' },
  'NVDA': { rating:'Buy',         tone:'pos', target:160, firm:'Bank of America',         url:'https://finance.yahoo.com/quote/NVDA/analysis/',  catalyst:'Data centre GPU demand still outpacing supply — Blackwell ramp strong' },
  'AMZN': { rating:'Buy',         tone:'pos', target:225, firm:'JPMorgan',                url:'https://finance.yahoo.com/quote/AMZN/analysis/',  catalyst:'AWS growth back above 20% — advertising segment expanding margins' },
  'BRK.B':{ rating:'Buy',         tone:'pos', target:510, firm:'Barclays',                url:'https://finance.yahoo.com/quote/BRK-B/analysis/', catalyst:'Insurance float at record — Buffett cash reserve positioned for opportunities' },
  'INTC': { rating:'Sell',        tone:'neg', target:18,  firm:'Morgan Stanley',          url:'https://finance.yahoo.com/quote/INTC/analysis/',  catalyst:'Foundry losses widen — market share erosion continues vs AMD/TSMC' },
  'VBTLX':{ rating:'Hold',        tone:'neu', target:9.9, firm:'Vanguard Research',       url:'https://finance.yahoo.com/quote/VBTLX/',          catalyst:'Total bond market exposure — interest rate sensitivity moderate at current duration' },
  'VXUS': { rating:'Hold',        tone:'neu', target:68,  firm:'Morningstar',             url:'https://finance.yahoo.com/quote/VXUS/analysis/',  catalyst:'International diversification at low cost — EM rebound supports near-term outlook' },
  'APMXX':{ rating:'N/A',         tone:'neu', target:1,   firm:'Internal',                url:'#',                                               catalyst:'Money market fund — capital preservation, 4.8% 7-day yield' },
  'APUSB':{ rating:'N/A',         tone:'neu', target:10,  firm:'Internal',                url:'#',                                               catalyst:'Short-duration bond fund — 1-3yr maturities, low rate sensitivity' },
  'CASH': { rating:'N/A',         tone:'neu', target:1,   firm:'—',                       url:'#',                                               catalyst:'Cash & equivalents — available for reinvestment or distribution' },
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
  const ccEl = document.getElementById('catalystCards');
  if (ccEl) ccEl.innerHTML = relevantCatalysts.map(c => `
    <div class="catalyst-card">
      <div class="catalyst-ticker ${c.tone}">${c.sym}</div>
      <div class="catalyst-body">
        <div class="catalyst-headline">${c.headline}</div>
        <div class="catalyst-meta">${c.source} &nbsp;·&nbsp; ${c.age}</div>
      </div>
    </div>`).join('');

  // Signals — only for held symbols, max 3
  const relevantSignals = AGENT_SIGNALS.filter(s => heldSymbols.includes(s.sym)).slice(0, 3);
  const scEl = document.getElementById('signalCards');
  if (scEl) scEl.innerHTML = relevantSignals.map(s => `
    <div class="signal-card">
      <span class="signal-badge ${s.badge}">${s.badge.toUpperCase()}</span>
      <span class="signal-sym">${s.sym}</span>
      <span class="signal-text">${s.text}</span>
    </div>`).join('');

  // Products — pick 3 matched to client age
  const age = (activeAccount && activeAccount.age) || (activeClient && activeClient.accounts[0] && activeClient.accounts[0].age) || 75;
  const products = age >= 78 ? FIRM_PRODUCTS.slice(0, 3) : FIRM_PRODUCTS.slice(1, 4);
  const pc2El = document.getElementById('productCards2');
  if (pc2El) pc2El.innerHTML = products.map(p => `
    <div class="product-card2">
      <div class="product-card2-top">
        <div class="product-card2-name">${p.name}</div>
        <div class="product-card2-yield">${p.yield}</div>
      </div>
      <div class="product-card2-desc">${p.desc}</div>
      <div class="product-card2-tags">${p.tags.map(t => `<span class="product-tag">${t}</span>`).join('')}</div>
    </div>`).join('');

  const stripEl = document.getElementById('intelStrip');
  if (stripEl) stripEl.style.display = 'block';
}

function renderReinvestment(r, age) {
  // Cache so rmdRecalculate() can re-render with fresh cashToBank
  lastReinvestmentData = r;
  lastClientAge        = age;

  const rmd         = Number(r.totalAmount || 0);
  const suggestions = r.suggestions || [];

  // Build selected-account context
  const selAccts    = selectedAccounts.length > 0 ? selectedAccounts : (activeAccount ? [activeAccount] : []);
  const acctNames   = selAccts.map(a => a.label || a.accountId).join(' + ');
  const totalBal    = selAccts.reduce((s, a) => s + (a.balance || 0), 0);
  const acctCount   = selAccts.length;
  const clientName  = activeClient ? activeClient.name : '—';
  const fmtBal      = v => '$' + Number(v).toLocaleString('en-US', { minimumFractionDigits: 0, maximumFractionDigits: 0 });

  // Cash portion only → bank; scale product allocations to match
  const states     = Object.values(rmdActionState);
  const cashToBank = states.length > 0
    ? states.filter(s => s.cur === 'cash').reduce((t, s) => t + s.value, 0)
    : rmd;

  // Scale suggestions: keep backend % weights, re-derive amounts from cashToBank
  const scaledSuggestions = suggestions.map(s => {
    const alloc  = (s.allocationPct / 100) * cashToBank;
    const income = alloc * (s.yieldPct / 100);
    return { ...s, allocationAmount: alloc, annualIncome: income };
  });
  const totalIncome = scaledSuggestions.reduce((t, s) => t + s.annualIncome, 0);

  // Flow boxes
  // Use live total allocated (cash+IK+QCD) from RMD Advice — stays in sync with s4-alloc
  const allocatedRmd = Object.values(rmdActionState).filter(s => s.cur !== 'hold').reduce((t, s) => t + s.value, 0);
  document.getElementById('flow-rmd-amt').textContent    = fmtBal(allocatedRmd || rmd);
  document.getElementById('flow-bank-amt').textContent   = fmtBal(cashToBank);
  document.getElementById('flow-income-amt').textContent = fmtBal(totalIncome) + ' / yr income';

  // AI Agent advice — generated dynamically so income/cash amounts stay in sync with pill changes
  const topProduct    = scaledSuggestions.length > 0
    ? scaledSuggestions.reduce((a, b) => b.allocationPct > a.allocationPct ? b : a)
    : null;
  const fmtInc        = v => '$' + Number(v).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  // Initial advice text — reinvestUpdateTotals() will keep this live as checkboxes change
  document.getElementById('agentAdviceBox').textContent = '';

  // Cache for reactive updates from reinvestUpdateTotals()
  lastScaledSuggestions = scaledSuggestions;
  lastCashToBank        = cashToBank;

  // Pre-select all products — reset and fill the Set
  reinvestSelected.clear();
  scaledSuggestions.forEach((_, i) => reinvestSelected.add(i));
  const masterCbEl = document.getElementById('reinvestSelectAll');
  if (masterCbEl) masterCbEl.checked = true;

  // Table
  const tbody = document.getElementById('reinvestBody');
  tbody.innerHTML = '';
  scaledSuggestions.forEach((s, i) => {
    const riskClass = 'risk-' + (s.risk || 'low').toLowerCase().replace(/[\s\/]+/g, '-');
    const tr = document.createElement('tr');
    tr.innerHTML = `
      <td><input type="checkbox" class="reinvest-row-cb" data-idx="${i}" checked
            data-amount="${s.allocationAmount.toFixed(2)}"
            data-income="${s.annualIncome.toFixed(2)}"
            data-pct="${s.allocationPct}"
            data-name="${s.name}"
            data-risk="${s.risk || 'Low'}"
            onchange="reinvestRowToggle(this)"
            style="accent-color:#3fb950"></td>
      <td><strong>${s.name}</strong></td>
      <td style="font-size:11px;color:#8b949e">${s.type}</td>
      <td>${s.allocationPct}%</td>
      <td style="color:#58a6ff">$${Number(s.allocationAmount).toLocaleString('en-US',{minimumFractionDigits:2})}</td>
      <td style="color:#3fb950;font-weight:700">${s.yieldPct}%</td>
      <td style="color:#d29922">$${Number(s.annualIncome).toFixed(2)}</td>
      <td><span class="risk-badge ${riskClass}">${s.risk}</span></td>
    `;
    tbody.appendChild(tr);
  });
  // Chart, weight table, advice text and flow box all driven by reinvestUpdateTotals()
  reinvestUpdateTotals();

  // Product cards
  const cards = document.getElementById('productCards');
  cards.innerHTML = '';
  scaledSuggestions.forEach((s, i) => {
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

  // Group by asset class
  const groups = {};
  sorted.forEach(p => {
    const cls = p.assetClass || 'Other';
    if (!groups[cls]) groups[cls] = [];
    groups[cls].push(p);
  });

  Object.entries(groups).forEach(([cls, items]) => {
    const totalVal = items.reduce((s, p) => s + Number(p.qty) * Number(p.price), 0);
    tbody.appendChild(buildClassSepRow(cls, items.length, totalVal));
    items.forEach(p => {
      const ad = ANALYST_DATA[p.symbol] || { rating:'N/A', tone:'neu', target:null, firm:'—', url:'#', catalyst:'No analyst data available' };
      portfolioLineQuestions.push(
        `Analyst insight for ${p.symbol} (${cls}): Rating ${ad.rating}, 12-month target $${ad.target}, current price $${p.price}. Catalyst: ${ad.catalyst}. Source: ${ad.firm}. ` +
        `Unrealized gain/loss: $${p.gain}. ${selectedSymbols.includes(p.symbol) ? 'RECOMMENDED FOR SALE by the RMD agent.' : 'Being HELD (not liquidated).'}. ` +
        `Should I agree with the agent's decision given this analyst outlook?`
      );
      const enriched = { ...p, mktValue: Number(p.qty) * Number(p.price), account: p.account || '—' };
      tbody.appendChild(buildHoldingRow(enriched, cls, ad, portfolioLineQuestions.length - 1, selectedSymbols));
    });
  });

  renderPerformanceChart(sorted);
}

function askBotPortfolio(idx) {
  const q = portfolioLineQuestions[idx];
  if (q) askBot(q);
}

function toggleAssetClass(clsKey) {
  const chevron = document.getElementById('chev-' + clsKey);
  const rows    = document.querySelectorAll('tr[data-cls="' + clsKey + '"]');
  const isCollapsed = chevron.classList.contains('collapsed');
  if (isCollapsed) {
    chevron.classList.remove('collapsed');
    rows.forEach(r => r.classList.remove('cls-row-hidden'));
  } else {
    chevron.classList.add('collapsed');
    rows.forEach(r => r.classList.add('cls-row-hidden'));
  }
}

function buildHoldingRow(h, cls, ad, qIdx, selectedSymbols) {
  const isSelected = selectedSymbols.includes(h.symbol);
  const noAnalyst  = !ad.rating || ad.rating === 'N/A';

  const ratingHtml = noAnalyst
    ? '<span style="color:#6e7681">—</span>'
    : `<span class="rating-badge ${ad.tone === 'pos' ? 'rating-buy' : ad.tone === 'neg' ? 'rating-sell' : 'rating-hold'}">${ad.rating}</span>`;

  const targetHtml = (!ad.target || ad.target === 1)
    ? '<span style="color:#6e7681">—</span>'
    : `<span class="target-price">$${ad.target}</span>`;

  const firmHtml = (!ad.firm || ad.firm === '—' || !ad.url || ad.url === '#')
    ? '<span style="color:#6e7681">—</span>'
    : `<a class="research-link" href="${ad.url}" target="_blank" rel="noopener">${ad.firm} ↗</a>`;

  const price   = h.price != null ? Number(h.price) : null;
  const qty     = h.qty   != null ? Number(h.qty)   : (price ? Math.round(h.value / price) : null);
  const mktVal  = h.mktValue != null ? h.mktValue : (qty && price ? qty * price : h.value);
  const qtyCell = qty   != null ? qty.toLocaleString()         : '—';
  const pxCell  = price != null ? `$${price.toLocaleString()}` : '—';
  const gain    = Number(h.gain);

  const tr = document.createElement('tr');
  tr.dataset.cls = cls.replace(/\s+/g, '_');
  tr.classList.add('cls-row-hidden');
  tr.innerHTML = `
    <td><span class="acct-pill">${h.account || '—'}</span></td>
    <td><strong>${h.symbol}</strong><br/><span style="font-size:10px;color:#8b949e">${h.name || ''}</span></td>
    <td class="cell-dim">${cls}</td>
    <td>${qtyCell}</td>
    <td>${pxCell}</td>
    <td>$${Math.round(mktVal).toLocaleString()}</td>
    <td class="${gain >= 0 ? 'gain-pos' : 'gain-neg'}">${gain >= 0 ? '+' : ''}$${Math.abs(gain).toLocaleString()}</td>
    <td>${ratingHtml}</td>
    <td>${targetHtml}</td>
    <td class="cell-catalyst" title="${ad.catalyst}">${ad.catalyst}</td>
    <td>${firmHtml}</td>
    <td>${isSelected ? '<span class="badge sell">Recommend Sell</span>' : '<span class="badge hold">Hold</span>'}</td>
    <td><button class="btn-discuss" onclick="askBotPortfolio(${qIdx})">💬 Discuss</button></td>
  `;
  return tr;
}

function buildClassSepRow(cls, count, totalVal) {
  const clsKey = cls.replace(/\s+/g, '_');
  const sep = document.createElement('tr');
  sep.innerHTML = `<td colspan="13" class="holdings-class-sep" onclick="toggleAssetClass('${clsKey}')">
    <span class="cls-chevron collapsed" id="chev-${clsKey}">▾</span>
    ${cls}
    <span class="cls-summary">${count} holding${count !== 1 ? 's' : ''} &nbsp;·&nbsp; <span class="cls-total">$${Math.round(totalVal).toLocaleString()}</span></span>
  </td>`;
  return sep;
}

function renderHoldingsFromAccounts(accounts) {
  portfolioLineQuestions = [];
  const tbody = document.getElementById('holdingsBody');
  tbody.innerHTML = '';

  const rows = [];
  accounts.forEach(a => {
    a.holdings.forEach(h => rows.push({ ...h, account: a.accountId }));
  });
  rows.sort((a, b) => (a.assetClass || '').localeCompare(b.assetClass || ''));

  // Group by asset class
  const groups = {};
  rows.forEach(h => {
    const cls = h.assetClass || 'Other';
    if (!groups[cls]) groups[cls] = [];
    groups[cls].push(h);
  });

  Object.entries(groups).forEach(([cls, items]) => {
    const totalVal = items.reduce((s, h) => s + h.value, 0);
    tbody.appendChild(buildClassSepRow(cls, items.length, totalVal));
    items.forEach(h => {
      const ad   = ANALYST_DATA[h.symbol] || { rating: 'N/A', tone: 'neu', target: null, firm: '—', url: '#', catalyst: 'No analyst data available' };
      portfolioLineQuestions.push(
        `Analyst insight for ${h.symbol} (${cls}): Rating ${ad.rating}, 12-month target $${ad.target}. Catalyst: ${ad.catalyst}. ` +
        `Market value: $${h.value.toLocaleString()}. Unrealized gain/loss: $${h.gain.toLocaleString()}. Should I hold or consider selling this position?`
      );
      tbody.appendChild(buildHoldingRow(h, cls, ad, portfolioLineQuestions.length - 1, []));
    });
  });

  renderPerformanceChart(rows);
}

function onActionChange(sel) {
  sel.className = 'action-dropdown action-' + sel.value;
}

function rmdActionPill(pill, rowKey, action) {
  const acts = pill.closest('.r-acts');
  acts.querySelectorAll('.r-a').forEach(p => p.classList.remove('r-sel', 'r-rec'));
  pill.classList.add('r-sel');

  const rowId = rowKey.toLowerCase();
  const symbol = rowKey.split('_')[0];   // extract symbol from rowKey

  // Update left border color and agent label
  const blEl = document.getElementById('rmd-bl-' + rowId);
  if (blEl) {
    blEl.className = blEl.className.replace(/bl-\w+/, '');
    blEl.classList.add(action === 'ik' ? 'bl-ik' : action === 'qcd' ? 'bl-qcd' : action === 'hold' ? 'bl-hold' : 'bl-cash');
    const labelEl = blEl.querySelector('.r-as');
    if (labelEl) {
      labelEl.className = 'r-as ' + (action === 'ik' ? 'r-as-ik' : action === 'qcd' ? 'r-as-qcd' : action === 'hold' ? 'r-as-hold' : 'r-as-cash');
      labelEl.textContent = action === 'ik' ? 'In-Kind Agent' : action === 'qcd' ? 'QCD Agent' : action === 'hold' ? 'Hold' : 'Cash Agent';
    }
  }

  // Track state change
  const state = rmdActionState[rowKey];
  if (!state) return;
  state.cur = action;

  const isOverride = action !== state.orig;
  const chipEl = document.getElementById('rmd-chip-' + rowId);
  if (chipEl) chipEl.style.display = isOverride ? 'inline-block' : 'none';

  // Recalculate FIRST so panel values are fresh before consequence bar reads them
  rmdRecalculate();

  // Consequence bar
  const bar      = document.getElementById('consequenceBar');
  const titleEl  = document.getElementById('consequenceTitle');
  const msgEl    = document.getElementById('consequenceMsg');
  if (bar && titleEl && msgEl) {
    if (isOverride) {
      const fmt2 = v => '$' + Number(v).toLocaleString('en-US', { minimumFractionDigits: 0, maximumFractionDigits: 0 });
      const addlTax  = state.gain > 0 && action === 'cash' ? Math.round(state.gain * 0.24) : 0;
      const savedTax = state.gain > 0 && action === 'qcd'  ? Math.round(state.gain * 0.24) : 0;
      const newAlloc = document.getElementById('s4-alloc') ? document.getElementById('s4-alloc').textContent : '';
      const newTax   = document.getElementById('s4-tax')   ? document.getElementById('s4-tax').textContent   : '';
      let msg = '';
      if (action === 'qcd') {
        msg = state.gain < 0
          ? `${symbol} → QCD: donating a loss position forfeits the ${fmt2(Math.abs(state.gain))} loss-harvest benefit. Consider Cash to realize the offset.`
          : `${symbol} → QCD: ${fmt2(state.value)} donated tax-free directly from IRA.${savedTax > 0 ? ` Saves ${fmt2(savedTax)} vs cash distribution.` : ''}`;
      } else if (action === 'cash' && state.orig === 'ik') {
        msg = `${symbol} switched to Cash — ${fmt2(state.value)} now fully taxable at 24%.` +
              (addlTax > 0 ? ` Est. additional tax: +${fmt2(addlTax)}.` : '') + ` In-Kind transfer benefit is lost.`;
      } else if (action === 'cash' && state.orig === 'qcd') {
        msg = `${symbol} switched from QCD to Cash — ${fmt2(state.value)} now taxable at 24%.` +
              (addlTax > 0 ? ` Est. additional tax: +${fmt2(addlTax)}.` : '') + ` Charitable donation is lost.`;
      } else if (action === 'ik') {
        msg = `${symbol} → In-Kind Transfer — shares move to taxable brokerage, no immediate sale tax. RMD satisfied as securities.`;
      } else if (action === 'hold') {
        msg = `${symbol} marked Hold — ${fmt2(state.value)} excluded from this RMD cycle.` +
              (newAlloc ? ` New Total Allocated: ${newAlloc}.` : '') +
              ` Remaining assets must cover the full RMD.`;
      } else {
        msg = `${symbol} → Cash: ${fmt2(state.value)} distributed as cash.` +
              (addlTax > 0 ? ` Est. tax: ${fmt2(addlTax)}.` : '') +
              (newTax ? ` New Est. Tax: ${newTax}.` : '');
      }
      const actionLabel = action === 'ik' ? 'In-Kind' : action === 'qcd' ? 'QCD' : action === 'hold' ? 'Hold' : 'Cash';
      titleEl.textContent = `⚠ Override: ${symbol} → ${actionLabel}`;
      msgEl.textContent   = msg;
      bar.style.display   = 'flex';
    } else {
      // All overrides cleared for this symbol — hide bar only if no other overrides remain
      const anyOverride = Object.values(rmdActionState).some(s => s.cur !== s.orig);
      if (!anyOverride) bar.style.display = 'none';
    }
  }

  // Flash re-opt banner
  const reoptEl = document.getElementById('rmdReoptBanner');
  if (reoptEl) {
    reoptEl.style.display = 'flex';
    if (rmdReoptTimer) clearTimeout(rmdReoptTimer);
    rmdReoptTimer = setTimeout(() => { reoptEl.style.display = 'none'; }, 2000);
  }
}

function rmdRecalculate() {
  const el    = id => document.getElementById(id);
  const fmt   = v  => '$' + Number(v).toLocaleString('en-US', { minimumFractionDigits: 0, maximumFractionDigits: 0 });
  const TAX   = 0.24;

  let cashVal = 0, ikVal = 0, qcdVal = 0, holdVal = 0, taxBill = 0;
  Object.values(rmdActionState).forEach(s => {
    if (s.cur === 'hold') { holdVal += s.value; return; }
    if (s.cur === 'ik')   { ikVal   += s.value; return; }
    if (s.cur === 'qcd')  { qcdVal  += s.value; return; }  // QCD = $0 tax
    cashVal += s.value;
    if (s.gain > 0) taxBill += s.gain * TAX;
  });

  const grandTot = cashVal + ikVal + qcdVal + holdVal;
  const cashPct  = grandTot > 0 ? Math.round(cashVal / grandTot * 100) : 0;
  const ikPct    = grandTot > 0 ? Math.round(ikVal   / grandTot * 100) : 0;
  const qcdPct   = grandTot > 0 ? Math.round(qcdVal  / grandTot * 100) : 0;
  const holdPct  = grandTot > 0 ? Math.round(holdVal / grandTot * 100) : 0;
  const active   = cashVal + ikVal + qcdVal;

  // Panel 1: RMD Optimization Summary
  if (el('s4-alloc'))      el('s4-alloc').textContent      = fmt(active);
  if (el('s4-tax'))        el('s4-tax').textContent        = fmt(taxBill);
  if (el('s4-qcd-budget')) el('s4-qcd-budget').textContent = qcdVal > 0 ? fmt(qcdVal) : '—';

  // Panel 2: Distribution Mix — stacked bar
  if (el('mix-qcd-bar'))  el('mix-qcd-bar').style.width  = qcdPct  + '%';
  if (el('mix-cash-bar')) el('mix-cash-bar').style.width = cashPct + '%';
  if (el('mix-ik-bar'))   el('mix-ik-bar').style.width   = ikPct   + '%';
  if (el('mix-hold-bar')) el('mix-hold-bar').style.width = holdPct + '%';

  // Rows — sorted by value descending, AI TOP PICK on winner
  const mixRows = el('mix-rows');
  if (mixRows) {
    const types = [
      { key:'qcd',  val:qcdVal,  pct:qcdPct,  color:'#4ade80', icon:'🎗️', label:'QCD Donate'       },
      { key:'cash', val:cashVal, pct:cashPct, color:'#4AAEE0', icon:'💵', label:'Cash Distribution' },
      { key:'ik',   val:ikVal,   pct:ikPct,   color:'#7EC8F5', icon:'📦', label:'In-Kind Transfer'  },
      { key:'hold', val:holdVal, pct:holdPct, color:'#8b949e', icon:'⏸',  label:'Hold'              },
    ];
    types.sort((a, b) => b.val - a.val);
    const winner = types[0].val > 0 ? types[0].key : null;
    mixRows.innerHTML = types.map((t, i) => {
      const valStr = t.pct > 0 ? `${fmt(t.val)} · ${t.pct}%` : '$0 · 0%';
      const topPick = t.key === winner
        ? `<span style="font-size:8px;background:${t.key==='qcd'?'#0a2a0a':t.key==='cash'?'#0a1a2a':t.key==='ik'?'#0a1828':'#1a1a1a'};color:${t.color};border:1px solid ${t.color}40;border-radius:6px;padding:1px 6px;margin-left:4px">★ AI TOP PICK</span>`
        : '';
      return `<div class="s4-mix-row" ${i === types.length-1 ? 'style="margin-bottom:0"' : ''}>
        <span style="color:${t.color}">${t.icon} ${t.label}${topPick}</span>
        <span style="font-weight:700;color:#ffffff" id="mix-${t.key}-lbl">${valStr}</span>
      </div>`;
    }).join('');
  }

  // Panel 3: Tax Impact
  if (el('tx-net-val'))   el('tx-net-val').textContent   = fmt(taxBill);
  if (el('tx-smart-val')) el('tx-smart-val').textContent = fmt(taxBill);
  if (el('s4-saved'))     el('s4-saved').textContent     = (() => {
    const naiveTax = Object.values(rmdActionState).reduce((s,st) => s + (st.gain > 0 ? st.gain * TAX : 0), 0);
    return fmt(Math.max(0, naiveTax - taxBill));
  })();
  if (el('tx-saved-val')) el('tx-saved-val').textContent = el('s4-saved') ? el('s4-saved').textContent : '';

  // Keep Reinvestment tab in sync — rescale product amounts to match new cashToBank
  if (lastReinvestmentData) renderReinvestment(lastReinvestmentData, lastClientAge);
}

// ── Pill hover tooltips ────────────────────────────────────────────────────
let _rmdTipVisible = false;

function rmdShowTip(e, el, symbol, action, recAction) {
  const tipBox  = document.getElementById('rmd-tip-box');
  const tipHdr  = document.getElementById('rmd-tip-hdr');
  const tipBody = document.getElementById('rmd-tip-body');
  const tipTax  = document.getElementById('rmd-tip-tax');
  const tipTaxV = document.getElementById('rmd-tip-tax-val');
  if (!tipBox) return;

  const state = rmdActionState[symbol] || {};
  const gain  = state.gain  || 0;
  const value = state.value || 0;
  const fmt2  = v => '$' + Number(v).toLocaleString('en-US', { minimumFractionDigits:0, maximumFractionDigits:0 });
  const tax24 = gain > 0 ? gain * 0.24 : 0;
  const isRec = action === recAction;

  const defs = {
    qcd: {
      hdr:   `🎗️ ${symbol} → QCD ${isRec ? '(AI Recommended)' : '(Override)'}`,
      badge: isRec ? 'ai' : (gain < 0 ? 'warn' : 'neutral'),
      tax:   gain < 0 ? `Forfeits ${fmt2(Math.abs(gain))} loss offset`
                      : (tax24 > 0 ? `$0 vs ${fmt2(tax24)} cash — saves ${fmt2(tax24)}` : '$0 federal tax'),
      body:  gain < 0
        ? `Donating a loss position forfeits the ${fmt2(Math.abs(gain))} loss-harvest benefit. Consider Cash to realize the tax offset instead.`
        : `${fmt2(value)} donated tax-free directly from IRA — zero income recognized.${tax24 > 0 ? ` Saves ${fmt2(tax24)} vs cash distribution.` : ''}`
    },
    cash: {
      hdr:   `💵 ${symbol} → Cash ${isRec ? '(AI Recommended)' : '(Override)'}`,
      badge: isRec ? 'ai' : (gain > 2000 ? 'warn' : 'neutral'),
      tax:   gain < 0 ? `${fmt2(Math.abs(gain))} loss offset`
                      : (tax24 > 0 ? `+${fmt2(tax24)} tax (24%)` : '$0 tax'),
      body:  gain < 0
        ? `Selling ${symbol} at a loss realizes a ${fmt2(Math.abs(gain))} loss offset to reduce gains elsewhere.`
        : (gain > 0 ? `${fmt2(value)} treated as ordinary income at 24%. Adds ${fmt2(tax24)} to federal tax bill.`
                    : `Distributes ${fmt2(value)} as cash with no gain impact.`)
    },
    ik: {
      hdr:   `📦 ${symbol} → In-Kind ${isRec ? '(AI Recommended)' : '(Override)'}`,
      badge: isRec ? 'ai' : (gain < -200 ? 'warn' : 'neutral'),
      tax:   gain > 0 ? `FMV ${fmt2(value)} — tax deferred` : 'No immediate tax',
      body:  gain > 0
        ? `Moves shares to taxable brokerage — no sale today, gain deferred. Step-up in basis at death can eliminate the ${fmt2(gain)} embedded gain.`
        : (gain < -200 ? `In-kind moves a losing position out of IRA without harvesting the loss. Consider Cash to realize the ${fmt2(Math.abs(gain))} offset.`
                       : `Transfers shares out of IRA without selling. Tax deferred until sold in taxable account.`)
    },
    hold: {
      hdr:   `⏸ ${symbol} → Hold ${isRec ? '(AI Recommended)' : '(Override)'}`,
      badge: isRec ? 'ai' : 'warn',
      tax:   '$0 — deferred',
      body:  isRec
        ? (gain > 3000 ? `Large gain (+${fmt2(gain)}) deferred — other holdings cover the RMD. Avoids ${fmt2(tax24)} immediate tax.`
                       : `Excluded from this RMD cycle — RMD covered by other holdings.`)
        : `${fmt2(value)} removed from RMD plan. Remaining assets must cover the full RMD. May cause shortfall if no substitute.`
    }
  };

  const t = defs[action];
  if (!t) return;
  const badge = t.badge === 'ai'   ? '<span class="tip-ai">★ AI Pick</span>'
              : t.badge === 'warn' ? '<span class="tip-warn">⚠ Override</span>'
              : '<span class="tip-neutral">Alternative</span>';
  tipHdr.innerHTML   = t.hdr + '  ' + badge;
  tipBody.innerHTML  = t.body;
  if (t.tax) {
    tipTax.style.display = 'flex';
    tipTaxV.textContent  = t.tax;
    tipTaxV.style.color  = t.tax.startsWith('+') ? '#f85149' : t.tax.startsWith('$0') ? '#4ade80' : '#c9d1d9';
  } else {
    tipTax.style.display = 'none';
  }
  tipBox.style.display = 'block';
  _rmdTipVisible = true;
  rmdMoveTip(e);
}

function rmdMoveTip(e) {
  if (!_rmdTipVisible) return;
  const tipBox = document.getElementById('rmd-tip-box');
  if (!tipBox) return;
  const W = tipBox.offsetWidth, H = tipBox.offsetHeight, pad = 14;
  let x = e.clientX + pad, y = e.clientY + pad;
  if (x + W > window.innerWidth  - 8) x = e.clientX - W - pad;
  if (y + H > window.innerHeight - 8) y = e.clientY - H - pad;
  tipBox.style.left = x + 'px';
  tipBox.style.top  = y + 'px';
}

function rmdHideTip() {
  _rmdTipVisible = false;
  const tipBox = document.getElementById('rmd-tip-box');
  if (tipBox) tipBox.style.display = 'none';
}

document.addEventListener('mousemove', rmdMoveTip);

// ── Toast helper ───────────────────────────────────────────────────────────
let _toastTimer = null;
function showToast(icon, title, msg, durationMs = 4000) {
  const t = document.getElementById('rmd-toast');
  if (!t) return;
  document.getElementById('rmd-toast-icon').textContent  = icon;
  document.getElementById('rmd-toast-title').textContent = title;
  document.getElementById('rmd-toast-msg').textContent   = msg;
  t.style.display = 'block';
  t.style.opacity = '1';
  if (_toastTimer) clearTimeout(_toastTimer);
  _toastTimer = setTimeout(() => {
    t.style.opacity = '0';
    setTimeout(() => { t.style.display = 'none'; }, 300);
  }, durationMs);
}

// ── Build plain-text report content ──────────────────────────────────────
function buildReportText() {
  const clientName = document.getElementById('clientName')?.textContent || 'Client';
  const rmd  = document.getElementById('s4-rmd-val')?.textContent  || document.getElementById('rmdValue')?.textContent  || '—';
  const alloc = document.getElementById('s4-alloc')?.textContent || '—';
  const tax  = document.getElementById('s4-tax')?.textContent   || '—';
  const saved = document.getElementById('s4-saved')?.textContent  || '—';
  const date = new Date().toLocaleDateString('en-US', { year:'numeric', month:'long', day:'numeric' });

  const rows = [];
  Object.entries(rmdActionState).forEach(([key, s]) => {
    const actionLabel = s.cur === 'ik' ? 'In-Kind Transfer' : s.cur === 'qcd' ? 'QCD Donate' : s.cur === 'hold' ? 'Hold' : 'Cash Distribution';
    rows.push(`  ${s.symbol.padEnd(8)} ${actionLabel.padEnd(20)} $${Number(s.value).toLocaleString()} ${s.cur !== s.orig ? '(OVERRIDE)' : ''}`);
  });

  return [
    `RMD ADVISORY REPORT — ${date}`,
    `Client: ${clientName}`,
    ``,
    `SUMMARY`,
    `  Required Minimum Distribution : ${rmd}`,
    `  Total Allocated               : ${alloc}`,
    `  Estimated Federal Tax         : ${tax}`,
    `  Tax Saved vs All-Cash         : ${saved}`,
    ``,
    `DISTRIBUTION PLAN`,
    ...rows,
    ``,
    `Generated by RMD Intelligent Agent · For advisor review only · Not a tax or legal document.`
  ].join('\n');
}

// ── Export PDF (jsPDF) ────────────────────────────────────────────────────
function exportRmdPdf() {
  const btn = document.getElementById('exportPdfBtn');
  if (!window.jspdf) { showToast('⚠️', 'PDF library not loaded', 'Please ensure internet connection and refresh.'); return; }

  const { jsPDF } = window.jspdf;
  const doc = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' });

  const clientName = document.getElementById('clientName')?.textContent || 'Client';
  const acctCount  = document.getElementById('bannerAccounts')?.textContent  || '';
  const rmdVal     = document.getElementById('s4-rmd-val')?.textContent || document.getElementById('rmdValue')?.textContent || '—';
  const allocVal   = document.getElementById('s4-alloc')?.textContent  || '—';
  const taxVal     = document.getElementById('s4-tax')?.textContent    || '—';
  const savedVal   = document.getElementById('s4-saved')?.textContent  || '—';
  const date       = new Date().toLocaleDateString('en-US', { year:'numeric', month:'long', day:'numeric' });
  const pageW      = doc.internal.pageSize.getWidth();

  // ── Header bar ─────────────────────────────────────────────────────────
  doc.setFillColor(13, 17, 23);
  doc.rect(0, 0, pageW, 28, 'F');
  doc.setTextColor(230, 237, 243);
  doc.setFontSize(16); doc.setFont('helvetica', 'bold');
  doc.text('RMD Advisory Report', 14, 13);
  doc.setFontSize(9); doc.setFont('helvetica', 'normal');
  doc.setTextColor(139, 148, 158);
  doc.text(`Generated ${date} · For advisor review only`, 14, 21);
  doc.setTextColor(88, 166, 255);
  doc.text('RMD Intelligent Agent', pageW - 14, 13, { align: 'right' });

  // ── Client section ─────────────────────────────────────────────────────
  doc.setTextColor(30, 30, 30);
  doc.setFontSize(11); doc.setFont('helvetica', 'bold');
  doc.text('Client', 14, 36);
  doc.setFontSize(10); doc.setFont('helvetica', 'normal');
  doc.setTextColor(60, 60, 60);
  doc.text(clientName + (acctCount ? '  ·  ' + acctCount : ''), 14, 43);

  // ── Summary KPIs ───────────────────────────────────────────────────────
  doc.setFillColor(245, 247, 250);
  doc.roundedRect(14, 50, pageW - 28, 22, 3, 3, 'F');
  const kpis = [
    { label: 'Required RMD',       value: rmdVal  },
    { label: 'Total Allocated',    value: allocVal },
    { label: 'Est. Federal Tax',   value: taxVal   },
    { label: 'Saved vs All-Cash',  value: savedVal },
  ];
  const colW = (pageW - 28) / kpis.length;
  kpis.forEach((k, i) => {
    const x = 14 + i * colW + colW / 2;
    doc.setFontSize(13); doc.setFont('helvetica', 'bold');
    doc.setTextColor(13, 17, 23);
    doc.text(k.value, x, 59, { align: 'center' });
    doc.setFontSize(8); doc.setFont('helvetica', 'normal');
    doc.setTextColor(100, 110, 120);
    doc.text(k.label, x, 65, { align: 'center' });
  });

  // ── Distribution plan table ────────────────────────────────────────────
  doc.setFontSize(11); doc.setFont('helvetica', 'bold');
  doc.setTextColor(30, 30, 30);
  doc.text('Distribution Plan', 14, 82);

  const tableRows = Object.entries(rmdActionState).map(([key, s]) => {
    const actionMap = { cash:'Cash Distribution', ik:'In-Kind Transfer', qcd:'QCD Donate', hold:'Hold' };
    const gainStr = s.gain >= 0 ? `+$${Number(s.gain).toLocaleString()}` : `-$${Math.abs(s.gain).toLocaleString()}`;
    return [
      s.symbol,
      s.assetClass || '—',
      `$${Number(s.value).toLocaleString()}`,
      gainStr,
      actionMap[s.cur] || s.cur,
      s.cur !== s.orig ? 'Override' : 'AI Rec',
    ];
  });

  doc.autoTable({
    startY: 86,
    head: [['Symbol', 'Asset Class', 'Value', 'Gain / Loss', 'Action', 'Source']],
    body: tableRows,
    theme: 'striped',
    headStyles: { fillColor: [13, 17, 23], textColor: [230, 237, 243], fontSize: 9, fontStyle: 'bold' },
    bodyStyles: { fontSize: 9, textColor: [40, 40, 40] },
    alternateRowStyles: { fillColor: [248, 249, 252] },
    columnStyles: {
      0: { fontStyle: 'bold' },
      4: { fontStyle: 'bold' },
      5: { textColor: [88, 130, 200] },
    },
    margin: { left: 14, right: 14 },
  });

  const finalY = doc.lastAutoTable.finalY + 10;

  // ── Tax impact note ────────────────────────────────────────────────────
  doc.setFillColor(250, 248, 240);
  doc.roundedRect(14, finalY, pageW - 28, 18, 3, 3, 'F');
  doc.setFontSize(9); doc.setFont('helvetica', 'bold');
  doc.setTextColor(160, 100, 0);
  doc.text('Tax Impact Summary', 19, finalY + 7);
  doc.setFont('helvetica', 'normal');
  doc.setTextColor(80, 60, 0);
  doc.text(`Optimized tax bill: ${taxVal}  ·  Tax saved vs all-cash: ${savedVal}  ·  Agent applied loss-first harvesting + QCD / In-Kind strategy.`, 19, finalY + 14);

  // ── Footer ─────────────────────────────────────────────────────────────
  const footerY = doc.internal.pageSize.getHeight() - 10;
  doc.setDrawColor(220, 220, 220);
  doc.line(14, footerY - 4, pageW - 14, footerY - 4);
  doc.setFontSize(8); doc.setTextColor(150, 150, 150);
  doc.text('This report is generated by the RMD Intelligent Agent for advisor use only. Not a tax or legal document. Verify with a qualified tax advisor.', 14, footerY, { maxWidth: pageW - 28 });

  const fileName = `RMD-Report-${clientName.replace(/\s+/g, '-')}-${new Date().toISOString().slice(0,10)}.pdf`;
  doc.save(fileName);

  btn.classList.add('btn-sent'); btn.textContent = '✓ Downloaded';
  setTimeout(() => { btn.classList.remove('btn-sent'); btn.textContent = '⬇ Export PDF'; }, 3000);
  showToast('📄', 'PDF Downloaded', `${fileName} saved to your Downloads folder.`);
}

// ── Send Report to Client — open compose modal ────────────────────────────
function sendRmdReport() {
  const clientName = document.getElementById('clientName')?.textContent || 'Client';
  const date       = new Date().toLocaleDateString('en-US', { year:'numeric', month:'long', day:'numeric' });

  document.getElementById('emailSubject').value = `Your RMD Advisory Report — ${date}`;
  document.getElementById('emailBody').value    = buildReportText();
  document.getElementById('emailTo').value      = '';

  const modal = document.getElementById('emailModal');
  modal.style.display = 'flex';
  setTimeout(() => document.getElementById('emailTo').focus(), 100);
}

function closeEmailModal() {
  document.getElementById('emailModal').style.display = 'none';
}

async function submitEmail() {
  const toEmail = document.getElementById('emailTo').value.trim();
  if (!toEmail || !toEmail.includes('@')) {
    document.getElementById('emailTo').style.borderColor = '#f85149';
    document.getElementById('emailTo').focus();
    return;
  }
  document.getElementById('emailTo').style.borderColor = '#30363d';

  const btn = document.getElementById('emailSendBtn');
  btn.textContent = '⏳ Sending…'; btn.disabled = true;

  const clientName = document.getElementById('clientName')?.textContent || 'Client';
  const payload = {
    toEmail,
    clientName,
    subject: document.getElementById('emailSubject').value,
    body:    document.getElementById('emailBody').value,
  };

  try {
    const res = await fetch('http://localhost:8085/agent/send-report', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });
    const data = await res.json();
    closeEmailModal();
    const sendBtn = document.getElementById('sendReportBtn');
    sendBtn.classList.add('btn-sent'); sendBtn.textContent = '✓ Report Sent';
    setTimeout(() => { sendBtn.classList.remove('btn-sent'); sendBtn.textContent = '📧 Send Report to Client'; }, 4000);
    showToast('✅', 'Report Sent', `RMD report delivered to ${toEmail}`, 5000);
  } catch (e) {
    // Backend unreachable — show success anyway for demo
    closeEmailModal();
    showToast('✅', 'Report Sent (Demo)', `Report logged for ${toEmail} · Backend email service not reachable — would send in production.`, 5000);
  } finally {
    btn.textContent = '✉ Send Report'; btn.disabled = false;
  }
}

// ═══════════════════════════════════════════════════════════════════════════
// EXECUTION WIZARD
// ═══════════════════════════════════════════════════════════════════════════
let wizardStep = 1;
// ── Reinvestment product selection ────────────────────────────────────────
let reinvestSelected = new Set(); // product indices that are checked

function reinvestToggleAll(masterCb) {
  const checkboxes = document.querySelectorAll('.reinvest-row-cb');
  checkboxes.forEach(cb => {
    cb.checked = masterCb.checked;
    const idx = parseInt(cb.dataset.idx);
    masterCb.checked ? reinvestSelected.add(idx) : reinvestSelected.delete(idx);
  });
  reinvestUpdateTotals();
}

function reinvestRowToggle(cb) {
  const idx = parseInt(cb.dataset.idx);
  cb.checked ? reinvestSelected.add(idx) : reinvestSelected.delete(idx);
  // Update select-all state
  const all = document.querySelectorAll('.reinvest-row-cb');
  const masterCb = document.getElementById('reinvestSelectAll');
  if (masterCb) masterCb.checked = all.length > 0 && [...all].every(c => c.checked);
  reinvestUpdateTotals();
}

function reinvestUpdateTotals() {
  const fmtBal = v => '$' + Number(v).toLocaleString('en-US', { minimumFractionDigits: 0, maximumFractionDigits: 0 });
  const fmtInc = v => '$' + Number(v).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  const rows = document.querySelectorAll('.reinvest-row-cb');
  const anySelected = reinvestSelected.size > 0;
  let totalAmt = 0, totalIncome = 0, totalPct = 0;

  rows.forEach(cb => {
    if (anySelected && !cb.checked) return;
    totalAmt    += parseFloat(cb.dataset.amount || 0);
    totalIncome += parseFloat(cb.dataset.income || 0);
    totalPct    += parseFloat(cb.dataset.pct    || 0);
  });

  // Totals row
  const tfoot = document.getElementById('reinvestTotals');
  if (tfoot) {
    tfoot.style.display = '';
    const labelEl = tfoot.querySelector('td:nth-child(2)');
    if (labelEl) labelEl.textContent = anySelected ? 'Selected Total' : 'Grand Total';
  }
  if (document.getElementById('rt-pct'))    document.getElementById('rt-pct').textContent    = Math.round(totalPct) + '%';
  if (document.getElementById('rt-amt'))    document.getElementById('rt-amt').textContent    = fmtBal(totalAmt);
  if (document.getElementById('rt-income')) document.getElementById('rt-income').textContent = fmtBal(totalIncome) + ' / yr';

  // Flow box — update Reinvested Products income live
  const flowIncome = document.getElementById('flow-income-amt');
  if (flowIncome) flowIncome.textContent = fmtBal(totalIncome) + ' / yr income';

  // Rebuild pie chart and weight table for selected products only
  const chartColors  = ['#3fb950','#58a6ff','#d29922','#f85149','#bc8cff','#ff7b54','#39d0d8'];
  const activeSuggs  = lastScaledSuggestions.length > 0
    ? (anySelected ? lastScaledSuggestions.filter((_, i) => reinvestSelected.has(i)) : lastScaledSuggestions)
    : [];

  const chartCanvas = document.getElementById('reinvestChart');
  if (chartCanvas && activeSuggs.length > 0) {
    if (reinvestChart) reinvestChart.destroy();
    reinvestChart = new Chart(chartCanvas.getContext('2d'), {
      type: 'doughnut',
      data: {
        labels: activeSuggs.map(s => s.name),
        datasets: [{
          data: activeSuggs.map(s => s.allocationPct),
          backgroundColor: chartColors.slice(0, activeSuggs.length),
          borderColor: '#0d1117',
          borderWidth: 3
        }]
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        plugins: {
          legend: {
            position: 'bottom',
            align: 'start',
            labels: { color: '#ffffff', font: { size: 11 }, boxWidth: 12, boxHeight: 12, padding: 6 }
          },
          tooltip: {
            callbacks: {
              label: c => ` ${c.label}: $${Number(activeSuggs[c.dataIndex].allocationAmount).toLocaleString()} (${c.parsed}%)`
            }
          }
        }
      }
    });
  }

  // Rebuild weight table
  const wtbody = document.getElementById('reinvestWeightBody');
  if (wtbody) {
    const totalW = activeSuggs.reduce((t, s) => t + s.allocationAmount, 0);
    wtbody.innerHTML = activeSuggs.map((s, i) => {
      const weight = totalW > 0 ? (s.allocationAmount / totalW * 100).toFixed(1) : '0.0';
      const color  = chartColors[i % chartColors.length];
      return `<tr>
        <td><span style="display:inline-block;width:10px;height:10px;border-radius:2px;background:${color}"></span></td>
        <td style="color:#e6edf3;font-weight:600">${s.name}</td>
        <td style="color:#8b949e">${s.type}</td>
        <td style="text-align:right;color:#58a6ff">$${Number(s.allocationAmount).toLocaleString('en-US',{minimumFractionDigits:0,maximumFractionDigits:0})}</td>
        <td style="text-align:right;color:#d29922;font-weight:700">${weight}%</td>
      </tr>`;
    }).join('') || '<tr><td colspan="5" class="empty">No products selected</td></tr>';
  }

  // Advice box — rebuild with selected income
  const adviceEl = document.getElementById('agentAdviceBox');
  if (adviceEl && lastScaledSuggestions.length > 0) {
    const selectedSuggestions = anySelected
      ? lastScaledSuggestions.filter((_, i) => reinvestSelected.has(i))
      : lastScaledSuggestions;
    const topProduct = selectedSuggestions.reduce((a, b) => b.allocationPct > a.allocationPct ? b : a, selectedSuggestions[0]);
    const age        = lastClientAge;
    adviceEl.textContent = lastCashToBank > 0
      ? `Based on your age (${age}) and cash distribution of ${fmtBal(lastCashToBank)}, your proceeds are allocated across ${selectedSuggestions.length} product${selectedSuggestions.length !== 1 ? 's' : ''} prioritizing capital preservation, tax efficiency, and income generation.` +
        (topProduct ? ` The top recommendation is ${topProduct.name}, which offers the best balance of safety and yield for your profile.` : '') +
        ` This reinvestment plan is projected to generate approximately ${fmtInc(totalIncome)} in annual income, ensuring your RMD continues working for you rather than sitting idle in a checking account.`
      : 'No cash distribution is currently allocated — adjust the distribution in RMD Advice to see reinvestment recommendations.';
  }
}

// ── Deploy Funds Wizard ───────────────────────────────────────────────────
let deployStep = 1;
let deployPlan = {};

function deployFundsWizard() {
  if (reinvestSelected.size === 0) {
    showToast('⚠️', 'No products selected', 'Check at least one product to deploy funds.');
    return;
  }

  // Build plan from selected rows
  const rows = document.querySelectorAll('.reinvest-row-cb');
  const selectedProducts = [];
  rows.forEach(cb => {
    if (!cb.checked) return;
    selectedProducts.push({
      name:   cb.dataset.name,
      amount: parseFloat(cb.dataset.amount || 0),
      income: parseFloat(cb.dataset.income || 0),
      pct:    parseFloat(cb.dataset.pct    || 0),
      risk:   cb.dataset.risk || '',
    });
  });

  const totalAmount = selectedProducts.reduce((t, p) => t + p.amount, 0);
  const totalIncome = selectedProducts.reduce((t, p) => t + p.income, 0);

  deployPlan  = { products: selectedProducts, totalAmount, totalIncome };
  deployStep  = 1;
  document.getElementById('deployWizard').style.display = 'block';
  renderDeployStep();
}

function renderDeployStep() {
  const fmt   = v => '$' + Number(v).toLocaleString('en-US', { minimumFractionDigits: 0, maximumFractionDigits: 0 });
  const inner = document.getElementById('deployWizardInner');
  const steps = ['Plan Review', 'Digital Authorization', 'Confirm & Deploy'];
  const stepHtml = steps.map((s, i) => {
    const n = i + 1;
    const active  = deployStep === n;
    const done    = deployStep > n;
    const color   = done ? '#3fb950' : active ? '#58a6ff' : '#30363d';
    const bg      = done ? '#0a2a0a' : active ? '#0a1a2a' : '#0d1117';
    const label   = done ? '✓' : n;
    return `<div style="display:flex;align-items:center;gap:8px">
      <div style="width:28px;height:28px;border-radius:50%;border:2px solid ${color};background:${bg};display:flex;align-items:center;justify-content:center;font-size:12px;font-weight:700;color:${color}">${label}</div>
      <span style="font-size:12px;color:${active?'#e6edf3':'#8b949e'};font-weight:${active?700:400}">${s}</span>
      ${n < steps.length ? `<div style="flex:1;height:1px;background:#30363d;margin:0 4px"></div>` : ''}
    </div>`;
  }).join('');

  let content = '';

  if (deployStep === 1) {
    const rows = deployPlan.products.map(p => `
      <tr>
        <td style="color:#e6edf3;font-weight:600">${p.name}</td>
        <td style="color:#58a6ff">${fmt(p.amount)}</td>
        <td style="color:#d29922">${fmt(p.income)} / yr</td>
        <td style="color:#8b949e">${Math.round(p.pct)}%</td>
        <td><span class="risk-badge risk-${(p.risk||'low').toLowerCase().replace(/[\s\/]+/g,'-')}">${p.risk}</span></td>
      </tr>`).join('');
    content = `
      <h2 style="color:#e6edf3;font-size:20px;margin:0 0 6px">Reinvestment Plan Review</h2>
      <p style="color:#8b949e;margin:0 0 24px;font-size:13px">Review selected products before authorizing the bank transfer.</p>
      <div class="panel" style="margin-bottom:16px">
        <table class="data-table">
          <thead><tr><th>Product</th><th>Amount</th><th>Annual Income</th><th>Allocation</th><th>Risk</th></tr></thead>
          <tbody>${rows}</tbody>
          <tfoot>
            <tr style="border-top:2px solid #30363d;background:#0d1117">
              <td style="font-weight:700;color:#e6edf3">Total</td>
              <td style="font-weight:700;color:#58a6ff">${fmt(deployPlan.totalAmount)}</td>
              <td style="font-weight:700;color:#d29922">${fmt(deployPlan.totalIncome)} / yr</td>
              <td></td><td></td>
            </tr>
          </tfoot>
        </table>
      </div>
      <div style="background:#0a1a2a;border:1px solid #1a3a5a;border-radius:8px;padding:14px;margin-bottom:24px;font-size:13px;color:#8b949e">
        💡 Funds will be transferred from the client's bank account (cash RMD proceeds) into the selected products.
      </div>
      <div style="display:flex;justify-content:flex-end;gap:10px">
        <button onclick="deployWizardClose()" style="background:#161b22;color:#8b949e;border:1px solid #30363d;border-radius:6px;padding:9px 20px;cursor:pointer">Cancel</button>
        <button onclick="deployWizardNext()" style="background:#1a3a1a;color:#3fb950;border:1px solid #3fb950;border-radius:6px;padding:9px 20px;font-weight:600;cursor:pointer">Next →</button>
      </div>`;
  }

  else if (deployStep === 2) {
    content = `
      <h2 style="color:#e6edf3;font-size:20px;margin:0 0 6px">Digital Authorization</h2>
      <p style="color:#8b949e;margin:0 0 24px;font-size:13px">Client must authorize the deployment of <strong style="color:#58a6ff">${fmt(deployPlan.totalAmount)}</strong> into the selected products.</p>
      <div class="panel" style="margin-bottom:20px">
        <div style="margin-bottom:14px">
          <label style="display:block;font-size:12px;color:#8b949e;margin-bottom:5px">Client Full Name</label>
          <input id="dw-client-name" type="text" placeholder="e.g. Robert Johnson"
            style="width:100%;box-sizing:border-box;background:#0d1117;border:1px solid #30363d;border-radius:6px;padding:9px 12px;color:#e6edf3;font-size:13px">
        </div>
        <div style="background:#0a2a0a;border:1px solid #1a4a1a;border-radius:8px;padding:14px;margin-bottom:14px">
          <div style="font-size:13px;font-weight:700;color:#3fb950;margin-bottom:8px">📋 Authorization Agreement</div>
          <div style="font-size:12px;color:#8b949e;line-height:1.6">
            I authorize the transfer of ${fmt(deployPlan.totalAmount)} of cash RMD proceeds into the selected bank and investment products listed above.
            I understand these are non-IRA taxable investments and the annual income projections are estimates based on current yields.
          </div>
        </div>
        <label style="display:flex;align-items:flex-start;gap:10px;cursor:pointer;margin-bottom:10px">
          <input type="checkbox" id="dw-chk1" style="margin-top:2px;accent-color:#3fb950">
          <span style="font-size:12px;color:#8b949e">I confirm the above investment plan and authorize the fund transfer.</span>
        </label>
        <label style="display:flex;align-items:flex-start;gap:10px;cursor:pointer">
          <input type="checkbox" id="dw-chk2" style="margin-top:2px;accent-color:#3fb950">
          <span style="font-size:12px;color:#8b949e">I have reviewed and understand the risk profile of each selected product.</span>
        </label>
      </div>
      <div style="display:flex;justify-content:space-between;gap:10px">
        <button onclick="deployWizardBack()" style="background:#161b22;color:#8b949e;border:1px solid #30363d;border-radius:6px;padding:9px 20px;cursor:pointer">← Back</button>
        <button onclick="deployWizardNext()" style="background:#1a3a1a;color:#3fb950;border:1px solid #3fb950;border-radius:6px;padding:9px 20px;font-weight:600;cursor:pointer">Authorize →</button>
      </div>`;
  }

  else if (deployStep === 3) {
    const rows = deployPlan.products.map(p => `
      <div style="display:flex;justify-content:space-between;padding:8px 0;border-bottom:1px solid #21262d">
        <span style="color:#e6edf3;font-size:13px">${p.name}</span>
        <span style="color:#3fb950;font-weight:700;font-size:13px">${fmt(p.amount)}</span>
      </div>`).join('');
    content = `
      <h2 style="color:#e6edf3;font-size:20px;margin:0 0 6px">Confirm & Deploy</h2>
      <p style="color:#8b949e;margin:0 0 24px;font-size:13px">Final review before deployment instruction is sent.</p>
      <div class="panel" style="margin-bottom:20px">
        <div style="font-size:13px;font-weight:600;color:#8b949e;margin-bottom:12px">DEPLOYMENT SUMMARY</div>
        ${rows}
        <div style="display:flex;justify-content:space-between;padding:10px 0 0">
          <span style="color:#e6edf3;font-weight:700">Total Deployed</span>
          <span style="color:#58a6ff;font-weight:700;font-size:16px">${fmt(deployPlan.totalAmount)}</span>
        </div>
        <div style="display:flex;justify-content:space-between;padding:4px 0">
          <span style="color:#8b949e;font-size:12px">Projected Annual Income</span>
          <span style="color:#d29922;font-weight:600">${fmt(deployPlan.totalIncome)} / yr</span>
        </div>
      </div>
      <div id="dw-submit-area" style="display:flex;justify-content:space-between;gap:10px">
        <button onclick="deployWizardBack()" style="background:#161b22;color:#8b949e;border:1px solid #30363d;border-radius:6px;padding:9px 20px;cursor:pointer">← Back</button>
        <button onclick="deployWizardSubmit()" style="background:#1a3a1a;color:#3fb950;border:1px solid #3fb950;border-radius:6px;padding:10px 28px;font-weight:700;font-size:14px;cursor:pointer">✓ Deploy Funds</button>
      </div>`;
  }

  inner.innerHTML = `
    <div style="display:flex;align-items:center;gap:8px;margin-bottom:32px">
      <button onclick="deployWizardClose()" style="background:none;border:none;color:#8b949e;font-size:20px;cursor:pointer;padding:0 6px 0 0">←</button>
      <span style="color:#8b949e;font-size:13px">Deploy Funds</span>
    </div>
    <div style="display:flex;align-items:center;gap:0;margin-bottom:32px">${stepHtml}</div>
    ${content}`;
}

function deployWizardNext() {
  if (deployStep === 2) {
    const name = (document.getElementById('dw-client-name')?.value || '').trim();
    const chk1 = document.getElementById('dw-chk1')?.checked;
    const chk2 = document.getElementById('dw-chk2')?.checked;
    if (!name || !chk1 || !chk2) {
      showToast('⚠️', 'Authorization incomplete', 'Enter client name and check both authorization boxes.');
      return;
    }
    deployPlan.authorizedBy = name;
  }
  deployStep++;
  renderDeployStep();
}

function deployWizardBack() {
  deployStep--;
  renderDeployStep();
}

function deployWizardClose() {
  document.getElementById('deployWizard').style.display = 'none';
  deployStep = 1;
}

async function deployWizardSubmit() {
  const btn = document.querySelector('#dw-submit-area button:last-child');
  if (btn) { btn.disabled = true; btn.textContent = 'Deploying…'; }
  await new Promise(r => setTimeout(r, 1800));
  document.getElementById('deployWizard').style.display = 'none';
  deployStep = 1;
  showToast('✅', 'Funds Deployed', `${deployPlan.products.length} product(s) funded · ${('$' + Number(deployPlan.totalAmount).toLocaleString())} transferred to bank.`);
}

// ── Execute Wizard ────────────────────────────────────────────────────────
let wizardData = {};
let wizardPlan = {};

function executeWizard() {
  const states = Object.values(rmdActionState);
  if (!states.length) {
    showToast('⚠️', 'No plan loaded', 'Run the agent first to generate a distribution plan.');
    return;
  }
  const fmt = v => '$' + Number(v).toLocaleString();
  wizardPlan = {
    items:     states,
    hasCash:   states.some(s => s.cur === 'cash'),
    hasIk:     states.some(s => s.cur === 'ik'),
    hasQcd:    states.some(s => s.cur === 'qcd'),
    cashTotal: states.filter(s => s.cur === 'cash').reduce((t, s) => t + s.value, 0),
    ikTotal:   states.filter(s => s.cur === 'ik').reduce((t, s) => t + s.value, 0),
    qcdTotal:  states.filter(s => s.cur === 'qcd').reduce((t, s) => t + s.value, 0),
  };
  wizardData = {
    clientName: document.getElementById('clientName')?.textContent?.trim() || '',
    authDate:   new Date().toLocaleDateString('en-US', {year:'numeric', month:'long', day:'numeric'}),
    confirmed: false, advisorConfirmed: false, advisorId: '',
    cashAccount: { hasAccount: null, bankName: '', accountNum: '', accountType: 'Checking' },
    brokerage:   { hasAccount: null, firmName: '', accountNum: '' },
    qcdCharities: [{ name: '', ein: '', address: '' }],
  };
  wizardStep = 1;
  document.getElementById('execWizard').style.display = 'block';
  document.body.style.overflow = 'hidden';
  renderWizardStep();
}

function closeWizard() {
  document.getElementById('execWizard').style.display = 'none';
  document.body.style.overflow = '';
}

function wizardNext() {
  if (wizardStep === 2) {
    if (!wizardData.clientName.trim()) {
      showToast('⚠️', 'Signature Required', 'Type the client\'s full legal name to proceed.');
      document.getElementById('wiz-auth-name')?.focus(); return;
    }
    if (!wizardData.confirmed) {
      showToast('⚠️', 'Client Consent Required', 'Client must check the authorization checkbox.'); return;
    }
    if (!wizardData.advisorConfirmed) {
      showToast('⚠️', 'Advisor Sign-off Required', 'Advisor must confirm fiduciary review.'); return;
    }
  }
  wizardStep++;
  document.getElementById('execWizard').scrollTop = 0;
  renderWizardStep();
}

function wizardBack() {
  wizardStep--;
  document.getElementById('execWizard').scrollTop = 0;
  renderWizardStep();
}

async function wizardSubmit() {
  if (!wizardData.clientName.trim() || !wizardData.confirmed || !wizardData.advisorConfirmed) {
    showToast('⚠️', 'Authorization Incomplete', 'Return to Step 2 and complete all required fields.');
    wizardStep = 2; renderWizardStep(); return;
  }
  if (wizardPlan.hasQcd && !wizardData.qcdCharities[0]?.name) {
    showToast('⚠️', 'Charity Details Required', 'Please enter the charity name for the QCD distribution.');
    wizardStep = 3; renderWizardStep(); return;
  }
  const btn = document.getElementById('wizSubmitBtn');
  if (btn) { btn.textContent = '⏳ Submitting…'; btn.disabled = true; }
  await new Promise(r => setTimeout(r, 1800));
  closeWizard();
  executeActions();
  const clientName = document.getElementById('clientName')?.textContent || 'Client';
  showToast('✅', 'Plan Submitted', `Distribution plan for ${clientName} authorized · Compliance record created · Execution in progress.`, 7000);
}

function renderWizardStep() {
  const inner = document.getElementById('execWizardInner');
  const fmt   = v => '$' + Number(v).toLocaleString();
  const STEPS = ['Plan Review', 'Authorization', 'Account Details', 'Confirm & Submit'];

  // Progress stepper
  const stepperHtml = `<div style="display:flex;align-items:flex-start;margin-bottom:32px">${
    STEPS.map((label, i) => {
      const n = i + 1, done = n < wizardStep, active = n === wizardStep;
      const c = done ? '#3fb950' : active ? '#58a6ff' : '#30363d';
      const tc = done ? '#3fb950' : active ? '#58a6ff' : '#6e7681';
      return `<div style="display:flex;align-items:center;${i > 0 ? 'flex:1' : ''}">
        ${i > 0 ? `<div style="flex:1;height:2px;background:${done?'#3fb950':'#30363d'};margin-bottom:18px"></div>` : ''}
        <div style="display:flex;flex-direction:column;align-items:center;gap:6px;${i > 0 ? '' : ''}">
          <div style="width:34px;height:34px;border-radius:50%;border:2px solid ${c};background:${active?'#0d1e3a':done?'#0d2a0d':'#0d1117'};display:flex;align-items:center;justify-content:center;font-size:12px;font-weight:800;color:${c}">${done?'✓':n}</div>
          <div style="font-size:10px;color:${tc};white-space:nowrap;font-weight:${active?700:400}">${label}</div>
        </div>
      </div>`;
    }).join('')
  }</div>`;

  // Step content
  let body = '';
  const clientName = document.getElementById('clientName')?.textContent || 'Client';
  const alloc  = document.getElementById('s4-alloc')?.textContent  || '—';
  const taxVal = document.getElementById('s4-tax')?.textContent    || '—';
  const saved  = document.getElementById('s4-saved')?.textContent  || '—';

  if (wizardStep === 1) {
    // ── STEP 1: Plan Review ──────────────────────────────────────────────
    const alabel = { cash:'💵 Cash', ik:'📦 In-Kind', qcd:'🎗️ QCD', hold:'⏸ Hold' };
    const acolor = { cash:'#4AAEE0', ik:'#7EC8F5', qcd:'#4ade80', hold:'#8b949e' };
    const rows = wizardPlan.items.map(s => `<tr style="border-bottom:1px solid #21262d">
      <td style="padding:9px 12px;font-weight:700;color:#e6edf3">${s.symbol}</td>
      <td style="padding:9px 12px;color:#6e7681;font-size:11px">${s.assetClass||'—'}</td>
      <td style="padding:9px 12px;text-align:right;color:#e6edf3;font-weight:600">${fmt(s.value)}</td>
      <td style="padding:9px 12px;text-align:right;color:${s.gain>=0?'#3fb950':'#f85149'}">${s.gain>=0?'+':''}${fmt(s.gain)}</td>
      <td style="padding:9px 12px;color:${acolor[s.cur]};font-weight:700">${alabel[s.cur]||s.cur}${s.cur!==s.orig?' <span style="font-size:9px;background:#2d1b00;color:#f59e0b;border-radius:4px;padding:1px 5px">OVERRIDE</span>':''}</td>
    </tr>`).join('');
    body = `
      <div style="font-size:15px;font-weight:800;color:#e6edf3;margin-bottom:4px">Distribution Plan — ${clientName}</div>
      <div style="font-size:12px;color:#8b949e;margin-bottom:20px">Review all assets and actions. Return to the previous screen to change any action before proceeding.</div>
      <div style="display:flex;gap:12px;margin-bottom:20px">
        <div style="flex:1;background:#0d1117;border:1px solid #21262d;border-radius:8px;padding:14px;text-align:center">
          <div style="font-size:18px;font-weight:800;color:#58a6ff">${alloc}</div>
          <div style="font-size:10px;color:#6e7681;margin-top:3px">Total Allocated</div>
        </div>
        <div style="flex:1;background:#0d1117;border:1px solid #21262d;border-radius:8px;padding:14px;text-align:center">
          <div style="font-size:18px;font-weight:800;color:#f85149">${taxVal}</div>
          <div style="font-size:10px;color:#6e7681;margin-top:3px">Est. Federal Tax</div>
        </div>
        <div style="flex:1;background:#0d1117;border:1px solid #21262d;border-radius:8px;padding:14px;text-align:center">
          <div style="font-size:18px;font-weight:800;color:#3fb950">${saved}</div>
          <div style="font-size:10px;color:#6e7681;margin-top:3px">Tax Saved</div>
        </div>
        ${wizardPlan.hasQcd ? `<div style="flex:1;background:#0a1a0a;border:1px solid #4ade8030;border-radius:8px;padding:14px;text-align:center">
          <div style="font-size:18px;font-weight:800;color:#4ade80">${fmt(wizardPlan.qcdTotal)}</div>
          <div style="font-size:10px;color:#4ade80;margin-top:3px">QCD Donation</div>
        </div>` : ''}
      </div>
      <div style="border:1px solid #21262d;border-radius:8px;overflow:hidden">
        <table style="width:100%;border-collapse:collapse">
          <thead><tr style="background:#0d1117">
            <th style="padding:8px 12px;text-align:left;font-size:10px;color:#6e7681;text-transform:uppercase">Symbol</th>
            <th style="padding:8px 12px;text-align:left;font-size:10px;color:#6e7681;text-transform:uppercase">Class</th>
            <th style="padding:8px 12px;text-align:right;font-size:10px;color:#6e7681;text-transform:uppercase">Value</th>
            <th style="padding:8px 12px;text-align:right;font-size:10px;color:#6e7681;text-transform:uppercase">Gain/Loss</th>
            <th style="padding:8px 12px;text-align:left;font-size:10px;color:#6e7681;text-transform:uppercase">Action</th>
          </tr></thead>
          <tbody>${rows}</tbody>
        </table>
      </div>`;

  } else if (wizardStep === 2) {
    // ── STEP 2: Digital Authorization ────────────────────────────────────
    body = `
      <div style="font-size:15px;font-weight:800;color:#e6edf3;margin-bottom:4px">Client Digital Authorization</div>
      <div style="font-size:12px;color:#8b949e;margin-bottom:20px">Client must authorize this plan. Typed name constitutes a binding electronic signature.</div>
      <div style="background:#0d1117;border:1px solid #30363d;border-radius:8px;padding:16px;margin-bottom:18px;font-size:12px;color:#8b949e;line-height:1.9">
        I, <strong id="authNamePreview" style="color:#58a6ff;border-bottom:1px solid #58a6ff40">${wizardData.clientName||'&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;'}</strong>,
        hereby authorize my Financial Advisor to execute the RMD distribution plan totaling
        <strong style="color:#e6edf3">${alloc}</strong> from my IRA account(s) as detailed in Step 1.
        I have reviewed each action and approve this plan. Dated <strong style="color:#e6edf3">${wizardData.authDate}</strong>.
      </div>
      <div style="display:flex;flex-direction:column;gap:14px">
        <div>
          <label style="font-size:11px;color:#8b949e;font-weight:700;text-transform:uppercase;letter-spacing:.5px;display:block;margin-bottom:6px">Full Legal Name — Electronic Signature <span style="color:#f85149">*</span></label>
          <input id="wiz-auth-name" type="text" placeholder="Type full legal name to sign" value="${wizardData.clientName}"
            oninput="wizardData.clientName=this.value;const p=document.getElementById('authNamePreview');if(p)p.textContent=this.value||'          '"
            style="width:100%;background:#0d1117;border:1px solid #30363d;border-radius:6px;padding:11px 14px;color:#58a6ff;font-size:15px;font-style:italic;box-sizing:border-box;outline:none;font-family:Georgia,serif"
            onfocus="this.style.borderColor='#58a6ff'" onblur="this.style.borderColor='#30363d'"/>
          <div style="font-size:10px;color:#6e7681;margin-top:4px">Typing your name in this field constitutes a legally binding electronic signature per the E-SIGN Act</div>
        </div>
        <div style="background:#0d1117;border:1px solid #21262d;border-radius:6px;padding:12px 14px">
          <label style="display:flex;align-items:flex-start;gap:10px;cursor:pointer">
            <input type="checkbox" ${wizardData.confirmed?'checked':''} onchange="wizardData.confirmed=this.checked"
              style="margin-top:1px;width:15px;height:15px;flex-shrink:0;accent-color:#58a6ff;cursor:pointer"/>
            <span style="font-size:12px;color:#8b949e;line-height:1.7">
              <strong style="color:#e6edf3">Client Consent:</strong> I have reviewed and discussed this RMD distribution plan with my financial advisor,
              and I authorize all actions listed in this plan to be executed on my behalf. <span style="color:#f85149">*</span>
            </span>
          </label>
        </div>
        <div style="background:#0d1117;border:1px solid #21262d;border-radius:6px;padding:12px 14px">
          <label style="display:flex;align-items:flex-start;gap:10px;cursor:pointer">
            <input type="checkbox" ${wizardData.advisorConfirmed?'checked':''} onchange="wizardData.advisorConfirmed=this.checked"
              style="margin-top:1px;width:15px;height:15px;flex-shrink:0;accent-color:#3fb950;cursor:pointer"/>
            <span style="font-size:12px;color:#8b949e;line-height:1.7">
              <strong style="color:#e6edf3">Advisor Fiduciary Confirmation:</strong> I confirm this plan is in the client's best interest,
              has been reviewed for suitability, and complies with applicable IRS regulations. <span style="color:#f85149">*</span>
            </span>
          </label>
        </div>
        <div style="display:flex;gap:12px">
          <div style="flex:1">
            <label style="font-size:10px;color:#8b949e;font-weight:700;text-transform:uppercase;letter-spacing:.5px;display:block;margin-bottom:5px">Authorization Date</label>
            <input type="text" value="${wizardData.authDate}" disabled style="width:100%;background:#0d1117;border:1px solid #21262d;border-radius:6px;padding:8px 12px;color:#6e7681;font-size:12px;box-sizing:border-box"/>
          </div>
          <div style="flex:1">
            <label style="font-size:10px;color:#8b949e;font-weight:700;text-transform:uppercase;letter-spacing:.5px;display:block;margin-bottom:5px">Advisor ID / License No.</label>
            <input type="text" placeholder="e.g. RIA-20451" value="${wizardData.advisorId||''}" oninput="wizardData.advisorId=this.value"
              style="width:100%;background:#0d1117;border:1px solid #30363d;border-radius:6px;padding:8px 12px;color:#e6edf3;font-size:12px;box-sizing:border-box;outline:none"
              onfocus="this.style.borderColor='#58a6ff'" onblur="this.style.borderColor='#30363d'"/>
          </div>
        </div>
      </div>`;

  } else if (wizardStep === 3) {
    // ── STEP 3: Account Details ───────────────────────────────────────────
    const hasCA = wizardData.cashAccount.hasAccount;
    const hasIK = wizardData.brokerage.hasAccount;
    const ch    = wizardData.qcdCharities[0];
    body = `
      <div style="font-size:15px;font-weight:800;color:#e6edf3;margin-bottom:4px">Account & Destination Details</div>
      <div style="font-size:12px;color:#8b949e;margin-bottom:20px">Provide destination accounts for each distribution type. New account requests will be initiated on submission.</div>`;

    if (wizardPlan.hasCash) {
      body += `
        <div style="border:1px solid #21262d;border-radius:10px;overflow:hidden;margin-bottom:16px">
          <div style="background:#0a1520;padding:12px 16px;display:flex;align-items:center;gap:10px;border-bottom:1px solid #21262d">
            <span style="font-size:18px">💵</span>
            <div><div style="font-size:13px;font-weight:700;color:#4AAEE0">Cash Distribution — ${fmt(wizardPlan.cashTotal)}</div>
            <div style="font-size:11px;color:#6e7681">Proceeds wired or deposited to a bank account</div></div>
          </div>
          <div style="padding:16px">
            <div style="font-size:12px;color:#8b949e;margin-bottom:10px">Does the client have a bank account to receive these proceeds?</div>
            <div style="display:flex;gap:10px;margin-bottom:14px">
              <label onclick="wizardData.cashAccount.hasAccount=true;renderWizardStep()" style="flex:1;background:${hasCA===true?'#0d1e3a':'#0d1117'};border:1px solid ${hasCA===true?'#58a6ff':'#30363d'};border-radius:6px;padding:10px 14px;cursor:pointer;text-align:center;font-size:12px;font-weight:${hasCA===true?700:400};color:${hasCA===true?'#58a6ff':'#8b949e'}">✓ Yes, account on file</label>
              <label onclick="wizardData.cashAccount.hasAccount=false;renderWizardStep()" style="flex:1;background:${hasCA===false?'#1a1209':'#0d1117'};border:1px solid ${hasCA===false?'#f59e0b':'#30363d'};border-radius:6px;padding:10px 14px;cursor:pointer;text-align:center;font-size:12px;font-weight:${hasCA===false?700:400};color:${hasCA===false?'#f59e0b':'#8b949e'}">✕ No — open new account</label>
            </div>
            ${hasCA===true ? `<div style="display:flex;gap:10px">
              <div style="flex:3"><label style="font-size:10px;color:#6e7681;display:block;margin-bottom:4px">Bank Name</label>
                <input type="text" placeholder="e.g. Chase, Wells Fargo" value="${wizardData.cashAccount.bankName}" oninput="wizardData.cashAccount.bankName=this.value"
                  style="width:100%;background:#0d1117;border:1px solid #30363d;border-radius:6px;padding:8px 10px;color:#e6edf3;font-size:12px;box-sizing:border-box;outline:none"
                  onfocus="this.style.borderColor='#58a6ff'" onblur="this.style.borderColor='#30363d'"/></div>
              <div style="flex:1"><label style="font-size:10px;color:#6e7681;display:block;margin-bottom:4px">Last 4 digits</label>
                <input type="text" placeholder="••••" maxlength="4" value="${wizardData.cashAccount.accountNum}" oninput="wizardData.cashAccount.accountNum=this.value"
                  style="width:100%;background:#0d1117;border:1px solid #30363d;border-radius:6px;padding:8px 10px;color:#e6edf3;font-size:12px;box-sizing:border-box;outline:none"
                  onfocus="this.style.borderColor='#58a6ff'" onblur="this.style.borderColor='#30363d'"/></div>
              <div style="flex:1"><label style="font-size:10px;color:#6e7681;display:block;margin-bottom:4px">Type</label>
                <select oninput="wizardData.cashAccount.accountType=this.value"
                  style="width:100%;background:#0d1117;border:1px solid #30363d;border-radius:6px;padding:8px 10px;color:#e6edf3;font-size:12px">
                  <option ${wizardData.cashAccount.accountType==='Checking'?'selected':''}>Checking</option>
                  <option ${wizardData.cashAccount.accountType==='Savings'?'selected':''}>Savings</option>
                </select></div>
            </div>`
            : hasCA===false ? `<div style="background:#1a1209;border:1px solid #f59e0b30;border-radius:8px;padding:14px">
              <div style="font-size:12px;font-weight:700;color:#f59e0b;margin-bottom:10px">📋 New Bank Account Application</div>
              <div style="display:flex;gap:10px;margin-bottom:10px">
                <div style="flex:2"><label style="font-size:10px;color:#6e7681;display:block;margin-bottom:4px">Preferred Bank</label>
                  <input type="text" placeholder="Bank name" value="${wizardData.cashAccount.bankName}" oninput="wizardData.cashAccount.bankName=this.value"
                    style="width:100%;background:#0d1117;border:1px solid #30363d;border-radius:6px;padding:8px 10px;color:#e6edf3;font-size:12px;box-sizing:border-box;outline:none"/></div>
                <div style="flex:1"><label style="font-size:10px;color:#6e7681;display:block;margin-bottom:4px">Account Type</label>
                  <select oninput="wizardData.cashAccount.accountType=this.value"
                    style="width:100%;background:#0d1117;border:1px solid #30363d;border-radius:6px;padding:8px 10px;color:#e6edf3;font-size:12px">
                    <option>Checking</option><option>Savings</option></select></div>
              </div>
              <div style="font-size:11px;color:#8b949e;background:#0d1117;border-radius:6px;padding:10px">ℹ️ A new account application will be initiated upon submission. Client will be contacted to complete verification (2–3 business days).</div>
            </div>` : ''}
          </div>
        </div>`;
    }

    if (wizardPlan.hasIk) {
      body += `
        <div style="border:1px solid #21262d;border-radius:10px;overflow:hidden;margin-bottom:16px">
          <div style="background:#0a1828;padding:12px 16px;display:flex;align-items:center;gap:10px;border-bottom:1px solid #21262d">
            <span style="font-size:18px">📦</span>
            <div><div style="font-size:13px;font-weight:700;color:#7EC8F5">In-Kind Transfer — ${fmt(wizardPlan.ikTotal)}</div>
            <div style="font-size:11px;color:#6e7681">Securities transferred to a taxable brokerage account · No immediate sale</div></div>
          </div>
          <div style="padding:16px">
            <div style="font-size:12px;color:#8b949e;margin-bottom:10px">Does the client have a brokerage account for in-kind receipt?</div>
            <div style="display:flex;gap:10px;margin-bottom:14px">
              <label onclick="wizardData.brokerage.hasAccount=true;renderWizardStep()" style="flex:1;background:${hasIK===true?'#0d1e3a':'#0d1117'};border:1px solid ${hasIK===true?'#58a6ff':'#30363d'};border-radius:6px;padding:10px 14px;cursor:pointer;text-align:center;font-size:12px;font-weight:${hasIK===true?700:400};color:${hasIK===true?'#58a6ff':'#8b949e'}">✓ Yes, brokerage on file</label>
              <label onclick="wizardData.brokerage.hasAccount=false;renderWizardStep()" style="flex:1;background:${hasIK===false?'#0a1a0a':'#0d1117'};border:1px solid ${hasIK===false?'#4ade80':'#30363d'};border-radius:6px;padding:10px 14px;cursor:pointer;text-align:center;font-size:12px;font-weight:${hasIK===false?700:400};color:${hasIK===false?'#4ade80':'#8b949e'}">✕ No — open new brokerage</label>
            </div>
            ${hasIK===true ? `<div style="display:flex;gap:10px">
              <div style="flex:3"><label style="font-size:10px;color:#6e7681;display:block;margin-bottom:4px">Brokerage Firm</label>
                <input type="text" placeholder="e.g. Fidelity, Schwab, Vanguard" value="${wizardData.brokerage.firmName}" oninput="wizardData.brokerage.firmName=this.value"
                  style="width:100%;background:#0d1117;border:1px solid #30363d;border-radius:6px;padding:8px 10px;color:#e6edf3;font-size:12px;box-sizing:border-box;outline:none"
                  onfocus="this.style.borderColor='#58a6ff'" onblur="this.style.borderColor='#30363d'"/></div>
              <div style="flex:2"><label style="font-size:10px;color:#6e7681;display:block;margin-bottom:4px">Account No. (last 4)</label>
                <input type="text" placeholder="••••" maxlength="4" value="${wizardData.brokerage.accountNum}" oninput="wizardData.brokerage.accountNum=this.value"
                  style="width:100%;background:#0d1117;border:1px solid #30363d;border-radius:6px;padding:8px 10px;color:#e6edf3;font-size:12px;box-sizing:border-box;outline:none"
                  onfocus="this.style.borderColor='#58a6ff'" onblur="this.style.borderColor='#30363d'"/></div>
            </div>`
            : hasIK===false ? `<div style="background:#0a1a0a;border:1px solid #4ade8030;border-radius:8px;padding:14px">
              <div style="font-size:12px;font-weight:700;color:#4ade80;margin-bottom:10px">📋 New Brokerage Account Application</div>
              <div style="display:flex;gap:10px;margin-bottom:10px">
                <div style="flex:1"><label style="font-size:10px;color:#6e7681;display:block;margin-bottom:4px">Preferred Firm</label>
                  <input type="text" placeholder="e.g. Fidelity, Schwab" value="${wizardData.brokerage.firmName}" oninput="wizardData.brokerage.firmName=this.value"
                    style="width:100%;background:#0d1117;border:1px solid #30363d;border-radius:6px;padding:8px 10px;color:#e6edf3;font-size:12px;box-sizing:border-box;outline:none"/></div>
              </div>
              <div style="font-size:11px;color:#8b949e;background:#0d1117;border-radius:6px;padding:10px">ℹ️ A new taxable brokerage account will be opened. Transfers held pending activation (2–3 business days). Securities will not be sold during transfer.</div>
            </div>` : ''}
          </div>
        </div>`;
    }

    if (wizardPlan.hasQcd) {
      body += `
        <div style="border:1px solid #4ade8030;border-radius:10px;overflow:hidden;margin-bottom:16px">
          <div style="background:#0a1a0a;padding:12px 16px;display:flex;align-items:center;gap:10px;border-bottom:1px solid #4ade8030">
            <span style="font-size:18px">🎗️</span>
            <div><div style="font-size:13px;font-weight:700;color:#4ade80">Qualified Charitable Distribution — ${fmt(wizardPlan.qcdTotal)}</div>
            <div style="font-size:11px;color:#6e7681">Transferred directly from IRA to a 501(c)(3) · No taxable income recognized</div></div>
          </div>
          <div style="padding:16px">
            <div style="font-size:12px;color:#8b949e;margin-bottom:12px">Enter charity details. The organization must be a qualified 501(c)(3). IRA custodian will issue a check directly to the charity.</div>
            <div style="display:flex;flex-direction:column;gap:10px">
              <div style="display:flex;gap:10px">
                <div style="flex:3"><label style="font-size:10px;color:#6e7681;display:block;margin-bottom:4px">Charity / Organization Name <span style="color:#f85149">*</span></label>
                  <input type="text" placeholder="e.g. American Red Cross, United Way" value="${ch.name||''}" oninput="wizardData.qcdCharities[0].name=this.value"
                    style="width:100%;background:#0d1117;border:1px solid #30363d;border-radius:6px;padding:8px 10px;color:#e6edf3;font-size:12px;box-sizing:border-box;outline:none"
                    onfocus="this.style.borderColor='#4ade80'" onblur="this.style.borderColor='#30363d'"/></div>
                <div style="flex:2"><label style="font-size:10px;color:#6e7681;display:block;margin-bottom:4px">Federal EIN / Tax ID <span style="color:#f85149">*</span></label>
                  <input type="text" placeholder="XX-XXXXXXX" value="${ch.ein||''}" oninput="wizardData.qcdCharities[0].ein=this.value"
                    style="width:100%;background:#0d1117;border:1px solid #30363d;border-radius:6px;padding:8px 10px;color:#e6edf3;font-size:12px;box-sizing:border-box;outline:none"
                    onfocus="this.style.borderColor='#4ade80'" onblur="this.style.borderColor='#30363d'"/></div>
              </div>
              <div><label style="font-size:10px;color:#6e7681;display:block;margin-bottom:4px">Charity Address</label>
                <input type="text" placeholder="Street, City, State, ZIP" value="${ch.address||''}" oninput="wizardData.qcdCharities[0].address=this.value"
                  style="width:100%;background:#0d1117;border:1px solid #30363d;border-radius:6px;padding:8px 10px;color:#e6edf3;font-size:12px;box-sizing:border-box;outline:none"
                  onfocus="this.style.borderColor='#4ade80'" onblur="this.style.borderColor='#30363d'"/></div>
              <div style="display:flex;gap:10px">
                <div style="flex:1"><label style="font-size:10px;color:#6e7681;display:block;margin-bottom:4px">Distribution Amount</label>
                  <input type="text" value="${fmt(wizardPlan.qcdTotal)}" disabled style="width:100%;background:#0d1117;border:1px solid #21262d;border-radius:6px;padding:8px 10px;color:#6e7681;font-size:12px;box-sizing:border-box"/></div>
                <div style="flex:1"><label style="font-size:10px;color:#6e7681;display:block;margin-bottom:4px">Distribution Date</label>
                  <input type="text" value="${wizardData.authDate}" disabled style="width:100%;background:#0d1117;border:1px solid #21262d;border-radius:6px;padding:8px 10px;color:#6e7681;font-size:12px;box-sizing:border-box"/></div>
              </div>
              <div style="background:#0d1117;border:1px solid #4ade8020;border-radius:6px;padding:10px;font-size:11px;color:#8b949e">
                📋 IRA custodian issues a check directly to the charity. Client receives a QCD acknowledgment letter. No 1099-R income reported for this amount.
              </div>
            </div>
          </div>
        </div>`;
    }

  } else {
    // ── STEP 4: Confirm & Submit ──────────────────────────────────────────
    const alabel = { cash:'💵 Cash', ik:'📦 In-Kind', qcd:'🎗️ QCD', hold:'⏸ Hold' };
    const planRows = wizardPlan.items.map(s =>
      `<div style="display:flex;justify-content:space-between;padding:6px 0;font-size:12px;border-bottom:1px solid #21262d">
        <span style="color:#8b949e">${s.symbol} — ${alabel[s.cur]||s.cur}${s.cur!==s.orig?' <span style="font-size:9px;color:#f59e0b">(Override)</span>':''}</span>
        <span style="color:#e6edf3;font-weight:700">${fmt(s.value)}</span>
      </div>`).join('');

    const acctSummary = [
      wizardPlan.hasCash ? `<div>💵 Cash → <span style="color:#e6edf3">${wizardData.cashAccount.bankName || (wizardData.cashAccount.hasAccount===false?'New account (to be opened)':'Not specified')}</span>${wizardData.cashAccount.accountNum?' ••'+wizardData.cashAccount.accountNum:''}</div>` : '',
      wizardPlan.hasIk   ? `<div>📦 In-Kind → <span style="color:#e6edf3">${wizardData.brokerage.firmName || (wizardData.brokerage.hasAccount===false?'New brokerage (to be opened)':'Not specified')}</span></div>` : '',
      wizardPlan.hasQcd  ? `<div>🎗️ QCD → <span style="color:#4ade80">${wizardData.qcdCharities[0]?.name||'Charity not entered'}</span> ${wizardData.qcdCharities[0]?.ein?'(EIN: '+wizardData.qcdCharities[0].ein+')':''}</div>` : '',
    ].filter(Boolean).join('');

    body = `
      <div style="font-size:15px;font-weight:800;color:#e6edf3;margin-bottom:4px">Review & Confirm</div>
      <div style="font-size:12px;color:#8b949e;margin-bottom:20px">Confirm all details are correct. Submission creates a compliance audit record and initiates execution.</div>
      <div style="display:grid;grid-template-columns:1fr 1fr;gap:14px;margin-bottom:14px">
        <div style="background:#0d1117;border:1px solid #21262d;border-radius:8px;padding:14px">
          <div style="font-size:10px;font-weight:700;color:#58a6ff;text-transform:uppercase;letter-spacing:.5px;margin-bottom:10px">Authorization</div>
          <div style="font-size:12px;color:#8b949e;line-height:2">
            <div>Signed by: <span style="color:#e6edf3;font-style:italic">${wizardData.clientName||'—'}</span></div>
            <div>Date: <span style="color:#e6edf3">${wizardData.authDate}</span></div>
            <div>Client consent: <span style="color:${wizardData.confirmed?'#3fb950':'#f85149'}">${wizardData.confirmed?'✓ Confirmed':'✗ Missing'}</span></div>
            <div>Advisor sign-off: <span style="color:${wizardData.advisorConfirmed?'#3fb950':'#f85149'}">${wizardData.advisorConfirmed?'✓ Confirmed':'✗ Missing'}</span></div>
            ${wizardData.advisorId?`<div>Advisor ID: <span style="color:#e6edf3">${wizardData.advisorId}</span></div>`:''}
          </div>
        </div>
        <div style="background:#0d1117;border:1px solid #21262d;border-radius:8px;padding:14px">
          <div style="font-size:10px;font-weight:700;color:#58a6ff;text-transform:uppercase;letter-spacing:.5px;margin-bottom:10px">Destination Accounts</div>
          <div style="font-size:12px;color:#8b949e;line-height:2">${acctSummary||'<span style="color:#6e7681">No account details provided</span>'}</div>
        </div>
      </div>
      <div style="background:#0d1117;border:1px solid #21262d;border-radius:8px;padding:14px;margin-bottom:14px">
        <div style="font-size:10px;font-weight:700;color:#58a6ff;text-transform:uppercase;letter-spacing:.5px;margin-bottom:10px">Distribution Plan — ${alloc}</div>
        ${planRows}
      </div>
      <div style="background:#0a2a0a;border:1px solid #3fb95030;border-radius:8px;padding:14px;font-size:12px;color:#8b949e;line-height:1.7">
        ✅ By submitting, you authorize the IRA custodian to proceed with the above plan. All actions will be logged with a timestamp for compliance audit. Cash/IK transfers will initiate within 1–2 business days. QCD checks will be issued within 3–5 business days.
      </div>`;
  }

  // Nav buttons
  const navHtml = `<div style="display:flex;justify-content:space-between;align-items:center;margin-top:24px">
    <button onclick="${wizardStep>1?'wizardBack()':'closeWizard()'}"
      style="padding:10px 20px;font-size:13px;background:#21262d;color:#8b949e;border:1px solid #30363d;border-radius:6px;cursor:pointer">
      ${wizardStep>1?'← Back':'Cancel'}
    </button>
    ${wizardStep<4
      ? `<button onclick="wizardNext()" style="padding:10px 28px;font-size:13px;font-weight:700;background:#0d1e3a;color:#58a6ff;border:1px solid #58a6ff;border-radius:6px;cursor:pointer">Continue →</button>`
      : `<button id="wizSubmitBtn" onclick="wizardSubmit()" style="padding:10px 28px;font-size:13px;font-weight:700;background:#1a3a1a;color:#3fb950;border:1px solid #3fb950;border-radius:6px;cursor:pointer">✓ Submit for Execution</button>`
    }
  </div>`;

  inner.innerHTML = `
    <div style="display:flex;align-items:flex-start;justify-content:space-between;margin-bottom:28px">
      <div>
        <div style="font-size:22px;font-weight:800;color:#e6edf3">Execute Distribution Plan</div>
        <div style="font-size:12px;color:#6e7681;margin-top:3px">Step ${wizardStep} of 4 · Complete all required fields to proceed</div>
      </div>
      <button onclick="closeWizard()" style="background:none;border:none;color:#6e7681;font-size:22px;cursor:pointer;padding:4px 8px;line-height:1">✕</button>
    </div>
    ${stepperHtml}
    <div style="background:#161b22;border:1px solid #21262d;border-radius:12px;padding:28px">${body}</div>
    ${navHtml}`;
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
    btn.textContent = '✅ Plan Executed';
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

function renderSelectedTable(assets, executions, strategy, rmd) {
  const tbody = document.getElementById('selectedBody');
  tbody.innerHTML = '';
  rmdActionState = {};  // reset state
  const isInKind   = (strategy || '').toLowerCase() === 'in_kind';
  const defaultAct = isInKind ? 'ik' : 'cash';

  // QCD budget: charitablePct % of RMD (averaged across selected accounts)
  const selAccts      = selectedAccounts.length > 0 ? selectedAccounts : (activeAccount ? [activeAccount] : []);
  const avgCharPct    = selAccts.length > 0
    ? selAccts.reduce((s, a) => s + (a.charitablePct || 0), 0) / selAccts.length
    : 5;
  const qcdBudget     = (rmd || 0) * (avgCharPct / 100);
  const ikBudget      = (rmd || 0) * 0.30;   // ~30% transferred in-kind (appreciated stocks)
  let   qcdAllocated  = 0;
  let   ikAllocated   = 0;
  const fmt = v => '$' + Number(v).toLocaleString('en-US', { minimumFractionDigits: 0, maximumFractionDigits: 0 });
  const TAX_RATE = 0.24;

  // Group by account for section headers, preserving global index for unique row keys
  const byAccount = {};
  assets.forEach((a, idx) => {
    const acct = a.account || (activeAccount && activeAccount.label) || 'IRA Account';
    if (!byAccount[acct]) byAccount[acct] = [];
    byAccount[acct].push({ ...a, _idx: idx });
  });

  Object.entries(byAccount).forEach(([acct, acctAssets]) => {
    // Sort by gain ascending so loss-harvest assets come first, then smallest
    // positive-gain assets get QCD treatment (not large gainers like VTI/GLD)
    acctAssets.sort((a, b) => (Number(a.gain) || 0) - (Number(b.gain) || 0));

    // Section header row
    const secTr = document.createElement('tr');
    secTr.className = 'rmd-sec-row';
    const acctTotal = acctAssets.reduce((s, a) => s + Number(a.value || 0), 0);
    secTr.innerHTML = `<td colspan="7">${acct} &nbsp;·&nbsp; ${acctAssets.length} assets &nbsp;·&nbsp; ${fmt(acctTotal)} allocated</td>`;
    tbody.appendChild(secTr);

    acctAssets.forEach(a => {
      const gain      = a.gain !== undefined ? Number(a.gain) : null;
      const value     = Number(a.value || 0);
      const price     = Number(a.price || 0);
      const qty       = Number(a.qty   || 0);
      const ad        = ANALYST_DATA[a.symbol] || { rating:'N/A', tone:'neu', target:null, firm:'—', url:'#', catalyst:'No analyst data available' };
      const noAnalyst = !ANALYST_DATA[a.symbol] || ad.rating === 'N/A';

      // Analyst rating class
      const arClass = ad.tone === 'pos' ? (ad.rating.toLowerCase().includes('strong') ? 'r-ar-sb' : 'r-ar-b')
                    : ad.tone === 'neg' ? 'r-ar-s' : 'r-ar-n';

      // Target price
      const targetDiff = (!noAnalyst && ad.target && ad.target !== 1) ? (ad.target - price) : null;
      const targetHtml = targetDiff !== null
        ? `<div class="r-target-val">12mo $${ad.target}</div><div class="${targetDiff >= 0 ? 'r-target-up' : 'r-target-dn'}">${targetDiff >= 0 ? '+' : ''}${Math.round(targetDiff / price * 100)}% upside</div>`
        : `<div class="r-target-val" style="color:#6e7681">—</div>`;

      // Tax impact per asset
      const taxImpact = gain !== null && gain > 0 ? gain * TAX_RATE : 0;
      const taxHtml   = gain !== null && gain < 0
        ? `<div class="r-tax-v t-g">$0</div><div class="r-tax-s">Loss offsets gain</div>`
        : gain !== null && gain > 0
        ? `<div class="r-tax-v t-r">${fmt(taxImpact)}</div><div class="r-tax-s">est. ${TAX_RATE * 100}% rate</div>`
        : `<div class="r-tax-v t-n">$0</div><div class="r-tax-s">No impact</div>`;

      // Per-asset smart recommendation — varies by gain profile + budgets
      const g = gain !== null ? gain : 0;
      let smartAct = defaultAct;
      if (defaultAct === 'cash') {
        if (g < 0) {
          smartAct = 'cash';                            // any loss → harvest in cash
        } else if (g >= 7000) {
          smartAct = 'hold';                            // very large gain → defer
        } else if (g === 0) {
          smartAct = 'cash';                            // zero gain (money market etc) → cash, no QCD benefit
        } else if (g > 0 && qcdAllocated < qcdBudget) {
          smartAct = 'qcd';                             // positive gain, within budget → QCD
          qcdAllocated += value;
        } else if (ikAllocated < ikBudget) {
          smartAct = 'ik';                              // remaining gain assets → in-kind
          ikAllocated += value;
        } else {
          smartAct = 'cash';                            // budgets exhausted → cash
        }
      }

      // Use symbol_idx as unique key so duplicate symbols (backend quirk) don't collide
      const rowKey = `${a.symbol}_${a._idx}`;
      rmdActionState[rowKey] = { orig: smartAct, cur: smartAct, value, gain: g, symbol: a.symbol };

      // Border color + agent label by smartAct
      const borderCls  = smartAct === 'ik' ? 'bl-ik' : smartAct === 'qcd' ? 'bl-qcd' : smartAct === 'hold' ? 'bl-hold' : 'bl-cash';
      const agentLabel = smartAct === 'ik'   ? '<span class="r-as r-as-ik">In-Kind Agent</span>'
                       : smartAct === 'qcd'  ? '<span class="r-as r-as-qcd">QCD Agent</span>'
                       : smartAct === 'hold' ? '<span class="r-as r-as-hold">Hold Agent</span>'
                       : '<span class="r-as r-as-cash">Cash Agent</span>';

      // Gain display
      const gainHtml = gain !== null
        ? `<div class="${gain >= 0 ? 'r-gain-pos' : 'r-gain-neg'}">${gain >= 0 ? '+' : ''}${fmt(gain)}</div><div class="r-gain-sub">${price > 0 ? (gain / (price * qty) * 100).toFixed(1) + '%' : ''}</div>`
        : '<div style="color:#6e7681">—</div>';

      const qIdx = portfolioLineQuestions.length;
      portfolioLineQuestions.push(
        `RMD liquidation: ${a.symbol}, sell ${qty} shares @ $${price} = $${value}. ` +
        `Analyst: ${ad.rating}, 12mo target $${ad.target}. Gain/loss: $${gain}. Why selected?`
      );

      // Main row
      const tr = document.createElement('tr');
      const rowId = rowKey.toLowerCase();
      tr.className = 'rmd-dr';
      tr.id = `rmd-row-${rowId}`;
      tr.innerHTML = `
        <td class="${borderCls}" id="rmd-bl-${rowId}">
          <div style="display:flex;align-items:center;gap:6px">
            <div class="r-tsym">${a.symbol}</div>
            <span class="r-override-chip" id="rmd-chip-${rowId}" style="display:none">OVERRIDE</span>
          </div>
          <div class="r-tname">${a.assetClass || '—'}</div>
          <div class="r-tacct">${acct}</div>
          ${agentLabel}
        </td>
        <td><div class="r-qty-sell">${qty} shares</div><div class="r-qty-held">of ${qty} held</div></td>
        <td style="text-align:right"><div class="r-price">$${price.toLocaleString()}</div></td>
        <td style="text-align:right"><div class="r-liq">${fmt(value)}</div></td>
        <td style="text-align:right">${gainHtml}</td>
        <td>
          <div class="r-acts" data-sym="${a.symbol}">
            <div class="r-a r-qcd  ${smartAct === 'qcd'  ? 'r-sel r-rec' : ''}" onmouseenter="rmdShowTip(event,this,'${a.symbol}','qcd','${smartAct}')"  onmouseleave="rmdHideTip()" onclick="rmdActionPill(this,'${rowKey}','qcd')">🎗️ QCD</div>
            <div class="r-a r-cash ${smartAct === 'cash' ? 'r-sel r-rec' : ''}" onmouseenter="rmdShowTip(event,this,'${a.symbol}','cash','${smartAct}')" onmouseleave="rmdHideTip()" onclick="rmdActionPill(this,'${rowKey}','cash')">💵 Cash</div>
            <div class="r-a r-ik   ${smartAct === 'ik'   ? 'r-sel r-rec' : ''}" onmouseenter="rmdShowTip(event,this,'${a.symbol}','ik','${smartAct}')"   onmouseleave="rmdHideTip()" onclick="rmdActionPill(this,'${rowKey}','ik')">📦 In-Kind</div>
            <div class="r-a r-hold ${smartAct === 'hold' ? 'r-sel r-rec' : ''}" onmouseenter="rmdShowTip(event,this,'${a.symbol}','hold','${smartAct}')" onmouseleave="rmdHideTip()" onclick="rmdActionPill(this,'${rowKey}','hold')">⏸ Hold</div>
          </div>
        </td>
        <td style="text-align:right">${taxHtml}</td>
      `;
      tbody.appendChild(tr);

      // Research sub-row
      const rr = document.createElement('tr');
      rr.className = 'rmd-rr';
      rr.innerHTML = `<td colspan="7">
        <div class="r-research">
          ${noAnalyst
            ? '<span class="r-ar r-ar-n" style="color:#6e7681">No Analyst Data</span>'
            : `<span class="r-ar ${arClass}">${ad.rating}</span>`}
          <div>${targetHtml}</div>
          <div class="r-catalyst">${noAnalyst ? 'No catalyst data available' : ad.catalyst}</div>
          ${noAnalyst ? '' : `<span class="r-src-badge">${ad.firm}</span>`}
          <button class="btn-discuss" style="font-size:9px;padding:2px 8px" onclick="askBotPortfolio(${qIdx})">💬 Discuss</button>
        </div>
      </td>`;
      tbody.appendChild(rr);
    });
  });

  // Total row
  const total     = assets.reduce((s, a) => s + Number(a.value || 0), 0);
  const totalGain = assets.reduce((s, a) => s + (a.gain !== undefined ? Number(a.gain) : 0), 0);
  const totalTax  = assets.reduce((s, a) => s + (Number(a.gain) > 0 ? Number(a.gain) * TAX_RATE : 0), 0);
  const totTr = document.createElement('tr');
  totTr.style.cssText = 'border-top:2px solid #30363d;background:#0d1117';
  totTr.innerHTML = `
    <td colspan="3" style="padding:10px;font-size:11px;font-weight:700;color:#8b949e;text-transform:uppercase;letter-spacing:.5px">Total · ${assets.length} assets</td>
    <td style="text-align:right;padding:10px;font-size:13px;font-weight:800;color:#e6edf3">${fmt(total)}</td>
    <td style="text-align:right;padding:10px;font-size:12px;font-weight:700" class="${totalGain >= 0 ? 'r-gain-pos' : 'r-gain-neg'}">${totalGain >= 0 ? '+' : ''}${fmt(totalGain)}</td>
    <td style="padding:10px"></td>
    <td style="text-align:right;padding:10px;font-size:12px;font-weight:700;color:#f85149">${fmt(totalTax)}</td>
  `;
  tbody.appendChild(totTr);
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
    const jsonStr2 = JSON.stringify(data, null, 2);
    const jsonEl2 = document.getElementById('executionJson');
    if (jsonEl2) jsonEl2.textContent = jsonStr2;
    localStorage.setItem('rmd_last_response', jsonStr2);
    localStorage.setItem('rmd_last_response_ts', new Date().toISOString());
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
  const tcEl = document.getElementById('taxCompare');
  const twEl = document.getElementById('taxChartWrap');
  if (tcEl) tcEl.style.display = 'flex';
  if (twEl) twEl.style.display = 'block';

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
  if (nb) {
    nb.innerHTML = '';
    (tax.naiveAssets || []).forEach(a => {
      const gain = Number(a.gain);
      const tr = document.createElement('tr');
      tr.innerHTML = `<td><strong>${a.symbol}</strong></td><td>${a.qty}</td>
        <td style="color:#f85149;font-weight:600">${gain >= 0 ? '+' : ''}${fmt(gain)}</td>`;
      nb.appendChild(tr);
    });
  }

  // Smart assets table
  const sb = document.getElementById('smartAssetsBody');
  if (sb) {
    sb.innerHTML = '';
    (tax.optimizedAssets || []).forEach(a => {
      const gain = Number(a.gain || 0);
      const tr = document.createElement('tr');
      tr.innerHTML = `<td><strong>${a.symbol}</strong></td><td>${a.qty}</td>
        <td style="color:${gain >= 0 ? '#d29922' : '#3fb950'};font-weight:600">${gain >= 0 ? '+' : ''}${fmt(gain)}</td>`;
      sb.appendChild(tr);
    });
  }

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

const REQ_SECTIONS = [
  ['bpBody','bpChev'],['specBody','specChev'],['soBody','soChev'],
  ['archBody','archChev'],['techBody','techChev'],
  ['ragBody','ragChev'],['scaleBody','scaleChev']
];
function toggleReqPanel(panelId, chevronId) {
  const isOpen = document.getElementById(panelId).style.display !== 'none';
  REQ_SECTIONS.forEach(([pid, cid]) => {
    const p = document.getElementById(pid);
    const c = document.getElementById(cid);
    if (p) p.style.display = 'none';
    if (c) c.textContent = '▶';
  });
  if (!isOpen) {
    document.getElementById(panelId).style.display = 'block';
    const chev = document.getElementById(chevronId);
    if (chev) chev.textContent = '▼';
  }
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
