<#
  Rocket League match recorder.

  Listens to Rocket League's official Stats API (local TCP, port 49123) and
  saves one record per finished online match: goals, assists, shots, saves,
  demos, score, win/loss, playlist, arena and timestamps for every player.

  Output (created on first match):
    Documents\RLStats\matches.jsonl   one JSON object per match (for the dashboard)
    Documents\RLStats\players.csv     one row per player per match (open in Excel)

  Run: double-click "Start RL Recorder.bat" (console) or "RL Stats Widget.bat"
  (small desktop window, which loads this file). Leave it open while you play.
  It waits for the game and reconnects on its own.
#>
param(
  [string[]]$TrackedPlayers = @('jay29ID', 'Kobra Kelvin'),
  [string]$HostName = '127.0.0.1',
  [int]$Port = 49123,
  [string]$OutDir = (Join-Path ([Environment]::GetFolderPath('MyDocuments')) 'RLStats'),
  [string]$GameLogDir = (Join-Path ([Environment]::GetFolderPath('MyDocuments')) 'My Games\Rocket League\TAGame\Logs'),
  [switch]$NoUpdate,  # set when relaunching after a self-update
  [switch]$NoLoop   # used by the widget, which drives Step-Connection from a timer
)

$ErrorActionPreference = 'Stop'
$Utf8NoBom = New-Object System.Text.UTF8Encoding($false)

# Known playlist ids (Game.PlaylistId). Unknown ids are saved as the number.
$Playlists = @{
  1 = 'Casual Duel'; 2 = 'Casual Doubles'; 3 = 'Casual Standard'; 4 = 'Casual Chaos'
  6 = 'Private Match'; 10 = 'Ranked Duel'; 11 = 'Ranked Doubles'; 13 = 'Ranked Standard'
  22 = 'Tournament'; 27 = 'Ranked Hoops'; 28 = 'Ranked Rumble'; 29 = 'Ranked Dropshot'
  30 = 'Ranked Snow Day'; 34 = 'Tournament'
}

# Hooks the widget sets: $script:LogHook (text, color), $script:OnState (UpdateState data),
# $script:OnMatchSaved (match record).
$script:LogHook = $null; $script:OnState = $null; $script:OnMatchSaved = $null; $script:MatchExtras = $null; $script:OnGoal = $null

function Write-Log([string]$Text, [string]$Color = 'Gray') {
  if ($script:LogHook) { & $script:LogHook $Text $Color; return }
  Write-Host ("[{0}] {1}" -f (Get-Date -Format 'HH:mm:ss'), $Text) -ForegroundColor $Color
}

function Get-Prop($Obj, [string]$Name, $Default = $null) {
  if ($null -eq $Obj) { return $Default }
  $p = $Obj.PSObject.Properties[$Name]
  if ($null -eq $p -or $null -eq $p.Value) { return $Default }
  return $p.Value
}

function Get-Int($Obj, [string]$Name) { [int](Get-Prop $Obj $Name 0) }

# The Stats API leaves zero and false values out of UpdateState, so an empty boost tank arrives as
# no Boost field at all. Your own team's players always carry some car fields; opponents never do.
$script:OwnCarFields = 'Boost', 'Speed', 'bHasCar', 'bOnGround', 'bOnWall', 'bBoosting', 'bSupersonic', 'bPowersliding', 'bDemolished'
function Get-Boost($P) {
  if ($null -eq $P) { return $null }
  $b = Get-Prop $P 'Boost'
  if ($null -ne $b) { return [double]$b }
  foreach ($k in $script:OwnCarFields) { if ($null -ne $P.PSObject.Properties[$k]) { return 0.0 } }
  return $null
}

function Test-StatsApiConfig {
  $roots = @(
    "$env:ProgramFiles\Epic Games\rocketleague",
    "${env:ProgramFiles(x86)}\Steam\steamapps\common\rocketleague"
  )
  foreach ($root in $roots) {
    foreach ($name in 'TAStatsAPI.ini', 'DefaultStatsAPI.ini') {
      $ini = Join-Path $root "TAGame\Config\$name"
      if (-not (Test-Path $ini)) { continue }
      $m = Select-String -Path $ini -Pattern '^\s*PacketSendRate\s*=\s*(\d+)' | Select-Object -First 1
      if ($m -and [int]$m.Matches[0].Groups[1].Value -gt 0) {
        Write-Log "Stats API is switched on in $ini" 'Green'
      } else {
        Write-Log "Stats API looks switched off. Set PacketSendRate=5 in $ini and restart the game." 'Yellow'
      }
      return
    }
  }
  Write-Log 'Could not find the Stats API config file; skipping the check.' 'DarkGray'
}

