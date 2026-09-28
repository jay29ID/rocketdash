# One-time setup for the RL Stats widget, then starts it. Safe to run again at any time.
#   1. copies the recorder into %LOCALAPPDATA%\RLStats\app
#   2. copies upload.json to Documents\RLStats if it isn't there yet, so matches reach the dashboard
#   3. checks Rocket League's Stats API is on, and offers to switch it on (Windows asks for permission)
#   4. puts an "RL Stats" shortcut on the desktop
#   5. starts the widget
param([switch]$NoStart)

Add-Type -AssemblyName System.Windows.Forms
function Say([string]$Text, [string]$Icon = 'Information') {
  [void][System.Windows.Forms.MessageBox]::Show($Text, 'RL Stats setup', 'OK', $Icon)
}
function Ask([string]$Text) {
  return [System.Windows.Forms.MessageBox]::Show($Text, 'RL Stats setup', 'YesNo', 'Warning') -eq 'Yes'
}

$src = $PSScriptRoot
$app = Join-Path $env:LOCALAPPDATA 'RLStats\app'
$data = Join-Path ([Environment]::GetFolderPath('MyDocuments')) 'RLStats'

try {
  # 1. files (skip copying onto itself when run from the installed folder)
  if (-not (Test-Path $app)) { [void](New-Item -ItemType Directory -Path $app) }
  if ((Resolve-Path $src).Path.TrimEnd('\') -ne (Resolve-Path $app).Path.TrimEnd('\')) {
    Get-ChildItem -Path $src -File | Where-Object { $_.Name -ne 'upload.json' } |
      ForEach-Object { Copy-Item $_.FullName (Join-Path $app $_.Name) -Force }
  }

  # 2. uploads
  if (-not (Test-Path $data)) { [void](New-Item -ItemType Directory -Path $data) }
  $upload = Join-Path $src 'upload.json'
  if ((Test-Path $upload) -and -not (Test-Path (Join-Path $data 'upload.json'))) {
    Copy-Item $upload (Join-Path $data 'upload.json')
  }

  # 3. Stats API
  $roots = @()
  $dat = Join-Path $env:ProgramData 'Epic\UnrealEngineLauncher\LauncherInstalled.dat'
  if (Test-Path $dat) {
    try {
      $roots += @((Get-Content $dat -Raw | ConvertFrom-Json).InstallationList |
        Where-Object { $_.AppName -eq 'Sugar' } | ForEach-Object { $_.InstallLocation })
    } catch { }
  }
  $roots += "$env:ProgramFiles\Epic Games\rocketleague", "${env:ProgramFiles(x86)}\Steam\steamapps\common\rocketleague"
  $config = $roots | ForEach-Object { Join-Path $_ 'TAGame\Config' } | Where-Object { Test-Path $_ } | Select-Object -First 1

  function Test-StatsOn($Dir) {
    foreach ($n in 'TAStatsAPI.ini', 'DefaultStatsAPI.ini') {
      $ini = Join-Path $Dir $n
      if ((Test-Path $ini) -and ((Get-Content $ini -Raw) -match '(?m)^\s*PacketSendRate\s*=\s*(\d+)')) { return [int]$Matches[1] -gt 0 }
    }
    return $false
  }

  if (-not $config) {
    Say "Couldn't find Rocket League's install folder, so the stats feed wasn't checked.`n`nIf the widget says ""Stats API is off"", run ""Enable Stats API.bat"" from:`n$app" 'Warning'
  } elseif (-not (Test-StatsOn $config)) {
    $open = ''
    if (Get-Process RocketLeague -ErrorAction SilentlyContinue) { $open = "`n`nRocket League is open. Close it first, because it only reads this setting when it starts." }
    if (Ask "Rocket League's stats feed is switched off, so no matches can be recorded.`n`nSwitch it on now? Windows will ask for permission.$open") {
      try {
        Start-Process powershell.exe -Verb RunAs -Wait -WindowStyle Hidden -ArgumentList @('-NoProfile', '-ExecutionPolicy', 'Bypass',
          '-File', ('"' + (Join-Path $app 'EnableStatsAPI.ps1') + '"'), '-ConfigDir', ('"' + $config + '"'))
        if (Test-StatsOn $config) { Say 'Stats feed switched on. If Rocket League was open, restart it before you play.' }
        else { Say "The stats feed still looks switched off. Run ""Enable Stats API.bat"" from:`n$app" 'Warning' }
      } catch {
        Say 'The stats feed was not switched on, because Windows permission was declined. Run setup again to retry.' 'Warning'
      }
    }
  }

  # 4. desktop shortcut straight to the widget (no console window)
  try {
    $lnk = Join-Path ([Environment]::GetFolderPath('Desktop')) 'RL Stats.lnk'
    $shell = New-Object -ComObject WScript.Shell
    $sc = $shell.CreateShortcut($lnk)
    $sc.TargetPath = Join-Path $env:SystemRoot 'System32\WindowsPowerShell\v1.0\powershell.exe'
    $sc.Arguments = '-NoProfile -ExecutionPolicy Bypass -WindowStyle Hidden -STA -File "' + (Join-Path $app 'RLStatsWidget.ps1') + '"'
    $sc.WorkingDirectory = $app
    $sc.WindowStyle = 7
    $sc.Description = 'Record Rocket League stats'
    $sc.Save()
  } catch { }

  # 5. start
  if (-not $NoStart) {
    Start-Process powershell.exe -WindowStyle Hidden -WorkingDirectory $app -ArgumentList @('-NoProfile', '-ExecutionPolicy', 'Bypass',
      '-WindowStyle', 'Hidden', '-STA', '-File', ('"' + (Join-Path $app 'RLStatsWidget.ps1') + '"'))
  }
} catch {
  Say "RL Stats setup stopped: $($_.Exception.Message)" 'Error'
}
