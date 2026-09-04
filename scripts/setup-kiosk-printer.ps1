<#
.SYNOPSIS
  One-time terminal setup: creates a desktop shortcut that launches the POS
  in Chrome/Edge with --kiosk-printing, so chit prints go straight to the
  Windows default printer with NO print dialog and NO extra software.

.USAGE
  From a PowerShell prompt:
    powershell -ExecutionPolicy Bypass -File setup-kiosk-printer.ps1
  Defaults to https://temple.insur-vault.com — pass -PosUrl to override:
    powershell -ExecutionPolicy Bypass -File setup-kiosk-printer.ps1 -PosUrl "https://other-url"

.REQUIREMENTS (do these once per terminal, outside this script)
  1. Install the thermal printer's driver in Windows as usual.
  2. Set it as the Windows DEFAULT printer (Settings > Bluetooth & devices > Printers & scanners).
  3. Staff must open the POS ONLY via the shortcut this script creates —
     opening it from a normal browser tab/bookmark still shows the print dialog.

.NOTES
  --kiosk-printing always prints to the current Windows default printer —
  there is no in-app printer picker with this approach. If a terminal ever
  needs to print to more than one printer, this approach isn't enough.
#>

param(
  [string]$PosUrl = "https://temple.insur-vault.com",

  [string]$ShortcutName = "Temple POS"
)

$ErrorActionPreference = 'Stop'

function Find-Browser {
  $candidates = @(
    "$env:ProgramFiles\Google\Chrome\Application\chrome.exe",
    "${env:ProgramFiles(x86)}\Google\Chrome\Application\chrome.exe",
    "$env:LOCALAPPDATA\Google\Chrome\Application\chrome.exe",
    "$env:ProgramFiles\Microsoft\Edge\Application\msedge.exe",
    "${env:ProgramFiles(x86)}\Microsoft\Edge\Application\msedge.exe"
  )
  foreach ($path in $candidates) {
    if (Test-Path $path) { return $path }
  }
  return $null
}

try {
  $browserPath = Find-Browser
  if (-not $browserPath) {
    throw "Could not find Chrome or Edge installed on this computer. Install one of them first."
  }

  $desktop = [Environment]::GetFolderPath('Desktop')
  $shortcutPath = Join-Path $desktop "$ShortcutName.lnk"

  $wsh = New-Object -ComObject WScript.Shell
  $shortcut = $wsh.CreateShortcut($shortcutPath)
  $shortcut.TargetPath = $browserPath
  $shortcut.Arguments = "--kiosk-printing --app=""$PosUrl"""
  $shortcut.WorkingDirectory = Split-Path $browserPath
  $shortcut.IconLocation = "$browserPath,0"
  $shortcut.Description = "Opens the POS with silent, dialog-free receipt printing"
  $shortcut.Save()

  Write-Host ""
  Write-Host "Shortcut created: $shortcutPath" -ForegroundColor Green
  Write-Host "Tell staff to open the POS ONLY from this shortcut from now on." -ForegroundColor Yellow
  Write-Host "Reminder: the thermal printer must be set as the Windows DEFAULT printer for silent printing to use it." -ForegroundColor Yellow
}
catch {
  Write-Host ""
  Write-Host "FAILED: $($_.Exception.Message)" -ForegroundColor Red
}
finally {
  Write-Host ""
  Read-Host "Press Enter to close this window"
}
