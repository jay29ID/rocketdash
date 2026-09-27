<#
  Rocket League stats widget: a small always-on-top window that runs the recorder
  (RLStatsRecorder.ps1, which must sit in the same folder) without a console.
  Shows connection status, the live score and stats during a match, today's
  record, your win/loss streak, the last match and your MMR.

  Start it with "RL Stats Widget.bat". Closing the window stops recording.
#>
param([string[]]$TrackedPlayers = @('jay29ID', 'Kobra Kelvin'))

Add-Type -AssemblyName System.Windows.Forms, System.Drawing
[System.Windows.Forms.Application]::EnableVisualStyles()

# Everything the window uses is kept in script scope ($script:...), because the recorder
# calls the hooks from inside its own functions, whose local variables (score, rows, cols)
# would otherwise shadow the widget's.
$script:here = Split-Path -Parent $MyInvocation.MyCommand.Path

function Show-Fatal([string]$Text) {
  [void][System.Windows.Forms.MessageBox]::Show($Text, 'RL Stats', 'OK', 'Error')
}

# Only one copy at a time, otherwise every match would be saved twice.
$script:mutex = New-Object System.Threading.Mutex($false, 'Local\RLStatsWidget')
if (-not $script:mutex.WaitOne(0)) { Show-Fatal 'RL Stats is already running (check the system tray).'; return }

try {
  . (Join-Path $script:here 'RLStatsRecorder.ps1') -TrackedPlayers $TrackedPlayers -NoLoop
} catch {
  Show-Fatal "Could not load RLStatsRecorder.ps1 from $script:here.`n`n$($_.Exception.Message)"; return
}
$ErrorActionPreference = 'Continue'

# ---- look -------------------------------------------------------------------------------------
function RGB([string]$Hex) { [System.Drawing.ColorTranslator]::FromHtml($Hex) }
$script:C = @{
  Bg = RGB '#12151C'; Panel = RGB '#1A1F2A'; Line = RGB '#262C3A'; Text = RGB '#E6E9EF'; Muted = RGB '#8A93A6'
  Blue = RGB '#4DA3FF'; Orange = RGB '#FF9F43'; Win = RGB '#3DDC84'; Loss = RGB '#FF5C6C'; Amber = RGB '#F5C04E'
}
$script:F = @{
  Small = New-Object System.Drawing.Font('Segoe UI', 8.25)
  Body = New-Object System.Drawing.Font('Segoe UI', 9)
  Bold = New-Object System.Drawing.Font('Segoe UI Semibold', 9)
  Score = New-Object System.Drawing.Font('Segoe UI Semibold', 22)
  Dot = New-Object System.Drawing.Font('Segoe UI', 11)
}
$script:Bullet = [string][char]0x25CF
$script:Dash = [string][char]0x2013

function New-Label([string]$Text, [int]$X, [int]$Y, [int]$W, [int]$H, $Font = $script:F.Body, $Color = $script:C.Text, [string]$Align = 'MiddleLeft') {
  $l = New-Object System.Windows.Forms.Label
  $l.Text = $Text; $l.Location = New-Object System.Drawing.Point($X, $Y); $l.Size = New-Object System.Drawing.Size($W, $H)
  $l.Font = $Font; $l.ForeColor = $Color; $l.BackColor = [System.Drawing.Color]::Transparent
  $l.TextAlign = [System.Drawing.ContentAlignment]::$Align
  return $l
}

# ---- window -----------------------------------------------------------------------------------
$script:form = New-Object System.Windows.Forms.Form
$script:form.Text = 'RL Stats'
$script:form.FormBorderStyle = 'None'
$script:form.StartPosition = 'Manual'
$script:form.ClientSize = New-Object System.Drawing.Size(360, 262)
$script:form.BackColor = $script:C.Bg
$script:form.TopMost = $true
$script:form.ShowInTaskbar = $true

$script:wa = [System.Windows.Forms.Screen]::PrimaryScreen.WorkingArea
$script:form.Location = New-Object System.Drawing.Point(($script:wa.Right - 380), ($script:wa.Bottom - 290))

