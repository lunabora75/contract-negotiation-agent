@echo off
echo ============================================
echo  Contract Negotiation Agent - Frontend
echo ============================================

cd /d "%~dp0frontend"

if not exist "node_modules" (
    echo Installing Node.js dependencies...
    npm install
)

echo Starting Next.js on http://localhost:3000
echo.
npm run dev
pause
