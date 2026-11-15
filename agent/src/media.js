// "Ahora suena": lee y controla el reproductor del sistema.
//  - Windows: controles multimedia del sistema (SMTC) vía PowerShell.
//  - macOS: Spotify o Música vía AppleScript.
//  - Linux: playerctl (MPRIS).
// Cada SO se prueba con salidas simuladas; en equipos reales es experimental.
import { execFile } from 'node:child_process';

export const ACTIONS = ['play-pause', 'next', 'previous'];
const SEP = '|||';

export function parseMedia(out) {
  const parts = String(out ?? '').trim().split(SEP);
  if (parts.length < 4) return null;
  const [title, artist, album, rawState] = parts.slice(-4).map((s) => s.trim());
  const source = parts.length > 4 ? parts[0].trim() : null;
  const st = rawState.toLowerCase();
  const status = st.includes('play') ? 'playing' : st.includes('paus') ? 'paused' : 'stopped';
  if (!title) return null;
  return { title: title.slice(0, 200), artist: artist.slice(0, 200), album: album.slice(0, 200), status, source };
}

const psPrelude = `
$ErrorActionPreference = 'Stop'
[Console]::OutputEncoding = [System.Text.Encoding]::UTF8
Add-Type -AssemblyName System.Runtime.WindowsRuntime
$asTask = ([System.WindowsRuntimeSystemExtensions].GetMethods() | Where-Object { $_.Name -eq 'AsTask' -and $_.GetParameters().Count -eq 1 -and $_.GetParameters()[0].ParameterType.Name -eq 'IAsyncOperation\`1' })[0]
function Await($op, $type) { $t = $asTask.MakeGenericMethod($type).Invoke($null, @($op)); $t.Wait(-1) | Out-Null; $t.Result }
[void][Windows.Media.Control.GlobalSystemMediaTransportControlsSessionManager, Windows.Media.Control, ContentType = WindowsRuntime]
$mgr = Await ([Windows.Media.Control.GlobalSystemMediaTransportControlsSessionManager]::RequestAsync()) ([Windows.Media.Control.GlobalSystemMediaTransportControlsSessionManager])
$s = $mgr.GetCurrentSession()
if (-not $s) { exit 0 }
`;

const PS_ACTION = {
  'play-pause': 'TryTogglePlayPauseAsync',
  next: 'TrySkipNextAsync',
  previous: 'TrySkipPreviousAsync',
};

export function windowsScript(action) {
  if (action) return `${psPrelude}\n[void](Await ($s.${PS_ACTION[action]}()) ([bool]))`;
  return `${psPrelude}
$p = Await ($s.TryGetMediaPropertiesAsync()) ([Windows.Media.Control.GlobalSystemMediaTransportControlsSessionMediaProperties])
$st = $s.GetPlaybackInfo().PlaybackStatus
Write-Output ("{0}${SEP}{1}${SEP}{2}${SEP}{3}" -f $p.Title, $p.Artist, $p.AlbumTitle, $st)`;
}

const encodePs = (script) => Buffer.from(script, 'utf16le').toString('base64');

export function macReadScript() {
  const line = (app) => `tell application "${app}" to return "${app}${SEP}" & (name of current track) & "${SEP}" & (artist of current track) & "${SEP}" & (album of current track) & "${SEP}" & (player state as string)`;
  return `if application "Spotify" is running then
${line('Spotify')}
else if application "Music" is running then
${line('Music')}
end if`;
}

export function macControlScript(action, app = 'Spotify') {
  const verb = { 'play-pause': 'playpause', next: 'next track', previous: 'previous track' }[action];
  return `tell application "${app}" to ${verb}`;
}

const defaultExec = (file, args) =>
  new Promise((resolve, reject) =>
    execFile(file, args, { timeout: 6000, windowsHide: true }, (err, stdout) => (err ? reject(err) : resolve(stdout))),
  );

export function createMedia({ platform = process.platform, exec = defaultExec } = {}) {
  let macApp = 'Spotify';

  async function read() {
    try {
      let out;
      if (platform === 'win32') {
        out = await exec('powershell.exe', ['-NoProfile', '-NonInteractive', '-EncodedCommand', encodePs(windowsScript())]);
      } else if (platform === 'darwin') {
        out = await exec('osascript', ['-e', macReadScript()]);
      } else {
        out = await exec('playerctl', ['metadata', '--format', `{{title}}${SEP}{{artist}}${SEP}{{album}}${SEP}{{status}}`]);
      }
      const media = parseMedia(out);
      if (media?.source) macApp = media.source;
      return media;
    } catch {
      return null; // sin reproductor o sin la herramienta instalada
    }
  }

  async function control(action) {
    if (!ACTIONS.includes(action)) return false;
    try {
      if (platform === 'win32') {
        await exec('powershell.exe', ['-NoProfile', '-NonInteractive', '-EncodedCommand', encodePs(windowsScript(action))]);
      } else if (platform === 'darwin') {
        await exec('osascript', ['-e', macControlScript(action, macApp)]);
      } else {
        await exec('playerctl', [action === 'play-pause' ? 'play-pause' : action]);
      }
      return true;
    } catch {
      return true; // la acción es válida; que no haya reproductor no es un error del pedido
    }
  }

  return { read, control };
}

// Consulta al reproductor solo mientras haya un panel mirando.
export function startMedia(bus, media, everyMs = 4000) {
  let last = '';
  const tick = async () => {
    if (bus.size === 0) return;
    const m = await media.read();
    const payload = m ? { playing: m.status === 'playing', ...m } : { playing: false, title: null };
    const key = JSON.stringify(payload);
    if (key !== last) {
      last = key;
      bus.publish('media', payload);
    }
  };
  const timer = setInterval(tick, everyMs);
  timer.unref();
  bus.publish('media', { playing: false, title: null });
  return timer;
}
