<#
  Runs your own copy of the dashboard on this PC. npm start and dashboard.bat both run it when no
  VIEW_KEY or UPLOAD_KEY is set.

  Every start asks which players to show (Enter keeps the last list). The first start makes a
  random view key and upload key, kept in data\local.json, and points the recorder at this copy
  through Documents\RLStats\upload.json. Then it starts the site and opens it, signed in.
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

[void](New-Item -ItemType Directory -Force -Path $dataDir)
if (Test-Path $cfgPath) { $cfg = Get-Content $cfgPath -Raw | ConvertFrom-Json }
else { $cfg = [pscustomobject]@{ viewKey = New-Key; uploadKey = New-Key; players = '' } }

$ask = 'Rocket League names to show, comma separated (yours first)'
if ($cfg.players) { $ask += " [$($cfg.players)]" }
do {
  $answer = @((Read-Host $ask) -split ',' | ForEach-Object { $_.Trim() } | Where-Object { $_ }) -join ','
  if ($answer) { $cfg.players = $answer }
} until ($cfg.players)
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

$env:PORT = $port; $env:VIEW_KEY = $cfg.viewKey; $env:UPLOAD_KEY = $cfg.uploadKey; $env:PLAYERS = $cfg.players
$server = Start-Process node -ArgumentList ('"' + (Join-Path $PSScriptRoot 'server.js') + '"') -NoNewWindow -PassThru
for ($i = 0; $i -lt 50; $i++) {
  try { [void](Invoke-WebRequest "http://localhost:$port/healthz" -UseBasicParsing -TimeoutSec 1); break } catch { Start-Sleep -Milliseconds 200 }
}
$link = "http://localhost:$port/s/$($cfg.viewKey)"
Start-Process $link
Write-Host "Dashboard: $link" -ForegroundColor Green
Write-Host 'Press Ctrl+C to stop.'
Wait-Process -Id $server.Id
