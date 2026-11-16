const esc = (s) => String(s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]);

export function isLoopback(addr = '') {
  return addr === '::1' || addr === '127.0.0.1' || addr.startsWith('::ffff:127.');
}

export function pairUrls(addresses, port, token) {
  return addresses.map((ip) => `http://${ip}:${port}/?token=${token}`);
}

// Página que se abre en la PC (solo desde la propia máquina) con el link para el celular.
export function pairPage(urls, usbUrl) {
  const items = urls
    .map((u, i) => `<div class="row"><code id="u${i}">${esc(u)}</code><button data-i="${i}">Copiar</button></div>`)
    .join('') || '<p class="dim">No encontré una red Wi-Fi. Probá el modo USB.</p>';
  return `<!doctype html><html lang="es"><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Conectar un dispositivo · deskpanel</title>
<style>body{font:16px/1.5 system-ui,sans-serif;background:#0f0a1f;color:#f1ecff;margin:0;padding:32px;max-width:720px}h1{font-weight:600}h2{margin-top:32px;font-size:15px;color:#c4b5fd;letter-spacing:.04em}.row{display:flex;gap:10px;align-items:center;background:#1a1033;border:1px solid #3a2a6b;border-radius:14px;padding:12px 14px;margin:10px 0}code{flex:1;word-break:break-all;color:#e9d5ff}button{font:inherit;background:#7c5cff;color:#fff;border:0;border-radius:10px;padding:10px 16px;cursor:pointer}.dim{color:#9d8fc4}ol{padding-left:20px}</style>
<h1>Conectar el celular o la tablet</h1>
<p class="dim">Esta página solo se ve en esta PC. El link tiene tu clave: no lo compartas con nadie.</p>
<h2>POR WI-FI (misma red que la PC)</h2>${items}
<ol><li>Copiá el link y mandátelo al celular (por ejemplo, por WhatsApp a vos misma).</li><li>Abrilo en Chrome.</li><li>Menú ⋮ → <b>Agregar a la pantalla principal</b> (o <b>Instalar app</b>).</li><li>Abrí el ícono: se conecta solo y recuerda la clave.</li></ol>
<h2>POR CABLE USB</h2><p>Reiniciá con <code>--usb</code>, conectá el celular y corré <code>adb reverse tcp:4747 tcp:4747</code>. Después abrí:</p><div class="row"><code id="usb">${esc(usbUrl)}</code><button data-i="usb">Copiar</button></div>
<script>document.querySelectorAll('button').forEach(b=>b.onclick=async()=>{const el=document.getElementById(b.dataset.i==='usb'?'usb':'u'+b.dataset.i);try{await navigator.clipboard.writeText(el.textContent);b.textContent='¡Copiado!';setTimeout(()=>b.textContent='Copiar',1500)}catch{}})</script></html>`;
}
