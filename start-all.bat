@echo off
echo Starting Hierarchical Task Manager...
echo.
echo [1/2] Launching Backend Server on port 5000...
start "TaskFlow Backend API (Port 5000)" cmd /k "cd backend && npm start"
timeout /t 2 /nobreak >nul
echo [2/2] Launching Frontend Development Server...
start "TaskFlow Frontend App" cmd /k "cd frontend && npm run dev"
echo.
echo Both servers are starting up!
echo Backend:  http://localhost:5000
echo Frontend: http://localhost:5173
echo.
