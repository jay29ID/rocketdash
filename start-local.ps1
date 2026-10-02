<#
  Runs your own copy of the dashboard on this PC. npm start and dashboard.bat both run it when no
  VIEW_KEY or UPLOAD_KEY is set.

  Every start asks for the players and the Rocket League folder (Enter keeps the saved answer).
  The first start makes a random view key and upload key. All of it is kept in data\local.json.
  Then it points the recorder at this copy through Documents\RLStats\upload.json, switches on the
  game's Stats API, starts the site and the RL Stats widget, and opens the dashboard, signed in.
#>
$ErrorActionPreference = 'Stop'
$port = 3000
$utf8 = New-Object System.Text.UTF8Encoding($false)
$dataDir = Join-Path $PSScriptRoot 'data'
$cfgPath = Join-Path $dataDir 'local.json'

function New-Key {
  $b = New-Object byte[] 24
  [Security.Cryptography.RandomNumberGenerator]::Create().GetBytes($b)
  -join ($b | ForEach-Object { $_.ToString('x2') })
}
function Read-Saved([string]$Prompt, [string]$Saved) {
  if ($Saved) { $Prompt += " [$Saved]" }
  $answer = (Read-Host $Prompt).Trim().Trim('"')
  if ($answer) { return $answer } else { return $Saved }
}

[void](New-Item -ItemType Directory -Force -Path $dataDir)
if (Test-Path $cfgPath) { $cfg = Get-Content $cfgPath -Raw | ConvertFrom-Json }
else { $cfg = [pscustomobject]@{ viewKey = New-Key; uploadKey = New-Key } }
foreach ($k in 'players', 'gameDir') { if ($cfg.PSObject.Properties.Name -notcontains $k) { $cfg | Add-Member $k '' } }

do {
  $cfg.players = @((Read-Saved 'Rocket League names to show, comma separated (yours first)' $cfg.players) -split ',' |
    ForEach-Object { $_.Trim() } | Where-Object { $_ }) -join ','
} until ($cfg.players)
do {
  $cfg.gameDir = Read-Saved 'Rocket League folder (the one with TAGame in it)' $cfg.gameDir
  $configDir = Join-Path $cfg.gameDir 'TAGame\Config'
  if (-not (Test-Path $configDir)) { Write-Host "No TAGame\Config folder in $($cfg.gameDir)." -ForegroundColor Red; $cfg.gameDir = '' }
} until ($cfg.gameDir)
[IO.File]::WriteAllText($cfgPath, ($cfg | ConvertTo-Json), $utf8)

# Send this PC's matches here. Asks first if they currently go to another site.
$rlDir = Join-Path ([Environment]::GetFolderPath('MyDocuments')) 'RLStats'
$uploadPath = Join-Path $rlDir 'upload.json'
$upload = [ordered]@{ url = "http://localhost:$port/api/ingest"; key = $cfg.uploadKey }
$current = $null
if (Test-Path $uploadPath) { $current = Get-Content $uploadPath -Raw | ConvertFrom-Json }
if (-not $current -or $current.url -ne $upload.url -or $current.key -ne $upload.key) {
  $write = $true
  if ($current -and $current.url -ne $upload.url) {
    $write = (Read-Host "Matches are uploaded to $($current.url). Send them to this copy instead? (y/n)") -match '^y'
  }
  if ($write) {
    [void](New-Item -ItemType Directory -Force -Path $rlDir)
    [IO.File]::WriteAllText($uploadPath, ($upload | ConvertTo-Json), $utf8)
    Write-Host "Recorder now uploads here. Restart the RL Stats widget if it is running." -ForegroundColor Yellow
  }
}

# The Stats API is the game's live feed the recorder reads. The game only reads it when it starts.
function Test-StatsApi {
  foreach ($n in 'TAStatsAPI.ini', 'DefaultStatsAPI.ini') {
    $ini = Join-Path $configDir $n
    if ((Test-Path $ini) -and ((Get-Content $ini -Raw) -match '(?m)^\s*PacketSendRate\s*=\s*(\d+)')) { return [int]$Matches[1] -gt 0 }
  }
  return $false
}
if (-not (Test-StatsApi)) {
  $enable = Join-Path $PSScriptRoot 'recorder\EnableStatsAPI.ps1'
  try { & $enable -ConfigDir $configDir *> $null } catch { }
  if (-not (Test-StatsApi)) {
    Write-Host 'Switching on the Stats API needs admin rights here. Click Yes on the Windows prompt.' -ForegroundColor Yellow
    try { Start-Process powershell -Verb RunAs -Wait -ArgumentList "-NoProfile -ExecutionPolicy Bypass -File `"$enable`" -ConfigDir `"$configDir`"" } catch { }
  }
  if (-not (Test-StatsApi)) { Write-Host "Could not switch on the Stats API in $configDir." -ForegroundColor Red }
  elseif (Get-Process RocketLeague -ErrorAction SilentlyContinue) { Write-Host 'Stats API switched on. Restart Rocket League so it starts sending stats.' -ForegroundColor Yellow }
  else { Write-Host 'Stats API switched on.' -ForegroundColor Green }
}

$env:PORT = $port; $env:VIEW_KEY = $cfg.viewKey; $env:UPLOAD_KEY = $cfg.uploadKey; $env:PLAYERS = $cfg.players
$server = Start-Process node -ArgumentList ('"' + (Join-Path $PSScriptRoot 'server.js') + '"') -NoNewWindow -PassThru
for ($i = 0; $i -lt 50; $i++) {
  try { [void](Invoke-WebRequest "http://localhost:$port/healthz" -UseBasicParsing -TimeoutSec 1); break } catch { Start-Sleep -Milliseconds 200 }
}

# Start the recorder widget with the same players, unless it is already running.
$m = $null
if ([Threading.Mutex]::TryOpenExisting('Local\RLStatsWidget', [ref]$m)) {
  $m.Dispose()
  Write-Host 'The RL Stats widget is already running. Restart it if you changed the names.'
} else {
  $names = ($cfg.players -split ',' | ForEach-Object { "'" + $_.Replace("'", "''") + "'" }) -join ','
  $widget = (Join-Path $PSScriptRoot 'recorder\RLStatsWidget.ps1').Replace("'", "''")
  Start-Process powershell -WindowStyle Hidden -ArgumentList "-NoProfile -ExecutionPolicy Bypass -STA -WindowStyle Hidden -Command `"& '$widget' -TrackedPlayers $names`""
}

$link = "http://localhost:$port/s/$($cfg.viewKey)"
Start-Process $link
Write-Host "Dashboard: $link" -ForegroundColor Green
Write-Host 'Press Ctrl+C to stop the site. The widget keeps recording, and uploads wait until the site is back.'
Wait-Process -Id $server.Id
