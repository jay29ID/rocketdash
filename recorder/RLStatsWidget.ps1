<#
  Rocket League stats widget: a small always-on-top window that runs the recorder
  (RLStatsRecorder.ps1, which must sit in the same folder) without a console.
  Shows connection status, the live score and stats during a match, today's
  record, your win/loss streak, the last match and your MMR.

  Start it with "RL Stats Widget.bat". Closing the window stops recording.
#>
param([string[]]$TrackedPlayers = @('jay29ID', 'Kobra Kelvin'), [switch]$NoUpdate)

Add-Type -AssemblyName System.Windows.Forms, System.Drawing
[System.Windows.Forms.Application]::EnableVisualStyles()

# Everything the window uses is kept in script scope ($script:...), because the recorder
# calls the hooks from inside its own functions, whose local variables (score, rows, cols)
# would otherwise shadow the widget's.
$script:here = Split-Path -Parent $MyInvocation.MyCommand.Path

# ---- loading splash ---------------------------------------------------------------------------
# While the widget updates itself and reads its history, a small window with a spinning wheel sits
# where the widget will appear. It runs on its own thread so it keeps spinning while this one works.
$script:splash = $null
function Start-Splash {
  $sync = [hashtable]::Synchronized(@{ Done = $false })
  $rs = [runspacefactory]::CreateRunspace(); $rs.ApartmentState = 'STA'; $rs.ThreadOptions = 'ReuseThread'; $rs.Open()
  $ps = [powershell]::Create(); $ps.Runspace = $rs
  [void]$ps.AddScript({
    param($Sync, $Prefs)
    Add-Type -AssemblyName System.Windows.Forms, System.Drawing
    $f = New-Object System.Windows.Forms.Form
    $f.FormBorderStyle = 'None'; $f.StartPosition = 'Manual'; $f.ShowInTaskbar = $false; $f.TopMost = $true
    $f.ClientSize = New-Object System.Drawing.Size(360, 262)
    $f.BackColor = [System.Drawing.ColorTranslator]::FromHtml('#12151C')
    $wa = [System.Windows.Forms.Screen]::PrimaryScreen.WorkingArea
    $f.Location = New-Object System.Drawing.Point(($wa.Right - 380), ($wa.Bottom - 290))
    try {
      if (Test-Path $Prefs) {
        $p = Get-Content $Prefs -Raw | ConvertFrom-Json
        $pt = New-Object System.Drawing.Point([int]$p.x, [int]$p.y)
        if ([System.Windows.Forms.Screen]::AllScreens | Where-Object { $_.WorkingArea.Contains($pt) }) { $f.Location = $pt }
      }
    } catch { }
    $state = @{ Angle = 0; Ticks = 0 }
    $blue = [System.Drawing.ColorTranslator]::FromHtml('#4DA3FF'); $track = [System.Drawing.ColorTranslator]::FromHtml('#262C3A')
    $muted = [System.Drawing.ColorTranslator]::FromHtml('#8A93A6')
    $font = New-Object System.Drawing.Font('Segoe UI', 9)
    $f.GetType().GetProperty('DoubleBuffered', [Reflection.BindingFlags]'NonPublic,Instance').SetValue($f, $true, $null)
    $f.add_Paint({
      param($s, $e)
      $g = $e.Graphics; $g.SmoothingMode = 'AntiAlias'
      $r = New-Object System.Drawing.Rectangle(160, 96, 40, 40)
      $pen1 = New-Object System.Drawing.Pen($track, 4); $g.DrawEllipse($pen1, $r); $pen1.Dispose()
      $pen2 = New-Object System.Drawing.Pen($blue, 4); $pen2.StartCap = 'Round'; $pen2.EndCap = 'Round'
      $g.DrawArc($pen2, $r, $state.Angle, 90); $pen2.Dispose()
      $sf = New-Object System.Drawing.StringFormat; $sf.Alignment = 'Center'
      $b = New-Object System.Drawing.SolidBrush($muted)
      $g.DrawString('Loading RL Stats...', $font, $b, (New-Object System.Drawing.RectangleF(0, 150, 360, 20)), $sf); $b.Dispose()
    })
    $t = New-Object System.Windows.Forms.Timer; $t.Interval = 30
    $t.add_Tick({
      $state.Angle = ($state.Angle + 12) % 360; $state.Ticks++
      if ($Sync.Done -or $state.Ticks -gt 2000) { $t.Stop(); $f.Close() } else { $f.Invalidate() }
    })
    $f.add_Shown({ $t.Start() })
    [System.Windows.Forms.Application]::Run($f)
  }).AddArgument($sync).AddArgument((Join-Path ([Environment]::GetFolderPath('MyDocuments')) 'RLStats\widget.json'))
  $script:splash = @{ Sync = $sync; PS = $ps; Handle = $ps.BeginInvoke() }
}
function Stop-Splash {
  if ($script:splash) { $script:splash.Sync.Done = $true; $script:splash = $null }
}
try { Start-Splash } catch { }

