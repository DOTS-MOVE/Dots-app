#!/bin/bash

# Colors for output
GREEN='\033[0;32m'
BLUE='\033[0;34m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
NC='\033[0m' # No Color

echo -e "${BLUE}🚀 Starting Dots App...${NC}\n"

# Check if .env.local files exist
if [ ! -f "backend/.env.local" ]; then
    echo -e "${YELLOW}⚠️  Warning: backend/.env.local not found${NC}"
    echo -e "${YELLOW}   Please create it with your Supabase credentials${NC}\n"
fi

if [ ! -f "frontend/.env.local" ]; then
    echo -e "${YELLOW}⚠️  Warning: frontend/.env.local not found${NC}"
    echo -e "${YELLOW}   Please create it with your Supabase credentials${NC}\n"
fi

# Function to cleanup on exit
cleanup() {
    echo -e "\n${YELLOW}🛑 Shutting down servers...${NC}"
    kill $BACKEND_PID $FRONTEND_PID 2>/dev/null
    exit
}

trap cleanup SIGINT SIGTERM

# Check if Python venv exists
if [ ! -d "backend/venv" ]; then
    echo -e "${YELLOW}📦 Creating Python virtual environment...${NC}"
    cd backend
    python3 -m venv venv
    cd ..
fi

# Activate virtual environment
echo -e "${GREEN}🐍 Activating Python virtual environment...${NC}"
source backend/venv/bin/activate

# Install backend dependencies if needed
if [ ! -f "backend/venv/.installed" ]; then
    echo -e "${GREEN}📦 Installing backend dependencies...${NC}"
    pip install -q -r backend/requirements.txt
    touch backend/venv/.installed
fi

# Start backend server
echo -e "${GREEN}🔧 Starting backend server (FastAPI)...${NC}"
cd backend
uvicorn main:app --reload --host 0.0.0.0 --port 8000 > ../backend.log 2>&1 &
BACKEND_PID=$!
cd ..

# Wait a bit for backend to start
sleep 2

# Check if backend started successfully
if ! kill -0 $BACKEND_PID 2>/dev/null; then
    echo -e "${RED}❌ Backend failed to start. Check backend.log for errors.${NC}"
    exit 1
fi

echo -e "${GREEN}✅ Backend running on http://localhost:8000${NC}"
echo -e "${GREEN}   API docs: http://localhost:8000/docs${NC}\n"

# Install frontend dependencies if needed
if [ ! -d "frontend/node_modules" ]; then
    echo -e "${GREEN}📦 Installing frontend dependencies...${NC}"
    cd frontend
    npm install
    cd ..
fi

# Start frontend server
echo -e "${GREEN}⚛️  Starting frontend server (Next.js)...${NC}"
cd frontend
npm run dev > ../frontend.log 2>&1 &
FRONTEND_PID=$!
cd ..

# Wait a bit for frontend to start
sleep 3

# Check if frontend started successfully
if ! kill -0 $FRONTEND_PID 2>/dev/null; then
    echo -e "${RED}❌ Frontend failed to start. Check frontend.log for errors.${NC}"
    kill $BACKEND_PID 2>/dev/null
    exit 1
fi

echo -e "${GREEN}✅ Frontend running on http://localhost:3000${NC}\n"
echo -e "${BLUE}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
echo -e "${GREEN}✨ App is running!${NC}"
echo -e "${BLUE}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
echo -e "${GREEN}📍 Frontend: ${NC}http://localhost:3000"
echo -e "${GREEN}📍 Backend API: ${NC}http://localhost:8000"
echo -e "${GREEN}📍 API Docs: ${NC}http://localhost:8000/docs"
echo -e "${BLUE}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
echo -e "\n${YELLOW}Press Ctrl+C to stop both servers${NC}\n"

# Wait for both processes
wait $BACKEND_PID $FRONTEND_PID
