' Inicia deskpanel en segundo plano, sin ventana de consola.
Set fso = CreateObject("Scripting.FileSystemObject")
Set sh = CreateObject("WScript.Shell")
root = fso.GetParentFolderName(fso.GetParentFolderName(fso.GetParentFolderName(WScript.ScriptFullName)))
sh.CurrentDirectory = root
sh.Run "cmd /c node agent\src\index.js", 0, False
