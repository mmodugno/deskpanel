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
