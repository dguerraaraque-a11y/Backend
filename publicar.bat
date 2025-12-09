@echo off
echo =========================================
echo  Publicando cambios en GLauncher...
echo =========================================

REM Anade todos los archivos modificados al area de preparacion (staging)
git add .
echo.
echo Archivos anadidos al commit.

REM Pide al usuario un mensaje para el commit
set /p commitMessage="Escribe un mensaje para el commit (ej: Corregido chat de radio): "

REM Realiza el commit con el mensaje proporcionado
git commit -m "%commitMessage%"
echo.
echo Commit realizado con exito.

REM Sube los cambios a la rama 'main' (o 'master' si usas esa) de tu repositorio en GitHub
git push origin main
echo.
echo =========================================
echo  Cambios subidos a GitHub!
echo =========================================
echo.
pause
