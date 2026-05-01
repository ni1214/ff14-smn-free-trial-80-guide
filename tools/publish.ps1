param(
  [Parameter(Mandatory = $true)]
  [string]$Message
)

$ErrorActionPreference = "Stop"
$RepoRoot = Resolve-Path (Join-Path $PSScriptRoot "..")
Set-Location $RepoRoot

Write-Host "== FF14 guide publish =="
Write-Host "Repository: $RepoRoot"

if (Get-Command node -ErrorAction SilentlyContinue) {
  Write-Host "Checking inline JavaScript and JSON..."
  $checkScript = @'
const fs = require("fs");
const html = fs.readFileSync("index.html", "utf8");
const scriptMatch = html.match(/<script>([\s\S]*?)<\/script>/);
if (!scriptMatch) {
  throw new Error("No inline script found in index.html.");
}
new Function(scriptMatch[1]);
for (const file of ["action-icons.json", "item-icons.json", "gear-catalog.json", "job-actions.json"]) {
  JSON.parse(fs.readFileSync(file, "utf8"));
}
console.log("syntax ok");
'@
  $checkScript | node -
  if ($LASTEXITCODE -ne 0) {
    throw "Syntax check failed."
  }
} else {
  Write-Host "Node.js was not found. Skipping syntax check."
}

$status = git status --short
if (-not $status) {
  Write-Host "No local changes. Running git push anyway."
  git push origin main
  exit 0
}

Write-Host "Changed files:"
Write-Host $status

git add -A
git commit -m $Message
git push origin main

Write-Host "Push complete. GitHub Pages may take a short moment to update."
Write-Host "https://ni1214.github.io/ff14-smn-free-trial-80-guide/"
