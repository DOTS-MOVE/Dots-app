#!/bin/bash

# Simple script to run the full app in development mode
# This runs both servers in separate terminal windows (macOS/Linux with xterm)

# Colors
GREEN='\033[0;32m'
BLUE='\033[0;34m'
NC='\033[0m'

echo -e "${BLUE}🚀 Starting Dots App...${NC}\n"

# Check for .env.local files
if [ ! -f "backend/.env.local" ]; then
    echo "⚠️  Warning: backend/.env.local not found"
fi
if [ ! -f "frontend/.env.local" ]; then
    echo "⚠️  Warning: frontend/.env.local not found"
fi

# Function to run backend
run_backend() {
    cd backend
    if [ ! -d "venv" ]; then
        python3 -m venv venv
    fi
    source venv/bin/activate
    pip install -q -r requirements.txt
    echo "🔧 Starting backend on http://localhost:8000"
    uvicorn main:app --reload --host 0.0.0.0 --port 8000
}

# Function to run frontend
run_frontend() {
    cd frontend
    if [ ! -d "node_modules" ]; then
        npm install
    fi
    echo "⚛️  Starting frontend on http://localhost:3000"
    npm run dev
}

# Export functions so they can be used in subshells
export -f run_backend
export -f run_frontend

# Check OS and run accordingly
if [[ "$OSTYPE" == "darwin"* ]]; then
    # macOS - use Terminal.app or iTerm
    echo -e "${GREEN}Opening servers in separate terminal windows...${NC}"
    osascript -e 'tell app "Terminal" to do script "cd \"'"$(pwd)"'\" && bash -c \"run_backend\""'
    sleep 2
    osascript -e 'tell app "Terminal" to do script "cd \"'"$(pwd)"'\" && bash -c \"run_frontend\""'
    echo -e "${GREEN}✅ Servers starting in separate windows${NC}"
    echo -e "${GREEN}📍 Frontend: http://localhost:3000${NC}"
    echo -e "${GREEN}📍 Backend: http://localhost:8000${NC}"
else
    # Linux/Other - run in background
    run_backend &
    BACKEND_PID=$!
    sleep 2
    run_frontend &
    FRONTEND_PID=$!
    echo -e "${GREEN}✅ Servers started${NC}"
    echo -e "${GREEN}📍 Frontend: http://localhost:3000${NC}"
    echo -e "${GREEN}📍 Backend: http://localhost:8000${NC}"
    wait
fi
