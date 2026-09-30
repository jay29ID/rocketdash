<#
  Rocket League stats widget: a small always-on-top window that runs the recorder
  (RLStatsRecorder.ps1, which must sit in the same folder) without a console.
  Shows connection status, the live score and stats during a match, today's
  record, your win/loss streak, the last match and your MMR.

  Start it with "RL Stats Widget.bat". Closing the window stops recording.
#>
param([string[]]$TrackedPlayers = @('jay29ID', 'Kobra Kelvin'), [switch]$NoUpdate,
  [string[]]$Spectators = @('Morgan', 'Chance', 'Nick'),   # people who might be watching
  [string]$DrinksPlayer = 'jay29ID')                        # whose widget shows the drinks counter

Add-Type -AssemblyName System.Windows.Forms, System.Drawing
[System.Windows.Forms.Application]::EnableVisualStyles()

# Rounded window corners: Windows 11 draws them itself (smooth, with a shadow); on Windows 10 the
# window is clipped to a rounded shape instead.
$script:RoundCornersCode = {
  param($Form, [int]$Radius = 10)
  try {
    if (-not ('RLWin.Dwm' -as [type])) {
      Add-Type -Namespace RLWin -Name Dwm -MemberDefinition '[DllImport("dwmapi.dll")] public static extern int DwmSetWindowAttribute(IntPtr hwnd, int attr, ref int value, int size);'
    }
    $v = 2   # DWMWCP_ROUND
    if ([RLWin.Dwm]::DwmSetWindowAttribute($Form.Handle, 33, [ref]$v, 4) -eq 0) { return }
  } catch { }
  try {
    $w = $Form.Width; $h = $Form.Height; $d = 2 * $Radius
    $path = New-Object System.Drawing.Drawing2D.GraphicsPath
    $path.AddArc(0, 0, $d, $d, 180, 90); $path.AddArc($w - $d - 1, 0, $d, $d, 270, 90)
    $path.AddArc($w - $d - 1, $h - $d - 1, $d, $d, 0, 90); $path.AddArc(0, $h - $d - 1, $d, $d, 90, 90); $path.CloseFigure()
    $Form.Region = New-Object System.Drawing.Region($path)
  } catch { }
}
function Set-RoundCorners($Form) { & $script:RoundCornersCode $Form }

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
    param($Sync, $Prefs, $RoundCode)
    Add-Type -AssemblyName System.Windows.Forms, System.Drawing
    $f = New-Object System.Windows.Forms.Form
    $f.FormBorderStyle = 'None'; $f.StartPosition = 'Manual'; $f.ShowInTaskbar = $false; $f.TopMost = $true
    $f.ClientSize = New-Object System.Drawing.Size(450, 555)
    $f.BackColor = [System.Drawing.ColorTranslator]::FromHtml('#080C12')
    $wa = [System.Windows.Forms.Screen]::PrimaryScreen.WorkingArea
    $f.Location = New-Object System.Drawing.Point(($wa.Right - 470), ($wa.Bottom - 583))
    try {
      if (Test-Path $Prefs) {
        $p = Get-Content $Prefs -Raw | ConvertFrom-Json
        $pt = New-Object System.Drawing.Point([int]$p.x, [int]$p.y)
        if ([System.Windows.Forms.Screen]::AllScreens | Where-Object { $_.WorkingArea.Contains($pt) }) { $f.Location = $pt }
      }
    } catch { }
    $state = @{ Angle = 0; Ticks = 0 }
    $blue = [System.Drawing.ColorTranslator]::FromHtml('#00E5FF'); $track = [System.Drawing.ColorTranslator]::FromHtml('#1B2A3A')
    $muted = [System.Drawing.ColorTranslator]::FromHtml('#6D7F96')
    $font = New-Object System.Drawing.Font('Consolas', 10); $caption = 'BOOTING RL STATS...'
    if ($p -and $p.theme -eq 'classic') {
      $f.BackColor = [System.Drawing.ColorTranslator]::FromHtml('#12151C')
      $blue = [System.Drawing.ColorTranslator]::FromHtml('#4DA3FF'); $track = [System.Drawing.ColorTranslator]::FromHtml('#262C3A')
      $muted = [System.Drawing.ColorTranslator]::FromHtml('#8A93A6'); $font = New-Object System.Drawing.Font('Segoe UI', 11); $caption = 'Loading RL Stats...'
    }
    if ($p -and $p.theme -eq 'rl') {
      $f.BackColor = [System.Drawing.ColorTranslator]::FromHtml('#07142B')
      $blue = [System.Drawing.ColorTranslator]::FromHtml('#2A8CFF'); $track = [System.Drawing.ColorTranslator]::FromHtml('#16376B')
      $muted = [System.Drawing.ColorTranslator]::FromHtml('#9DB4D8'); $font = New-Object System.Drawing.Font('Bahnschrift SemiBold Condensed', 12); $caption = 'LOADING...'
    }
    $f.GetType().GetProperty('DoubleBuffered', [Reflection.BindingFlags]'NonPublic,Instance').SetValue($f, $true, $null)
    $f.add_Paint({
      param($s, $e)
      $g = $e.Graphics; $g.SmoothingMode = 'AntiAlias'
      $r = New-Object System.Drawing.Rectangle(200, 236, 50, 50)
      $pen1 = New-Object System.Drawing.Pen($track, 5); $g.DrawEllipse($pen1, $r); $pen1.Dispose()
      $pen2 = New-Object System.Drawing.Pen($blue, 5); $pen2.StartCap = 'Round'; $pen2.EndCap = 'Round'
      $g.DrawArc($pen2, $r, $state.Angle, 90); $pen2.Dispose()
      $sf = New-Object System.Drawing.StringFormat; $sf.Alignment = 'Center'
      $b = New-Object System.Drawing.SolidBrush($muted)
      $g.DrawString($caption, $font, $b, (New-Object System.Drawing.RectangleF(0, 302, 450, 24)), $sf); $b.Dispose()
    })
    $t = New-Object System.Windows.Forms.Timer; $t.Interval = 30
    $t.add_Tick({
      $state.Angle = ($state.Angle + 12) % 360; $state.Ticks++
      if ($Sync.Done -or $state.Ticks -gt 2000) { $t.Stop(); $f.Close() } else { $f.Invalidate() }
    })
    $f.add_Shown({ try { & ([scriptblock]::Create($RoundCode)) $f } catch { }; $t.Start() })
    [System.Windows.Forms.Application]::Run($f)
  }).AddArgument($sync).AddArgument((Join-Path ([Environment]::GetFolderPath('MyDocuments')) 'RLStats\widget.json')).AddArgument($script:RoundCornersCode.ToString())
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
# Themes: 'cyber' (framed neon panels), 'rl' (Rocket League menus: navy, blue and orange, slanted
# tabs) or 'classic' (the original plain dark look). Picked from the
# theme button in the title bar and saved in widget.json; switching restarts the widget.
$script:Theme = 'cyber'
try {
  $tp = Join-Path $OutDir 'widget.json'
  if (Test-Path $tp) { $t = (Get-Content $tp -Raw | ConvertFrom-Json).theme; if ($t -in 'cyber', 'rl', 'classic') { $script:Theme = $t } }
} catch { }
$script:Themes = [ordered]@{ cyber = 'Cyber'; rl = 'Rocket League'; classic = 'Classic' }
$script:C = @{
  # neon-on-black: cyan for structure, magenta for secondary accents
  Bg = RGB '#080C12'; Panel = RGB '#0E1520'; Line = RGB '#1B2A3A'; Text = RGB '#DDE8F5'; Muted = RGB '#6D7F96'
  Blue = RGB '#2BD2FF'; Orange = RGB '#FF8A3D'; Win = RGB '#39FF88'; Loss = RGB '#FF3B6B'; Amber = RGB '#FFC23D'
  Cyan = RGB '#00E5FF'; Magenta = RGB '#FF2BD6'; Frame = RGB '#16364A'
}
# The layout below is drawn at 360 wide and then scaled up by UiScale; fonts are scaled to match.
$script:UiScale = 1.25
function UiFont([string]$Face, [double]$Pt) { New-Object System.Drawing.Font($Face, [single]($Pt * $script:UiScale)) }
if ($script:Theme -eq 'classic') {
  $script:C = @{
    Bg = RGB '#12151C'; Panel = RGB '#1A1F2A'; Line = RGB '#262C3A'; Text = RGB '#E6E9EF'; Muted = RGB '#8A93A6'
    Blue = RGB '#4DA3FF'; Orange = RGB '#FF9F43'; Win = RGB '#3DDC84'; Loss = RGB '#FF5C6C'; Amber = RGB '#F5C04E'
    Cyan = RGB '#4DA3FF'; Magenta = RGB '#FF9F43'; Frame = RGB '#262C3A'
  }
}
if ($script:Theme -eq 'rl') {
  # the game's menus: deep navy panels, bright team blue and orange, white condensed type
  $script:C = @{
    Bg = RGB '#061127'; Panel = RGB '#0B1E42'; Line = RGB '#16376B'; Text = RGB '#FFFFFF'; Muted = RGB '#9DB4D8'
    Blue = RGB '#2A8CFF'; Orange = RGB '#FF7A1A'; Win = RGB '#4CE38A'; Loss = RGB '#FF4D4D'; Amber = RGB '#FFC940'
    Cyan = RGB '#2A8CFF'; Magenta = RGB '#FF7A1A'; Frame = RGB '#1F4C8F'
  }
}
$script:F = @{
  Small = UiFont 'Bahnschrift' 8.25
  Body = UiFont 'Bahnschrift' 9
  Bold = UiFont 'Bahnschrift SemiBold' 9
  Head = UiFont 'Consolas' 7
  Tiny = UiFont 'Consolas' 6.5
  Tag = New-Object System.Drawing.Font('Consolas', [single](6.5 * $script:UiScale), [System.Drawing.FontStyle]::Bold)
  Speed = UiFont 'Bahnschrift SemiBold' 15
  Score = UiFont 'Bahnschrift SemiBold' 24
  Dot = UiFont 'Segoe UI' 11
}
if ($script:Theme -eq 'classic') {
  $script:F = @{
    Small = UiFont 'Segoe UI' 8.25; Body = UiFont 'Segoe UI' 9; Bold = UiFont 'Segoe UI Semibold' 9
    Head = UiFont 'Segoe UI' 7.5; Tiny = UiFont 'Segoe UI' 6.75; Tag = UiFont 'Segoe UI' 6.75
    Speed = UiFont 'Segoe UI Semibold' 15; Score = UiFont 'Segoe UI Semibold' 22; Dot = UiFont 'Segoe UI' 11
  }
}
if ($script:Theme -eq 'rl') {
  $cond = 'Bahnschrift SemiBold Condensed'
  $script:F = @{
    Small = UiFont 'Bahnschrift' 8.25; Body = UiFont 'Bahnschrift' 9; Bold = UiFont 'Bahnschrift SemiBold' 9
    Head = UiFont $cond 7.5; Tiny = UiFont $cond 7; Tag = UiFont $cond 7.5
    Speed = UiFont $cond 16
    Score = New-Object System.Drawing.Font($cond, [single](25 * $script:UiScale), [System.Drawing.FontStyle]::Italic)
    Dot = UiFont 'Segoe UI' 11
  }
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
$script:form.ClientSize = New-Object System.Drawing.Size(360, 444)
$script:form.BackColor = $script:C.Bg
$script:form.TopMost = $true
$script:form.ShowInTaskbar = $true
$script:form.Opacity = 0   # shown once everything is loaded, see add_Shown
$script:form.GetType().GetProperty('DoubleBuffered', [Reflection.BindingFlags]'NonPublic,Instance').SetValue($script:form, $true, $null)

$script:wa = [System.Windows.Forms.Screen]::PrimaryScreen.WorkingArea
$script:form.Location = New-Object System.Drawing.Point(($script:wa.Right - 380), ($script:wa.Bottom - 334))

# header
$script:header = New-Object System.Windows.Forms.Panel
$script:header.Location = New-Object System.Drawing.Point(0, 0); $script:header.Size = New-Object System.Drawing.Size(360, 30); $script:header.BackColor = $script:C.Panel
$script:form.Controls.Add($script:header)
if ($script:Theme -eq 'rl') {
  $script:header.GetType().GetProperty('DoubleBuffered', [Reflection.BindingFlags]'NonPublic,Instance').SetValue($script:header, $true, $null)
  $script:header.add_Paint({
    param($s, $e)
    $r = $s.ClientRectangle
    $gb = New-Object System.Drawing.Drawing2D.LinearGradientBrush($r, (RGB '#123A80'), $script:C.Bg, [single]0)
    $e.Graphics.FillRectangle($gb, $r); $gb.Dispose()
  })
}
$script:dot = New-Label $script:Bullet 8 4 18 22 $script:F.Dot $script:C.Amber 'MiddleCenter'
$script:status = New-Label 'Starting...' 28 5 206 20 $script:F.Small $script:C.Muted
$script:status.AutoEllipsis = $true; $script:status.UseMnemonic = $false
$script:updLink = New-Label 'Update' 168 5 66 20 $script:F.Bold $script:C.Win 'MiddleCenter'
$script:updLink.Visible = $false
$script:pin = New-Label 'Pin' 262 5 30 20 $script:F.Small $script:C.Text 'MiddleCenter'
$script:min = New-Label '_' 296 3 28 22 $script:F.Bold $script:C.Muted 'MiddleCenter'
$script:close = New-Label 'x' 326 3 28 22 $script:F.Bold $script:C.Muted 'MiddleCenter'
foreach ($b in $script:pin, $script:min, $script:close, $script:updLink) { $b.Cursor = [System.Windows.Forms.Cursors]::Hand }
$script:themeBtn = New-Label ([string][char]0x25D0) 236 3 24 22 $script:F.Dot $script:C.Muted 'MiddleCenter'
$script:themeBtn.Cursor = [System.Windows.Forms.Cursors]::Hand
$script:header.Controls.AddRange(@($script:dot, $script:status, $script:updLink, $script:themeBtn, $script:pin, $script:min, $script:close))

# score block
$script:blueName = New-Label 'BLUE' 16 40 104 20 $script:F.Small $script:C.Blue 'MiddleLeft'
$script:orangeName = New-Label 'ORANGE' 240 40 104 20 $script:F.Small $script:C.Orange 'MiddleRight'
$script:score = New-Label ("0 $script:Dash 0") 90 34 180 44 $script:F.Score $script:C.Text 'MiddleCenter'
$script:sub = New-Label 'Waiting for a match' 16 76 328 18 $script:F.Small $script:C.Muted 'MiddleCenter'
if ($script:Theme -eq 'rl') {
  # white names sit on the blue and orange bars painted behind them
  $script:blueName.ForeColor = $script:C.Text; $script:orangeName.ForeColor = $script:C.Text
  $script:blueName.Location = New-Object System.Drawing.Point(18, 40); $script:blueName.Width = 96
  $script:orangeName.Location = New-Object System.Drawing.Point(246, 40); $script:orangeName.Width = 96
  $script:blueName.AutoEllipsis = $true; $script:orangeName.AutoEllipsis = $true
}
# Long team names ("THE DANGEROUS NIGHTS CREW") shrink to fit on one line, then get "..." if still too long.
foreach ($l in $script:blueName, $script:orangeName) { $l.AutoEllipsis = $true; $l.UseMnemonic = $false }
$script:NameFonts = foreach ($pt in 8.25, 7.5, 6.75, 6) { New-Object System.Drawing.Font($script:F.Small.FontFamily, [single]($pt * $script:UiScale), $script:F.Small.Style) }
function Set-TeamName($Label, [string]$Text) {
  if ($Label.Text -eq $Text) { return }
  $flags = [System.Windows.Forms.TextFormatFlags]'SingleLine, NoPadding'
  $pick = $script:NameFonts[-1]
  foreach ($f in $script:NameFonts) {
    $w = [System.Windows.Forms.TextRenderer]::MeasureText($Text, $f, (New-Object System.Drawing.Size([int]::MaxValue, 100)), $flags).Width
    if ($w -le $Label.ClientSize.Width - 4) { $pick = $f; break }
  }
  $Label.Font = $pick; $Label.Text = $Text
}
$script:form.Controls.AddRange(@($script:blueName, $script:orangeName, $script:score, $script:sub))

# players table: an icon and the full stat name over each column
$script:cols = @(@{ K = 'Goals'; T = 'Goals' }, @{ K = 'Assists'; T = 'Assists' }, @{ K = 'Shots'; T = 'Shots' }, @{ K = 'Saves'; T = 'Saves' },
  @{ K = 'Demos'; T = 'Demos' }, @{ K = 'CarTouches'; T = 'Bumps'; Saved = 'car_touches' })
$script:tableTop = 112
$script:colX = 100; $script:colW = 41
$script:sep1 = New-Object System.Windows.Forms.Panel
$script:sep1.Location = New-Object System.Drawing.Point(12, ($script:tableTop - 4)); $script:sep1.Size = New-Object System.Drawing.Size(336, 1); $script:sep1.BackColor = $script:C.Line
$script:sep1.Visible = ($script:Theme -eq 'classic')   # cyber frames replace the separators
$script:form.Controls.Add($script:sep1)
$script:form.Controls.Add((New-Label 'PLAYER' 16 ($script:tableTop + 16) 90 16 $script:F.Head $script:C.Muted))

# Small line icons for each stat, drawn at 32px so they stay sharp after scaling.
function New-StatIcon([string]$Key) {
  $bmp = New-Object System.Drawing.Bitmap(32, 32)
  $g = [System.Drawing.Graphics]::FromImage($bmp); $g.SmoothingMode = 'AntiAlias'
  $col = $script:C.Muted
  $pen = New-Object System.Drawing.Pen($col, 2.6); $pen.StartCap = 'Round'; $pen.EndCap = 'Round'; $pen.LineJoin = 'Round'
  $br = New-Object System.Drawing.SolidBrush($col)
  switch ($Key) {
    'Goals' {    # goal frame with net
      $g.DrawLines($pen, [System.Drawing.PointF[]]@((New-Object System.Drawing.PointF(4, 27)), (New-Object System.Drawing.PointF(4, 7)), (New-Object System.Drawing.PointF(28, 7)), (New-Object System.Drawing.PointF(28, 27))))
      $thin = New-Object System.Drawing.Pen($col, 1.2)
      foreach ($x in 10, 16, 22) { $g.DrawLine($thin, $x, 9, $x, 26) }
      foreach ($y in 13, 19, 25) { $g.DrawLine($thin, 6, $y, 26, $y) }
      $thin.Dispose()
    }
    'Assists' {  # two arrows passing
      $g.DrawLine($pen, 5, 11, 22, 11); $g.DrawLines($pen, [System.Drawing.PointF[]]@((New-Object System.Drawing.PointF(17, 6)), (New-Object System.Drawing.PointF(22, 11)), (New-Object System.Drawing.PointF(17, 16))))
      $g.DrawLine($pen, 27, 22, 10, 22); $g.DrawLines($pen, [System.Drawing.PointF[]]@((New-Object System.Drawing.PointF(15, 17)), (New-Object System.Drawing.PointF(10, 22)), (New-Object System.Drawing.PointF(15, 27))))
    }
    'Shots' {    # ball with speed lines
      $g.DrawEllipse($pen, 15, 9, 14, 14)
      $g.DrawLine($pen, 3, 12, 11, 12); $g.DrawLine($pen, 1, 17, 11, 17); $g.DrawLine($pen, 3, 22, 11, 22)
    }
    'Saves' {    # shield
      $path = New-Object System.Drawing.Drawing2D.GraphicsPath
      $path.AddLines([System.Drawing.PointF[]]@((New-Object System.Drawing.PointF(16, 3)), (New-Object System.Drawing.PointF(27, 7)), (New-Object System.Drawing.PointF(27, 15))))
      $path.AddBezier(27, 15, 27, 22, 22, 27, 16, 29); $path.AddBezier(16, 29, 10, 27, 5, 22, 5, 15)
      $path.AddLines([System.Drawing.PointF[]]@((New-Object System.Drawing.PointF(5, 15)), (New-Object System.Drawing.PointF(5, 7)))); $path.CloseFigure()
      $g.DrawPath($pen, $path); $path.Dispose()
      $g.DrawLines($pen, [System.Drawing.PointF[]]@((New-Object System.Drawing.PointF(11, 16)), (New-Object System.Drawing.PointF(15, 20)), (New-Object System.Drawing.PointF(21, 12))))
    }
    'Demos' {    # burst
      $pts = New-Object System.Collections.Generic.List[System.Drawing.PointF]
      for ($i = 0; $i -lt 16; $i++) {
        $a = -[math]::PI / 2 + $i * [math]::PI / 8; $r = 13; if ($i % 2) { $r = 6 }
        $pts.Add((New-Object System.Drawing.PointF([single](16 + $r * [math]::Cos($a)), [single](16 + $r * [math]::Sin($a)))))
      }
      $g.DrawPolygon($pen, $pts.ToArray())
    }
    'CarTouches' {   # two cars meeting
      $g.DrawRectangle($pen, 2, 14, 10, 8); $g.DrawRectangle($pen, 20, 14, 10, 8)
      $g.DrawLine($pen, 16, 6, 16, 11); $g.DrawLine($pen, 12, 8, 14, 11); $g.DrawLine($pen, 20, 8, 18, 11)
      $g.FillEllipse($br, 3, 23, 4, 4); $g.FillEllipse($br, 25, 23, 4, 4)
    }
    'Boost' {    # flame
      $path = New-Object System.Drawing.Drawing2D.GraphicsPath
      $path.AddBezier(16, 3, 19, 10, 26, 13, 25, 21); $path.AddBezier(25, 21, 24, 27, 20, 29, 16, 29)
      $path.AddBezier(16, 29, 12, 29, 7, 27, 7, 21); $path.AddBezier(7, 21, 7, 15, 12, 12, 16, 3); $path.CloseFigure()
      $g.DrawPath($pen, $path); $path.Dispose()
      $g.FillEllipse($br, 12, 18, 8, 8)
    }
  }
  $pen.Dispose(); $br.Dispose(); $g.Dispose()
  return $bmp
}
for ($i = 0; $i -lt $script:cols.Count; $i++) {
  $x = $script:colX + $i * $script:colW
  $pb = New-Object System.Windows.Forms.PictureBox
  $pb.SizeMode = 'Zoom'; $pb.BackColor = [System.Drawing.Color]::Transparent
  $pb.Location = New-Object System.Drawing.Point(($x + [int](($script:colW - 16) / 2)), $script:tableTop); $pb.Size = New-Object System.Drawing.Size(16, 16)
  try { $pb.Image = New-StatIcon $script:cols[$i].K } catch { }
  $script:form.Controls.Add($pb)
  $script:form.Controls.Add((New-Label $script:cols[$i].T ($x - 2) ($script:tableTop + 16) ($script:colW + 4) 16 $script:F.Tiny $script:C.Muted 'MiddleCenter'))
}
$script:rows = @{}
# Live boost and speed per tracked player, drawn by the boost meters and the speedometer.
$script:Live = @{}
$script:PColor = @($script:C.Blue, $script:C.Orange, $script:C.Win)
function New-Canvas([int]$X, [int]$Y, [int]$W, [int]$H) {
  $p = New-Object System.Windows.Forms.Panel
  $p.Location = New-Object System.Drawing.Point($X, $Y); $p.Size = New-Object System.Drawing.Size($W, $H); $p.BackColor = $script:C.Panel; if ($script:Theme -eq 'classic') { $p.BackColor = $script:C.Bg }
  $p.GetType().GetProperty('DoubleBuffered', [Reflection.BindingFlags]'NonPublic,Instance').SetValue($p, $true, $null)
  return $p
}
for ($r = 0; $r -lt $TrackedPlayers.Count -and $r -lt 3; $r++) {
  $y = $script:tableTop + 36 + $r * 30
  $name = $TrackedPlayers[$r]
  $cells = @{ Name = (New-Label $name 16 $y 86 20 $script:F.Bold $script:C.Text) }
  $cells.Name.AutoEllipsis = $true
  $script:form.Controls.Add($cells.Name)
  for ($i = 0; $i -lt $script:cols.Count; $i++) {
    $cells[$script:cols[$i].K] = New-Label '-' ($script:colX + $i * $script:colW) $y $script:colW 20 $script:F.Body $script:C.Text 'MiddleCenter'
    $script:form.Controls.Add($cells[$script:cols[$i].K])
  }
  # boost meter under the row
  $meter = New-Canvas 16 ($y + 21) 328 8
  $meter.Tag = @{ Name = $name; Color = $script:PColor[$r] }
  $meter.add_Paint({
    param($s, $e)
    $g = $e.Graphics; $g.SmoothingMode = 'AntiAlias'
    $t = $s.Tag; $w = $s.ClientSize.Width; $h = $s.ClientSize.Height
    $lw = [int]($w * 0.12)                        # room for the number on the right
    $bw = $w - $lw - 4
    $track = New-Object System.Drawing.SolidBrush($script:C.Line); $g.FillRectangle($track, 0, [int]($h * 0.2), $bw, [int]($h * 0.6)); $track.Dispose()
    $v = $null; if ($script:Live.ContainsKey($t.Name)) { $v = $script:Live[$t.Name].Boost }
    if ($null -ne $v) {
      $fillW = [int]($bw * [math]::Max(0, [math]::Min(100, $v)) / 100)
      $c = $t.Color; if ($v -le 0) { $c = $script:C.Loss }
      $fb = New-Object System.Drawing.SolidBrush($c); $g.FillRectangle($fb, 0, [int]($h * 0.2), $fillW, [int]($h * 0.6)); $fb.Dispose()
      $tb = New-Object System.Drawing.SolidBrush($script:C.Muted)
      $sf = New-Object System.Drawing.StringFormat; $sf.Alignment = 'Far'; $sf.LineAlignment = 'Center'
      $g.DrawString(([string][int]$v), $script:F.Tiny, $tb, (New-Object System.Drawing.RectangleF(($w - $lw), -2, $lw, ($h + 4))), $sf); $tb.Dispose()
    }
  })
  $script:form.Controls.Add($meter)
  $cells.Meter = $meter
  $script:rows[$name] = $cells
}

# Speedometer: one needle per player, 0 to 100 km/h, supersonic from 79 km/h (2200 uu/s).
$script:gauge = New-Canvas 16 222 328 72
$script:gauge.add_Paint({
  param($s, $e)
  $g = $e.Graphics; $g.SmoothingMode = 'AntiAlias'; $g.TextRenderingHint = 'AntiAliasGridFit'
  $w = $s.ClientSize.Width; $h = $s.ClientSize.Height; $k = $w / 328.0
  $rad = [int](62 * $k); $cx = [int]($w / 2); $cy = $h - [int](6 * $k)
  $box = New-Object System.Drawing.Rectangle(($cx - $rad), ($cy - $rad), (2 * $rad), (2 * $rad))
  $pw = [single](7 * $k)
  $p1 = New-Object System.Drawing.Pen($script:C.Line, $pw); $g.DrawArc($p1, $box, 180, 180); $p1.Dispose()
  $p2 = New-Object System.Drawing.Pen($script:C.Loss, $pw); $g.DrawArc($p2, $box, (180 + 180 * 0.79), (180 * 0.21)); $p2.Dispose()
  $tick = New-Object System.Drawing.Pen($script:C.Muted, [single](1.2 * $k))
  $tb = New-Object System.Drawing.SolidBrush($script:C.Muted)
  $sf = New-Object System.Drawing.StringFormat; $sf.Alignment = 'Center'; $sf.LineAlignment = 'Center'
  foreach ($v in 0, 20, 40, 60, 80, 100) {
    $a = [math]::PI * (1 + $v / 100)
    $x1 = $cx + ($rad - 8 * $k) * [math]::Cos($a); $y1 = $cy + ($rad - 8 * $k) * [math]::Sin($a)
    $x2 = $cx + ($rad - 13 * $k) * [math]::Cos($a); $y2 = $cy + ($rad - 13 * $k) * [math]::Sin($a)
    $g.DrawLine($tick, [single]$x1, [single]$y1, [single]$x2, [single]$y2)
    $xt = $cx + ($rad - 22 * $k) * [math]::Cos($a); $yt = $cy + ($rad - 22 * $k) * [math]::Sin($a)
    $g.DrawString([string]$v, $script:F.Tiny, $tb, [single]$xt, [single]$yt, $sf)
  }
  $tick.Dispose()
  $g.DrawString('km/h', $script:F.Tiny, $tb, [single]$cx, [single]($cy - 14 * $k), $sf)
  # needles and the readouts either side
  for ($r = 0; $r -lt $TrackedPlayers.Count -and $r -lt 2; $r++) {
    $n = $TrackedPlayers[$r]; $col = $script:PColor[$r]
    $v = $null; if ($script:Live.ContainsKey($n)) { $v = $script:Live[$n].Speed }
    $short = ($n -split '\s+')[0] -replace '\d.*$', ''
    if ($short) { $short = $short.Substring(0, 1).ToUpper() + $short.Substring(1) } else { $short = $n }
    $nb = New-Object System.Drawing.SolidBrush($col)
    $big = if ($null -eq $v) { '-' } else { [string][int]$v }
    $rs = New-Object System.Drawing.StringFormat; $rs.LineAlignment = 'Center'
    $rx = 0; if ($r -eq 1) { $rs.Alignment = 'Far'; $rx = $w - [int](90 * $k) }
    $g.DrawString($short, $script:F.Small, $nb, (New-Object System.Drawing.RectangleF($rx, (8 * $k), (90 * $k), (18 * $k))), $rs)
    $g.DrawString($big, $script:F.Speed, $nb, (New-Object System.Drawing.RectangleF($rx, (24 * $k), (90 * $k), (30 * $k))), $rs)
    if ($null -ne $v) {
      if ($script:Live[$n].Super) { $g.DrawString('SUPERSONIC', $script:F.Tiny, $nb, (New-Object System.Drawing.RectangleF($rx, (52 * $k), (90 * $k), (16 * $k))), $rs) }
      $a = [math]::PI * (1 + [math]::Max(0, [math]::Min(100, $v)) / 100)
      $np = New-Object System.Drawing.Pen($col, [single](3 * $k)); $np.EndCap = 'Round'; $np.StartCap = 'Round'
      $g.DrawLine($np, [single]$cx, [single]$cy, [single]($cx + ($rad - 12 * $k) * [math]::Cos($a)), [single]($cy + ($rad - 12 * $k) * [math]::Sin($a)))
      $np.Dispose()
    }
    $nb.Dispose()
  }
  $hub = New-Object System.Drawing.SolidBrush($script:C.Text); $g.FillEllipse($hub, [single]($cx - 4 * $k), [single]($cy - 4 * $k), [single](8 * $k), [single](8 * $k)); $hub.Dispose()
  $tb.Dispose()
})
$script:form.Controls.Add($script:gauge)

$script:sep2 = New-Object System.Windows.Forms.Panel
$script:sep2.Location = New-Object System.Drawing.Point(12, 300); $script:sep2.Size = New-Object System.Drawing.Size(336, 1); $script:sep2.BackColor = $script:C.Line
$script:sep2.Visible = ($script:Theme -eq 'classic')
$script:form.Controls.Add($script:sep2)

$script:today = New-Label 'Session: no games yet' 16 308 186 20 $script:F.Body $script:C.Text
$script:sessWhen = New-Label '' 190 309 156 18 $script:F.Tiny $script:C.Muted 'MiddleRight'
$script:sessStats = New-Label '' 16 327 328 18 $script:F.Small $script:C.Text
$script:streak = New-Label '' 16 346 328 18 $script:F.Small $script:C.Muted
$script:mmrLabel = New-Label 'MMR: queue a ranked game to read it' 16 364 328 18 $script:F.Small $script:C.Muted
$script:form.Controls.AddRange(@($script:today, $script:sessWhen, $script:sessStats, $script:streak, $script:mmrLabel))

# who's watching + drinks: stamped onto every match saved while they're set
$script:Watching = New-Object System.Collections.Generic.List[string]
$script:Drinks = 0
$script:form.Controls.Add((New-Label 'Watching' 16 396 56 18 $script:F.Small $script:C.Muted))
$script:specLabels = @{}
$x = 72
foreach ($name in $Spectators) {
  $w = [math]::Max(44, 18 + 7 * $name.Length)
  $l = New-Label '' $x 396 $w 18 $script:F.Small $script:C.Muted
  $l.Cursor = [System.Windows.Forms.Cursors]::Hand; $l.Tag = $name
  $l.add_Click({ param($s, $e) Switch-Spectator ([string]$s.Tag) })
  $script:specLabels[$name] = $l; $script:form.Controls.Add($l)
  $x += $w + 2
}
$script:drinksLabel = New-Label 'Drinks' 250 396 40 18 $script:F.Small $script:C.Muted
$script:drinksMinus = New-Label '-' 290 394 16 20 $script:F.Bold $script:C.Blue 'MiddleCenter'
$script:drinksCount = New-Label '0' 306 396 22 18 $script:F.Bold $script:C.Text 'MiddleCenter'
$script:drinksPlus = New-Label '+' 328 394 16 20 $script:F.Bold $script:C.Blue 'MiddleCenter'
foreach ($l in $script:drinksMinus, $script:drinksPlus) { $l.Cursor = [System.Windows.Forms.Cursors]::Hand }
$script:drinksParts = @($script:drinksLabel, $script:drinksMinus, $script:drinksCount, $script:drinksPlus)
foreach ($l in $script:drinksParts) { $l.Visible = $false }
$script:form.Controls.AddRange($script:drinksParts)

# ---- panel frames ------------------------------------------------------------------------------
# Each section sits in a frame with clipped corners, cyan corner brackets and a tag on its top
# edge. Coordinates are in the unscaled 360-wide layout.
$script:Frames = @(
  @{ Tag = '01 // MATCH';     Y = 36;  H = 62 }
  @{ Tag = '02 // PLAYERS';   Y = 102; H = 110 }
  @{ Tag = '03 // TELEMETRY'; Y = 216; H = 82 }
  @{ Tag = '04 // SESSION';   Y = 302; H = 84 }
  @{ Tag = '05 // CREW';      Y = 390; H = 26 }
)
# Rocket League look: flat navy panels with a bright top edge, a slanted blue tab for each title,
# and blue and orange team bars under the score, like the in-game scoreboard.
function New-Slant([single]$X, [single]$Y, [single]$W, [single]$H, [single]$Lean) {
  [System.Drawing.PointF[]]@(
    (New-Object System.Drawing.PointF(($X + $Lean), $Y)), (New-Object System.Drawing.PointF(($X + $W), $Y)),
    (New-Object System.Drawing.PointF(($X + $W - $Lean), ($Y + $H))), (New-Object System.Drawing.PointF($X, ($Y + $H))))
}
function Draw-RlFrames($g) {
  $g.SmoothingMode = 'AntiAlias'; $g.TextRenderingHint = 'ClearTypeGridFit'
  $k = [single]$script:UiScale
  $fill = New-Object System.Drawing.SolidBrush($script:C.Panel)
  $edge = New-Object System.Drawing.Pen($script:C.Frame, [single](1 * $k))
  $top = New-Object System.Drawing.Pen($script:C.Blue, [single](2 * $k))
  $white = New-Object System.Drawing.SolidBrush($script:C.Text)
  $x0 = 6 * $k; $x1 = 354 * $k
  foreach ($f in $script:Frames) {
    $y0 = $f.Y * $k; $y1 = ($f.Y + $f.H) * $k
    $g.FillRectangle($fill, $x0, $y0, ($x1 - $x0), ($y1 - $y0))
    $g.DrawRectangle($edge, $x0, $y0, ($x1 - $x0), ($y1 - $y0))
    $g.DrawLine($top, $x0, $y0, $x1, $y0)
    # slanted title tab hanging off the top edge
    $name = ($f.Tag -replace '^\d+ // ', '')
    $sz = $g.MeasureString($name, $script:F.Tag)
    $th = $sz.Height; $tw = $sz.Width + 18 * $k; $tx = $x0 + 10 * $k; $ty = $y0 - $th / 2
    $rect = New-Object System.Drawing.RectangleF($tx, $ty, $tw, $th)
    $grad = New-Object System.Drawing.Drawing2D.LinearGradientBrush($rect, $script:C.Blue, (RGB '#1456C8'), [single]90)
    $g.FillPolygon($grad, (New-Slant $tx $ty $tw $th (6 * $k))); $grad.Dispose()
    $g.DrawString($name, $script:F.Tag, $white, ($tx + 9 * $k), $ty)
  }
  # scoreboard team bars behind the team names
  $bh = 20 * $k; $by = 40 * $k
  $bb = New-Object System.Drawing.Drawing2D.LinearGradientBrush((New-Object System.Drawing.RectangleF((12 * $k), $by, (110 * $k), $bh)), $script:C.Blue, (RGB '#1456C8'), [single]0)
  $bpts = [System.Drawing.PointF[]]@(
    (New-Object System.Drawing.PointF((12 * $k), $by)), (New-Object System.Drawing.PointF((122 * $k), $by)),
    (New-Object System.Drawing.PointF((122 * $k - 8 * $k), ($by + $bh))), (New-Object System.Drawing.PointF((12 * $k), ($by + $bh))))
  $g.FillPolygon($bb, $bpts); $bb.Dispose()
  $ob = New-Object System.Drawing.Drawing2D.LinearGradientBrush((New-Object System.Drawing.RectangleF((238 * $k), $by, (110 * $k), $bh)), (RGB '#C9500A'), $script:C.Orange, [single]0)
  $opts = [System.Drawing.PointF[]]@(
    (New-Object System.Drawing.PointF((238 * $k), $by)), (New-Object System.Drawing.PointF((348 * $k), $by)),
    (New-Object System.Drawing.PointF((348 * $k), ($by + $bh))), (New-Object System.Drawing.PointF((238 * $k + 8 * $k), ($by + $bh))))
  $g.FillPolygon($ob, $opts); $ob.Dispose()
  # blue and orange split under the title bar
  $bp = New-Object System.Drawing.Pen($script:C.Blue, [single](2 * $k)); $g.DrawLine($bp, 0, (30 * $k), (180 * $k), (30 * $k)); $bp.Dispose()
  $op = New-Object System.Drawing.Pen($script:C.Orange, [single](2 * $k)); $g.DrawLine($op, (180 * $k), (30 * $k), (360 * $k), (30 * $k)); $op.Dispose()
  $fill.Dispose(); $edge.Dispose(); $top.Dispose(); $white.Dispose()
}
$script:form.add_Paint({
  param($s, $e)
  if ($script:Theme -eq 'rl') { Draw-RlFrames $e.Graphics; return }
  if ($script:Theme -ne 'cyber') { return }
  $g = $e.Graphics; $g.SmoothingMode = 'AntiAlias'; $g.TextRenderingHint = 'ClearTypeGridFit'
  $k = [single]$script:UiScale
  $frame = New-Object System.Drawing.Pen($script:C.Frame, [single](1 * $k))
  $acc = New-Object System.Drawing.Pen($script:C.Cyan, [single](1.6 * $k))
  $fill = New-Object System.Drawing.SolidBrush($script:C.Panel)
  $tagBg = New-Object System.Drawing.SolidBrush($script:C.Bg)
  $tagFg = New-Object System.Drawing.SolidBrush($script:C.Cyan)
  $x0 = 6 * $k; $x1 = 354 * $k; $c = 7 * $k; $b = 12 * $k
  foreach ($f in $script:Frames) {
    $y0 = $f.Y * $k; $y1 = ($f.Y + $f.H) * $k
    $pts = [System.Drawing.PointF[]]@(
      (New-Object System.Drawing.PointF(($x0 + $c), $y0)), (New-Object System.Drawing.PointF($x1, $y0)),
      (New-Object System.Drawing.PointF($x1, ($y1 - $c))), (New-Object System.Drawing.PointF(($x1 - $c), $y1)),
      (New-Object System.Drawing.PointF($x0, $y1)), (New-Object System.Drawing.PointF($x0, ($y0 + $c))))
    $g.FillPolygon($fill, $pts); $g.DrawPolygon($frame, $pts)
    # corner brackets: top-right and bottom-left
    $g.DrawLine($acc, ($x1 - $b), $y0, $x1, $y0); $g.DrawLine($acc, $x1, $y0, $x1, ($y0 + $b))
    $g.DrawLine($acc, $x0, ($y1 - $b), $x0, $y1); $g.DrawLine($acc, $x0, $y1, ($x0 + $b), $y1)
    $g.DrawLine($acc, $x0, ($y0 + $c), ($x0 + $c), $y0)
    # tag on the top edge
    $sz = $g.MeasureString($f.Tag, $script:F.Tag)
    $tx = $x0 + 12 * $k; $ty = $y0 - $sz.Height / 2
    $g.FillRectangle($tagBg, ($tx - 3 * $k), $ty, ($sz.Width + 4 * $k), $sz.Height)
    $g.DrawString($f.Tag, $script:F.Tag, $tagFg, $tx, $ty)
  }
  # thin cyan rule under the header and a magenta tick at its end
  $g.DrawLine($acc, 0, (30 * $k), (360 * $k), (30 * $k))
  $mag = New-Object System.Drawing.Pen($script:C.Magenta, [single](2 * $k)); $g.DrawLine($mag, (300 * $k), (30 * $k), (360 * $k), (30 * $k)); $mag.Dispose()
  $frame.Dispose(); $acc.Dispose(); $fill.Dispose(); $tagBg.Dispose(); $tagFg.Dispose()
})

# footer links
$script:openLink = New-Label 'Open data folder' 16 422 96 18 $script:F.Small $script:C.Blue
$script:mmrLink = New-Label 'Type MMR' 114 422 62 18 $script:F.Small $script:C.Blue
$script:dashLink = New-Label 'Open dashboard' 178 422 92 18 $script:F.Small $script:C.Blue
$script:checkLink = New-Label 'Check updates' 270 422 86 18 $script:F.Small $script:C.Blue
foreach ($l in $script:openLink, $script:mmrLink, $script:dashLink, $script:checkLink) { $l.Cursor = [System.Windows.Forms.Cursors]::Hand }
$script:form.Controls.AddRange(@($script:openLink, $script:mmrLink, $script:dashLink, $script:checkLink))

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
# Tray icon: a dark rounded tile with a ball in the status colour (amber waiting, green connected,
# blue in a match), so you can see what the recorder is doing without opening the widget.
$script:trayColor = $null
function Set-TrayIcon($Color) {
  if ($script:trayColor -eq $Color) { return }
  $bmp = New-Object System.Drawing.Bitmap(32, 32)
  $g = [System.Drawing.Graphics]::FromImage($bmp); $g.SmoothingMode = 'AntiAlias'
  $path = New-Object System.Drawing.Drawing2D.GraphicsPath
  $path.AddArc(1, 1, 10, 10, 180, 90); $path.AddArc(21, 1, 10, 10, 270, 90)
  $path.AddArc(21, 21, 10, 10, 0, 90); $path.AddArc(1, 21, 10, 10, 90, 90); $path.CloseFigure()
  $bg = New-Object System.Drawing.SolidBrush($script:C.Panel); $g.FillPath($bg, $path); $bg.Dispose()
  $ball = New-Object System.Drawing.SolidBrush($Color); $g.FillEllipse($ball, 7, 7, 18, 18); $ball.Dispose()
  $pen = New-Object System.Drawing.Pen($script:C.Bg, 1.6)
  $g.DrawArc($pen, 7, 11, 18, 10, 0, 180); $g.DrawLine($pen, 16, 7, 16, 25); $pen.Dispose()
  $g.Dispose(); $path.Dispose()
  $h = $bmp.GetHicon(); $icon = [System.Drawing.Icon]::FromHandle($h)
  $old = $script:tray.Icon
  $script:tray.Icon = $icon; $script:trayColor = $Color
  $script:form.Icon = $icon
  $bmp.Dispose()
  if ($old -and $old -ne [System.Drawing.SystemIcons]::Application) { try { $old.Dispose() } catch { } }
}
try { Set-TrayIcon $script:C.Amber } catch { $script:tray.Icon = [System.Drawing.SystemIcons]::Application }
$script:tray.Text = 'RL Stats'
$script:tray.Visible = $true
$script:menu = New-Object System.Windows.Forms.ContextMenuStrip
[void]$script:menu.Items.Add('Show', $null, { $script:form.Show(); $script:form.Activate() })
[void]$script:menu.Items.Add('Open dashboard', $null, { Open-Dashboard })
[void]$script:menu.Items.Add('Open data folder', $null, { Start-Process explorer.exe $OutDir })
[void]$script:menu.Items.Add('Check for updates', $null, { Invoke-UpdateCheckNow })
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

function Update-Extras {
  foreach ($name in $script:specLabels.Keys) {
    $l = $script:specLabels[$name]
    if ($script:Watching.Contains($name)) { $l.Text = "$script:Bullet $name"; $l.ForeColor = $script:C.Blue }
    else { $l.Text = "$([char]0x25CB) $name"; $l.ForeColor = $script:C.Muted }
  }
  $script:drinksCount.Text = [string]$script:Drinks
  # Drinks are $DrinksPlayer's, but every widget shows them and can change them (they're shared).
  foreach ($l in $script:drinksParts) { $l.Visible = $true }
}
function Switch-Spectator([string]$Name) {
  if ($script:Watching.Contains($Name)) { [void]$script:Watching.Remove($Name) } else { $script:Watching.Add($Name) }
  Update-Extras; Send-Crew
}
$script:drinksPlus.add_Click({ if ($script:Drinks -lt 30) { $script:Drinks++ }; Update-Extras; Send-Crew })
$script:drinksMinus.add_Click({ if ($script:Drinks -gt 0) { $script:Drinks-- }; Update-Extras; Send-Crew })

# ---- shared crew ------------------------------------------------------------------------------
# Watching and drinks live on the dashboard site too, so a click on either widget shows on the
# others within a few seconds. Changes are pushed straight away; the site is read every 8 seconds.
$script:crewJob = $null; $script:crewPush = $false; $script:crewChanged = [DateTime]::MinValue
$script:crewPulled = [DateTime]::MinValue
function Send-Crew { $script:crewPush = $true; $script:crewChanged = [DateTime]::UtcNow }
function Start-CrewJob([bool]$Push) {
  $body = $null
  if ($Push) {
    $body = @{ watching = @($script:Watching); drinks = @{ $DrinksPlayer = $script:Drinks } } | ConvertTo-Json -Compress -Depth 4
  }
  $ps = [powershell]::Create()
  [void]$ps.AddScript({
    param($CfgPath, $Body)
    $ErrorActionPreference = 'Stop'
    try { [Net.ServicePointManager]::SecurityProtocol = [Net.ServicePointManager]::SecurityProtocol -bor [Net.SecurityProtocolType]::Tls12 } catch { }
    $cfg = Get-Content $CfgPath -Raw | ConvertFrom-Json
    $base = ([Uri]$cfg.url).GetLeftPart([UriPartial]::Authority)
    $h = @{ 'X-Upload-Key' = [string]$cfg.key }
    if ($Body) { Invoke-RestMethod -Uri "$base/api/crew" -Method Post -Headers $h -Body $Body -ContentType 'application/json' -TimeoutSec 6 -UseBasicParsing }
    else { Invoke-RestMethod -Uri "$base/api/crew" -Headers $h -TimeoutSec 6 -UseBasicParsing }
  }).AddArgument((Join-Path $OutDir 'upload.json')).AddArgument($body)
  $script:crewJob = @{ PS = $ps; Handle = $ps.BeginInvoke(); Started = [DateTime]::UtcNow; Push = $Push }
}
function Step-Crew {
  if (-not (Test-Path (Join-Path $OutDir 'upload.json'))) { return }
  $j = $script:crewJob
  if ($j) {
    if (-not $j.Handle.IsCompleted) { return }
    $script:crewJob = $null
    $r = $null
    try { $r = @($j.PS.EndInvoke($j.Handle)) | Select-Object -Last 1 } catch { if ($j.Push) { $script:crewPush = $true } }
    $j.PS.Dispose()
    # Apply what the site says unless something was clicked here after this request went out.
    if ($r -and $null -ne $r.rev -and [int]$r.rev -gt 0 -and $j.Started -gt $script:crewChanged -and -not $script:crewPush) {
      $script:Watching.Clear()
      foreach ($n in @($r.watching)) { if ($n -and $script:Spectators -contains $n -and -not $script:Watching.Contains([string]$n)) { $script:Watching.Add([string]$n) } }
      $d = 0; if ($r.drinks -and $null -ne $r.drinks.$DrinksPlayer) { $d = [int]$r.drinks.$DrinksPlayer }
      $script:Drinks = $d
      Update-Extras
    }
    return
  }
  if ($script:crewPush) { $script:crewPush = $false; Start-CrewJob $true; return }
  if (([DateTime]::UtcNow - $script:crewPulled).TotalSeconds -ge 8) { $script:crewPulled = [DateTime]::UtcNow; Start-CrewJob $false }
}
$script:crewTimer = New-Object System.Windows.Forms.Timer
$script:crewTimer.Interval = 500
$script:crewTimer.add_Tick({ try { Step-Crew } catch { } })
# Called by the recorder as each match is saved.
$script:MatchExtras = {
  $x = [ordered]@{ spectators = @($script:Spectators | Where-Object { $script:Watching.Contains($_) }) }
  $x.drinks = @{ $DrinksPlayer = $script:Drinks }
  return $x
}
$script:Spectators = $Spectators

function Set-Pin([bool]$On) {
  $script:form.TopMost = $On
  if ($On) { $script:pin.ForeColor = $script:C.Blue } else { $script:pin.ForeColor = $script:C.Muted }
}
$script:pin.add_Click({ Set-Pin (-not $script:form.TopMost) })
$script:themeMenu = New-Object System.Windows.Forms.ContextMenuStrip
foreach ($key in $script:Themes.Keys) {
  $it = New-Object System.Windows.Forms.ToolStripMenuItem($script:Themes[$key])
  $it.Tag = $key; $it.Checked = ($key -eq $script:Theme)
  $it.add_Click({ param($s, $e) Set-Theme ([string]$s.Tag) })
  [void]$script:themeMenu.Items.Add($it)
}
$script:themeBtn.add_Click({ $script:themeMenu.Show($script:themeBtn, (New-Object System.Drawing.Point(0, $script:themeBtn.Height))) })
function Set-Theme([string]$Name) {
  if ($Name -eq $script:Theme) { return }
  if ($script:InMatch) {
    [void][System.Windows.Forms.MessageBox]::Show('Finish this match first, then switch themes (the widget restarts to apply it).', 'RL Stats', 'OK', 'Information')
    return
  }
  $script:Theme = $Name            # saved to widget.json as the widget closes
  $script:restartAfterClose = $true
  $script:form.Close()
}
$script:min.add_Click({ $script:form.Hide(); $script:tray.ShowBalloonTip(2000, 'RL Stats', 'Still recording. Double-click the tray icon to bring it back.', 'Info') })
$script:close.add_Click({ $script:form.Close() })
$script:openLink.add_Click({ if (-not (Test-Path $OutDir)) { [void](New-Item -ItemType Directory -Path $OutDir) }; Start-Process explorer.exe $OutDir })
$script:dashLink.add_Click({ Open-Dashboard })
$script:checkLink.add_Click({ Invoke-UpdateCheckNow })
$script:mmrLink.add_Click({ Show-TypeMmr })

# The title bar only has room for a few words, so long messages get a short form there;
# the tray tooltip keeps the full text.
$script:ShortStatus = @{
  'Connected, waiting for a match' = 'Ready for a match'
  'Waiting for Rocket League' = 'Waiting for RL'
  'Match saved, waiting for the next one' = 'Match saved'
  'Stats API is off: run Enable Stats API' = 'Stats API is off'
  'Update failed, try again later' = 'Update failed'
}
function Set-Status([string]$Text, $Color) {
  $short = $script:ShortStatus[$Text]; if (-not $short) { $short = $Text }
  $script:status.Text = $short; $script:dot.ForeColor = $Color
  $script:tray.Text = ('RL Stats: ' + $Text).Substring(0, [math]::Min(63, 10 + $Text.Length))
  try { Set-TrayIcon $Color } catch { }
}

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
        elseif ($col.Saved) { $v = Get-Field $p $col.Saved }
        else { $v = Get-Field $p $col.K.ToLower() }
      }
      if ($null -eq $v) { $cells[$col.K].Text = '-' } else { $cells[$col.K].Text = [string][math]::Round([double]$v) }
    }
    if ($Mode -eq 'live' -and $p) {
      $sp = Get-Field $p 'Speed'; if ($null -ne $sp) { $sp = [double]$sp; if ($sp -gt 300) { $sp = $sp * 0.036 } }   # uu/s to km/h
      $bst = Get-Field $p 'Boost'; if ($null -eq $bst -and $p -isnot [System.Collections.IDictionary]) { $bst = Get-Boost $p }
      $script:Live[$name] = @{ Boost = $bst; Speed = $sp; Super = [bool](Get-Field $p 'bSupersonic') }
    } else { [void]$script:Live.Remove($name) }
    $cells.Meter.Invalidate()
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
      $st = $null; try { $st = [datetime]::Parse($o.started_at).ToLocalTime() } catch { }
      [void]$script:History.Add(@{ ended = [datetime]::Parse($o.ended_at).ToLocalTime(); started = $st; result = $o.result
        playlist = $o.playlist; us = $o.team_score; them = $o.opponent_score; players = (Get-HistPlayers $o.players) })
    } catch { }
  }
}

