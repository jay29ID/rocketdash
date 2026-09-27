# Switches on Rocket League's Stats API by setting PacketSendRate=5.
# Creates the config file if the game doesn't have one yet.
param([string]$ConfigDir)

if (-not $ConfigDir) {
  $ConfigDir = @(
    "$env:ProgramFiles\Epic Games\rocketleague\TAGame\Config",
    "${env:ProgramFiles(x86)}\Steam\steamapps\common\rocketleague\TAGame\Config"
  ) | Where-Object { Test-Path $_ } | Select-Object -First 1
}
if (-not $ConfigDir) { Write-Host 'Could not find the Rocket League Config folder.' -ForegroundColor Red; exit 1 }

$ini = Join-Path $ConfigDir 'TAStatsAPI.ini'
if (-not (Test-Path $ini)) { $ini = Join-Path $ConfigDir 'DefaultStatsAPI.ini' }
$section = '[TAGame.MatchStatsExporter_TA]'
$text = ''
if (Test-Path $ini) { $text = [IO.File]::ReadAllText($ini) }

if ($text -match '(?m)^\s*PacketSendRate\s*=') {
  $text = $text -replace '(?m)^(\s*PacketSendRate\s*=\s*)\d+', '${1}5'
} elseif ($text.Contains($section)) {
  $text = $text.Replace($section, $section + "`r`nPacketSendRate=5")
} else {
  $text = ($text.TrimEnd() + "`r`n`r`n$section`r`nPacketSendRate=5`r`nPort=49123`r`nWebPort=49124`r`n").TrimStart()
}
[IO.File]::WriteAllText($ini, $text)
Write-Host "Stats API switched on in $ini" -ForegroundColor Green
Write-Host ''
Get-Content $ini