function Show-Fatal([string]$Text) {
  Stop-Splash
  [void][System.Windows.Forms.MessageBox]::Show($Text, 'RL Stats', 'OK', 'Error')
}

# Self-update: check the dashboard site for newer files, swap them in, and restart once.
# This runs before the mutex below is taken, so the relaunched copy can take it.
$script:updater = Join-Path $script:here 'RLStatsUpdater.ps1'
$script:selfPath = $MyInvocation.MyCommand.Path
$script:restartAfterClose = $false
if (-not $NoUpdate -and (Test-Path $script:updater)) {
  . $script:updater
  if (Update-RLStats -InstallDir $script:here) {
    Start-Process powershell.exe -WindowStyle Hidden -ArgumentList @('-NoProfile', '-ExecutionPolicy', 'Bypass', '-STA',
      '-WindowStyle', 'Hidden', '-File', ('"' + $MyInvocation.MyCommand.Path + '"'), '-NoUpdate')
    Stop-Splash
    return
  }
}

if ((Test-Path $script:updater) -and -not (Get-Command Update-RLStats -ErrorAction SilentlyContinue)) { . $script:updater }

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
$script:form.Opacity = 0   # shown once everything is loaded, see add_Shown

$script:wa = [System.Windows.Forms.Screen]::PrimaryScreen.WorkingArea
$script:form.Location = New-Object System.Drawing.Point(($script:wa.Right - 380), ($script:wa.Bottom - 290))

# header
$script:header = New-Object System.Windows.Forms.Panel
$script:header.Location = New-Object System.Drawing.Point(0, 0); $script:header.Size = New-Object System.Drawing.Size(360, 30); $script:header.BackColor = $script:C.Panel
$script:form.Controls.Add($script:header)
$script:dot = New-Label $script:Bullet 8 4 18 22 $script:F.Dot $script:C.Amber 'MiddleCenter'
$script:status = New-Label 'Starting...' 28 5 228 20 $script:F.Small $script:C.Muted
$script:updLink = New-Label 'Update' 190 5 66 20 $script:F.Bold $script:C.Win 'MiddleCenter'
$script:updLink.Visible = $false
$script:pin = New-Label 'Pin' 262 5 30 20 $script:F.Small $script:C.Text 'MiddleCenter'
$script:min = New-Label '_' 296 3 28 22 $script:F.Bold $script:C.Muted 'MiddleCenter'
$script:close = New-Label 'x' 326 3 28 22 $script:F.Bold $script:C.Muted 'MiddleCenter'
foreach ($b in $script:pin, $script:min, $script:close, $script:updLink) { $b.Cursor = [System.Windows.Forms.Cursors]::Hand }
$script:header.Controls.AddRange(@($script:dot, $script:status, $script:updLink, $script:pin, $script:min, $script:close))

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
$script:dashLink = New-Label 'Open dashboard' 214 238 110 18 $script:F.Small $script:C.Blue
foreach ($l in $script:openLink, $script:mmrLink, $script:dashLink) { $l.Cursor = [System.Windows.Forms.Cursors]::Hand }
$script:form.Controls.AddRange(@($script:openLink, $script:mmrLink, $script:dashLink))

# Opens the online dashboard. The site hands back its private share link to anyone holding the
# upload key, so the browser is signed in without the link being stored on this PC.
function Open-Dashboard {
  $cfgPath = Join-Path $OutDir 'upload.json'
  if (-not (Test-Path $cfgPath)) {
    [void][System.Windows.Forms.MessageBox]::Show('Uploads are not set up on this PC, so there is no dashboard to open. Run RLStats.exe once to set them up.', 'RL Stats', 'OK', 'Information')
    return
  }
  $base = $null
  try {
    $cfg = Get-Content $cfgPath -Raw | ConvertFrom-Json
    $base = ([Uri]$cfg.url).GetLeftPart([UriPartial]::Authority)
    try { [Net.ServicePointManager]::SecurityProtocol = [Net.ServicePointManager]::SecurityProtocol -bor [Net.SecurityProtocolType]::Tls12 } catch { }
    $r = Invoke-RestMethod -Uri "$base/api/view-link" -Headers @{ 'X-Upload-Key' = [string]$cfg.key } -TimeoutSec 6 -UseBasicParsing
    if ($r.url) { Start-Process ([string]$r.url); return }
  } catch { }
  if ($base) { Start-Process $base }
}

