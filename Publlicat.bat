@echo off
REM Este script automatiza el proceso de push a GitHub para tu backend Node.js.

echo.
echo --- Preparando y Sincronizando cambios a GitHub ---
echo.

REM Paso 0.1: Asegurarse de que .gitignore exista y sea correcto
echo Verificando y creando .gitignore si es necesario...
IF NOT EXIST .gitignore (
    echo Creando .gitignore para ignorar node_modules y archivos sensibles...
    (
        echo # Directorio de modulos de Node.js
        echo node_modules/
        echo.
        echo # Archivos de configuracion de entorno
        echo .env
        echo.
        echo # Archivos de logs
        echo *.log
        echo npm-debug.log*
        echo yarn-debug.log*
        echo yarn-error.log*
        echo.
        echo # Directorios de build
        echo dist/
        echo build/
        echo.
        echo # IDEs y otros archivos locales
        echo .vscode/
        echo .idea/
        echo *.sublime-project
        echo *.sublime-workspace
        echo.
        echo # Archivos de base de datos local
        echo *.db
        echo *.sqlite
        echo *.sqlite3
        echo /static/data/*.db
        echo.
        echo # Archivos temporales
        echo tmp/
        echo temp/
    ) > .gitignore
    echo .gitignore creado.
) ELSE (
    echo .gitignore ya existe.
)
echo.

REM Paso 0.2: Inicializar Git si no esta inicializado
IF NOT EXIST ".git" (
    echo Inicializando repositorio Git local...
    git init
    IF %ERRORLEVEL% NEQ 0 (
        echo ERROR: Fallo al inicializar Git.
        pause
        goto :eof
    )
    echo Repositorio Git inicializado.
) ELSE (
    echo Repositorio Git ya inicializado.
)
echo.

REM Paso 0.3: Añadir el repositorio remoto si no esta configurado
git remote get-url origin >NUL 2>&1
IF %ERRORLEVEL% NEQ 0 (
    echo Configurando el repositorio remoto 'origin'...
    git remote add origin https://github.com/dguerraaraque-a11y/Backend.git
    IF %ERRORLEVEL% NEQ 0 (
        echo ERROR: Fallo al configurar el remoto 'origin'.
        pause
        goto :eof
    )
    echo Remoto 'origin' configurado.
) ELSE (
    echo Remoto 'origin' ya configurado.
)
echo.

REM Paso 0.4: Limpiar el archivo index.lock si existe (soluciona problemas de procesos Git colgados)
echo Limpiando posibles archivos .git/index.lock ...
IF EXIST ".git\index.lock" (
    del ".git\index.lock"
    echo .git/index.lock eliminado.
)
echo.

REM Paso 1: Descargar los ultimos cambios del repositorio remoto (opcional, pero buena practica)
echo Ejecutando: git pull origin main
git pull origin main
IF %ERRORLEVEL% NEQ 0 (
    echo.
    echo ERROR: Fallo al hacer git pull. Revisa los mensajes anteriores.
    pause
    goto :eof
)
echo.

REM Paso 2: Anadir todos los archivos modificados y nuevos al staging area (ignorando lo de .gitignore)
echo Ejecutando: git add .
git add .
IF %ERRORLEVEL% NEQ 0 (
    echo.
    echo ERROR: Fallo al hacer git add. Revisa los mensajes anteriores.
    pause
    goto :eof
)
echo.

REM Paso 3: Confirma los cambios con un mensaje descriptivo
set /p commitMessage="Por favor, escribe un mensaje para tu commit: "
echo Ejecutando: git commit -m "%commitMessage%"
git commit -m "%commitMessage%"
IF %ERRORLEVEL% NEQ 0 (
    echo.
    echo ERROR: Fallo al hacer git commit. Puede que no haya cambios para commitear.
    echo (Si este es el caso, no es un error critico, puedes continuar.)
    pause
)
echo.

REM Paso 4: Subir los cambios a la rama 'main' en GitHub
echo Ejecutando: git push origin main
git push origin main
IF %ERRORLEVEL% NEQ 0 (
    echo.
    echo ERROR: Fallo al hacer git push. Revisa los mensajes anteriores o tus credenciales de GitHub.
    pause
    goto :eof
)
echo.

echo --- Proceso de publicacion en GitHub completado con exito ---
echo Tus cambios han sido publicados. Render deberia iniciar un nuevo despliegue.
echo.
pause