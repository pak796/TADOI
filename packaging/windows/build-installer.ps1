param(
  [Parameter(Mandatory = $true)]
  [string]$BinaryPath,

  [Parameter(Mandatory = $true)]
  [string]$Version,

  [Parameter(Mandatory = $true)]
  [string]$InstallerDir,

  [string]$IssPath = "packaging/windows/TADOI.iss"
)

$ErrorActionPreference = "Stop"

if (-not (Test-Path -LiteralPath $BinaryPath)) {
  throw "[build-installer] binary not found: $BinaryPath"
}

$workspace = Resolve-Path -LiteralPath "."
$workspacePath = $workspace.Path
$resolvedInstallerDir = if ([System.IO.Path]::IsPathRooted($InstallerDir)) {
  $InstallerDir
} else {
  Join-Path $workspacePath $InstallerDir
}
New-Item -ItemType Directory -Force -Path $resolvedInstallerDir | Out-Null
$resolvedInstallerDir = (Resolve-Path -LiteralPath $resolvedInstallerDir).Path

$iscc = Get-Command iscc -ErrorAction SilentlyContinue
if (-not $iscc) {
  throw "[build-installer] Inno Setup compiler (iscc) not found. Install Inno Setup first."
}

$resolvedIssPath = Resolve-Path -LiteralPath $IssPath
$resolvedBinaryPath = Resolve-Path -LiteralPath $BinaryPath

$args = @(
  "/DMyAppVersion=$Version",
  "/DSourceBinary=$resolvedBinaryPath",
  "/DOutputDir=$resolvedInstallerDir",
  "$resolvedIssPath"
)

& $iscc.Source @args
if ($LASTEXITCODE -ne 0) {
  throw "[build-installer] iscc failed with code $LASTEXITCODE"
}

$outputPath = Join-Path $resolvedInstallerDir "TADOI-Setup-x64-$Version.exe"
if (-not (Test-Path -LiteralPath $outputPath)) {
  throw "[build-installer] expected output not found: $outputPath"
}

Write-Host "[build-installer] wrote: $outputPath"
