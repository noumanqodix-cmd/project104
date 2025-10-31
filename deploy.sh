#!/bin/bash

# Deployment script for Morphit VPS
# Run this script after building locally

echo "🚀 Starting deployment to VPS..."

# VPS Configuration
VPS_HOST="root@srv873112"
VPS_PATH="/var/www/morphit.rjautonomous.com"

echo "📦 Building the application..."
VITE_SUPABASE_URL="https://guvpoifxhpypgrjrejjh.supabase.co" \
VITE_SUPABASE_ANON_KEY="eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imd1dnBvaWZ4aHB5cGdyanJlampoIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjA0MDIyODQsImV4cCI6MjA3NTk3ODI4NH0.oI1-jvU-Oioov3fWgxNPy83eSl7VoAbhzO3H5G5AoRo" \
npm run build

if [ $? -eq 0 ]; then
    echo "✅ Build successful!"
else
    echo "❌ Build failed!"
    exit 1
fi

echo "📤 Uploading files to VPS..."

# Upload dist folder
rsync -avz --progress dist/ ${VPS_HOST}:${VPS_PATH}/dist/

# Upload ecosystem config
rsync -avz --progress ecosystem.config.cjs ${VPS_HOST}:${VPS_PATH}/

# Upload nginx config
rsync -avz --progress morphit.nginx.conf ${VPS_HOST}:/etc/nginx/sites-available/morphit.rjautonomous.com

# Upload environment file
rsync -avz --progress .env.production ${VPS_HOST}:${VPS_PATH}/.env

# Upload package files (in case dependencies changed)
rsync -avz --progress package*.json ${VPS_HOST}:${VPS_PATH}/

echo "🔄 Restarting PM2 on VPS..."

ssh ${VPS_HOST} << 'EOF'
cd /var/www/morphit.rjautonomous.com

# Install/update dependencies if needed
npm install --production

# Create logs directory if it doesn't exist
mkdir -p logs

# Setup nginx
sudo ln -sf /etc/nginx/sites-available/morphit.rjautonomous.com /etc/nginx/sites-enabled/
sudo nginx -t
sudo systemctl reload nginx

# Restart PM2 with production environment
pm2 stop morphit
pm2 delete morphit
pm2 start ecosystem.config.cjs --env production
pm2 save

# Show status
echo ""
echo "📊 PM2 Status:"
pm2 list

echo ""
echo "🔍 Checking NODE_ENV:"
pm2 env 0 | grep NODE_ENV

echo ""
echo "📝 Recent logs:"
pm2 logs morphit --lines 20 --nostream
EOF

echo ""
echo "✅ Deployment complete!"
echo "🌐 Check your site at: https://morphit.rjautonomous.com"
