#!/bin/bash
# Doble clic para iniciar deskpanel con la consola visible.
cd "$(dirname "$0")/../.." || exit 1
command -v node >/dev/null || { echo "Falta Node.js 20 o más nuevo: https://nodejs.org"; read -r -p "Enter para cerrar"; exit 1; }
exec node agent/src/index.js --open
