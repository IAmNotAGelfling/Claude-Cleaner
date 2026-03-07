# Git Hooks

This directory contains Git hooks to help maintain code quality and documentation.

## Available Hooks

### commit-msg
Reminds you to update `CHANGELOG.md` when modifying code files (`claude-clean.js` or `package.json`).

**Behavior**: Non-blocking reminder (won't prevent commits)

## Installation

### Option 1: Automatic Install (Recommended)

Run this command from the project root:

```bash
# On Windows (Git Bash)
cp hooks/commit-msg .git/hooks/commit-msg && chmod +x .git/hooks/commit-msg

# On Unix/Linux/macOS
cp hooks/commit-msg .git/hooks/commit-msg && chmod +x .git/hooks/commit-msg
```

### Option 2: Manual Install

1. Copy `hooks/commit-msg` to `.git/hooks/commit-msg`
2. Make it executable: `chmod +x .git/hooks/commit-msg`

### Option 3: Global Git Hooks Directory (Advanced)

Configure Git to use this hooks directory for all commits:

```bash
git config core.hooksPath hooks
```

**Note**: This applies to this repository only.

## Verifying Installation

After installing, make a test commit that modifies `claude-clean.js` without updating `CHANGELOG.md`. You should see:

```
💡 Reminder: You're changing code but didn't update CHANGELOG.md
   Consider adding an [Unreleased] section if this is a notable change
```

## Disabling Hooks

To temporarily bypass hooks, use:

```bash
git commit --no-verify
```

To permanently disable, remove the hook file:

```bash
rm .git/hooks/commit-msg
```