# header
$script:header = New-Object System.Windows.Forms.Panel
$script:header.Location = New-Object System.Drawing.Point(0, 0); $script:header.Size = New-Object System.Drawing.Size(360, 30); $script:header.BackColor = $script:C.Panel
$script:form.Controls.Add($script:header)
$script:dot = New-Label $script:Bullet 8 4 18 22 $script:F.Dot $script:C.Amber 'MiddleCenter'
$script:status = New-Label 'Starting...' 28 5 200 20 $script:F.Small $script:C.Muted
$script:pin = New-Label 'Pin' 262 5 30 20 $script:F.Small $script:C.Text 'MiddleCenter'
$script:min = New-Label '_' 296 3 28 22 $script:F.Bold $script:C.Muted 'MiddleCenter'
$script:close = New-Label 'x' 326 3 28 22 $script:F.Bold $script:C.Muted 'MiddleCenter'
foreach ($b in $script:pin, $script:min, $script:close) { $b.Cursor = [System.Windows.Forms.Cursors]::Hand }
$script:header.Controls.AddRange(@($script:dot, $script:status, $script:pin, $script:min, $script:close))

# score block
$script:blueName = New-Label 'BLUE' 16 40 110 20 $script:F.Small $script:C.Blue 'MiddleLeft'
$script:orangeName = New-Label 'ORANGE' 234 40 110 20 $script:F.Small $script:C.Orange 'MiddleRight'
$script:score = New-Label ("0 $script:Dash 0") 90 34 180 44 $script:F.Score $script:C.Text 'MiddleCenter'
$script:sub = New-Label 'Waiting for a match' 16 76 328 18 $script:F.Small $script:C.Muted 'MiddleCenter'
$script:form.Controls.AddRange(@($script:blueName, $script:orangeName, $script:score, $script:sub))

# players table
$script:cols = @(@{ K = 'Goals'; T = 'G' }, @{ K = 'Assists'; T = 'A' }, @{ K = 'Shots'; T = 'SH' }, @{ K = 'Saves'; T = 'SV' },
  @{ K = 'Demos'; T = 'D' }, @{ K = 'Boost'; T = 'BST' })
$script:tableTop = 102
$script:sep1 = New-Object System.Windows.Forms.Panel
$script:sep1.Location = New-Object System.Drawing.Point(12, ($script:tableTop - 4)); $script:sep1.Size = New-Object System.Drawing.Size(336, 1); $script:sep1.BackColor = $script:C.Line
$script:form.Controls.Add($script:sep1)
$script:form.Controls.Add((New-Label 'PLAYER' 16 $script:tableTop 120 18 $script:F.Small $script:C.Muted))
for ($i = 0; $i -lt $script:cols.Count; $i++) {
  $script:form.Controls.Add((New-Label $script:cols[$i].T (150 + $i * 33) $script:tableTop 33 18 $script:F.Small $script:C.Muted 'MiddleCenter'))
}
$script:rows = @{}
for ($r = 0; $r -lt $TrackedPlayers.Count -and $r -lt 3; $r++) {
  $y = $script:tableTop + 20 + $r * 22
  $cells = @{ Name = (New-Label $TrackedPlayers[$r] 16 $y 132 20 $script:F.Bold $script:C.Text) }
  $script:form.Controls.Add($cells.Name)
  for ($i = 0; $i -lt $script:cols.Count; $i++) {
    $cells[$script:cols[$i].K] = New-Label '-' (150 + $i * 33) $y 33 20 $script:F.Body $script:C.Text 'MiddleCenter'
    $script:form.Controls.Add($cells[$script:cols[$i].K])
  }
  $script:rows[$TrackedPlayers[$r]] = $cells
}

$script:sep2 = New-Object System.Windows.Forms.Panel
$script:sep2.Location = New-Object System.Drawing.Point(12, 172); $script:sep2.Size = New-Object System.Drawing.Size(336, 1); $script:sep2.BackColor = $script:C.Line
$script:form.Controls.Add($script:sep2)

$script:today = New-Label 'Today: no games yet' 16 178 328 20 $script:F.Body $script:C.Text
$script:streak = New-Label '' 16 198 328 18 $script:F.Small $script:C.Muted
$script:mmrLabel = New-Label 'MMR: queue a ranked game to read it' 16 216 328 18 $script:F.Small $script:C.Muted
$script:form.Controls.AddRange(@($script:today, $script:streak, $script:mmrLabel))

# footer links
$script:openLink = New-Label 'Open data folder' 16 238 110 18 $script:F.Small $script:C.Blue
$script:mmrLink = New-Label 'Type MMR' 132 238 70 18 $script:F.Small $script:C.Blue
foreach ($l in $script:openLink, $script:mmrLink) { $l.Cursor = [System.Windows.Forms.Cursors]::Hand }
$script:form.Controls.AddRange(@($script:openLink, $script:mmrLink))

