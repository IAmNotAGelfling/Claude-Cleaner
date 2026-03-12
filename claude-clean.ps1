#!/usr/bin/env pwsh
<#
.SYNOPSIS
    Claude Cleaner - PowerShell Runner

.DESCRIPTION
    Wrapper script to run Claude Cleaner from PowerShell.
    Passes all arguments through to the Node.js script.

.PARAMETER Arguments
    All arguments are passed through to claude-clean.js

.EXAMPLE
    .\claude-clean.ps1 status

.EXAMPLE
    .\claude-clean.ps1 clean-projects --dry-run

.EXAMPLE
    .\claude-clean.ps1 dashboard
#>

# Get the directory where this script is located
$ScriptDir = Split-Path -Parent $MyInvocation.MyCommand.Path

# Run the Node.js script with all passed arguments
& node (Join-Path $ScriptDir "claude-clean.js") @args