# tray icon
$script:tray = New-Object System.Windows.Forms.NotifyIcon
$script:tray.Icon = [System.Drawing.SystemIcons]::Application
$script:tray.Text = 'RL Stats'
$script:tray.Visible = $true
$script:menu = New-Object System.Windows.Forms.ContextMenuStrip
[void]$script:menu.Items.Add('Show', $null, { $script:form.Show(); $script:form.Activate() })
[void]$script:menu.Items.Add('Open dashboard', $null, { Open-Dashboard })
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
$script:dashLink.add_Click({ Open-Dashboard })
$script:mmrLink.add_Click({ Show-TypeMmr })

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
  # Follow the playlist of the last match played; before any match, the latest value logged.
  $pl = $null
  if ($script:History.Count -gt 0) { $pl = $script:History[$script:History.Count - 1].playlist }
  $mine = @($script:MmrSamples | Where-Object { -not $pl -or $_.playlist -eq $pl })
  if ($mine.Count -eq 0) {
    if ($pl) { $script:mmrLabel.Text = "MMR ($pl): not logged here, use Type MMR" }
    elseif ($script:MmrSamples.Count -eq 0) { return }
    return
  }
  $latest = $mine[-1]
  $pl = $latest.playlist
  $todayStr = (Get-Date).ToUniversalTime().ToString('yyyy-MM-dd')
  $first = $mine | Where-Object { $_.logged_at.StartsWith($todayStr) } | Select-Object -First 1
  $text = "MMR ($pl): $($latest.mmr)"
  if ($first -and $first.mmr -ne $latest.mmr) {
    $delta = $latest.mmr - $first.mmr
    if ($delta -gt 0) { $text += " (+$delta today)" } else { $text += " ($delta today)" }
  }
  if (-not $latest.logged_at.StartsWith($todayStr)) {
    try { $text += ' (from ' + ([datetime]::Parse($latest.logged_at).ToLocalTime().ToString('d MMM')) + ')' } catch { }
  }
  if ($latest.party_size -gt 1) { $text += '  [party queue]' }
  $script:mmrLabel.Text = $text
}

