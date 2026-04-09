#!/bin/bash
# StockNews Dev Startup Script
# Automatically detects your current IP and starts both backend and mobile app

set -e

# Colors for output
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

echo -e "${BLUE}🚀 StockNews Dev Startup${NC}"
echo "=================================="

# 1. Detect current IP
CURRENT_IP=$(ipconfig getifaddr en0 2>/dev/null || ipconfig getifaddr en1 2>/dev/null || ifconfig | grep 'inet ' | grep -v 127.0.0.1 | awk '{print $2}' | head -1)

if [ -z "$CURRENT_IP" ]; then
  echo -e "${YELLOW}⚠️  Could not detect IP. Make sure you're connected to WiFi.${NC}"
  exit 1
fi

echo -e "${GREEN}✅ Detected IP: ${CURRENT_IP}${NC}"

# 2. Update api.ts with current IP
API_FILE="./mobile/constants/api.ts"
if grep -q "API_BASE_URL" "$API_FILE"; then
  # Replace the IP in the file
  sed -i '' "s|export const API_BASE_URL = 'http://[0-9.]*:4000'|export const API_BASE_URL = 'http://${CURRENT_IP}:4000'|g" "$API_FILE"
  echo -e "${GREEN}✅ Updated API URL to http://${CURRENT_IP}:4000${NC}"
else
  echo -e "${YELLOW}⚠️  Could not update api.ts — please update manually.${NC}"
fi

# 3. Kill any existing backend processes
echo -e "${BLUE}🛑 Stopping any existing backend processes...${NC}"
pkill -f "ts-node src/index.ts" 2>/dev/null || true
pkill -f "nodemon src/index.ts" 2>/dev/null || true
sleep 1

# 4. Start backend in background
echo -e "${BLUE}🔧 Starting backend on port 4000...${NC}"
cd backend
npm run dev &
BACKEND_PID=$!
cd ..

# 5. Wait for backend to be ready
echo -e "${BLUE}⏳ Waiting for backend to start...${NC}"
for i in {1..15}; do
  if curl -s "http://localhost:4000/api/health" > /dev/null 2>&1; then
    echo -e "${GREEN}✅ Backend is ready!${NC}"
    break
  fi
  sleep 1
  if [ $i -eq 15 ]; then
    echo -e "${YELLOW}⚠️  Backend took too long to start. Check for errors above.${NC}"
  fi
done

# 6. Start Expo
echo ""
echo -e "${GREEN}=================================="
echo -e "📱 Starting Expo Dev Server..."
echo -e "   Backend: http://${CURRENT_IP}:4000"
echo -e "   Scan the QR code in Expo Go"
echo -e "==================================${NC}"
echo ""

cd mobile
npx expo start --clear
