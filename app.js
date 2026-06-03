const API = 'http://localhost:8085';
let agentContext = '';
let portfolioChart = null;
let performanceChart = null;
let rmdChart = null;

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
function showTab(name) {
  document.querySelectorAll('.tab-content').forEach(t => t.classList.remove('active'));
  document.querySelectorAll('.tab').forEach(t => t.classList.remove('active'));
  document.getElementById(`tab-${name}`).classList.add('active');
  event.target.classList.add('active');
  if (name === 'logs') loadLogs();
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
    renderResults(data);
    agentContext = buildContext(data, body);
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

  // Explanation
  document.getElementById('explanationBox').textContent = data.explanation || 'No explanation returned.';
  document.getElementById('reasoningBox').textContent = '🤖 AI Reasoning: ' + (data.reasoning || '');

  // Portfolio chart
  renderPortfolioChart(portfolio);

  // Holdings table
  renderHoldingsTable(portfolio, assets);

  // Selected assets table
  renderSelectedTable(assets);

  // RMD coverage chart
  renderRMDChart(rmd, totalLiquidated);

  // JSON raw output
  document.getElementById('executionJson').textContent = JSON.stringify(data, null, 2);
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
      datasets: [{ data: values, backgroundColor: colors.slice(0, labels.length), borderColor: '#0d1117', borderWidth: 3 }]
    },
    options: {
      responsive: true,
      plugins: {
        legend: { position: 'bottom', labels: { color: '#8b949e', font: { size: 11 }, boxWidth: 12 } },
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

function renderSelectedTable(assets) {
  const tbody = document.getElementById('selectedBody');
  tbody.innerHTML = '';
  assets.forEach(a => {
    const tr = document.createElement('tr');
    tr.innerHTML = `
      <td><strong>${a.symbol}</strong></td>
      <td>${a.qty} shares</td>
      <td>$${Number(a.price).toLocaleString()}</td>
      <td>$${Number(a.value).toLocaleString()}</td>
      <td><span class="badge done">✓ Executed</span></td>
    `;
    tbody.appendChild(tr);
  });
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

// ── Chat ──────────────────────────────────────────────────────────────
async function sendChat() {
  const input = document.getElementById('chatInput');
  const msg = input.value.trim();
  if (!msg) return;
  input.value = '';
  appendChat('user', msg);
  const loading = appendChat('loading', '⏳ Thinking...');

  try {
    const res = await fetch(`${API}/agent/chat`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ message: msg, context: agentContext })
    });
    const data = await res.json();
    loading.remove();
    appendChat('assistant', data.reply);
  } catch (e) {
    loading.remove();
    appendChat('assistant', 'Could not reach the AI assistant. Make sure the backend is running on port 8085.');
  }
}

function askQuick(q) {
  document.getElementById('chatInput').value = q;
  sendChat();
}

function appendChat(role, text) {
  const box = document.getElementById('chatMessages');
  const div = document.createElement('div');
  div.className = `chat-msg ${role}`;
  div.textContent = text;
  box.appendChild(div);
  box.scrollTop = box.scrollHeight;
  return div;
}
