param(
  [Parameter(Mandatory = $true)]
  [string]$Message
)

$ErrorActionPreference = "Stop"
$RepoRoot = Resolve-Path (Join-Path $PSScriptRoot "..")
Set-Location $RepoRoot

function Get-GitCommand {
  $git = Get-Command git -ErrorAction SilentlyContinue
  if ($git) {
    return $git.Source
  }

  $candidates = @(
    "$env:ProgramFiles\Git\cmd\git.exe",
    "$env:ProgramFiles\Git\bin\git.exe",
    "$env:LOCALAPPDATA\Programs\Git\cmd\git.exe",
    "$env:LOCALAPPDATA\Programs\Git\bin\git.exe"
  )

  $githubDesktopGit = Get-ChildItem "$env:LOCALAPPDATA\GitHubDesktop\app-*\resources\app\git\cmd\git.exe" -ErrorAction SilentlyContinue |
    Sort-Object FullName -Descending |
    Select-Object -First 1
  if ($githubDesktopGit) {
    $candidates += $githubDesktopGit.FullName
  }

  foreach ($candidate in $candidates) {
    if ($candidate -and (Test-Path $candidate)) {
      return $candidate
    }
  }

  throw "Git was not found. Install Git for Windows or GitHub Desktop, then try again."
}

$Git = Get-GitCommand

Write-Host "== FF14 guide publish =="
Write-Host "Repository: $RepoRoot"
Write-Host "Git: $Git"

if (Get-Command node -ErrorAction SilentlyContinue) {
  Write-Host "Checking inline JavaScript and JSON..."
  node tools/check-site.mjs
  if ($LASTEXITCODE -ne 0) {
    throw "Syntax check failed."
  }
} else {
  Write-Host "Node.js was not found. Skipping syntax check."
}

$status = & $Git status --short
if (-not $status) {
  Write-Host "No local changes. Running git push anyway."
  & $Git push origin main
  exit 0
}

Write-Host "Changed files:"
Write-Host $status

& $Git add -A
& $Git commit -m $Message
& $Git push origin main

Write-Host "Push complete. GitHub Pages may take a short moment to update."
Write-Host "https://ni1214.github.io/ff14-smn-free-trial-80-guide/"
