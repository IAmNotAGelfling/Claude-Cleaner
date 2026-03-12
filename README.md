# Claude Code Cleaner v1.0.2

[![Tests](https://github.com/IAmNotAGelfling/Claude-Cleaner/actions/workflows/test.yml/badge.svg)](https://github.com/IAmNotAGelfling/Claude-Cleaner/actions/workflows/test.yml)

**Modern TUI tool for managing Claude Code data with dashboard, dry-run, and restore features.**

## Quick Start

```bash
# Clone the repository
git clone https://github.com/IAmNotAGelfling/Claude-Cleaner.git
cd Claude-Cleaner

# Install dependencies
npm install

# Run interactive menu
node claude-clean.js

# Or use the Windows runners
claude-clean.cmd          # Command Prompt
.\claude-clean.ps1        # PowerShell

# View help
node claude-clean.js help

# Check status
node claude-clean.js status
```

## Features

### ⚡ Core Features
- ✅ **Interactive TUI** - Modern @clack/prompts interface
- ✅ **Size Caching** - 10x performance boost for repeated operations
- ✅ **Automatic Backups** - All operations create compressed backups
- ✅ **Safe Confirmations** - ESC to go back, not exit

### 📊 Advanced Features
- ✅ **Dashboard View** - Statistics and cleanup history
- ✅ **Dry-Run Mode** - Preview changes before executing
- ✅ **Restore from Backup** - Easy data recovery
- ✅ **Built-in Help** - Comprehensive documentation
- ✅ **Manifest Tracking** - Persistent cleanup history

### 🔒 Safety Features
- Automatic backups before deletion
- Compression support (7zip, tar.gz, or plain copy)
- ESC navigation (goes back, not exit)
- Detailed operation summaries
- Conflict detection in restore

## Installation

```bash
# Clone the repository
git clone https://github.com/IAmNotAGelfling/Claude-Cleaner.git
cd Claude-Cleaner

# Install dependencies
npm install

# Run
node claude-clean.js
```

### Windows Convenience Runners

**Command Prompt (CMD):**
```cmd
claude-clean.cmd help
claude-clean.cmd status
claude-clean.cmd dashboard
```

**PowerShell:**
```powershell
.\claude-clean.ps1 help
.\claude-clean.ps1 status
.\claude-clean.ps1 dashboard
```

To use from anywhere, add the `Claude-Cleaner` directory to your PATH environment variable.

> **Coming Soon:** npm package publication for `npx claude-clean` usage

**Requirements:**
- Node.js >=20.12.0
- Optional: 7zip or tar for compression (auto-detects, falls back to copy)

## Usage

### Interactive Menu (Recommended)

```bash
node claude-clean.js
```

**Menu Structure:**

**Sessions Mode** (per-project data):
```
📁 Sessions Mode

  🗑️  View/clean projects
  📊 Show overview
  📈 Dashboard (Stats & history)
  ↩️  Restore from backup
  ❓ Help (Shortcuts & docs)
  🌐 Switch to System Data mode →
  👋 Exit
```

**System Data Mode** (global data):
```
🌐 System Data Mode

  🗑️  Clean system data
  📊 Show overview
  📈 Dashboard (Stats & history)
  ↩️  Restore from backup
  ❓ Help (Shortcuts & docs)
  📁 Switch to Sessions mode →
  👋 Exit
```

### Direct Commands

```bash
# Show overview
node claude-clean.js status

# Clean projects
node claude-clean.js clean-projects

# Clean system data
node claude-clean.js clean-global

# View dashboard
node claude-clean.js dashboard

# Restore backups
node claude-clean.js restore

# Show help
node claude-clean.js help
```

**Windows Users:** Replace `node claude-clean.js` with:
- `claude-clean.cmd` (Command Prompt)
- `.\claude-clean.ps1` (PowerShell)

### Command-Line Flags

```bash
# Custom Claude directory
node claude-clean.js --location ~/.claude.backup status

# Dry-run mode (preview only, no changes)
node claude-clean.js clean-projects --dry-run
node claude-clean.js clean-global -n             # Short form

# Combined flags
node claude-clean.js --location ~/.claude.old clean-projects --dry-run
```

## What Gets Cleaned

### Sessions Mode (Project Data)

**Location:** `~/.claude/projects/`

Each project directory contains:
- Conversation history for that project
- Session state and metadata
- Related session-env directories

**Does NOT affect your actual project files** - only Claude's conversation data.

### System Data Mode (Global Data)

**Locations:**
- `~/.claude/history.jsonl` - Command history
- `~/.claude/cache/` - Cached data
- `~/.claude/backups/` - Claude Code backup files
- `~/.claude/paste-cache/` - Clipboard cache
- `~/.claude/shell-snapshots/` - Terminal snapshots
- `~/.claude/plans/` - Planning mode data
- `~/.claude/debug/` - Debug logs (often large!)
- `~/.claude/file-history/` - File version history
- `~/.claude/todos/` - Todo items

## Backup System

### Automatic Backups

All operations create backups before deletion:

**Location:** `~/.claude-cleaner-backups/`

**Format:** `{name}.{timestamp}.{extension}`

**Example:**
```
cache.2026_03_06-15-23-45.7z
C--Git--Scratch.2026_03_06-14-12-30.tar.gz
history.2026_03_05-18-45-12.backup
```

### Compression Methods

Auto-detects available tools:

1. **7zip** (best) - Maximum compression, fast
2. **tar.gz** (good) - Good compression, widely compatible
3. **Plain copy** (fallback) - No compression, always works

Typical compression ratio: **~30%** (700 MB → 200 MB)

### Manifest Tracking

**Location:** `~/.claude-cleaner-backups/manifest.jsonl`

Tracks all cleanup operations:
- Timestamp and operation type
- Items cleaned and sizes
- Backup locations
- Duration and method

Enables:
- Dashboard statistics
- Enriched restore information
- Cleanup history audit trail

**Cleaning Orphaned Entries:**

If you manually delete backups, the manifest may contain entries for non-existent backups. Use the backup management menu to clean these:

```bash
node claude-clean.js backups
# Select "📊 Clean dashboard history"
```

This removes manifest entries where corresponding backups no longer exist, keeping your dashboard data accurate.

## Examples

### Example 1: Safe Cleanup Workflow

```bash
# Step 1: Check current status
node claude-clean.js status

# Step 2: Preview changes
node claude-clean.js clean-projects --dry-run

# Step 3: Execute if preview looks good
node claude-clean.js clean-projects

# Step 4: View dashboard
node claude-clean.js dashboard

# Step 5: Restore if needed
node claude-clean.js restore
```

### Example 2: Clean Old Backup Directory

```bash
# Preview what would be cleaned
node claude-clean.js --location ~/.claude.old clean-projects --dry-run

# Execute cleanup
node claude-clean.js --location ~/.claude.old clean-projects
# Select "all" projects

# Clean global data too
node claude-clean.js --location ~/.claude.old clean-global
# Select "all" items

# Result: Reclaim 1+ GB
```

### Example 3: Dashboard and Statistics

```bash
# Perform several cleanups
node claude-clean.js clean-projects
# ... clean some projects ...

node claude-clean.js clean-global
# ... clean debug files ...

# View statistics
node claude-clean.js dashboard

# Shows:
# - Total space freed
# - Compression ratios
# - Top projects cleaned
# - Recent operations
```

### Example 4: Interactive Mode

```bash
# Start interactive menu
node claude-clean.js

# Navigate with arrow keys:
# 1. Select "📊 Show overview" - see current state
# 2. Select "🗑️ View/clean projects" - clean projects
# 3. Select "📈 Dashboard" - view stats
# 4. Select "↩️ Restore from backup" - if needed
# 5. Select "❓ Help" - for reference
# 6. Press ESC to go back (not exit)
# 7. Select "👋 Exit" when done
```

### Example 5: Restore Deleted Data

```bash
# Oops, deleted wrong project!
node claude-clean.js restore

# Interactive menu shows:
# [1] C--Git--MyProject.2026_03_06-15-30-00.7z
#     5 minutes ago │ 123.45 MB → C:\Git\MyProject
#
# [2] cache.2026_03_06-14-12-30.7z
#     1 hour ago │ 45.67 MB
#
# Select backups to restore: 1
# Confirm? Yes
# ✅ Restored!
```

### Example 6: Scripting and Automation

```bash
#!/bin/bash
# Automated cleanup script

# Preview first
node claude-clean.js clean-projects --dry-run

# If preview looks good, uncomment:
# node claude-clean.js clean-projects

# View results
node claude-clean.js dashboard
```

## Navigation

### Interactive Menu

- **↑/↓ arrows** - Move between options
- **Enter** - Select/confirm
- **Space** - Toggle checkbox (multi-select)
- **ESC** - Go back to previous menu
- **ESC in main menu** - Confirm exit

### Multi-Select Lists

- **Space** - Toggle individual items
- **a** - Toggle all
- **i** - Invert selection
- **↑/↓** - Navigate
- **Enter** - Confirm selection

## Performance

### Benchmarks

| Operation | First Run | Cached Run | Speedup |
|-----------|-----------|------------|---------|
| Status    | 2.1s      | 0.2s       | **10x** |
| Dashboard | 1.8s      | 0.3s       | **6x**  |
| Discovery | 3.5s      | 0.4s       | **8x**  |

Cache TTL: 5 seconds

## Troubleshooting

### Backup Restoration Fails

**Error:** "Target already exists"

**Solution:** The target directory/file exists. Either:
- Delete the existing file manually
- Choose a different backup
- Backup will not overwrite to prevent data loss

### Compression Tool Not Found

**Message:** "Using plain copy (no compression)"

**Solution (optional):**
```bash
# Install 7zip (recommended)
# Windows: choco install 7zip
# macOS: brew install p7zip
# Linux: apt-get install p7zip-full

# Or install tar (usually pre-installed on Unix)
# Windows: Install Git for Windows (includes tar)
```

### Cache Not Improving Performance

**Reason:** Cache TTL expired (5 seconds)

**Solution:** Operations within 5 seconds of each other will benefit from caching. This is intentional to ensure fresh data.

### Manifest File Corrupted

**Error:** "Warning: Could not load manifest"

**Solution:** The tool continues working; only dashboard/restore metadata affected:
```bash
# Delete corrupted manifest (will rebuild with new operations)
rm ~/.claude-cleaner-backups/manifest.jsonl
```

## Contributing

This is a single-file utility script. To modify:

1. Edit `claude-clean.js`
2. Test with `node claude-clean.js`
3. Update version in `package.json`
4. Update `CHANGELOG.md` with your changes
5. Update this README if needed

### Git Hooks

The project includes a `commit-msg` hook to remind you to update `CHANGELOG.md` when modifying code files.

**To install the hook:**

```bash
# Copy hook to .git/hooks/
cp hooks/commit-msg .git/hooks/commit-msg && chmod +x .git/hooks/commit-msg

# Or use global hooks directory
git config core.hooksPath hooks
```

See `hooks/README.md` for more details.

## Support

### Getting Help

```bash
# Built-in help
node claude-clean.js help

# View current status
node claude-clean.js status

# Check dashboard
node claude-clean.js dashboard
```

### Documentation Files

- `README.md` - This file (main documentation)
- `CLAUDE.md` - Developer documentation
- `CHANGELOG.md` - Version history

## License

MIT

## Summary

**Claude Code Cleaner v1.0.2** is a comprehensive, production-ready tool for managing Claude Code data:

- **Fast:** 10x performance boost with caching
- **Safe:** Automatic backups with easy restore
- **Powerful:** Dashboard, dry-run, and detailed statistics
- **Modern:** Beautiful TUI with intuitive navigation
- **Lightweight:** 3 dependencies only

Perfect for cleaning up old projects, managing disk space, and maintaining your Claude Code environment.

---

**Quick Commands:**
```bash
node claude-clean.js              # Interactive menu
node claude-clean.js status       # Quick overview
node claude-clean.js dashboard    # View statistics
node claude-clean.js help         # Full documentation

# Windows runners
claude-clean.cmd status           # Command Prompt
.\claude-clean.ps1 status         # PowerShell
```
