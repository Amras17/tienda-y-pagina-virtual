#!/bin/bash
# EmporioAndinoPOS en un Mac: doble clic y se abre el sistema en el navegador.
# Sirve la carpeta en http://localhost:8080 (siempre la misma dirección: el
# navegador guarda ventas, stock y PIN asociados a ella).
cd "$(dirname "$0")" || exit 1
PUERTO=8080
URL="http://localhost:$PUERTO/"

if lsof -nP -iTCP:$PUERTO -sTCP:LISTEN >/dev/null 2>&1; then
  echo "EmporioAndinoPOS ya está corriendo en $URL"
else
  if python3 -c "import http.server" >/dev/null 2>&1; then
    nohup python3 -m http.server $PUERTO --bind 127.0.0.1 >/dev/null 2>&1 &
  elif [ -x /usr/bin/ruby ]; then
    nohup /usr/bin/ruby -run -e httpd . -p $PUERTO -b 127.0.0.1 >/dev/null 2>&1 &
  else
    echo "Falta Python 3. Instálalo con:  xcode-select --install   y vuelve a abrir este archivo."
    read -r -p "Presiona Enter para cerrar…"
    exit 1
  fi
  for i in 1 2 3 4 5 6 7 8 9 10; do
    lsof -nP -iTCP:$PUERTO -sTCP:LISTEN >/dev/null 2>&1 && break
    sleep 0.5
  done
  echo "EmporioAndinoPOS corriendo en $URL"
fi
open "$URL"
echo "Puedes cerrar esta ventana: el sistema sigue abierto en el navegador."