# Goals, saves and score per tracked player, kept with each match for the session line.
function Get-HistPlayers($Players) {
  $h = @{}
  foreach ($p in @($Players)) {
    if ($p -is [System.Collections.IDictionary]) { $p = [pscustomobject]$p }   # live records hold dictionaries
    $n = [string](Get-Prop $p 'name')
    if ($n -and $TrackedPlayers -contains $n) { $h[$n] = @{ g = [int](Get-Prop $p 'goals' 0); sv = [int](Get-Prop $p 'saves' 0); sc = [int](Get-Prop $p 'score' 0) } }
  }
  return $h
}
# A session is every game with less than 90 minutes between them (the dashboard uses the same rule).
# Returns the latest session and whether it is still going (last game within 90 minutes).
function Get-LatestSession {
  $games = @($script:History | Where-Object { $_.result -eq 'Win' -or $_.result -eq 'Loss' } | Sort-Object { $_.ended })
  if ($games.Count -eq 0) { return @{ Games = @(); Current = $false } }
  $i = $games.Count - 1
  while ($i -gt 0 -and ($games[$i].ended - $games[$i - 1].ended).TotalMinutes -le 90) { $i-- }
  return @{ Games = @($games[$i..($games.Count - 1)]); Current = (((Get-Date) - $games[-1].ended).TotalMinutes -le 90) }
}
function Get-CurrentSession { $s = Get-LatestSession; if ($s.Current) { return $s.Games } else { return @() } }
function Update-Session {
  $sess = Get-LatestSession
  $games = @($sess.Games)
  $w = @($games | Where-Object { $_.result -eq 'Win' }).Count
  $l = $games.Count - $w
  if ($games.Count -eq 0) { $script:today.Text = 'Session: no games yet'; $script:sessStats.Text = ''; $script:sessWhen.Text = '' }
  else {
    $label = 'Session'; if (-not $sess.Current) { $label = 'Last session' }
    $script:today.Text = ('{0}: {1}W {2} {3}L  ({4}%)' -f $label, $w, $script:Dash, $l, [math]::Round(100 * $w / $games.Count))
    # when: day, date and the time span, e.g. "SAT 27 SEP 20:15-21:40"
    $from = $games[0].started; if (-not $from) { $from = $games[0].ended.AddMinutes(-6) }
    $to = $games[-1].ended
    $script:sessWhen.Text = ($from.ToString('ddd d MMM HH:mm', [Globalization.CultureInfo]::InvariantCulture).ToUpper() + '-' + $to.ToString('HH:mm'))
    $bits = @()
    foreach ($n in $TrackedPlayers) {
      $g = 0; $sv = 0; $sc = 0; $any = $false
      foreach ($m in $games) { if ($m.players -and $m.players.ContainsKey($n)) { $any = $true; $g += $m.players[$n].g; $sv += $m.players[$n].sv; $sc += $m.players[$n].sc } }
      if ($any) {
        $short = ($n -split '\s+')[0] -replace '\d.*$', ''
        if ($short) { $short = $short.Substring(0, 1).ToUpper() + $short.Substring(1) } else { $short = $n }
        $bits += ('{0} {1}G {2}SV {3}pts' -f $short, $g, $sv, $sc)
      }
    }
    $script:sessStats.Text = ($bits -join '   |   ')
  }

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

# ---- goal GIFs ---------------------------------------------------------------------------------
# Every goal pops up a random GIF next to the widget for a few seconds. The dashboard site picks
# one from GIPHY; if it can't, a random file from Documents\RLStats\gifs is used instead.
# Set GoalGifs to false in Documents\RLStats\widget.json to switch it off.
$script:GoalGifs = $true
$script:gifJob = $null
$script:gifPopup = $null
function Start-GoalGif($Goal) {
  if (-not $script:GoalGifs -or $script:gifJob) { return }
  $ps = [powershell]::Create()
  [void]$ps.AddScript({
    param($CfgPath, $GifDir)
    $ErrorActionPreference = 'Stop'
    try { [Net.ServicePointManager]::SecurityProtocol = [Net.ServicePointManager]::SecurityProtocol -bor [Net.SecurityProtocolType]::Tls12 } catch { }
    try {
      $cfg = Get-Content $CfgPath -Raw | ConvertFrom-Json
      $base = ([Uri]$cfg.url).GetLeftPart([UriPartial]::Authority)
      $r = Invoke-RestMethod -Uri "$base/api/gif" -Headers @{ 'X-Upload-Key' = [string]$cfg.key } -TimeoutSec 5 -UseBasicParsing
      if ($r.url) {
        $file = Join-Path ([IO.Path]::GetTempPath()) ('rlstats-goal-' + [guid]::NewGuid().ToString('N').Substring(0, 8) + '.gif')
        Invoke-WebRequest -Uri ([string]$r.url) -OutFile $file -TimeoutSec 8 -UseBasicParsing
        return @{ Path = $file; Temp = $true; Credit = 'GIPHY' }
      }
    } catch { }
    if (Test-Path $GifDir) {
      $f = Get-ChildItem $GifDir -Filter '*.gif' -File | Get-Random
      if ($f) { return @{ Path = $f.FullName; Temp = $false; Credit = '' } }
    }
    return $null
  }).AddArgument((Join-Path $OutDir 'upload.json')).AddArgument((Join-Path $OutDir 'gifs'))
  $who = [string]$Goal.scorer
  $script:gifJob = @{ PS = $ps; Handle = $ps.BeginInvoke(); Who = $who; Ours = ($TrackedPlayers -contains $who) }
}
function Step-GoalGif {
  $j = $script:gifJob
  if (-not $j -or -not $j.Handle.IsCompleted) { return }
  $script:gifJob = $null
  $res = $null
  try { $res = @($j.PS.EndInvoke($j.Handle)) | Where-Object { $_ } | Select-Object -Last 1 } catch { }
  $j.PS.Dispose()
  if ($res -and $res.Path -and (Test-Path $res.Path)) { Show-GoalGif $res $j.Who $j.Ours }
}
function Close-GoalGif {
  $p = $script:gifPopup; if (-not $p) { return }
  $script:gifPopup = $null
  try { $p.Timer.Stop(); $p.Form.Close(); $p.Image.Dispose(); $p.Form.Dispose() } catch { }
  if ($p.Temp) { try { Remove-Item $p.Path -Force } catch { } }
}
function Show-GoalGif($Res, [string]$Who, [bool]$Ours) {
  Close-GoalGif
  try { $img = [System.Drawing.Image]::FromFile($Res.Path) } catch { return }
  $w = 300; $h = [int][math]::Round($w * $img.Height / [math]::Max(1, $img.Width)); $h = [math]::Max(120, [math]::Min(320, $h))
  $f = New-Object System.Windows.Forms.Form
  $f.FormBorderStyle = 'None'; $f.StartPosition = 'Manual'; $f.ShowInTaskbar = $false; $f.TopMost = $true
  $f.BackColor = $script:C.Bg; $f.ClientSize = New-Object System.Drawing.Size($w, ($h + 26))
  $pb = New-Object System.Windows.Forms.PictureBox
  $pb.SizeMode = 'Zoom'; $pb.Location = New-Object System.Drawing.Point(0, 0); $pb.Size = New-Object System.Drawing.Size($w, $h); $pb.Image = $img
  $text = 'GOAL'; if ($Who) { $text = "GOAL: $Who" }
  $col = $script:C.Loss; if ($Ours) { $col = $script:C.Win }
  $cap = New-Label $text 8 ($h + 3) 200 20 $script:F.Bold $col
  $credit = New-Label '' 200 ($h + 3) 92 20 $script:F.Small $script:C.Muted 'MiddleRight'
  if ($Res.Credit) { $credit.Text = 'via ' + $Res.Credit }
  $f.Controls.AddRange(@($pb, $cap, $credit))
  # Above the widget, or below it when the widget sits near the top of the screen.
  $wa = [System.Windows.Forms.Screen]::FromControl($script:form).WorkingArea
  $x = [math]::Min($wa.Right - $w - 4, [math]::Max($wa.Left + 4, $script:form.Left + $script:form.Width - $w))
  $y = $script:form.Top - $f.Height - 8
  if (-not $script:form.Visible -or $y -lt $wa.Top) { $y = [math]::Min($wa.Bottom - $f.Height - 4, $script:form.Bottom + 8) }
  if (-not $script:form.Visible) { $x = $wa.Right - $w - 20; $y = $wa.Bottom - $f.Height - 20 }
  $f.Location = New-Object System.Drawing.Point($x, $y)
  $t = New-Object System.Windows.Forms.Timer; $t.Interval = 5000
  $t.add_Tick({ Close-GoalGif })
  foreach ($c in $f, $pb, $cap, $credit) { $c.add_Click({ Close-GoalGif }) }
  $script:gifPopup = @{ Form = $f; Timer = $t; Image = $img; Path = $Res.Path; Temp = [bool]$Res.Temp }
  Set-RoundCorners $f
  $f.Show(); $t.Start()
}
$script:OnGoal = { param($Goal) Start-GoalGif $Goal }
$script:gifPoll = New-Object System.Windows.Forms.Timer
$script:gifPoll.Interval = 250
$script:gifPoll.add_Tick({ try { Step-GoalGif } catch { } })

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
  Set-TeamName $script:blueName ([string]$bn).ToUpper(); Set-TeamName $script:orangeName ([string]$on).ToUpper()
  $pl = $null; $plId = Get-Prop $game 'PlaylistId'
  if ($null -ne $plId -and $Playlists.ContainsKey([int]$plId)) { $pl = $Playlists[[int]$plId] }
  $script:sub.Text = (@($pl, (Format-Clock (Get-Prop $game 'TimeSeconds') ([bool](Get-Prop $game 'bOvertime' $false)))) | Where-Object { $_ }) -join '   '
  $script:sub.ForeColor = $script:C.Muted
  Set-PlayerRows @(Get-Prop $Data 'Players' @()) 'live'
  $script:gauge.Invalidate()
  if (-not $script:InMatch) { $script:InMatch = $true; Set-Status 'In a match' $script:C.Blue }
}

