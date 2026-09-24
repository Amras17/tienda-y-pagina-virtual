@echo off
rem Doble clic para encender el POS (Windows).
rem No cierres esta ventana mientras uses el POS.
cd /d "%~dp0"
where npm >nul 2>nul
if errorlevel 1 (
  echo.
  echo Falta instalar Node.js. Se abrira la pagina de descarga:
  echo descarga la version LTS, instalala y vuelve a abrir este archivo.
  start "" https://nodejs.org
  pause
  exit /b 1
)
call npm run iniciar
echo.
pause
