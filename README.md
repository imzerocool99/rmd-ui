# RMD Intelligent Agent — Frontend UI

Dashboard UI for the Intelligent RMD Liquidation Agent. Built with HTML5, Chart.js and vanilla JavaScript.

**Branch:** `feature/local-poc-ui` | **Port:** `4500`

---

## What This Shows

| Tab | Description |
|-----|-------------|
| **Dashboard** | RMD amount, strategy, portfolio allocation chart by asset class, AI explanation |
| **Portfolio** | All 31 holdings grouped by asset class with gain/loss and agent action |
| **Agent Results** | Selected assets for liquidation + RMD coverage chart + full JSON response |
| **💡 Reinvestment** | Money flow diagram → bank → 7 reinvestment products + AI advice + allocation chart |
| **📊 Business Value** | Before/After comparison, 6 business values from POC doc, agent loop, KPIs |
| **AI Assistant** | Chat with local Ollama AI about your RMD, tax impact, asset selection |
| **Logs** | Real-time agent execution logs |

---

## Prerequisites

### 1. Node.js
```powershell
winget install OpenJS.NodeJS --accept-package-agreements --accept-source-agreements
```
Verify: `node -v`

### 2. Backend (rmd-agent) must be running
See [rmd-agent repo](https://github.com/imzerocool99/rmd-agent) for backend setup.

### 3. Ollama (for AI chat)
```powershell
# Install Ollama
winget install Ollama.Ollama --accept-package-agreements --accept-source-agreements

# Pull Phi-3 model
ollama pull phi3
```

---

## Installation & Run

```powershell
# 1. Clone the repo
git clone https://github.com/imzerocool99/rmd-ui.git
cd rmd-ui

# 2. Checkout the POC branch
git checkout feature/local-poc-ui

# 3. Install dependencies
npm install

# 4. Start the frontend server
npx http-server ./ -p 4500 --cors
```

Frontend available at **http://localhost:4500**

---

## Full Local Setup (All Services)

Open **3 terminal windows** and run:

```
Terminal 1 — Ollama AI (starts automatically after install)
  ollama serve                                              → port 11434

Terminal 2 — Backend
  cd rmd-agent
  java -jar target/rmd-agent-1.0.0.jar                    → port 8085

Terminal 3 — Frontend
  cd rmd-ui
  npx http-server ./ -p 4500 --cors                       → port 4500
```

Then open your browser: **http://localhost:4500**

---

## How to Use the App

1. **Enter client profile** in the left sidebar (age, IRA balance, preference)
2. Click **▶ Run Agent** — the AI agent runs the full pipeline in seconds
3. View results across all tabs:
   - **Dashboard** — summary cards + portfolio doughnut chart
   - **Portfolio** — full holdings table by asset class
   - **Agent Results** — which assets were selected + tax savings vs naive approach
   - **Reinvestment** — where to put the RMD cash (bank + product suggestions)
   - **Business Value** — showcase for stakeholders and demos
4. **AI Assistant tab** — ask questions like:
   - *"Why were these assets selected?"*
   - *"What is my tax impact?"*
   - *"Should I choose cash or in-kind?"*

---

## Quick Presets (Sidebar)

| Preset | Age | Balance |
|--------|-----|---------|
| Conservative | 72 | $300K |
| Moderate | 75 | $500K |
| High Net Worth | 80 | $1M |

---

## Project Structure

```
rmd-ui/
├── index.html                  # Main SPA — 7 tabs
├── style.css                   # Dark financial theme
├── app.js                      # All JavaScript — API calls, charts, rendering
├── package.json                # http-server dependency
└── RMD_Architecture_Plan.html  # Full architecture & tech stack document
```

---

## Tech Stack

| Component | Technology | Cost |
|-----------|-----------|------|
| UI | HTML5 / CSS3 / Vanilla JS | Free |
| Charts | Chart.js 4.5 | Free |
| Server | http-server (npx) | Free |
| AI Chat | Ollama + Phi-3 via backend | Free |

**Total cost: $0**

---

## Backend API (consumed by this UI)

Base URL: `http://localhost:8085`

| Endpoint | Used for |
|----------|---------|
| `POST /agent/run` | Run the full agent pipeline |
| `GET /agent/logs` | Real-time logs tab |
| `GET /agent/portfolio` | Portfolio refresh |
| `POST /agent/chat` | AI Assistant tab |

---

## Architecture Reference

See `RMD_Architecture_Plan.html` in this repo for the full:
- System architecture diagram
- Component breakdown
- Tech stack comparison (free vs paid)
- Ollama installation guide
- Agent execution flow (SENSE→THINK→PLAN→ACT→REPORT)
- Business value & KPIs
