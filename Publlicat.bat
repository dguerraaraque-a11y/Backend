@echo off
title Auto-Push Git - Canaima Stream Edition
echo // Iniciando automatizacion para dguerraaraque-a11y //
echo.

:: 1. Configurar identidad del commit
git config user.name "dguerraaraque-a11y"
git config user.email "dguerrraaraque@gmail.com"
echo [+] Identidad local configurada: dguerrraaraque@gmail.com

:: 2. Definir Token y URL Remota
:: Usamos el token que me pasaste directamente
set MY_TOKEN=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
echo [!] Vinculando repositorio con Token...

:: Cambiamos la URL para que incluya las credenciales y no pida nada mas
git remote set-url origin https://dguerraaraque-a11y:%MY_TOKEN%@github.com/dguerraaraque-a11y/Backend.git

:: 3. Procesar cambios de Git
echo [!] Agregando archivos...
git add .

:: Usamos un mensaje de commit generico para no perder tiempo
git commit -m "update desde script automatico"
echo.

:: 4. Subir a GitHub
echo [!] Intentando subir cambios forzados a main...
git push -f origin main

if %ERRORLEVEL% EQU 0 (
    echo.
    echo =========================================
    echo [OK] CAMBIOS SUBIDOS EXITOSAMENTE
    echo =========================================
) else (
    echo.
    echo [X] Error al subir. Revisa tu conexion a internet o el Token.
)

:: Limpiar variable por seguridad
set MY_TOKEN=
pause