# Splits the raw TCP stream into complete top-level JSON objects.
# The game sends objects back to back with no delimiter.
$script:FrameBuf = New-Object System.Text.StringBuilder
function Get-Frames([string]$Chunk) {
  [void]$script:FrameBuf.Append($Chunk)
  $text = $script:FrameBuf.ToString()
  $frames = New-Object System.Collections.Generic.List[string]
  $depth = 0; $inStr = $false; $esc = $false; $start = -1; $consumed = 0
  for ($i = 0; $i -lt $text.Length; $i++) {
    $c = $text[$i]
    if ($inStr) {
      if ($esc) { $esc = $false }
      elseif ($c -eq '\') { $esc = $true }
      elseif ($c -eq '"') { $inStr = $false }
      continue
    }
    if ($c -eq '"') { $inStr = $true }
    elseif ($c -eq '{') { if ($depth -eq 0) { $start = $i }; $depth++ }
    elseif ($c -eq '}' -and $depth -gt 0) {
      $depth--
      if ($depth -eq 0) { $frames.Add($text.Substring($start, $i - $start + 1)); $consumed = $i + 1 }
    }
  }
  if ($depth -eq 0 -and -not $inStr) { $consumed = $text.Length }
  [void]$script:FrameBuf.Remove(0, $consumed)
  return , $frames
}

# Per-match state, keyed by MatchGuid.
$script:OpenMatches = @{}
# Matches already saved. The game keeps sending events (podium, MatchDestroyed) after
# MatchEnded, and those must not create a second record.
$script:DoneMatches = New-Object 'System.Collections.Generic.HashSet[string]'
# Saved records, so a ReplayCreated that arrives after MatchEnded can still be attached and re-uploaded.
$script:SavedRecords = @{}

function Get-Match([string]$Guid) {
  if (-not $script:OpenMatches.ContainsKey($Guid)) {
    $script:OpenMatches[$Guid] = @{
      Guid = $Guid; StartedAt = (Get-Date).ToUniversalTime(); State = $null; Saved = $false
      Goals = New-Object System.Collections.ArrayList
      Events = New-Object System.Collections.ArrayList   # raw event log, written to events\<guid>.jsonl
      Agg = @{}          # per-player movement/boost samples from UpdateState
      Feed = @{}         # per-player counts of statfeed events (EpicSave, AerialGoal, ...)
      FeedAgainst = @{}  # per-player counts of statfeed events where they were the second target (e.g. got demoed)
      Hits = @{}         # per-player ball hits and hardest hit
      Crossbars = @{}; BallTeam = @{}; LastSecond = $null
      LastHitBy = @{}; LastHit = $null   # where the ball was on each player's latest touch (shot origin for goals)
      Loadouts = @{}     # per-player car and cosmetics, from UpdateState
      Pickups = @{}      # per-player boost pad pickups (BoostPickup events)
      Left = New-Object System.Collections.ArrayList   # players who quit before the end (PlayerLeft)
      Replay = $null     # set when the game sends ReplayCreated
    }
  }
  return $script:OpenMatches[$Guid]
}

function Add-Count([hashtable]$Table, [string]$Key, [string]$Sub) {
  if (-not $Key) { return }
  if (-not $Table.ContainsKey($Key)) { $Table[$Key] = @{} }
  $Table[$Key][$Sub] = 1 + [int]$Table[$Key][$Sub]
}

function Get-Pct($Part, $Whole) { if ($Whole -gt 0) { [math]::Round(100.0 * $Part / $Whole, 1) } else { $null } }

# Adds one UpdateState snapshot to the running totals. Boost and movement are only
# sent for your own team, so opponents end up with empty values for those.
function Add-Sample($M, $Data) {
  $game = Get-Prop $Data 'Game'
  $ballTeam = Get-Prop (Get-Prop $game 'Ball') 'TeamNum'
  if ($null -ne $ballTeam -and [int]$ballTeam -ge 0 -and [int]$ballTeam -le 1) { $M.BallTeam[[int]$ballTeam] = 1 + [int]$M.BallTeam[[int]$ballTeam] }
  foreach ($p in @(Get-Prop $Data 'Players' @())) {
    $name = [string](Get-Prop $p 'Name')
    $loadout = Get-Prop $p 'Loadout'
    if ($name -and $null -ne $loadout) { $M.Loadouts[$name] = $loadout }
    $boost = Get-Boost $p
    if (-not $name -or $null -eq $boost) { continue }
    if (-not $M.Agg.ContainsKey($name)) {
      $M.Agg[$name] = @{ N = 0; Boost = 0.0; Zero = 0; Full = 0; Boosting = 0; Super = 0; Ground = 0; Wall = 0; Air = 0
        Slide = 0; Speed = 0.0; MaxSpeed = 0.0; DemoedNow = $false; Demoed = 0 }
    }
    $a = $M.Agg[$name]
    $demoed = [bool](Get-Prop $p 'bDemolished' $false)
    if ($demoed -and -not $a.DemoedNow) { $a.Demoed++ }
    $a.DemoedNow = $demoed
    if ($demoed -or -not [bool](Get-Prop $p 'bHasCar' $true)) { continue }
    $speed = [double](Get-Prop $p 'Speed' 0)
    $ground = [bool](Get-Prop $p 'bOnGround' $false); $wall = [bool](Get-Prop $p 'bOnWall' $false)
    $a.N++; $a.Boost += $boost; $a.Speed += $speed
    if ($speed -gt $a.MaxSpeed) { $a.MaxSpeed = $speed }
    if ($boost -lt 1) { $a.Zero++ }
    if ($boost -ge 100) { $a.Full++ }
    if ([bool](Get-Prop $p 'bBoosting' $false)) { $a.Boosting++ }
    if ([bool](Get-Prop $p 'bSupersonic' $false)) { $a.Super++ }
    if ([bool](Get-Prop $p 'bPowersliding' $false)) { $a.Slide++ }
    if ($ground) { $a.Ground++ } elseif ($wall) { $a.Wall++ } else { $a.Air++ }
  }
  # Slim once-a-second timeline for charts (score, boost and speed over time).
  $sec = Get-Prop $game 'TimeSeconds'
  if ($null -ne $sec -and $sec -ne $M.LastSecond) {
    $M.LastSecond = $sec
    $slim = foreach ($p in @(Get-Prop $Data 'Players' @())) {
      [ordered]@{ n = Get-Prop $p 'Name'; b = Get-Boost $p; s = Get-Prop $p 'Speed'; sc = Get-Prop $p 'Score' }
    }
    $teamScores = foreach ($t in @(Get-Prop $game 'Teams' @())) { Get-Int $t 'Score' }
    [void]$M.Events.Add([ordered]@{ Event = 'Sample'; Clock = $sec; Overtime = Get-Prop $game 'bOvertime'; Elapsed = Get-Prop $game 'Elapsed'
      Ball = Get-Prop (Get-Prop $game 'Ball') 'Speed'; Scores = @($teamScores); Players = @($slim) })
  }
}

function Save-Match($M, [string]$Result, $WinnerTeamNum) {
  if ($M.Saved -or $null -eq $M.State) { return }
  $M.Saved = $true
  [void]$script:DoneMatches.Add($M.Guid)
  $game = Get-Prop $M.State 'Game'
  $players = @(Get-Prop $M.State 'Players' @())
  $teams = @(Get-Prop $game 'Teams' @())
  $playlistId = Get-Prop $game 'PlaylistId'
  $playlist = $null
  if ($null -ne $playlistId -and $Playlists.ContainsKey([int]$playlistId)) { $playlist = $Playlists[[int]$playlistId] }

  $myTeam = $null
  foreach ($p in $players) { if ($TrackedPlayers -contains (Get-Prop $p 'Name')) { $myTeam = Get-Int $p 'TeamNum'; break } }

  $score = @{}
  foreach ($t in $teams) { $score[[int](Get-Int $t 'TeamNum')] = Get-Int $t 'Score' }

  if ($Result -eq 'Finished') {
    if ($null -ne $myTeam -and $null -ne $WinnerTeamNum) {
      if ([int]$WinnerTeamNum -eq $myTeam) { $Result = 'Win' } else { $Result = 'Loss' }
    } else { $Result = 'Unknown' }
  }

  $rows = foreach ($p in $players) {
    $name = [string](Get-Prop $p 'Name')
    $a = $M.Agg[$name]; $n = 0; if ($a) { $n = $a.N }
    $hit = $M.Hits[$name]
    $goals = Get-Int $p 'Goals'; $shots = Get-Int $p 'Shots'
    $row = [ordered]@{
      name = $name; primary_id = Get-Prop $p 'PrimaryId'; team = Get-Int $p 'TeamNum'
      tracked = [bool]($TrackedPlayers -contains $name)
      score = Get-Int $p 'Score'; goals = $goals; assists = Get-Int $p 'Assists'
      shots = $shots; saves = Get-Int $p 'Saves'; demos = Get-Int $p 'Demos'
      touches = Get-Int $p 'Touches'; car_touches = Get-Int $p 'CarTouches'
      shooting_pct = Get-Pct $goals $shots
      ball_hits = $null; hardest_hit = $null; crossbar_hits = [int]$M.Crossbars[$name]
      avg_boost = $null; pct_zero_boost = $null; pct_full_boost = $null; pct_boosting = $null
      pct_supersonic = $null; pct_ground = $null; pct_wall = $null; pct_air = $null; pct_powerslide = $null
      avg_speed = $null; max_speed = $null; times_demolished = $null
      statfeed = $M.Feed[$name]; statfeed_against = $M.FeedAgainst[$name]
      boost_pickups = $null; loadout = $M.Loadouts[$name]
    }
    if ($M.Pickups.ContainsKey($name)) { $row.boost_pickups = [int]$M.Pickups[$name] }
    if ($hit) { $row.ball_hits = $hit.Count; if ($hit.Max -gt 0) { $row.hardest_hit = [math]::Round($hit.Max, 1) } }
    if ($a) { $row.times_demolished = $a.Demoed }
    if ($n -gt 0) {
      $row.avg_boost = [math]::Round($a.Boost / $n, 1); $row.pct_zero_boost = Get-Pct $a.Zero $n
      $row.zero_boost_fixed = $true   # older versions never counted an empty tank
      $row.pct_full_boost = Get-Pct $a.Full $n; $row.pct_boosting = Get-Pct $a.Boosting $n
      $row.pct_supersonic = Get-Pct $a.Super $n; $row.pct_ground = Get-Pct $a.Ground $n
      $row.pct_wall = Get-Pct $a.Wall $n; $row.pct_air = Get-Pct $a.Air $n; $row.pct_powerslide = Get-Pct $a.Slide $n
      $row.avg_speed = [math]::Round($a.Speed / $n, 1); $row.max_speed = [math]::Round($a.MaxSpeed, 1)
    }
    $row
  }

  $myScore = $null; $oppScore = $null; $possession = $null
  if ($null -ne $myTeam) {
    $myScore = $score[[int]$myTeam]; $oppScore = $score[1 - [int]$myTeam]
    $possession = Get-Pct ([int]$M.BallTeam[[int]$myTeam]) ([int]$M.BallTeam[0] + [int]$M.BallTeam[1])
  }

  $record = [ordered]@{
    match_guid = $M.Guid
    started_at = $M.StartedAt.ToString('o')
    ended_at = (Get-Date).ToUniversalTime().ToString('o')
    duration_seconds = Get-Prop $game 'Elapsed'
    playlist_id = $playlistId; playlist = $playlist
    arena = Get-Prop $game 'Arena'
    overtime = [bool](Get-Prop $game 'bOvertime' $false)
    my_team = $myTeam; result = $Result
    team_score = $myScore; opponent_score = $oppScore
    blue_score = $score[0]; orange_score = $score[1]
    possession_pct = $possession
    mmr_at_queue = $null; mmr_party_size = $null
    goals = @($M.Goals)
    players = @($rows)
    players_left = @($M.Left)
    replay_created = $M.Replay
  }

  if ($null -ne $myTeam) { foreach ($g in $M.Goals) { if ($null -ne $g.team) { $g.ours = ([int]$g.team -eq [int]$myTeam) } } }

  $q = $null; if ($playlist) { $q = Get-QueueMmr $playlist $M.StartedAt }
  if ($q) { $record.mmr_at_queue = $q.mmr; $record.mmr_party_size = $q.party_size }

  # Extra fields from the widget (who was watching, drinks).
  if ($script:MatchExtras) {
    try { $x = & $script:MatchExtras; foreach ($k in @($x.Keys)) { $record[$k] = $x[$k] } } catch { }
  }

  if (-not (Test-Path $OutDir)) { [void](New-Item -ItemType Directory -Path $OutDir) }
  $script:SavedRecords[$M.Guid] = $record
  $json = ConvertTo-Json -InputObject $record -Depth 8 -Compress
  [IO.File]::AppendAllText((Join-Path $OutDir 'matches.jsonl'), $json + "`r`n", $Utf8NoBom)

  # Full event log for this match, so new stats can be worked out later.
  $evDir = Join-Path $OutDir 'events'
  if (-not (Test-Path $evDir)) { [void](New-Item -ItemType Directory -Path $evDir) }
  [void]$M.Events.Add([ordered]@{ Event = 'FinalState'; Data = $M.State })
  $lines = foreach ($e in $M.Events) { ConvertTo-Json -InputObject $e -Depth 10 -Compress }
  [IO.File]::WriteAllText((Join-Path $evDir ($M.Guid + '.jsonl')), (($lines -join "`r`n") + "`r`n"), $Utf8NoBom)

  $cols = 'name','tracked','team','score','goals','assists','shots','saves','demos','touches','car_touches',
    'shooting_pct','ball_hits','hardest_hit','crossbar_hits','avg_boost','pct_zero_boost','pct_full_boost',
    'pct_boosting','pct_supersonic','pct_ground','pct_wall','pct_air','pct_powerslide','avg_speed','max_speed',
    'times_demolished','statfeed'
  $csv = Join-Path $OutDir 'players.csv'
  try {
  $header = 'ended_at,match_guid,playlist,arena,result,team_score,opponent_score,overtime,duration_seconds,possession_pct,' + ($cols -join ',')
  if (Test-Path $csv) {
    # Older versions wrote fewer columns; start a new file instead of mixing layouts.
    $first = Get-Content $csv -TotalCount 1
    if ($first -ne $header) { Move-Item $csv (Join-Path $OutDir ('players-old-' + (Get-Date -Format 'yyyyMMdd-HHmmss') + '.csv')) }
  }
  if (-not (Test-Path $csv)) { [IO.File]::AppendAllText($csv, $header + "`r`n", $Utf8NoBom) }
  foreach ($r in $rows) {
    $vals = @($record.ended_at, $record.match_guid, $record.playlist, $record.arena, $record.result, $record.team_score,
      $record.opponent_score, $record.overtime, $record.duration_seconds, $record.possession_pct)
    foreach ($c in $cols) {
      $v = $r[$c]
      if ($c -eq 'statfeed' -and $v) { $v = (($v.Keys | Sort-Object | ForEach-Object { "$($_):$($v[$_])" }) -join ' ') }
      $vals += $v
    }
    $cells = $vals | ForEach-Object { '"' + ([string]$_).Replace('"', '""') + '"' }
    [IO.File]::AppendAllText($csv, ($cells -join ',') + "`r`n", $Utf8NoBom)
  }
  } catch {
    Write-Log 'Could not update players.csv (is it open in Excel?). The match is still saved in matches.jsonl.' 'Yellow'
  }

  if ($script:OnMatchSaved) { & $script:OnMatchSaved $record }
  try { Send-Upload 'match' $record } catch { Write-Log "Could not queue upload: $($_.Exception.Message)" 'Yellow' }

  $color = 'Yellow'
  if ($Result -eq 'Win') { $color = 'Green' } elseif ($Result -eq 'Loss') { $color = 'Red' }
  Write-Log ("Saved match: {0} {1}-{2} ({3})" -f $Result, $myScore, $oppScore, $playlist) $color
  foreach ($r in $rows) {
    if ($r.tracked) {
      Write-Log ("  {0}: {1} goals, {2} assists, {3} shots, {4} saves, {5} demos, score {6}" -f $r.name, $r.goals, $r.assists, $r.shots, $r.saves, $r.demos, $r.score)
      if ($null -ne $r.avg_boost) {
        Write-Log ("  {0}: avg boost {1}, supersonic {2}%, in air {3}%, hardest hit {4}" -f $r.name, $r.avg_boost, $r.pct_supersonic, $r.pct_air, $r.hardest_hit) 'DarkGray'
      }
    }
  }
}

function Invoke-Message($Msg) {
  $evt = [string](Get-Prop $Msg 'Event')
  $data = Get-Prop $Msg 'Data'
  if ($data -is [string]) { $data = $data | ConvertFrom-Json }   # Data can arrive as a JSON string
  $guid = [string](Get-Prop $data 'MatchGuid' '')
  if (-not $guid) { return }   # freeplay, training and replays have no MatchGuid
  if ($script:DoneMatches.Contains($guid)) {
    # The replay can be created after the match was saved: mark it and re-send; the site merges by match id.
    if ($evt -eq 'ReplayCreated' -and $script:SavedRecords.ContainsKey($guid) -and -not $script:SavedRecords[$guid].replay_created) {
      $script:SavedRecords[$guid].replay_created = (Get-Date).ToUniversalTime().ToString('o')
      try { Send-Upload 'match' $script:SavedRecords[$guid] } catch { }
    }
    return
  }

  $m = Get-Match $guid
  if ($evt -ne 'UpdateState' -and $evt -ne 'ClockUpdatedSeconds') {
    [void]$m.Events.Add([ordered]@{ Event = $evt; At = (Get-Date).ToUniversalTime().ToString('o'); Data = $data })
  }
  switch ($evt) {
    'MatchCreated'  { Write-Log 'Match started.' 'Cyan' }
    'UpdateState'   {
      if (-not [bool](Get-Prop (Get-Prop $data 'Game') 'bReplay' $false)) {
        $m.State = $data; Add-Sample $m $data
        if ($script:OnState) { & $script:OnState $data }
      }
    }
    'GoalScored'    {
      $last = Get-Prop $data 'BallLastTouch'
      # Shot origin: where the ball was when the last toucher hit it (from BallHit events).
      $shot = $m.LastHitBy[[string](Get-Prop (Get-Prop $last 'Player') 'Name')]
      if (-not $shot) { $shot = $m.LastHit }
      if (-not $shot) { $shot = @{ location = $null; player = $null; speed = $null } }
      [void]$m.Goals.Add([ordered]@{
        scorer = Get-Prop (Get-Prop $data 'Scorer') 'Name'
        assister = Get-Prop (Get-Prop $data 'Assister') 'Name'
        team = Get-Prop (Get-Prop $data 'Scorer') 'TeamNum'
        speed = Get-Prop $data 'GoalSpeed'; goal_time = Get-Prop $data 'GoalTime'
        last_touch = Get-Prop (Get-Prop $last 'Player') 'Name'; last_touch_speed = Get-Prop $last 'Speed'
        impact = Get-Prop $data 'ImpactLocation'
        shot_from = $shot.location; shot_from_player = $shot.player; shot_speed = $shot.speed
        ours = $null
      })
      if ($script:OnGoal) { try { & $script:OnGoal $m.Goals[$m.Goals.Count - 1] } catch { } }
    }
    'BallHit'       {
      foreach ($p in @(Get-Prop $data 'Players' @())) {
        $name = [string](Get-Prop $p 'Name'); if (-not $name) { continue }
        if (-not $m.Hits.ContainsKey($name)) { $m.Hits[$name] = @{ Count = 0; Max = 0.0 } }
        $m.Hits[$name].Count++
        $spd = Get-Prop (Get-Prop $data 'Ball') 'PostHitSpeed'
        $hitInfo = @{ player = $name; team = Get-Prop $p 'TeamNum'; speed = $spd; location = Get-Prop (Get-Prop $data 'Ball') 'Location' }
        $m.LastHitBy[$name] = $hitInfo; $m.LastHit = $hitInfo
        if ($null -ne $spd -and [double]$spd -gt $m.Hits[$name].Max) { $m.Hits[$name].Max = [double]$spd }
      }
    }
    'CrossbarHit'   {
      $name = [string](Get-Prop (Get-Prop (Get-Prop $data 'BallLastTouch') 'Player') 'Name')
      if ($name) { $m.Crossbars[$name] = 1 + [int]$m.Crossbars[$name] }
    }
    'StatfeedEvent' {
      $kind = [string](Get-Prop $data 'EventName')
      if (-not $kind) { $kind = [string](Get-Prop $data 'Type') }
      Add-Count $m.Feed ([string](Get-Prop (Get-Prop $data 'MainTarget') 'Name')) $kind
      Add-Count $m.FeedAgainst ([string](Get-Prop (Get-Prop $data 'SecondaryTarget') 'Name')) $kind
    }
    'BoostPickup'   {
      $name = [string](Get-Prop (Get-Prop $data 'Player') 'Name')
      if (-not $name) { $name = [string](Get-Prop $data 'PlayerName') }
      if ($name) { $m.Pickups[$name] = 1 + [int]$m.Pickups[$name] }
    }
    'PlayerLeft'    {
      $pl = Get-Prop $data 'Player'; if ($null -eq $pl) { $pl = $data }
      $name = [string](Get-Prop $pl 'Name')
      if ($name) {
        [void]$m.Left.Add([ordered]@{ name = $name; team = Get-Prop $pl 'TeamNum'
          clock = Get-Prop (Get-Prop $m.State 'Game') 'TimeSeconds'; at = (Get-Date).ToUniversalTime().ToString('o') })
      }
    }
    'ReplayCreated' { $m.Replay = (Get-Date).ToUniversalTime().ToString('o') }
    'MatchEnded'    { Save-Match $m 'Finished' (Get-Prop $data 'WinnerTeamNum'); $script:OpenMatches.Remove($guid) }
    'MatchDestroyed' {
      # Left before the end (or the game closed). Keep it, flagged, so nothing is lost.
      Save-Match $m 'Incomplete' $null; $script:OpenMatches.Remove($guid)
    }
  }
}

# ---- MMR from the game's own log -------------------------------------------------------------
# Each time you start a queue the game writes your skill to Launch.log:
#   Matchmaking: Post-divide PartyLeaderMMR: 47.4225
#   Matchmaking: PartyLeaderTier=(15)
#   Matchmaking: StartMatchmaking at 2026-09-20 13:05:33 in EU7 for playlists 11 on game server
#   Matchmaking: PreferredRegions.Length=(5) PreferredPlaylists.Length=(1) Party.GetOrderedPartyMemberIDs().Length=(2)
# The displayed MMR is mu * 20 + 100. With several playlists selected the value is an average, so
# those are skipped. Only these lines are read; nothing else in the log is touched.
$script:MmrState = @{ Pos = 0L; Partial = ''; Mu = $null; At = $null; Playlists = @(); Player = $null; NextCheck = [datetime]::MinValue }
$script:MmrSeen = New-Object 'System.Collections.Generic.HashSet[string]'
$script:MmrSamples = New-Object System.Collections.ArrayList
$script:OnMmr = $null
$MmrHeader = 'logged_at,player,playlist,mmr,mu,party_size,source'

function Initialize-MmrCsv {
  if (-not (Test-Path $OutDir)) { [void](New-Item -ItemType Directory -Path $OutDir) }
  $csv = Join-Path $OutDir 'mmr.csv'
  if (Test-Path $csv) {
    $first = Get-Content $csv -TotalCount 1
    if ($first -ne $MmrHeader) { Move-Item $csv (Join-Path $OutDir ('mmr-old-' + (Get-Date -Format 'yyyyMMdd-HHmmss') + '.csv')) }
  }
  if (-not (Test-Path $csv)) { [IO.File]::AppendAllText($csv, $MmrHeader + "`r`n", $Utf8NoBom) }
  foreach ($row in (Import-Csv $csv)) {
    if ($row.source -eq 'game log') { [void]$script:MmrSeen.Add("$($row.logged_at)|$($row.playlist)|$($row.mu)") }
    if ($row.mmr -match '^\d+$') {
      $ps = $null; if ($row.party_size -match '^\d+$') { $ps = [int]$row.party_size }
      [void]$script:MmrSamples.Add([ordered]@{ logged_at = $row.logged_at; player = $row.player; playlist = $row.playlist
        mmr = [int]$row.mmr; party_size = $ps })
    }
  }
}

function Read-MmrLine([string]$Line) {
  $st = $script:MmrState
  if ($Line -match 'Party: HandleLocalPlayerLoginStatusChanged PlayerName=(.*?) PlayerID=\S+ LoginStatus=LS_LoggedIn IsPrimary=True') { $st.Player = $Matches[1]; return }
  if ($Line -match 'Matchmaking: Post-divide PartyLeaderMMR: (-?[\d.]+)') {
    $st.Mu = [double]::Parse($Matches[1], [Globalization.CultureInfo]::InvariantCulture); $st.At = $null; $st.Playlists = @(); return
  }
  if ($Line -match 'Matchmaking: StartMatchmaking at (\d{4}-\d{2}-\d{2}) (\d{2}:\d{2}:\d{2}) .*? for playlists ([\d,]+) on game server') {
    $st.At = "$($Matches[1])T$($Matches[2])Z"; $st.Playlists = @($Matches[3].Split(',') | ForEach-Object { [int]$_ }); return
  }
  if ($Line -match 'Matchmaking: PreferredRegions\.Length=\(\d+\) PreferredPlaylists\.Length=\((\d+)\) Party\.GetOrderedPartyMemberIDs\(\)\.Length=\((\d+)\)') {
    $nPlaylists = [int]$Matches[1]; $party = [int]$Matches[2]
    if ($null -ne $st.Mu -and $st.At -and $st.Playlists.Count -eq 1 -and $nPlaylists -eq 1) {
      $plId = $st.Playlists[0]
      $name = $Playlists[$plId]; if (-not $name) { $name = "Playlist $plId" }
      $muText = $st.Mu.ToString([Globalization.CultureInfo]::InvariantCulture)
      $key = "$($st.At)|$name|$muText"
      if ($script:MmrSeen.Add($key)) {
        $sample = [ordered]@{ logged_at = $st.At; player = $st.Player; playlist = $name; playlist_id = $plId
          mmr = [int][math]::Round($st.Mu * 20 + 100); mu = $st.Mu; party_size = $party }
        [void]$script:MmrSamples.Add($sample)
        $cells = @($sample.logged_at, $sample.player, $sample.playlist, $sample.mmr, $muText, $party, 'game log') |
          ForEach-Object { '"' + ([string]$_).Replace('"', '""') + '"' }
        try { [IO.File]::AppendAllText((Join-Path $OutDir 'mmr.csv'), ($cells -join ',') + "`r`n", $Utf8NoBom) }
        catch { Write-Log 'Could not update mmr.csv (is it open in Excel?).' 'Yellow' }
        if ($script:OnMmr) { & $script:OnMmr $sample }
        try { Send-Upload 'mmr' $sample } catch { }
      }
    }
    $st.Mu = $null; $st.At = $null; $st.Playlists = @()
  }
}

function Read-MmrFile([string]$Path, [long]$From) {
  $fs = [IO.File]::Open($Path, 'Open', 'Read', 'ReadWrite, Delete')
  try {
    if ($fs.Length -lt $From) { $From = 0; $script:MmrState.Partial = '' }   # game restarted and began a new log
    [void]$fs.Seek($From, 'Begin')
    $reader = New-Object IO.StreamReader($fs, $Utf8NoBom)
    $text = $script:MmrState.Partial + $reader.ReadToEnd()
    $end = $fs.Position
  } finally { $fs.Close() }
  $lines = $text -split "`r?`n"
  $script:MmrState.Partial = $lines[-1]
  for ($i = 0; $i -lt $lines.Count - 1; $i++) { Read-MmrLine $lines[$i] }
  return $end
}

# Reads older logs once at startup (the game keeps a few Launch-backup-*.log files), then follows Launch.log.
function Initialize-MmrLog {
  try { Initialize-MmrCsv } catch { Write-Log "Could not open mmr.csv: $($_.Exception.Message)" 'Yellow'; return }
  if (-not (Test-Path $GameLogDir)) { Write-Log "Game log folder not found; MMR won't be read automatically." 'DarkGray'; return }
  $before = $script:MmrSamples.Count
  foreach ($f in (Get-ChildItem $GameLogDir -Filter 'Launch-backup-*.log' | Sort-Object LastWriteTime)) {
    try { $script:MmrState.Partial = ''; [void](Read-MmrFile $f.FullName 0); Read-MmrLine $script:MmrState.Partial } catch { }
  }
  $script:MmrState.Partial = ''
  Step-MmrLog
  $found = $script:MmrSamples.Count - $before
  if ($found -gt 0) { Write-Log "Read $found MMR value(s) from the game's logs." 'Green' }
}

function Step-MmrLog {
  $st = $script:MmrState
  if ((Get-Date) -lt $st.NextCheck) { return }
  $st.NextCheck = (Get-Date).AddSeconds(2)
  $path = Join-Path $GameLogDir 'Launch.log'
  if (-not (Test-Path $path)) { return }
  try { $st.Pos = Read-MmrFile $path $st.Pos } catch { }
}

# Latest MMR logged for this playlist within 20 minutes before the match started (when you queued).
function Get-QueueMmr($PlaylistName, [datetime]$StartedUtc) {
  for ($i = $script:MmrSamples.Count - 1; $i -ge 0; $i--) {
    $s = $script:MmrSamples[$i]
    if ($s.playlist -ne $PlaylistName) { continue }
    $at = [datetime]::Parse($s.logged_at, [Globalization.CultureInfo]::InvariantCulture, [Globalization.DateTimeStyles]::AdjustToUniversal)
    $gap = ($StartedUtc - $at).TotalMinutes
    if ($gap -ge -1 -and $gap -le 20) { return $s }
  }
  return $null
}

# ---- Optional upload to the online dashboard ---------------------------------------------------
# Put upload.json in the output folder: { "url": "https://.../api/ingest", "key": "secret" }.
# Every saved match and MMR value is POSTed there. Anything that fails waits in the "outbox"
# folder and is retried every minute, so nothing is lost while offline.
$script:Upload = $null
$script:NextOutboxTry = [datetime]::MinValue

function Initialize-Upload {
  $cfg = Join-Path $OutDir 'upload.json'
  if (-not (Test-Path $cfg)) { return }
  try {
    $c = Get-Content $cfg -Raw | ConvertFrom-Json
    if ($c.url) { $script:Upload = $c; Write-Log "Uploading matches to $($c.url)" 'Green' }
  } catch { Write-Log "upload.json could not be read: $($_.Exception.Message)" 'Yellow' }
}

function Send-Upload([string]$Kind, $Payload) {
  if (-not $script:Upload) { return }
  $body = ConvertTo-Json -InputObject ([ordered]@{ kind = $Kind; data = $Payload }) -Depth 10 -Compress
  $dir = Join-Path $OutDir 'outbox'
  if (-not (Test-Path $dir)) { [void](New-Item -ItemType Directory -Path $dir) }
  $file = Join-Path $dir ('{0}-{1}.json' -f (Get-Date -Format 'yyyyMMddHHmmssfff'), [guid]::NewGuid().ToString('N').Substring(0, 6))
  [IO.File]::WriteAllText($file, $body, $Utf8NoBom)
  $script:NextOutboxTry = [datetime]::MinValue
  Step-Outbox
}

function Step-Outbox {
  if (-not $script:Upload -or (Get-Date) -lt $script:NextOutboxTry) { return }
  $dir = Join-Path $OutDir 'outbox'
  if (-not (Test-Path $dir)) { return }
  foreach ($f in (Get-ChildItem $dir -Filter '*.json' | Sort-Object Name)) {
    try {
      $body = [IO.File]::ReadAllBytes($f.FullName)
      [void](Invoke-RestMethod -Method Post -Uri $script:Upload.url -Body $body -ContentType 'application/json; charset=utf-8' `
        -Headers @{ 'X-Upload-Key' = [string]$script:Upload.key } -TimeoutSec 8 -UseBasicParsing)
      Remove-Item $f.FullName
    } catch {
      Write-Log "Upload failed, will retry in a minute: $($_.Exception.Message)" 'DarkGray'
      $script:NextOutboxTry = (Get-Date).AddMinutes(1)
      return
    }
  }
  $script:NextOutboxTry = (Get-Date).AddMinutes(1)
}

# Non-blocking connection pump: call Step-Connection repeatedly (console loop or widget timer).
$script:Conn = @{ Client = $null; Task = $null; Stream = $null; NextTry = [datetime]::MinValue; Waiting = $false }
$script:Bytes = New-Object byte[] 65536
$script:Chars = New-Object char[] 65536
$script:Decoder = $null

function Test-Connected { return ($null -ne $script:Conn.Stream) }

function Reset-Connection([string]$Why) {
  $c = $script:Conn
  if ($c.Client) { try { $c.Client.Close() } catch { } }
  $c.Client = $null; $c.Task = $null; $c.Stream = $null
  $c.NextTry = (Get-Date).AddSeconds(5)
  if ($Why) { Write-Log $Why 'Yellow' }
  # Anything still open when the game disconnects is kept as incomplete.
  foreach ($k in @($script:OpenMatches.Keys)) { Save-Match $script:OpenMatches[$k] 'Incomplete' $null; $script:OpenMatches.Remove($k) }
}

function Step-Connection {
  Step-MmrLog
  Step-Outbox
  $c = $script:Conn
  if ($c.Stream) {
    try {
      $sock = $c.Client.Client
      if ($sock.Poll(0, [System.Net.Sockets.SelectMode]::SelectRead) -and $sock.Available -eq 0) {
        Reset-Connection 'Rocket League closed the connection. Waiting for it to come back...'; return
      }
      $budget = 64
      while ($c.Stream -and $c.Stream.DataAvailable -and $budget-- -gt 0) {
        $n = $c.Stream.Read($script:Bytes, 0, $script:Bytes.Length)
        if ($n -le 0) { Reset-Connection 'Rocket League closed the connection. Waiting for it to come back...'; return }
        $count = $script:Decoder.GetChars($script:Bytes, 0, $n, $script:Chars, 0)
        foreach ($frame in (Get-Frames (New-Object string($script:Chars, 0, $count)))) {
          try { Invoke-Message ($frame | ConvertFrom-Json) }
          catch { Write-Log "Skipped a message it could not read: $($_.Exception.Message)" 'DarkGray' }
        }
      }
    } catch {
      Reset-Connection 'Lost the connection to Rocket League. Waiting for it to come back...'
    }
    return
  }
  if ($c.Task) {
    if (-not $c.Task.IsCompleted) { return }
    if ($c.Task.Status -eq 'RanToCompletion' -and $c.Client.Connected) {
      $c.Stream = $c.Client.GetStream()
      $script:Decoder = $Utf8NoBom.GetDecoder()
      [void]$script:FrameBuf.Clear()
      $c.Waiting = $false
      Write-Log 'Connected to Rocket League.' 'Green'
    } else {
      try { $c.Client.Close() } catch { }
      $c.Client = $null; $c.NextTry = (Get-Date).AddSeconds(5)
      if (-not $c.Waiting) { Write-Log 'Waiting for Rocket League to start...' 'Yellow'; $c.Waiting = $true }
    }
    $c.Task = $null
    return
  }
  if ((Get-Date) -ge $c.NextTry) {
    $c.Client = New-Object System.Net.Sockets.TcpClient
    $c.Task = $c.Client.ConnectAsync($HostName, $Port)
  }
}

if ($NoLoop) { return }

# Self-update (console mode only; the widget runs its own check before loading this file).
$updater = Join-Path $PSScriptRoot 'RLStatsUpdater.ps1'
if (-not $NoUpdate -and (Test-Path $updater)) {
  . $updater
  if (Update-RLStats -InstallDir $PSScriptRoot -OutDir $OutDir -Log { param($t) Write-Log $t 'Cyan' }) {
    Start-Process powershell.exe -ArgumentList @('-NoProfile', '-ExecutionPolicy', 'Bypass', '-File', ('"' + $PSCommandPath + '"'), '-NoUpdate')
    return
  }
}
Write-Log "Recording matches for: $($TrackedPlayers -join ', ')" 'Cyan'
Write-Log "Saving to $OutDir"
Test-StatsApiConfig
Initialize-Upload
Initialize-MmrLog
while ($true) {
  Step-Connection
  if (Test-Connected) { Start-Sleep -Milliseconds 50 } else { Start-Sleep -Milliseconds 250 }
}
