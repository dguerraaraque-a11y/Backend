#!/bin/bash
#================================================================
#                 SCRIPT DE PUBLICACIÓN PARA GLAUNCHER
#----------------------------------------------------------------
# Automatiza el proceso de subir cambios al repositorio de Git.
#================================================================

echo "======================================"
echo "       Publicador de GLauncher      "bash


echo "======================================"
echo

# Staging de todos los cambios
echo "[1/3] Preparando todos los archivos para el commit..."
git add .
echo "✔ Archivos preparados."
echo

# Commit con mensaje personalizable
echo "[2/3] Creando un nuevo commit..."
read -p "Escribe un mensaje para este commit y presiona ENTER: " commitMessage

# Usar un mensaje por defecto si el usuario no ingresa uno
if [ -z "$commitMessage" ]; then
    commitMessage="Actualización de backend y mejoras generales"
fi

git commit -m "$commitMessage"
echo "✔ Commit creado con el mensaje: '$commitMessage'"
echo

# Push al repositorio remoto
echo "[3/3] Subiendo los cambios a GitHub..."
git push
echo

echo "======================================"
echo "✅ ¡Publicación completada!"
echo "======================================"
echo
