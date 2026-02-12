param(
  [Parameter(Mandatory = $true)]
  [string]$FilePath
)

$ErrorActionPreference = "Stop"

if (-not (Test-Path -LiteralPath $FilePath)) {
  throw "[sign] file not found: $FilePath"
}

$certPath = $env:TADOI_WIN_SIGN_CERT_PATH
$certPassword = $env:TADOI_WIN_SIGN_CERT_PASSWORD
$requireSigning = $env:TADOI_REQUIRE_SIGNING -eq "1"

if ([string]::IsNullOrWhiteSpace($certPath) -or [string]::IsNullOrWhiteSpace($certPassword)) {
  if ($requireSigning) {
    throw "[sign] strict signing enabled (TADOI_REQUIRE_SIGNING=1); missing required signing env vars: TADOI_WIN_SIGN_CERT_PATH, TADOI_WIN_SIGN_CERT_PASSWORD"
  }
  Write-Host "[sign] signing env vars not set; skipping"
  Write-Host "[sign] expected: TADOI_WIN_SIGN_CERT_PATH, TADOI_WIN_SIGN_CERT_PASSWORD"
  exit 0
}

if (-not (Test-Path -LiteralPath $certPath)) {
  throw "[sign] certificate file not found: $certPath"
}

$signtool = Get-Command signtool -ErrorAction SilentlyContinue
if (-not $signtool) {
  throw "[sign] signtool not found on PATH"
}

$args = @(
  "sign",
  "/fd", "SHA256",
  "/td", "SHA256",
  "/tr", "http://timestamp.digicert.com",
  "/f", $certPath,
  "/p", $certPassword,
  $FilePath
)

& $signtool.Source @args
if ($LASTEXITCODE -ne 0) {
  throw "[sign] signtool failed with code $LASTEXITCODE"
}

Write-Host "[sign] signed: $FilePath"
