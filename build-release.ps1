# Build and Release Script for AI Story Writing Tool
# PowerShell script to automate the build process

Write-Host "🚀 Starting build process for AI Story Writing Tool..." -ForegroundColor Green

# Step 1: Clean previous builds
Write-Host "🧹 Cleaning previous builds..." -ForegroundColor Yellow
if (Test-Path "dist") {
    Remove-Item -Recurse -Force "dist"
}
if (Test-Path "release") {
    Remove-Item -Recurse -Force "release"
}

# Step 2: Install dependencies
Write-Host "📦 Installing dependencies..." -ForegroundColor Yellow
npm install

# Step 3: Build frontend
Write-Host "🔨 Building frontend..." -ForegroundColor Yellow
npm run build

# Step 4: Build desktop app
Write-Host "🖥️ Building desktop app..." -ForegroundColor Yellow
npm run dist

# Step 5: Check results
Write-Host "✅ Build completed!" -ForegroundColor Green
Write-Host "📁 Check the 'release' folder for the installer" -ForegroundColor Cyan

# List release files
if (Test-Path "release") {
    Write-Host "📋 Release files:" -ForegroundColor Cyan
    Get-ChildItem "release" -Name | ForEach-Object {
        Write-Host "   - $_" -ForegroundColor White
    }
}

Write-Host "🎉 Build process completed successfully!" -ForegroundColor Green 