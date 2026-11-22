@echo off
rem ===================================================================
rem  WOCA launcher: double-click to start.
rem  1. Starts the local WOCA server (minimized), or reuses a running one.
rem  2. Waits until it answers.
rem  3. Opens WOCA in Edge as a full-screen app window, using its own
rem     Edge profile so settings, calibration and camera permission stay
rem     separate from normal browsing.
rem  Close WOCA with Alt+F4. F11 leaves full screen.
rem  Everything runs on this laptop; no internet is needed.
rem ===================================================================
setlocal
cd /d "%~dp0"

set "WOCA_URL=http://localhost:5173"
set "WOCA_PROFILE=%LOCALAPPDATA%\WOCA\edge-profile"

where node >nul 2>nul || (
  echo Node.js tidak dijumpai. Sila pasang Node.js LTS dari nodejs.org dahulu.
  echo [Node.js not found. Install Node.js LTS from nodejs.org first.]
  goto :error
)

if not exist "node_modules" (
  echo Memasang WOCA buat kali pertama... [first-time install]
  call npm install || goto :error
)

rem Already running? (e.g. the developer's "npm run dev")
call :ping
if errorlevel 1 (
  start "WOCA server" /min cmd /c "npx vite --port 5173 --strictPort"
)

rem Wait up to ~30 seconds for the server.
set /a tries=0
:wait
call :ping
if not errorlevel 1 goto :open
set /a tries+=1
if %tries% geq 60 goto :error
powershell -NoProfile -Command "Start-Sleep -Milliseconds 500"
goto :wait

:open
start "" msedge --user-data-dir="%WOCA_PROFILE%" --app=%WOCA_URL% --start-fullscreen --no-first-run --no-default-browser-check
exit /b 0

:ping
powershell -NoProfile -Command "try { Invoke-WebRequest '%WOCA_URL%' -UseBasicParsing -TimeoutSec 1 | Out-Null; exit 0 } catch { exit 1 }"
exit /b %errorlevel%

:error
echo.
echo WOCA tidak dapat dimulakan. Tangkap gambar skrin ini dan tunjukkan kepada pembangun.
echo [WOCA could not start. Take a screenshot of this window for the developer.]
pause
exit /b 1