# tray icon
$script:tray = New-Object System.Windows.Forms.NotifyIcon
$script:tray.Icon = [System.Drawing.SystemIcons]::Application
$script:tray.Text = 'RL Stats'
$script:tray.Visible = $true
$script:menu = New-Object System.Windows.Forms.ContextMenuStrip
[void]$script:menu.Items.Add('Show', $null, { $script:form.Show(); $script:form.Activate() })
[void]$script:menu.Items.Add('Open data folder', $null, { Start-Process explorer.exe $OutDir })
[void]$script:menu.Items.Add('Quit', $null, { $script:form.Close() })
$script:tray.ContextMenuStrip = $script:menu
$script:tray.add_DoubleClick({ $script:form.Show(); $script:form.Activate() })

# ---- behaviour --------------------------------------------------------------------------------
$script:Drag = $null
$dragDown = { param($s, $e)
  if ($e.Button -eq 'Left') {
    $p = [System.Windows.Forms.Control]::MousePosition
    $script:Drag = New-Object System.Drawing.Point(($p.X - $script:form.Left), ($p.Y - $script:form.Top))
  } }
$dragMove = { param($s, $e)
  if ($script:Drag -and $e.Button -eq 'Left') {
    $p = [System.Windows.Forms.Control]::MousePosition
    $script:form.Location = New-Object System.Drawing.Point(($p.X - $script:Drag.X), ($p.Y - $script:Drag.Y))
  } }
$dragUp = { $script:Drag = $null }
foreach ($ctl in @($script:form, $script:header, $script:status, $script:dot, $script:score, $script:sub, $script:blueName, $script:orangeName)) {
  $ctl.add_MouseDown($dragDown); $ctl.add_MouseMove($dragMove); $ctl.add_MouseUp($dragUp)
}

function Set-Pin([bool]$On) {
  $script:form.TopMost = $On
  if ($On) { $script:pin.ForeColor = $script:C.Blue } else { $script:pin.ForeColor = $script:C.Muted }
}
$script:pin.add_Click({ Set-Pin (-not $script:form.TopMost) })
$script:min.add_Click({ $script:form.Hide(); $script:tray.ShowBalloonTip(2000, 'RL Stats', 'Still recording. Double-click the tray icon to bring it back.', 'Info') })
$script:close.add_Click({ $script:form.Close() })
$script:openLink.add_Click({ if (-not (Test-Path $OutDir)) { [void](New-Item -ItemType Directory -Path $OutDir) }; Start-Process explorer.exe $OutDir })
$script:mmrLink.add_Click({ Start-Process powershell.exe -ArgumentList @('-NoProfile', '-ExecutionPolicy', 'Bypass', '-File', ('"' + (Join-Path $script:here 'LogMMR.ps1') + '"')) })

function Set-Status([string]$Text, $Color) { $script:status.Text = $Text; $script:dot.ForeColor = $Color }

function Format-Clock($Seconds, $Overtime) {
  if ($null -eq $Seconds) { return '' }
  $t = [int]$Seconds
  $s = '{0}:{1:00}' -f [math]::Floor($t / 60), ($t % 60)
  if ($Overtime) { return "+$s OT" }
  return $s
}

# Live rows are the game's objects (Name, Goals, Boost...); saved rows are the recorder's
# dictionaries (name, goals, avg_boost...).
function Get-Field($Obj, [string]$Name) {
  if ($null -eq $Obj) { return $null }
  if ($Obj -is [System.Collections.IDictionary]) { return $Obj[$Name] }
  return Get-Prop $Obj $Name
}

function Set-PlayerRows($Players, [string]$Mode) {
  foreach ($name in @($script:rows.Keys)) {
    $cells = $script:rows[$name]
    $p = $null
    foreach ($x in $Players) {
      $n = Get-Field $x 'Name'; if ($null -eq $n) { $n = Get-Field $x 'name' }
      if ($n -eq $name) { $p = $x; break }
    }
    foreach ($col in $script:cols) {
      $v = $null
      if ($p) {
        if ($Mode -eq 'live') { $v = Get-Field $p $col.K }
        elseif ($col.K -eq 'Boost') { $v = Get-Field $p 'avg_boost' }
        else { $v = Get-Field $p $col.K.ToLower() }
      }
      if ($null -eq $v) { $cells[$col.K].Text = '-' } else { $cells[$col.K].Text = [string][math]::Round([double]$v) }
    }
    $cells.Name.ForeColor = $script:C.Text
    if ($p) {
      $team = Get-Field $p 'TeamNum'; if ($null -eq $team) { $team = Get-Field $p 'team' }
      if ($team -eq 0) { $cells.Name.ForeColor = $script:C.Blue } elseif ($team -eq 1) { $cells.Name.ForeColor = $script:C.Orange }
    }
  }
}

