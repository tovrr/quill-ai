param(
  [string]$GifPath = "public/demo.gif",
  [string]$ReadmePath = "README.md",
  [int]$MaxSizeMb = 8
)

$ErrorActionPreference = "Stop"

if (-not (Test-Path $GifPath)) {
  Write-Error "GIF not found at '$GifPath'. Export your demo GIF first."
}

$gif = Get-Item $GifPath
$sizeMb = [math]::Round($gif.Length / 1MB, 2)
Write-Host "Demo GIF size: $sizeMb MB"

if ($sizeMb -gt $MaxSizeMb) {
  Write-Warning "GIF is larger than ${MaxSizeMb}MB. Consider trimming duration, frame rate, or dimensions."
}

if (-not (Test-Path $ReadmePath)) {
  Write-Error "README not found at '$ReadmePath'."
}

$readme = Get-Content $ReadmePath -Raw
$updated = $readme -replace "!\[Quill AI Demo Preview\]\(\./public/demo-preview\.svg\)", "![Quill AI Demo](./public/demo.gif)"

if ($updated -ne $readme) {
  Set-Content -Path $ReadmePath -Value $updated -Encoding UTF8
  Write-Host "README updated to use ./public/demo.gif"
} else {
  Write-Host "README already points to demo.gif or expected placeholder not found."
}

Write-Host "Done."
