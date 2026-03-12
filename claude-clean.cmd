@echo off
REM Claude Cleaner - Windows Command Prompt Runner
REM Usage: claude-clean [command] [options]

setlocal

REM Get the directory where this script is located
set "SCRIPT_DIR=%~dp0"

REM Run the Node.js script with all passed arguments
node "%SCRIPT_DIR%claude-clean.js" %*

endlocal
