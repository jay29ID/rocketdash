# The recorder reads MMR from the game's log automatically; use this only to fill gaps.
# Asks for your current MMR and saves it with the time to Documents\RLStats\mmr.csv.
# Run it at the end of a session. Press Enter to skip a playlist.
param([string]$OutDir = (Join-Path ([Environment]::GetFolderPath('MyDocuments')) 'RLStats'))

$Utf8NoBom = New-Object System.Text.UTF8Encoding($false)
if (-not (Test-Path $OutDir)) { [void](New-Item -ItemType Directory -Path $OutDir) }
$csv = Join-Path $OutDir 'mmr.csv'
$header = 'logged_at,player,playlist,mmr,mu,party_size,source'
if ((Test-Path $csv) -and ((Get-Content $csv -TotalCount 1) -ne $header)) {
  Move-Item $csv (Join-Path $OutDir ('mmr-old-' + (Get-Date -Format 'yyyyMMdd-HHmmss') + '.csv'))
}
if (-not (Test-Path $csv)) { [IO.File]::AppendAllText($csv, $header + "`r`n", $Utf8NoBom) }

$player = Read-Host 'Player name (Enter for jay29ID)'
if (-not $player) { $player = 'jay29ID' }
$now = (Get-Date).ToUniversalTime().ToString('o')
$saved = 0
foreach ($pl in 'Ranked Doubles', 'Ranked Duel', 'Ranked Standard') {
  $v = Read-Host "$pl MMR (Enter to skip)"
  if ($v -match '^\s*(\d{1,4})\s*$') {
    [IO.File]::AppendAllText($csv, ('"{0}","{1}","{2}",{3},,,"typed"' -f $now, $player.Replace('"', '""'), $pl, $Matches[1]) + "`r`n", $Utf8NoBom)
    $saved++
  } elseif ($v) { Write-Host "  '$v' isn't a number, skipped." -ForegroundColor Yellow }
}
Write-Host "Saved $saved MMR value(s) to $csv" -ForegroundColor Green
