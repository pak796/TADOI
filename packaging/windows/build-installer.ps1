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

function Resolve-NormalizedPath {
  param(
    [Parameter(Mandatory = $true)]
    [string]$PathValue,

    [Parameter(Mandatory = $true)]
    [string]$BaseDir,

    [bool]$MustExist = $true,

    [string]$Label = "path"
  )

  if ([string]::IsNullOrWhiteSpace($PathValue)) {
    throw "[build-installer] $Label is required."
  }

  $candidate = $PathValue
  if (-not [System.IO.Path]::IsPathRooted($candidate)) {
    $candidate = Join-Path -Path $BaseDir -ChildPath $candidate
  }

  $normalized = [System.IO.Path]::GetFullPath($candidate)
  if ($MustExist -and -not (Test-Path -LiteralPath $normalized)) {
    throw "[build-installer] $Label not found: $normalized"
  }

  return $normalized
}

$repoRoot = (Resolve-Path -LiteralPath (Join-Path $PSScriptRoot "..\\..")).ProviderPath
$resolvedBinaryPath = Resolve-NormalizedPath -PathValue $BinaryPath -BaseDir $repoRoot -MustExist $true -Label "binary"
$resolvedIssPath = Resolve-NormalizedPath -PathValue $IssPath -BaseDir $repoRoot -MustExist $true -Label "iss file"
$resolvedInstallerDir = Resolve-NormalizedPath -PathValue $InstallerDir -BaseDir $repoRoot -MustExist $false -Label "installer directory"
[System.IO.Directory]::CreateDirectory($resolvedInstallerDir) | Out-Null

Write-Host "[build-installer] repo root: $repoRoot"
Write-Host "[build-installer] binary: $resolvedBinaryPath"
Write-Host "[build-installer] installer dir: $resolvedInstallerDir"
Write-Host "[build-installer] iss: $resolvedIssPath"

$iscc = Get-Command iscc -ErrorAction SilentlyContinue
if (-not $iscc) {
  throw "[build-installer] Inno Setup compiler (iscc) not found. Install Inno Setup first."
}

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
