@echo off
echo ============================================
echo  Contract Negotiation Agent - Backend
echo ============================================

cd /d "%~dp0backend"

REM Check for .env
if not exist ".env" (
    echo ERROR: .env file not found in backend\
    echo Create backend\.env with:  ANTHROPIC_API_KEY=your_key_here
    pause
    exit /b 1
)

REM Try to find Python
where python >nul 2>&1
if %errorlevel% neq 0 (
    echo ERROR: Python not found. Install Python 3.10+ from https://python.org
    pause
    exit /b 1
)

echo Installing/checking Python dependencies...
python -m pip install -r requirements.txt --quiet

echo.
echo Starting FastAPI on http://localhost:8000
echo API docs at  http://localhost:8000/docs
echo Press Ctrl+C to stop.
echo.
python -m uvicorn main:app --host 0.0.0.0 --port 8000 --reload
pause
