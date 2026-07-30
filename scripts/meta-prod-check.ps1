$ErrorActionPreference = "Stop"
$base = if ($env:API_BASE_URL) { $env:API_BASE_URL.TrimEnd("/") } else { "https://crm-production-e81d.up.railway.app" }
$email = if ($env:CHECK_EMAIL) { $env:CHECK_EMAIL } else { "admin@propninja.local" }
$password = $env:CHECK_PASSWORD
if (-not $password) { throw "Set CHECK_PASSWORD (and optionally CHECK_EMAIL / API_BASE_URL) before running." }
$body = @{ email = $email; password = $password } | ConvertTo-Json
$login = Invoke-RestMethod -Uri "$base/api/auth/login" -Method POST -ContentType "application/json" -Body $body -TimeoutSec 30
$token = $login.data.token
if (-not $token) { $token = $login.token }
Write-Host "login_ok=$([bool]$token)"
$h = @{ Authorization = "Bearer $token" }

$dash = Invoke-RestMethod -Uri "$base/api/meta/dashboard" -Headers $h
$pages = Invoke-RestMethod -Uri "$base/api/meta/pages" -Headers $h
$leads = Invoke-RestMethod -Uri "$base/api/meta/leads?page=1&pageSize=5" -Headers $h
$hist = Invoke-RestMethod -Uri "$base/api/meta/sync-history?page=1&pageSize=10" -Headers $h

$pageItems = $pages.data.items
if (-not $pageItems) { $pageItems = $pages.data }
$pageSummary = @()
foreach ($p in $pageItems) {
  $pageSummary += [ordered]@{
    name = $p.name
    isActive = $p.isActive
    isSelected = $p.isSelected
    leadgenSubscribed = $p.leadgenSubscribed
    hasToken = $p.hasToken
    pageId = $p.pageId
  }
}

$result = [ordered]@{
  leadsKpi = $dash.data.leads
  counts = $dash.data.counts
  connection = $dash.data.connection
  pages = $pageSummary
  metaLeadsTotal = $leads.data.total
  syncHistory = $hist.data.items
}
$result | ConvertTo-Json -Depth 8
