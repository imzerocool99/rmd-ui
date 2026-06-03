# ============================================================
#  RMD Intelligent Agent — Stop All Services
#  Right-click → Run with PowerShell
# ============================================================

Write-Host "Stopping RMD Agent services..." -ForegroundColor Yellow

Get-Process -Name "java"   -ErrorAction SilentlyContinue | Stop-Process -Force
Get-Process -Name "node"   -ErrorAction SilentlyContinue | Stop-Process -Force
Get-Process -Name "ollama" -ErrorAction SilentlyContinue | Stop-Process -Force

Write-Host "All services stopped." -ForegroundColor Green
Start-Sleep -Seconds 2
