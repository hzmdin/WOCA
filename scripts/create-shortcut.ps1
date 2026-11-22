# Creates a "WOCA" shortcut on the Desktop that runs start-woca.cmd.
# Run once from the project folder:  powershell -ExecutionPolicy Bypass -File scripts\create-shortcut.ps1
# Run it again if the project folder moves (the shortcut stores the full path).

$ErrorActionPreference = 'Stop'
$projectDir = Split-Path -Parent $PSScriptRoot
$launcher = Join-Path $projectDir 'start-woca.cmd'
if (-not (Test-Path $launcher)) { throw "start-woca.cmd not found in $projectDir" }

# Use Edge's icon so caregivers recognise it; fall back to a generic one.
$edge = (Get-ItemProperty 'HKLM:\SOFTWARE\Microsoft\Windows\CurrentVersion\App Paths\msedge.exe' -ErrorAction SilentlyContinue).'(default)'
$icon = if ($edge -and (Test-Path $edge)) { "$edge,0" } else { "$env:SystemRoot\System32\shell32.dll,13" }

$desktop = [Environment]::GetFolderPath('Desktop')   # works with OneDrive desktops too
$shortcutPath = Join-Path $desktop 'WOCA.lnk'

$shell = New-Object -ComObject WScript.Shell
$shortcut = $shell.CreateShortcut($shortcutPath)
$shortcut.TargetPath = $launcher
$shortcut.WorkingDirectory = $projectDir
$shortcut.WindowStyle = 7   # minimized: the black launcher window stays out of the way
$shortcut.IconLocation = $icon
$shortcut.Description = 'WOCA - Whenever Operating Communication Assistant'
$shortcut.Save()

Write-Output "Shortcut created: $shortcutPath -> $launcher"