$script:OnMatchSaved = {
  param($Record)
  $script:InMatch = $false
  $st = $null; try { $st = [datetime]::Parse($Record.started_at).ToLocalTime() } catch { }
  [void]$script:History.Add(@{ ended = (Get-Date); started = $st; result = $Record.result; playlist = $Record.playlist
    us = $Record.team_score; them = $Record.opponent_score; players = (Get-HistPlayers $Record.players) })
  $color = $script:C.Muted
  if ($Record.result -eq 'Win') { $color = $script:C.Win } elseif ($Record.result -eq 'Loss') { $color = $script:C.Loss }
  $script:sub.Text = ('{0}  {1}' -f $Record.result.ToUpper(), $Record.playlist)
  $script:sub.ForeColor = $color
  Set-PlayerRows @($Record.players) 'saved'
  $script:gauge.Invalidate()
  Set-Status 'Match saved, waiting for the next one' $script:C.Win
  Update-Session
  Update-Mmr
  if ($Record.result -eq 'Win' -or $Record.result -eq 'Loss') {
    $script:tray.ShowBalloonTip(3000, 'RL Stats', ('{0} {1}-{2} saved' -f $Record.result, $Record.team_score, $Record.opponent_score), 'Info')
  }
}

$script:OnMmr = { param($Sample) Update-Mmr }

