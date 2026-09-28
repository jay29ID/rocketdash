<#
  Self-update for the RL Stats recorder and widget.

  Update-RLStats checks the dashboard site for newer recorder files and swaps them in.
  It reads the site address and key from Documents\RLStats\upload.json (the same file
  the recorder uploads with) and never changes that file. If upload.json is missing, or
  the site can't be reached, it does nothing and the current version keeps running.

  Server side (rocketdash):
    GET /api/recorder/manifest           -> { version, files: [ { name, size, sha256 } ] }
    GET /api/recorder/file/<name>        -> raw bytes
  Both need the X-Upload-Key header.

  Returns $true when at least one file was replaced, so the caller should restart.
#>

function Update-RLStats {
  param(
    [string]$InstallDir,
    [string]$OutDir = (Join-Path ([Environment]::GetFolderPath('MyDocuments')) 'RLStats'),
    [scriptblock]$Log = { param($Text) }
  )
  $cfgPath = Join-Path $OutDir 'upload.json'
  if (-not (Test-Path $cfgPath)) { return $false }
  try {
    $cfg = Get-Content $cfgPath -Raw | ConvertFrom-Json
    if (-not $cfg.url) { return $false }
    $uri = [Uri]$cfg.url
    $base = $uri.GetLeftPart([UriPartial]::Authority)
    $headers = @{ 'X-Upload-Key' = [string]$cfg.key }
    try { [Net.ServicePointManager]::SecurityProtocol = [Net.ServicePointManager]::SecurityProtocol -bor [Net.SecurityProtocolType]::Tls12 } catch { }

    $manifest = Invoke-RestMethod -Uri "$base/api/recorder/manifest" -Headers $headers -TimeoutSec 6 -UseBasicParsing
    $changed = @()
    foreach ($f in @($manifest.files)) {
      $name = [string]$f.name
      # Only plain file names in the install folder; never upload.json or anything outside it.
      if (-not $name -or $name -match '[\\/:*?"<>|]' -or $name -like '*..*' -or $name -ieq 'upload.json') { continue }
      $local = Join-Path $InstallDir $name
      $hash = $null
      if (Test-Path $local) { $hash = (Get-FileHash -Algorithm SHA256 -Path $local).Hash }
      if ($hash -ne ([string]$f.sha256).ToUpper()) { $changed += $f }
    }
    if ($changed.Count -eq 0) { return $false }

    # Download everything first and check it, so a half-finished update never gets installed.
    $tmp = Join-Path ([IO.Path]::GetTempPath()) ('RLStatsUpdate-' + [guid]::NewGuid().ToString('N'))
    [void](New-Item -ItemType Directory -Path $tmp)
    try {
      foreach ($f in $changed) {
        $dest = Join-Path $tmp $f.name
        $fileUri = "$base/api/recorder/file/" + [Uri]::EscapeDataString([string]$f.name)
        Invoke-WebRequest -Uri $fileUri -Headers $headers -OutFile $dest -TimeoutSec 20 -UseBasicParsing
        $got = (Get-FileHash -Algorithm SHA256 -Path $dest).Hash
        if ($got -ne ([string]$f.sha256).ToUpper()) { throw "Checksum mismatch for $($f.name)" }
      }
      foreach ($f in $changed) { Copy-Item -Path (Join-Path $tmp $f.name) -Destination (Join-Path $InstallDir $f.name) -Force }
    } finally {
      Remove-Item $tmp -Recurse -Force -ErrorAction SilentlyContinue
    }
    & $Log ("Updated to version {0} ({1} file(s))." -f $manifest.version, $changed.Count)
    return $true
  } catch {
    & $Log "Update check skipped: $($_.Exception.Message)"
    return $false
  }
}

# Check only: returns how many files differ from the site's copy (0 when up to date or offline).
# The widget runs this in the background to show its "Update" button.
function Test-RLStatsUpdate {
  param(
    [string]$InstallDir,
    [string]$OutDir = (Join-Path ([Environment]::GetFolderPath('MyDocuments')) 'RLStats')
  )
  $cfgPath = Join-Path $OutDir 'upload.json'
  if (-not (Test-Path $cfgPath)) { return -1 }
  try {
    $cfg = Get-Content $cfgPath -Raw | ConvertFrom-Json
    if (-not $cfg.url) { return -1 }
    $base = ([Uri]$cfg.url).GetLeftPart([UriPartial]::Authority)
    try { [Net.ServicePointManager]::SecurityProtocol = [Net.ServicePointManager]::SecurityProtocol -bor [Net.SecurityProtocolType]::Tls12 } catch { }
    $manifest = Invoke-RestMethod -Uri "$base/api/recorder/manifest" -Headers @{ 'X-Upload-Key' = [string]$cfg.key } -TimeoutSec 6 -UseBasicParsing
    $n = 0
    foreach ($f in @($manifest.files)) {
      $name = [string]$f.name
      if (-not $name -or $name -match '[\\/:*?"<>|]' -or $name -like '*..*' -or $name -ieq 'upload.json') { continue }
      $local = Join-Path $InstallDir $name
      $hash = $null
      if (Test-Path $local) { $hash = (Get-FileHash -Algorithm SHA256 -Path $local).Hash }
      if ($hash -ne ([string]$f.sha256).ToUpper()) { $n++ }
    }
    return $n
  } catch { return -1 }   # -1: couldn't reach the site
}
