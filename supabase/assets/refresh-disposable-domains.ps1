# Refresh disposable email domains blacklist
# Run this script weekly/monthly to keep the list up-to-date

Write-Host "Downloading latest disposable email domains list..." -ForegroundColor Cyan

$sourceUrl = "https://raw.githubusercontent.com/disposable/disposable-email-domains/master/domains.txt"
$assetsFile = "supabase\assets\disposable-email-domains.txt"
$functionFile = "supabase\functions\validate-email\disposable-email-domains.txt"

try {
    # Download to assets folder
    Invoke-WebRequest -Uri $sourceUrl -OutFile $assetsFile
    Write-Host "✓ Downloaded to assets folder" -ForegroundColor Green
    
    # Copy to function directory
    Copy-Item $assetsFile -Destination $functionFile -Force
    Write-Host "✓ Copied to validate-email function directory" -ForegroundColor Green
    
    $lineCount = (Get-Content $assetsFile | Measure-Object -Line).Lines
    Write-Host "`nUpdated: $lineCount domains loaded" -ForegroundColor Yellow
    Write-Host "`nNext step: Deploy the updated function:" -ForegroundColor Cyan
    Write-Host "  supabase functions deploy validate-email" -ForegroundColor White
} catch {
    Write-Host "`nError: $_" -ForegroundColor Red
    exit 1
}