# ---- saved window position ----------------------------------------------------------------------
# Scale the whole layout up, then place it in the bottom-right corner (saved position below wins).
$script:form.Scale((New-Object System.Drawing.SizeF([single]$script:UiScale, [single]$script:UiScale)))
$script:form.Location = New-Object System.Drawing.Point(($script:wa.Right - $script:form.Width - 20), ($script:wa.Bottom - $script:form.Height - 28))
$script:prefsFile = Join-Path $OutDir 'widget.json'
try {
  if (Test-Path $script:prefsFile) {
    $prefs = Get-Content $script:prefsFile -Raw | ConvertFrom-Json
    $pt = New-Object System.Drawing.Point([int]$prefs.x, [int]$prefs.y)
    if ([System.Windows.Forms.Screen]::AllScreens | Where-Object { $_.WorkingArea.Contains($pt) }) { $script:form.Location = $pt }
    Set-Pin ([bool]$prefs.pinned)
    if ($null -ne $prefs.GoalGifs) { $script:GoalGifs = [bool]$prefs.GoalGifs }
    # Watchers and drinks carry over a restart, but not to the next night.
    $fresh = $false
    try { $fresh = ((Get-Date) - [datetime]::Parse([string]$prefs.saved_at)).TotalHours -lt 8 } catch { }
    if ($fresh) {
      foreach ($n in @($prefs.watching)) { if ($n -and $Spectators -contains $n) { $script:Watching.Add([string]$n) } }
      if ($prefs.drinks -match '^\d+$') { $script:Drinks = [int]$prefs.drinks }
    }
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
$script:slow.add_Tick({ try { Update-Session; Update-Extras } catch { } })

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
# The "Check updates" link: runs the same background check now and says what it found.
$script:manualCheck = $null
function Invoke-UpdateCheckNow {
  if ($script:updLink.Visible) { Invoke-UpdateNow; return }
  if (-not (Get-Command Test-RLStatsUpdate -ErrorAction SilentlyContinue)) { Show-Note 'Updates are not set up on this PC' $script:C.Loss; return }
  $script:manualCheck = @{ Text = $script:status.Text; Color = $script:dot.ForeColor }
  $script:status.Text = 'Checking for updates...'
  Start-UpdateCheck
}
# Shows a status message for a few seconds, then puts the previous one back.
$script:noteTimer = New-Object System.Windows.Forms.Timer
$script:noteTimer.Interval = 4000
$script:noteRestore = $null
$script:noteTimer.add_Tick({
  $script:noteTimer.Stop()
  if ($script:noteRestore -and $script:status.Text -eq $script:noteRestore.Shown) { Set-Status $script:noteRestore.Text $script:noteRestore.Color }
  $script:noteRestore = $null
})
function Show-Note([string]$Text, $Color) {
  $prev = @{ Text = $script:status.Text; Color = $script:dot.ForeColor }
  if ($script:manualCheck) { $prev = $script:manualCheck }
  Set-Status $Text $Color
  $script:noteRestore = @{ Text = $prev.Text; Color = $prev.Color; Shown = $Text }
  $script:noteTimer.Stop(); $script:noteTimer.Start()
}
function Step-UpdateCheck {
  $c = $script:updCheck
  if (-not $c -or -not $c.Handle.IsCompleted) { return }
  $n = -1
  try { $n = [int](@($c.PS.EndInvoke($c.Handle)) | Select-Object -Last 1) } catch { }
  $c.PS.Dispose(); $script:updCheck = $null
  $manual = $script:manualCheck
  if ($manual -and $n -eq 0) { Show-Note 'Up to date' $script:C.Win }
  if ($manual -and $n -lt 0) { Show-Note "Couldn't reach the dashboard to check" $script:C.Loss }
  $script:manualCheck = $null
  if ($manual -and $n -gt 0) { Set-Status $manual.Text $manual.Color }
  if ($n -gt 0) {
    $script:status.Width = [int](138 * $script:UiScale); $script:updLink.Visible = $true; $script:updLink.BringToFront()
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
  Set-RoundCorners $script:form
  try {
    Set-Status 'Waiting for Rocket League' $script:C.Amber
    Import-History; Update-Session
    Test-StatsApiConfig
    Initialize-Upload
    Initialize-MmrLog; Update-Mmr; Update-Extras
  } catch { Set-Status "Error: $($_.Exception.Message)" $script:C.Loss }
  $script:form.Refresh()
  Stop-Splash
  $script:form.Opacity = 1
  $script:timer.Start(); $script:slow.Start(); $script:updTimer.Start(); $script:updPoll.Start(); $script:gifPoll.Start(); $script:crewTimer.Start()
})

$script:form.add_FormClosing({
  $script:timer.Stop(); $script:slow.Stop(); $script:updTimer.Stop(); $script:updPoll.Stop(); $script:gifPoll.Stop(); Close-GoalGif
  try {
    if (-not (Test-Path $OutDir)) { [void](New-Item -ItemType Directory -Path $OutDir) }
    $json = ConvertTo-Json -InputObject @{ x = $script:form.Left; y = $script:form.Top; pinned = $script:form.TopMost
      watching = @($script:Watching); drinks = $script:Drinks; saved_at = (Get-Date).ToString('o'); GoalGifs = $script:GoalGifs; theme = $script:Theme } -Compress
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
