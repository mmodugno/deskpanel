# Crea un acceso directo "deskpanel" en el Escritorio y otro en Inicio de Windows,
# así el agente arranca solo al prender la PC. Para quitarlos: .\instalar-inicio-automatico.ps1 -Quitar
param([switch]$Quitar)

$ErrorActionPreference = 'Stop'
$root = Split-Path -Parent (Split-Path -Parent $PSScriptRoot)
$vbs = Join-Path $PSScriptRoot 'iniciar-deskpanel.vbs'
$links = @(
  (Join-Path ([Environment]::GetFolderPath('Startup')) 'deskpanel.lnk'),
  (Join-Path ([Environment]::GetFolderPath('Desktop')) 'deskpanel.lnk')
)

if ($Quitar) {
  $links | Where-Object { Test-Path $_ } | Remove-Item
  Write-Host 'Listo: se quitaron los accesos directos.'
  exit 0
}

if (-not (Get-Command node -ErrorAction SilentlyContinue)) {
  Write-Warning 'No encontré Node.js. Instalalo desde https://nodejs.org (versión 20 o más nueva) y volvé a correr este script.'
  exit 1
}

$ws = New-Object -ComObject WScript.Shell
foreach ($path in $links) {
  $sc = $ws.CreateShortcut($path)
  $sc.TargetPath = 'wscript.exe'
  $sc.Arguments = "`"$vbs`""
  $sc.WorkingDirectory = $root
  $sc.Description = 'deskpanel'
  $sc.Save()
}
Write-Host 'Listo. deskpanel arrancará solo al iniciar Windows, y tenés un acceso directo en el Escritorio.'
Write-Host 'Para conectar el celular, abrí http://localhost:4747/pair en esta PC.'
