# Instalación

Hay dos partes: **la PC** corre el agente y **el celular o la tablet** abren el panel como si fuera una app.

## 1. En la PC

Necesitás [Node.js](https://nodejs.org) 20 o más nuevo y bajar este repo (`git clone` o "Download ZIP").

### Windows

1. Abrí PowerShell dentro de la carpeta `scripts\windows` y corré:
   ```powershell
   .\instalar-inicio-automatico.ps1
   ```
   Si Windows no deja ejecutarlo: `powershell -ExecutionPolicy Bypass -File .\instalar-inicio-automatico.ps1`.
2. Se crea un acceso directo **deskpanel** en el Escritorio y otro en Inicio. Desde ahora el agente arranca solo al prender la PC, sin ventana.
3. Para probarlo ya, hacé doble clic en el acceso directo del Escritorio. (Si preferís ver los mensajes, usá `scripts\windows\deskpanel.bat`.)
4. Para quitarlo: `.\instalar-inicio-automatico.ps1 -Quitar`.

### macOS

El arranque automático es **opcional**. Lo normal en una Mac de trabajo es iniciarlo a mano cuando lo necesitás:

```bash
npm start -- --usb
```

o hacer doble clic en `scripts/mac/deskpanel.command` (también en modo USB). Corre mientras la ventana esté abierta; al cerrarla, se detiene y no queda nada en segundo plano.

Si más adelante querés que arranque solo al iniciar sesión: `scripts/mac/instalar-inicio-automatico.sh` (y `--quitar` para sacarlo). El modo USB solo escucha en `localhost`, así que no abre puertos en la red.

> Estos scripts los escribí sin poder ejecutarlos en Windows ni en Mac. Si algo falla, abrí un issue con el mensaje de error.

## 2. En el celular o la tablet

La primera vez, el agente abre en la PC una página (`http://localhost:4747/pair`, solo se ve desde esa PC) con el link de conexión.

1. Copiá el link y mandátelo al celular (por ejemplo, por WhatsApp a vos misma). **Lleva tu clave: no lo compartas.**
2. Abrilo en Chrome.
3. Menú ⋮ → **Agregar a la pantalla principal** (o **Instalar app**).
4. Desde ahí abrís el ícono y el panel se conecta solo. La clave queda guardada y no cambia al reiniciar la PC.

La PC y el celular tienen que estar en la misma red Wi-Fi.

### Que no se apague la pantalla

- **Por Wi-Fi** el navegador no deja mantener la pantalla encendida (esa función exige HTTPS). Poné el tiempo de pantalla en el máximo, o en Ajustes de desarrollador activá **Permanecer activo** mientras carga, y dejalo enchufado.
- **Por cable USB** el panel se abre desde `localhost`, que sí cuenta como seguro: se instala como app a pantalla completa y mantiene la pantalla encendida. Es la opción más cómoda para una tablet fija.

### Por cable USB

1. Activá la **depuración USB** en el celular y conectalo.
2. Corré `adb reverse tcp:4747 tcp:4747` en la PC (necesitás `adb`: en Windows, "Platform Tools" de Android; en Mac, `brew install --cask android-platform-tools`).
3. En el celular abrí `http://localhost:4747/` con la clave que muestra `/pair` y agregalo a la pantalla principal.

En Windows el agente arranca en modo Wi-Fi; para usar el cable sin tocar nada más, iniciá con `node agent/src/index.js --usb`.

## Problemas comunes

- **No carga en el celular:** revisá que estén en la misma red y que el Firewall de Windows no bloquee a Node (la primera vez aparece un aviso: permití redes privadas).
- **Dice "token inválido":** abrí de nuevo el link de `/pair`. La clave está en `~/.deskpanel/token`; si la borrás se genera otra y hay que reconectar.
- **Cambió la IP de la PC:** el link viejo deja de andar; copiá el nuevo desde `/pair`. Conviene fijarle una IP a la PC en el router.
