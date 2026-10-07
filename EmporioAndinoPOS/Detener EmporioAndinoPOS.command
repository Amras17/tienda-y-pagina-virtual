#!/bin/bash
# Detiene el servidor local de EmporioAndinoPOS (puerto 8080).
# Los datos no se borran: quedan en el navegador.
PIDS=$(lsof -nP -t -iTCP:8080 -sTCP:LISTEN 2>/dev/null)
if [ -n "$PIDS" ]; then
  kill $PIDS && echo "EmporioAndinoPOS detenido. Los datos siguen guardados en el navegador."
else
  echo "EmporioAndinoPOS no estaba corriendo."
fi
