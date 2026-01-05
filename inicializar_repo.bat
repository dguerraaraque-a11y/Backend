@echo off
setlocal

REM --- Script para inicializar el repositorio de Git por primera vez ---

echo.
echo ==========================================================
echo      Inicializador de Repositorio para GLauncher Backend
echo ==========================================================
echo.
echo ADVERTENCIA: Este script esta disenado para ejecutarse UNA SOLA VEZ.
echo Borrara la configuracion de Git existente en esta carpeta
echo para crear una nueva y limpia.
echo.

set /p "continue=¿Estas seguro de que quieres continuar? (S/N): "
if /i not "%continue%"=="S" (
    echo Operacion cancelada.
    pause
    exit /b
)

REM --- INICIO DEL PROCESO ---

REM Navegar al directorio del script
cd /d "%~dp0"

echo.
echo [PASO 1/5] Eliminando configuracion de Git anterior (si existe)...
if exist .git (
    rmdir /s /q .git
)

echo [PASO 2/5] Inicializando nuevo repositorio de Git...
git init

echo [PASO 3/5] Conectando con el repositorio remoto de GitHub...
git remote add origin https://github.com/dguerraaraque-a11y/Backend.git

echo [PASO 4/5] Anadiendo todos los archivos para la subida inicial...
git add .

echo [PASO 5/5] Creando commit inicial y subiendo a la rama 'main'...
git commit -m "Commit inicial del backend"
git branch -M main
git push -f origin main

echo.
echo ¡Proceso completado! El repositorio ha sido inicializado y publicado.
echo Ahora puedes usar 'publicar.bat' para futuras actualizaciones.
echo.
pause