# Small pop-up for entering an MMR by hand (the game only logs it on the party leader's PC).
# Saves to mmr.csv, uploads it to the dashboard and updates the MMR line.
function Show-TypeMmr {
  $d = New-Object System.Windows.Forms.Form
  $d.Text = 'Type MMR'; $d.FormBorderStyle = 'FixedToolWindow'; $d.StartPosition = 'CenterParent'
  $d.ClientSize = New-Object System.Drawing.Size(250, 150); $d.BackColor = $script:C.Panel; $d.TopMost = $true
  $d.MaximizeBox = $false; $d.MinimizeBox = $false; $d.ShowInTaskbar = $false
  $who = $script:MmrState.Player
  if (-not $who) { $who = [Environment]::UserName }
  $d.Controls.Add((New-Label "Player: $who" 12 8 226 18 $script:F.Small $script:C.Muted))
  $d.Controls.Add((New-Label 'Playlist' 12 32 70 22 $script:F.Body $script:C.Text))
  $pick = New-Object System.Windows.Forms.ComboBox
  $pick.DropDownStyle = 'DropDownList'; $pick.Location = New-Object System.Drawing.Point(86, 32); $pick.Size = New-Object System.Drawing.Size(152, 22)
  [void]$pick.Items.AddRange(@('Ranked Doubles', 'Ranked Duel', 'Ranked Standard', 'Casual Doubles', 'Casual Duel', 'Casual Standard'))
  $pl = 'Ranked Doubles'
  if ($script:History.Count -gt 0 -and $pick.Items.Contains($script:History[$script:History.Count - 1].playlist)) { $pl = $script:History[$script:History.Count - 1].playlist }
  $pick.SelectedItem = $pl
  $d.Controls.Add((New-Label 'MMR' 12 64 70 22 $script:F.Body $script:C.Text))
  $box = New-Object System.Windows.Forms.TextBox
  $box.Location = New-Object System.Drawing.Point(86, 64); $box.Size = New-Object System.Drawing.Size(80, 22); $box.MaxLength = 4
  $msg = New-Label '' 12 90 226 18 $script:F.Small $script:C.Loss
  $ok = New-Object System.Windows.Forms.Button
  $ok.Text = 'Save'; $ok.Location = New-Object System.Drawing.Point(86, 114); $ok.Size = New-Object System.Drawing.Size(70, 26)
  $cancel = New-Object System.Windows.Forms.Button
  $cancel.Text = 'Cancel'; $cancel.Location = New-Object System.Drawing.Point(164, 114); $cancel.Size = New-Object System.Drawing.Size(74, 26)
  $cancel.DialogResult = 'Cancel'
  foreach ($b in $ok, $cancel) { $b.FlatStyle = 'Flat'; $b.ForeColor = $script:C.Text; $b.BackColor = $script:C.Line }
  $d.Controls.AddRange(@($pick, $box, $msg, $ok, $cancel))
  $d.AcceptButton = $ok; $d.CancelButton = $cancel
  $ok.add_Click({
    if ($box.Text.Trim() -notmatch '^\d{2,4}$') { $msg.Text = 'Enter a number, like 1354.'; return }
    $d.Tag = [int]$box.Text.Trim(); $d.DialogResult = 'OK'; $d.Close()
  })
  $d.add_Shown({ $box.Focus() })
  if ($d.ShowDialog($script:form) -ne 'OK') { $d.Dispose(); return }
  $sample = [ordered]@{ logged_at = (Get-Date).ToUniversalTime().ToString('yyyy-MM-ddTHH:mm:ssZ'); player = $who
    playlist = [string]$pick.SelectedItem; mmr = [int]$d.Tag; mu = $null; party_size = $null; source = 'typed' }
  $d.Dispose()
  [void]$script:MmrSamples.Add($sample)
  $cells = @($sample.logged_at, $sample.player, $sample.playlist, $sample.mmr, '', '', 'typed') |
    ForEach-Object { '"' + ([string]$_).Replace('"', '""') + '"' }
  try { [IO.File]::AppendAllText((Join-Path $OutDir 'mmr.csv'), ($cells -join ',') + "`r`n", $Utf8NoBom) } catch { }
  try { Send-Upload 'mmr' $sample } catch { }
  Update-Mmr
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
  Update-Mmr
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

# ---- updates while running ----------------------------------------------------------------------
# Every 15 minutes a background check compares this install with the dashboard site. When something
# is newer, the header shows an "Update" button; clicking it installs the files and restarts.
$script:updCheck = $null
function Start-UpdateCheck {
  if ($script:updCheck -or $script:updLink.Visible -or -not (Get-Command Test-RLStatsUpdate -ErrorAction SilentlyContinue)) { return }
  $ps = [powershell]::Create()
  [void]$ps.AddScript({ param($U, $Dir, $Out) . $U; Test-RLStatsUpdate -InstallDir $Dir -OutDir $Out }).AddArgument($script:updater).AddArgument($script:here).AddArgument($OutDir)
  $script:updCheck = @{ PS = $ps; Handle = $ps.BeginInvoke() }
}
function Step-UpdateCheck {
  $c = $script:updCheck
  if (-not $c -or -not $c.Handle.IsCompleted) { return }
  $n = 0
  try { $n = [int](@($c.PS.EndInvoke($c.Handle)) | Select-Object -Last 1) } catch { }
  $c.PS.Dispose(); $script:updCheck = $null
  if ($n -gt 0) {
    $script:status.Width = 160; $script:updLink.Visible = $true; $script:updLink.BringToFront()
    $script:tray.ShowBalloonTip(5000, 'RL Stats', 'An update is ready. Click Update in the widget to install it.', 'Info')
  }
}
function Invoke-UpdateNow {
  if ($script:InMatch) {
    [void][System.Windows.Forms.MessageBox]::Show('Finish this match first, so it gets saved. Then click Update.', 'RL Stats', 'OK', 'Information')
    return
  }
  Set-Status 'Updating...' $script:C.Blue
  $script:form.Refresh()
  if (Update-RLStats -InstallDir $script:here -OutDir $OutDir) {
    $script:restartAfterClose = $true
    $script:form.Close()
  } else {
    Set-Status 'Update failed, try again later' $script:C.Loss
  }
}
$script:updLink.add_Click({ Invoke-UpdateNow })
$script:updTimer = New-Object System.Windows.Forms.Timer
$script:updTimer.Interval = 15 * 60 * 1000
$script:updTimer.add_Tick({ try { Start-UpdateCheck } catch { } })
$script:updPoll = New-Object System.Windows.Forms.Timer
$script:updPoll.Interval = 2000
$script:updPoll.add_Tick({ try { Step-UpdateCheck } catch { } })

$script:form.add_Shown({
  try {
    Set-Status 'Waiting for Rocket League' $script:C.Amber
    Import-History; Update-Session
    Test-StatsApiConfig
    Initialize-Upload
    Initialize-MmrLog; Update-Mmr
  } catch { Set-Status "Error: $($_.Exception.Message)" $script:C.Loss }
  $script:form.Refresh()
  Stop-Splash
  $script:form.Opacity = 1
  $script:timer.Start(); $script:slow.Start(); $script:updTimer.Start(); $script:updPoll.Start()
})

$script:form.add_FormClosing({
  $script:timer.Stop(); $script:slow.Stop(); $script:updTimer.Stop(); $script:updPoll.Stop()
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
  if ($script:restartAfterClose) {
    Start-Process powershell.exe -WindowStyle Hidden -ArgumentList @('-NoProfile', '-ExecutionPolicy', 'Bypass', '-STA',
      '-WindowStyle', 'Hidden', '-File', ('"' + $script:selfPath + '"'), '-NoUpdate')
  }
}
