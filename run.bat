@echo off
setlocal

:mainLoop
cls
echo =================================
echo   Compilador y Ejecutor GLauncher
echo =================================
echo.

REM --- PASO 1: COMPILACION ---
echo [INFO] Iniciando compilacion del proyecto...
echo.

REM Definir la ruta a las librerias y al codigo fuente
set LIBS_DIR=libs
set SRC_DIR=src

REM Crear lista de JARs para el classpath
set CLASSPATH=
for /f "delims=" %%a in ('dir /b /s "%LIBS_DIR%\*.jar"') do (
    call set CLASSPATH=%%CLASSPATH%%;%%a
)

REM Compilar
javac -encoding UTF-8 -d bin -cp ".%CLASSPATH%" %SRC_DIR%\glauncher\*.java %SRC_DIR%\glauncher\ui\*.java %SRC_DIR%\glauncher\ui\views\*.java

REM Verificar si hubo error de compilacion
if %errorlevel% neq 0 (
    echo.
    echo [ERROR] Error de compilacion detectado.
    echo.
    pause
    goto end
)

echo.
echo [SUCCESS] Compilacion completada con exito.
echo.
echo ---------------------------------
echo.
echo [INFO] Iniciando GLauncher...
echo.

REM --- PASO 2: EJECUCION ---
java -cp "bin;%CLASSPATH%" glauncher.GLauncher

REM --- PASO 3: MENU DE OPCIONES ---
echo.
echo ---------------------------------
echo.
echo [INFO] La aplicacion se ha cerrado.
echo.

choice /C SN /M "¿Deseas compilar y ejecutar de nuevo? [S/N]"

if errorlevel 2 (
    REM El usuario presiono 'N'
    goto end
)

if errorlevel 1 (
    REM El usuario presiono 'S'
    goto mainLoop
)

:end
echo.
echo Saliendo del script. ¡Hasta luego!
endlocal
