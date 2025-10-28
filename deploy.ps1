# PowerShell Deployment script for Morphit VPS
# Run this script after building locally

Write-Host "🚀 Starting deployment to VPS..." -ForegroundColor Cyan

# VPS Configuration
$VPS_HOST = "root@srv873112"
$VPS_PATH = "/var/www/morphit.rjautonomous.com"

Write-Host "📦 Building the application..." -ForegroundColor Yellow
$env:VITE_SUPABASE_URL = "https://guvpoifxhpypgrjrejjh.supabase.co"
$env:VITE_SUPABASE_ANON_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imd1dnBvaWZ4aHB5cGdyanJlampoIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjA0MDIyODQsImV4cCI6MjA3NTk3ODI4NH0.oI1-jvU-Oioov3fWgxNPy83eSl7VoAbhzO3H5G5AoRo"

npm run build

if ($LASTEXITCODE -eq 0) {
    Write-Host "✅ Build successful!" -ForegroundColor Green
} else {
    Write-Host "❌ Build failed!" -ForegroundColor Red
    exit 1
}

Write-Host "📤 Uploading files to VPS..." -ForegroundColor Yellow

# Check if using WSL or native SSH
if (Get-Command wsl -ErrorAction SilentlyContinue) {
    Write-Host "Using WSL for rsync..." -ForegroundColor Gray
    
    # Convert Windows path to WSL path
    $currentPath = (Get-Location).Path
    $wslPath = $currentPath -replace '\\', '/' -replace 'C:', '/mnt/c'
    
    # Upload using WSL rsync
    wsl rsync -avz --progress "$wslPath/dist/" "${VPS_HOST}:${VPS_PATH}/dist/"
    wsl rsync -avz --progress "$wslPath/ecosystem.config.cjs" "${VPS_HOST}:${VPS_PATH}/"
    wsl rsync -avz --progress "$wslPath/package*.json" "${VPS_HOST}:${VPS_PATH}/"
} else {
    Write-Host "⚠️ WSL not found. Using SCP instead..." -ForegroundColor Yellow
    scp -r dist/* "${VPS_HOST}:${VPS_PATH}/dist/"
    scp ecosystem.config.cjs "${VPS_HOST}:${VPS_PATH}/"
    scp package*.json "${VPS_HOST}:${VPS_PATH}/"
}

Write-Host "🔄 Restarting PM2 on VPS..." -ForegroundColor Yellow

$sshCommands = @"
cd /var/www/morphit.rjautonomous.com
npm install --production
mkdir -p logs
pm2 stop morphit
pm2 delete morphit
pm2 start ecosystem.config.cjs --env production
pm2 save
echo ""
echo "📊 PM2 Status:"
pm2 list
echo ""
echo "🔍 Checking NODE_ENV:"
pm2 env 0 | grep NODE_ENV
echo ""
echo "📝 Recent logs:"
pm2 logs morphit --lines 20 --nostream
"@

ssh $VPS_HOST $sshCommands

Write-Host ""
Write-Host "✅ Deployment complete!" -ForegroundColor Green
Write-Host "🌐 Check your site at: https://morphit.rjautonomous.com" -ForegroundColor Cyan
