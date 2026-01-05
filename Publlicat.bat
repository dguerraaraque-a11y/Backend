@echo off
title Configurador de Git - Canaima Stream Edition
echo // Configurando Git para dguerraaraque-a11y //
echo.

:: 1. Configurar datos de usuario
git config user.name "dguerraaraque-a11y"
git config user.email "dguerrraaraque@gmail.com"

echo [+] Usuario configurado: dguerraaraque-a11y
echo [+] Correo configurado: dguerrraaraque@gmail.com
echo.

:: 2. Verificar archivo .gitignore
if exist .gitignore (
    echo [OK] El archivo .gitignore ha sido detectado.
) else (
    echo [!] ADVERTENCIA: No se encontro el archivo .gitignore en esta carpeta.
)
echo.

:: 3. Configurar el Token para evitar error 403
echo Por favor, pega tu Token de GitHub (PAT) que empieza por ghp_
echo (Nota: En la consola no se vera lo que pegas por seguridad)
set /p MY_TOKEN=^> 

if "%MY_TOKEN%"=="" (
    echo [!] Error: No ingresaste un token. Abortando.
    pause
    exit
)

:: 4. Actualizar la URL remota con el Token
git remote set-url origin https://dguerraaraque-a11y:%MY_TOKEN%@github.com/dguerraaraque-a11y/Backend.git

echo.
echo [+] URL de repositorio actualizada con exito.
echo [!] Ya puedes hacer 'git push' sin que te pida contrasenas.
echo.
pause