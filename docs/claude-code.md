# Conectar Claude Code

Claude Code puede avisarle al panel cuando una sesión trabaja, pide permiso o termina, usando [hooks](https://docs.claude.com/en/docs/claude-code/hooks).
Agregá esto a tu `~/.claude/settings.json` (reemplazá `TOKEN` por el que imprime el agente al arrancar):

```json
{
  "hooks": {
    "UserPromptSubmit": [{ "hooks": [{ "type": "command", "command": "curl -s -X POST \"http://localhost:4747/api/hook?token=TOKEN\" -d @-" }] }],
    "Notification":     [{ "hooks": [{ "type": "command", "command": "curl -s -X POST \"http://localhost:4747/api/hook?token=TOKEN\" -d @-" }] }],
    "Stop":             [{ "hooks": [{ "type": "command", "command": "curl -s -X POST \"http://localhost:4747/api/hook?token=TOKEN\" -d @-" }] }],
    "SessionEnd":       [{ "hooks": [{ "type": "command", "command": "curl -s -X POST \"http://localhost:4747/api/hook?token=TOKEN\" -d @-" }] }]
  }
}
```

Claude Code manda el evento como JSON por la entrada estándar y `curl -d @-` lo reenvía tal cual.
El token cambia cada vez que reiniciás el agente; para fijarlo, definí la variable de entorno `DESKPANEL_TOKEN`.

| Evento | Lámpara en el panel |
|---|---|
| `UserPromptSubmit` | ámbar pulsando (trabajando) |
| `Notification` | roja titilando + sonido + vibración (te necesita) |
| `Stop` | verde + sonido corto (terminó) |
| `SessionEnd` | desaparece |

## Aprobar permisos desde el panel

Con el hook `PermissionRequest`, cuando Claude Code pide permiso para una herramienta el panel muestra el comando a pantalla completa con **Permitir** / **Denegar**:

```json
{
  "hooks": {
    "PermissionRequest": [{ "hooks": [{ "type": "command", "timeout": 120, "command": "curl -s --max-time 118 -X POST \"http://localhost:4747/api/permission?token=TOKEN\" -d @-" }] }]
  }
}
```

- El hook queda esperando tu respuesta. Si no contestás en 110 s (se cambia con `permissionTimeoutMs` en `config.local.json`), el agente responde vacío y Claude Code te pregunta en la terminal como siempre.
- Si el panel no está abierto o el agente está apagado, `curl` falla y pasa lo mismo: la terminal pregunta.
- **Ojo:** quien tenga el token puede aprobar comandos. Usalo solo en una red de confianza o con el modo `--usb`.
- Este hook depende de la versión de Claude Code; verificá en la [documentación de hooks](https://docs.claude.com/en/docs/claude-code/hooks) que tu versión lo soporte.
