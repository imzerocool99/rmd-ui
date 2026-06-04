const API = 'http://localhost:8085';
let agentContext = '';
let agentData = null;
let currentTab = 'dashboard';
let portfolioChart = null;
let performanceChart = null;
let rmdChart = null;
let reinvestChart = null;

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

// ── Run Agent ─────────────────────────────────────────────────────────
async function runAgent() {
  const btn = document.getElementById('runBtn');
  btn.disabled = true;
  btn.innerHTML = '<span class="spinner"></span> Running Agent...';

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
    alert('Agent run failed. Is the backend running on port 8085?');
  } finally {
    btn.disabled = false;
    btn.innerHTML = '▶ Run Agent';
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
  const sv = document.getElementById('strategyValue');
  sv.textContent = strategy === 'sell' ? 'CASH SALE' : 'IN-KIND TRANSFER';
  sv.className = 'card-value ' + (strategy === 'sell' ? 'orange' : 'green');
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
    .join('');
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
      sep.innerHTML = `<td colspan="7" style="background:#1c2128;color:#58a6ff;font-size:11px;font-weight:700;text-transform:uppercase;letter-spacing:1px;padding:6px 12px;">${cls}</td>`;
      tbody.appendChild(sep);
      lastClass = cls;
    }

    const tr = document.createElement('tr');
    tr.innerHTML = `
      <td><strong>${p.symbol}</strong></td>
      <td style="color:#8b949e;font-size:11px">${cls}</td>
      <td>${p.qty}</td>
      <td>$${Number(p.price).toLocaleString()}</td>
      <td>$${value.toLocaleString()}</td>
      <td style="color:${gain >= 0 ? '#3fb950' : '#f85149'}">${gain >= 0 ? '+' : ''}$${gain.toLocaleString()}</td>
      <td>${isSelected ? '<span class="badge sell">Liquidating</span>' : '<span class="badge hold">Hold</span>'}</td>
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
      datasets: [{
        label: 'Gain / Loss ($)',
        data: portfolio.map(p => Number(p.gain)),
        backgroundColor: portfolio.map(p => Number(p.gain) >= 0 ? '#238636' : '#da3633'),
        borderRadius: 6
      }]
    },
    options: {
      responsive: true,
      plugins: { legend: { display: false } },
      scales: {
        x: { ticks: { color: '#8b949e' }, grid: { color: '#21262d' } },
        y: { ticks: { color: '#8b949e' }, grid: { color: '#21262d' } }
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

    const tr = document.createElement('tr');
    tr.innerHTML = `
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
    <td colspan="3" style="font-weight:700;color:#c9d1d9">Total</td>
    <td style="font-weight:700;color:#58a6ff">$${total.toLocaleString('en-US',{minimumFractionDigits:2})}</td>
    <td style="color:${totalGain >= 0 ? '#d29922' : '#3fb950'};font-weight:700">${totalGain >= 0 ? '+' : ''}$${totalGain.toFixed(2)}</td>
    <td></td>
  `;
  tbody.appendChild(tr);
}

function resolveStatus(status) {
  switch ((status || '').toLowerCase()) {
    case 'filled':
      return { badge: 'done',   label: '✅ Order Filled',    tooltip: 'Trade confirmed filled on the market' };
    case 'new':
    case 'pending_new':
    case 'accepted':
      return { badge: 'inkind', label: '🔄 Order Placed',    tooltip: 'Order submitted to Alpaca — awaiting fill' };
    case 'simulated':
      return { badge: 'sim',    label: '⚠️ POC Simulated',   tooltip: 'Paper trade simulated locally for demo — no real order placed' };
    case 'selected':
    default:
      return { badge: 'hold',   label: '📋 Ready to Execute', tooltip: 'Agent selected this asset for liquidation — pending execution' };
  }
}

function renderRMDChart(rmd, liquidated) {
  const ctx = document.getElementById('rmdChart').getContext('2d');
  if (rmdChart) rmdChart.destroy();

  const coverage = Math.min(liquidated, rmd);
  const shortfall = Math.max(0, rmd - liquidated);

  rmdChart = new Chart(ctx, {
    type: 'bar',
    data: {
      labels: ['RMD Requirement', 'Assets Liquidated', 'Coverage', 'Shortfall'],
      datasets: [{
        data: [rmd, liquidated, coverage, shortfall],
        backgroundColor: ['#58a6ff', '#3fb950', '#3fb950', '#f85149'],
        borderRadius: 6
      }]
    },
    options: {
      indexAxis: 'y',
      responsive: true,
      plugins: { legend: { display: false } },
      scales: {
        x: {
          ticks: { color: '#8b949e', callback: v => '$' + v.toLocaleString() },
          grid: { color: '#21262d' }
        },
        y: { ticks: { color: '#8b949e' }, grid: { color: '#21262d' } }
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
  document.getElementById('taxChart').style.display = 'block';

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
      labels: ['Naive Tax Bill', 'Agent Tax Bill', 'Tax Saved'],
      datasets: [{
        data: [tax.naiveTaxBill, tax.smartTaxBill, tax.taxSaved],
        backgroundColor: ['#da3633', '#238636', '#58a6ff'],
        borderRadius: 6
      }]
    },
    options: {
      responsive: true,
      plugins: { legend: { display: false } },
      scales: {
        x: { ticks: { color: '#8b949e' }, grid: { color: '#21262d' } },
        y: {
          ticks: { color: '#8b949e', callback: v => '$' + v.toLocaleString() },
          grid: { color: '#21262d' }
        }
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
