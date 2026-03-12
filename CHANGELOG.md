# Changelog

All notable changes to Claude Cleaner will be documented in this file.

## [1.0.2] - 2026-03-12

### Added
- **Clean Dashboard History**: New option in backup management to remove orphaned manifest entries
  - Removes dashboard entries where corresponding backups no longer exist
  - Accessible via "📊 Clean dashboard history" in backup management menu
  - Keeps dashboard data synchronized with actual backups

### Fixed
- **Exit Confirmation Loop**: Fixed issue where pressing ESC or No on exit confirmation would freeze the menu
  - Menu now properly redisplays after cancelling exit confirmation
  - Improved comment clarity for exit handling logic

## [1.0.1] - 2026-03-12

### Added
- **Windows Runner Scripts**: `claude-clean.cmd` and `claude-clean.ps1` for convenient execution
  - CMD script for Command Prompt users
  - PowerShell script with full help documentation
  - Both scripts pass all arguments through to the Node.js script

### Fixed
- **Entry Point Check**: Fixed ESM module detection on Windows
  - Previous implementation compared `import.meta.url` with `process.argv[1]` incorrectly
  - Now uses `fileURLToPath()` and `path.resolve()` for proper cross-platform path comparison
  - Fixes issue where script would not run when executed directly

## [1.0.0] - 2026-03-08

### Initial Release

A comprehensive Node.js CLI tool for managing Claude Code data with modern TUI, dashboard, and backup features.

#### Core Features
- **Interactive TUI**: Modern @clack/prompts interface with dual modes (Sessions/System Data)
- **Safe Operations**: Automatic backups before deletion with compression support (7zip/tar/copy)
- **Size Caching**: 10x performance boost with 5-second TTL cache

#### Dashboard & Analytics
- **Dashboard View**: Comprehensive statistics and cleanup history
- **Manifest System**: JSONL-based cleanup history tracking
- **CSV Export**: Export dashboard statistics for long-term tracking

#### Backup & Restore
- **Automatic Backups**: All operations create compressed backups
- **Restore Functionality**: Interactive restoration with conflict detection
- **Backup Management**: Prune backups older than configurable retention period

#### Advanced Features
- **Dry-Run Mode**: Preview changes with `--dry-run` / `-n` flag
- **Config System**: Persistent settings in `~/.claude-cleanrc`
  - Default location setting
  - Compression preference
  - Backup retention days
  - Auto-delete old backups option
- **Quiet Mode**: `--quiet` / `-q` flag for scripting and automation
- **Built-in Help**: Comprehensive `help` command

#### Developer Tools
- **Git Hooks**: `commit-msg` hook to remind about CHANGELOG updates
- **Developer Docs**: Comprehensive `CLAUDE.md` for future maintenance
- **Test Suite**: 63 comprehensive tests across 3 test files covering utility functions, config system, and manifest handling
- **GitHub Actions CI**: Automated testing on all PRs and pushes (Node 20/22 × Ubuntu/Windows/macOS)

#### System Data Cleaning
- Cleans 9 types of Claude Code data: history, cache, backups, paste-cache, shell-snapshots, plans, debug, file-history, todos

#### npm Publication Ready
- Package prepared for npm with `bin` field for CLI command (`claude-clean`)
- Users can run with `npx claude-clean` when published
- Includes `repository`, `bugs`, and `homepage` URLs
- Node.js >=20.12.0 requirement specified

#### Technical Details
- **Single-File Design**: No build step required
- **Dependencies**: @clack/prompts ^1.1.0, chalk ^5.3.0, dayjs ^1.11.10
- **Platform**: Node.js (ESM), cross-platform (Windows/macOS/Linux)
- **Testing**: 63 tests across 3 test files using Node.js built-in test runner
- **License**: MIT

---

[1.0.2]: https://github.com/IAmNotAGelfling/Claude-Cleaner/releases/tag/v1.0.2
[1.0.1]: https://github.com/IAmNotAGelfling/Claude-Cleaner/releases/tag/v1.0.1
[1.0.0]: https://github.com/IAmNotAGelfling/Claude-Cleaner/releases/tag/v1.0.0