# Session numbers come from matches.jsonl so they survive restarts.
$script:History = New-Object System.Collections.ArrayList
function Import-History {
  $file = Join-Path $OutDir 'matches.jsonl'
  if (-not (Test-Path $file)) { return }
  foreach ($line in [IO.File]::ReadAllLines($file)) {
    if (-not $line.Trim()) { continue }
    try {
      $o = $line | ConvertFrom-Json
      [void]$script:History.Add(@{ ended = [datetime]::Parse($o.ended_at).ToLocalTime(); result = $o.result
        playlist = $o.playlist; us = $o.team_score; them = $o.opponent_score })
    } catch { }
  }
}

function Update-Session {
  $d = (Get-Date).Date
  $games = @($script:History | Where-Object { $_.ended.Date -eq $d -and ($_.result -eq 'Win' -or $_.result -eq 'Loss') })
  $w = @($games | Where-Object { $_.result -eq 'Win' }).Count
  $l = $games.Count - $w
  if ($games.Count -eq 0) { $script:today.Text = 'Today: no games yet' }
  else { $script:today.Text = ('Today: {0}W {1} {2}L   ({3}% win rate)' -f $w, $script:Dash, $l, [math]::Round(100 * $w / $games.Count)) }

  $decided = @($script:History | Where-Object { $_.result -eq 'Win' -or $_.result -eq 'Loss' })
  $parts = @()
  if ($decided.Count -gt 0) {
    $last = $decided[-1].result; $n = 0
    for ($i = $decided.Count - 1; $i -ge 0 -and $decided[$i].result -eq $last; $i--) { $n++ }
    if ($last -eq 'Win') { $parts += "Win streak: $n" } else { $parts += "Loss streak: $n" }
    $lm = $decided[-1]
    $ago = [math]::Round(((Get-Date) - $lm.ended).TotalMinutes)
    $parts += ('Last: {0} {1}-{2} {3}, {4} min ago' -f $lm.result, $lm.us, $lm.them, $lm.playlist, $ago)
  }
  $script:streak.Text = ($parts -join '   |   ')
}

function Update-Mmr {
  if ($script:MmrSamples.Count -eq 0) { return }
  $latest = $script:MmrSamples[$script:MmrSamples.Count - 1]
  $pl = $latest.playlist
  $todayStr = (Get-Date).ToUniversalTime().ToString('yyyy-MM-dd')
  $first = $script:MmrSamples | Where-Object { $_.playlist -eq $pl -and $_.logged_at.StartsWith($todayStr) } | Select-Object -First 1
  $text = "MMR ($pl): $($latest.mmr)"
  if ($first -and $first.mmr -ne $latest.mmr) {
    $delta = $latest.mmr - $first.mmr
    if ($delta -gt 0) { $text += " (+$delta today)" } else { $text += " ($delta today)" }
  }
  if ($latest.party_size -gt 1) { $text += '  [party queue]' }
  $script:mmrLabel.Text = $text
}

# ---- hooks from the recorder ------------------------------------------------------------------
$script:InMatch = $false
$script:LogHook = {
  param($Text, $Color)
  switch -Wildcard ($Text) {
    'Connected*'   { Set-Status 'Connected, waiting for a match' $script:C.Win }
    'Waiting*'     { Set-Status 'Waiting for Rocket League' $script:C.Amber; $script:InMatch = $false }
    '*closed the connection*' { Set-Status 'Waiting for Rocket League' $script:C.Amber; $script:InMatch = $false }
    'Lost the connection*'    { Set-Status 'Waiting for Rocket League' $script:C.Amber; $script:InMatch = $false }
    'Match started.' { Set-Status 'In a match' $script:C.Blue }
    'Stats API looks switched off*' { Set-Status 'Stats API is off: run Enable Stats API' $script:C.Loss }
    'Could not update*' { $script:tray.ShowBalloonTip(4000, 'RL Stats', $Text, 'Warning') }
  }
}

