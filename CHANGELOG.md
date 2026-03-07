# Changelog

All notable changes to Claude Cleaner will be documented in this file.

## [1.0.0] - 2026-03-07

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

#### System Data Cleaning
- Cleans 9 types of Claude Code data: history, cache, backups, paste-cache, shell-snapshots, plans, debug, file-history, todos

#### npm Publication Ready
- Package prepared for npm with `bin` field for CLI command (`claude-clean`)
- Users can run with `npx claude-clean` when published
- Includes `repository`, `bugs`, and `homepage` URLs
- Node.js >=16.0.0 requirement specified

#### Technical Details
- **Single-File Design**: No build step required
- **Dependencies**: @clack/prompts ^1.1.0, chalk ^5.3.0, dayjs ^1.11.10
- **Platform**: Node.js (ESM), cross-platform (Windows/macOS/Linux)
- **License**: MIT

---

[1.0.0]: https://github.com/IAmNotAGelfling/Claude-Cleaner/releases/tag/v1.0.0
