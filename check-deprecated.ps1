# PowerShell script to find which packages use deprecated dependencies
# Usage: .\check-deprecated.ps1 [package-name]

param(
    [string]$PackageName = ""
)

if ($PackageName -eq "") {
    Write-Host "Finding all deprecated packages in dependency tree..." -ForegroundColor Yellow
    npm ls --all --depth=10 2>&1 | Select-String -Pattern "deprecated" | ForEach-Object {
        Write-Host $_.Line -ForegroundColor Red
    }
} else {
    Write-Host "Finding which packages depend on: $PackageName" -ForegroundColor Yellow
    npm ls $PackageName --all --depth=10 2>&1 | ForEach-Object {
        if ($_ -match "`"$PackageName`"") {
            Write-Host $_ -ForegroundColor Cyan
        }
    }

    Write-Host "`nChecking why this package is installed:" -ForegroundColor Yellow
    npm why $PackageName 2>&1
}