$script:OnState = {
  param($Data)
  $game = Get-Prop $Data 'Game'
  $teams = @(Get-Prop $game 'Teams' @())
  $b = 0; $o = 0; $bn = 'Blue'; $on = 'Orange'
  foreach ($t in $teams) {
    if ((Get-Prop $t 'TeamNum') -eq 0) { $b = Get-Prop $t 'Score' 0; $bn = Get-Prop $t 'Name' 'BLUE' }
    if ((Get-Prop $t 'TeamNum') -eq 1) { $o = Get-Prop $t 'Score' 0; $on = Get-Prop $t 'Name' 'ORANGE' }
  }
  $script:score.Text = "$b $script:Dash $o"
  $script:blueName.Text = ([string]$bn).ToUpper(); $script:orangeName.Text = ([string]$on).ToUpper()
  $pl = $null; $plId = Get-Prop $game 'PlaylistId'
  if ($null -ne $plId -and $Playlists.ContainsKey([int]$plId)) { $pl = $Playlists[[int]$plId] }
  $script:sub.Text = (@($pl, (Format-Clock (Get-Prop $game 'TimeSeconds') ([bool](Get-Prop $game 'bOvertime' $false)))) | Where-Object { $_ }) -join '   '
  $script:sub.ForeColor = $script:C.Muted
  Set-PlayerRows @(Get-Prop $Data 'Players' @()) 'live'
  if (-not $script:InMatch) { $script:InMatch = $true; Set-Status 'In a match' $script:C.Blue }
}

$script:OnMatchSaved = {
  param($Record)
  $script:InMatch = $false
  [void]$script:History.Add(@{ ended = (Get-Date); result = $Record.result; playlist = $Record.playlist
    us = $Record.team_score; them = $Record.opponent_score })
  $color = $script:C.Muted
  if ($Record.result -eq 'Win') { $color = $script:C.Win } elseif ($Record.result -eq 'Loss') { $color = $script:C.Loss }
  $script:sub.Text = ('{0}  {1}' -f $Record.result.ToUpper(), $Record.playlist)
  $script:sub.ForeColor = $color
  Set-PlayerRows @($Record.players) 'saved'
  Set-Status 'Match saved, waiting for the next one' $script:C.Win
  Update-Session
  if ($Record.result -eq 'Win' -or $Record.result -eq 'Loss') {
    $script:tray.ShowBalloonTip(3000, 'RL Stats', ('{0} {1}-{2} saved' -f $Record.result, $Record.team_score, $Record.opponent_score), 'Info')
  }
}

$script:OnMmr = { param($Sample) Update-Mmr }

# ---- saved window position ----------------------------------------------------------------------
$script:prefsFile = Join-Path $OutDir 'widget.json'
try {
  if (Test-Path $script:prefsFile) {
    $prefs = Get-Content $script:prefsFile -Raw | ConvertFrom-Json
    $pt = New-Object System.Drawing.Point([int]$prefs.x, [int]$prefs.y)
    if ([System.Windows.Forms.Screen]::AllScreens | Where-Object { $_.WorkingArea.Contains($pt) }) { $script:form.Location = $pt }
    Set-Pin ([bool]$prefs.pinned)
  } else { Set-Pin $true }
} catch { Set-Pin $true }

# ---- start ------------------------------------------------------------------------------------
$script:timer = New-Object System.Windows.Forms.Timer
$script:timer.Interval = 100
$script:Ticking = $false
$script:timer.add_Tick({
  if ($script:Ticking) { return }
  $script:Ticking = $true
  try { Step-Connection }
  catch { Set-Status "Error: $($_.Exception.Message)" $script:C.Loss }
  finally { $script:Ticking = $false }
})
# Refresh "x min ago" once a minute.
$script:slow = New-Object System.Windows.Forms.Timer
$script:slow.Interval = 60000
$script:slow.add_Tick({ try { Update-Session } catch { } })

$script:form.add_Shown({
  try {
    Set-Status 'Waiting for Rocket League' $script:C.Amber
    Import-History; Update-Session
    Test-StatsApiConfig
    Initialize-Upload
    Initialize-MmrLog; Update-Mmr
  } catch { Set-Status "Error: $($_.Exception.Message)" $script:C.Loss }
  $script:timer.Start(); $script:slow.Start()
})

$script:form.add_FormClosing({
  $script:timer.Stop(); $script:slow.Stop()
  try {
    if (-not (Test-Path $OutDir)) { [void](New-Item -ItemType Directory -Path $OutDir) }
    $json = ConvertTo-Json -InputObject @{ x = $script:form.Left; y = $script:form.Top; pinned = $script:form.TopMost } -Compress
    [IO.File]::WriteAllText($script:prefsFile, $json, $Utf8NoBom)
  } catch { }
  try { Reset-Connection $null } catch { }
  $script:tray.Visible = $false; $script:tray.Dispose()
})

try {
  [System.Windows.Forms.Application]::Run($script:form)
} catch {
  Show-Fatal "RL Stats stopped because of an error:`n`n$($_.Exception.Message)"
} finally {
  $script:mutex.ReleaseMutex()
}
