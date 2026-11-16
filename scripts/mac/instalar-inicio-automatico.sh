#!/bin/bash
# Hace que deskpanel arranque solo al iniciar sesión en el Mac (LaunchAgent).
# Para quitarlo: ./instalar-inicio-automatico.sh --quitar
set -e
LABEL="com.deskpanel.agent"
PLIST="$HOME/Library/LaunchAgents/$LABEL.plist"
ROOT="$(cd "$(dirname "$0")/../.." && pwd)"

if [ "$1" = "--quitar" ]; then
  launchctl unload "$PLIST" 2>/dev/null || true
  rm -f "$PLIST"
  echo "Listo: deskpanel ya no arranca solo."
  exit 0
fi

NODE="$(command -v node || true)"
[ -n "$NODE" ] || { echo "No encontré Node.js. Instalalo desde https://nodejs.org (versión 20 o más nueva)."; exit 1; }

mkdir -p "$HOME/Library/LaunchAgents" "$HOME/.deskpanel"
cat > "$PLIST" <<PLIST
<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0"><dict>
  <key>Label</key><string>$LABEL</string>
  <key>ProgramArguments</key><array><string>$NODE</string><string>$ROOT/agent/src/index.js</string><string>--usb</string></array>
  <key>WorkingDirectory</key><string>$ROOT</string>
  <key>RunAtLoad</key><true/>
  <key>KeepAlive</key><true/>
  <key>StandardOutPath</key><string>$HOME/.deskpanel/agent.log</string>
  <key>StandardErrorPath</key><string>$HOME/.deskpanel/agent.log</string>
</dict></plist>
PLIST
launchctl unload "$PLIST" 2>/dev/null || true
launchctl load "$PLIST"
echo "Listo. deskpanel arranca solo en modo USB (solo localhost, no abre puertos a la red)."
echo "Conectá el celular y corré: adb reverse tcp:4747 tcp:4747"
