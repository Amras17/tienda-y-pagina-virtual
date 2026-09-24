#!/bin/bash
# Doble clic en el Finder para encender el POS (macOS).
# Abre una ventana de Terminal: no la cierres mientras uses el POS.
cd "$(dirname "$0")" || exit 1
export PATH="$PATH:/usr/local/bin:/opt/homebrew/bin" # respaldo si la Terminal no las tiene

if ! command -v npm >/dev/null 2>&1; then
  echo ""
  echo "✖ Falta instalar Node.js. Se abrirá la página de descarga:"
  echo "  descarga la versión LTS, instálala y vuelve a abrir este archivo."
  open "https://nodejs.org"
  read -r -p "Presiona Enter para cerrar…"
  exit 1
fi

npm run iniciar
echo ""
read -r -p "El POS se apagó. Presiona Enter para cerrar esta ventana…"
