@echo off

echo "======================================"
echo "       Publicador de GLauncher      "
echo "======================================"

REM Staging de todos los cambios
echo.
echo "[1/3] Preparando todos los archivos..."
git add .

REM Commit con mensaje personalizable
echo.
echo "[2/3] Creando un nuevo commit..."
set /p commitMessage="Escribe un mensaje para este commit y presiona ENTER: "

 "%commitMessage%"

REM Push al repositorio remoto
echo.
echo "[3/3] Subiendo los cambios al repositorio..."
git push

echo.
echo "======================================"
echo "? ¡Publicacion completada!"
echo "======================================"

REM Pausa para que puedas ver el resultado
pause
