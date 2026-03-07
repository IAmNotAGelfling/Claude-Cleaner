# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

Claude Code Cleaner is a single-file Node.js CLI utility for managing Claude Code data (conversation history, caches, system data). It's a TUI application built with @clack/prompts that provides interactive cleanup, backup/restore, and dashboard features.

**Key Characteristic**: This is a production-ready, self-contained utility (no build step, no tests, single file).

## Development Commands

```bash
# Run the tool (no build needed)
node claude-clean.js

# Test specific commands directly
node claude-clean.js status
node claude-clean.js dashboard
node claude-clean.js clean-projects --dry-run
node claude-clean.js help

# Install dependencies after package.json changes
npm install

# Test with custom location (useful for development)
node claude-clean.js --location /path/to/test/dir status
```

## Architecture

### Single-File Design
All functionality is in `claude-clean.js`. The file is organized into sections:
1. **Config System** (lines ~40-140) - Persistent settings in `~/.claude-cleanrc`
2. **Compression** (lines ~142-250) - 7zip/tar/copy backup methods
3. **Size Cache** (lines ~252-300) - 5-second TTL cache for directory sizes
4. **Manifest System** (lines ~302-400) - JSONL cleanup history tracker
5. **Core Operations** (lines ~402-800) - Discovery, backup, deletion logic
6. **Interactive Menus** (lines ~802-1100) - TUI with @clack/prompts
7. **CLI Entry Point** (lines ~1102+) - Argument parsing and routing

### Data Persistence

**Config File**: `~/.claude-cleanrc` (JSON)
- User preferences: default location, compression preference, retention settings
- Created on first config command, optional otherwise

**Manifest File**: `~/.claude-cleaner-backups/manifest.jsonl` (JSONL)
- One JSON object per line (append-only for reliability)
- Tracks every cleanup operation: timestamp, items, sizes, backups created
- Powers dashboard statistics and restore metadata enrichment
- Corrupted lines are silently skipped (graceful degradation)

**Backups**: `~/.claude-cleaner-backups/`
- Naming: `{name}.{timestamp}.{extension}` (e.g., `cache.2026_03_06-15-23-45.7z`)
- Format auto-detected: 7zip > tar.gz > plain copy

### Size Cache Implementation
```javascript
// Key: absolute path, Value: { size, timestamp }
const sizeCache = new Map();
const SIZE_CACHE_TTL = 5000; // 5 seconds

// Cache invalidation happens:
// 1. After TTL expires (checked on read)
// 2. After any cleanup operation (explicit clear)
// 3. On process restart
```

Performance impact: First run ~2s, cached ~0.2s (10x speedup)

### Compression Detection
The tool auto-detects available compression tools in this order:
1. **7zip** (`7z` command) - Best compression, fastest
2. **tar** (`tar` command) - Good compression, Unix default
3. **Plain copy** - Fallback if neither available

Typical ratio: ~30% (700 MB → 200 MB with 7zip)

## Claude Code Data Structure

This tool operates on `~/.claude/` which contains:

**Sessions Mode** (`~/.claude/projects/`):
- Each subdirectory = one project's conversation data
- Directory names encode project paths: `C--Git--MyProject`
- Contains `.session` files, history, and related `session-env` directories

**System Data Mode** (various `~/.claude/` locations):
- `history.jsonl` - Command history
- `cache/`, `paste-cache/`, `shell-snapshots/` - Various caches
- `plans/`, `file-history/`, `todos/` - Feature data
- `debug/` - Often the largest (logs)

## Critical Implementation Details

### ESC Navigation Fix
@clack/prompts handles ESC correctly (goes back to previous menu, not exit). Previous version (inquirer.js) had a bug requiring a 23-line workaround that's now removed.

### Dry-Run Mode
When `--dry-run` flag is present:
- All discovery and size calculation runs normally
- Backup and deletion steps are skipped
- Results show "Would delete" instead of "Deleted"
- No manifest entry created

### Restore Conflict Detection
Before restoring a backup, the tool checks if the target exists:
```javascript
// For projects: Check if ~/.claude/projects/{name} exists
// For system data: Check if specific file/dir exists
// If exists: Show error, prevent restore (no overwrite)
```

### Session-Env Handling
When deleting a project directory (e.g., `C--Git--MyProject`), the tool also finds and deletes related `session-env` directories that share the same base name pattern.

## Making Changes

### Git Hooks for CHANGELOG

A `commit-msg` hook reminds you to update `CHANGELOG.md` when modifying code files.

**Installation** (already done in this repo):
```bash
cp hooks/commit-msg .git/hooks/commit-msg && chmod +x .git/hooks/commit-msg
```

**What It Does**: When you commit changes to `claude-clean.js` or `package.json` without updating `CHANGELOG.md`, you'll see a reminder (non-blocking).

**Location**: `hooks/commit-msg` (tracked in git) → copy to `.git/hooks/commit-msg` (local only)

See `hooks/README.md` for full documentation.

### Adding a New Command
1. Add command handler function (around line 1000)
2. Update CLI argument parser in main() (line ~1150)
3. Add to interactive menu options (lines ~900-1000)
4. Update help text (showHelp function, line ~700)
5. Update README.md and CHANGELOG.md (the commit-msg hook will remind you!)

### Modifying Compression
Edit `backupPath()` function (line ~180). Compression method is detected once per backup operation. To change preference order, reorder the detection logic.

### Adjusting Cache TTL
```javascript
const SIZE_CACHE_TTL = 5000; // Line ~30
// Change to desired milliseconds (e.g., 30000 = 30 seconds)
```

### Adding Config Options
1. Update defaults in `loadConfig()` (line ~42)
2. Add validation in `saveConfig()` (line ~68)
3. Add to interactive config menu in `configMenu()` (line ~950)

## Scripting and Automation

For automated cleanup scripts:
```bash
# Use quiet mode to suppress interactive prompts
node claude-clean.js --quiet clean-projects

# Combine with dry-run for safe previews
node claude-clean.js clean-projects --dry-run --quiet

# Check exit codes (0 = success, non-zero = error)
```

## Platform Considerations

**Windows**: Path separators in project names use `--` (e.g., `C--Git--Project`)
**Unix**: Path separators in project names use `-` or `--` depending on depth

The tool uses Node.js `path` module for cross-platform compatibility, but backup names reflect the encoded project path format.

## Version Tracking

Current version: 1.0.0 (in package.json)

When incrementing version:
1. Update `package.json`
2. Add entry to `CHANGELOG.md`
3. Update README.md version references (header, summary section)
4. Tag git commit: `git tag v1.x.x`

## Dependencies

```json
{
  "@clack/prompts": "^1.1.0",  // TUI framework (ESC handling, spinners, select/multiselect)
  "chalk": "^5.3.0",            // Terminal colors (ESM-only, v5+)
  "dayjs": "^1.11.10"           // Date formatting (with relativeTime plugin)
}
```

All dependencies are ESM-only. The project uses `"type": "module"` in package.json.
