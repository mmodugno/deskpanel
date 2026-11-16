@echo off
REM Inicia deskpanel con la consola visible (útil para ver los mensajes).
cd /d "%~dp0\..\.."
where node >nul 2>nul || (echo Falta Node.js 20 o mas nuevo: https://nodejs.org & pause & exit /b 1)
node agent\src\index.js --open
pause
