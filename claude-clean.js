#!/usr/bin/env node

/**
 * Claude Code Comprehensive Cleaner - Phase 3
 *
 * Phase 3 Features:
 * - Size caching for improved performance
 * - Manifest system for cleanup history
 * - Dashboard view with statistics
 * - Dry-run mode for previewing changes
 * - Built-in help menu
 * - Restore from backup functionality
 */

import fs from 'fs';
import path from 'path';
import os from 'os';
import { execSync } from 'child_process';
import * as p from '@clack/prompts';
import chalk from 'chalk';
import dayjs from 'dayjs';
import relativeTime from 'dayjs/plugin/relativeTime.js';

dayjs.extend(relativeTime);

const HOME = os.homedir();
const BACKUP_DIR = path.join(HOME, '.claude-cleaner-backups');

// Size cache configuration
const SIZE_CACHE_TTL = 5000; // 5 seconds
const sizeCache = new Map(); // Key: path, Value: { size, timestamp }

// Manifest path
const MANIFEST_PATH = path.join(BACKUP_DIR, 'manifest.jsonl');

// ============================================================================
// CONFIG SYSTEM
// ============================================================================

const CONFIG_FILE = path.join(HOME, '.claude-cleanrc');

function loadConfig() {
  const defaults = {
    defaultLocation: null,
    compressionPreference: 'auto', // auto, 7zip, tar, copy
    backupRetentionDays: 30,
    autoDeleteOldBackups: false,
    quietMode: false,
    confirmations: true
  };

  if (!fs.existsSync(CONFIG_FILE)) {
    return defaults;
  }

  try {
    const content = fs.readFileSync(CONFIG_FILE, 'utf8');
    const config = JSON.parse(content);
    return { ...defaults, ...config };
  } catch (error) {
    console.error(chalk.yellow(`Warning: Could not load config file: ${error.message}`));
    return defaults;
  }
}

function saveConfig(config) {
  try {
    fs.writeFileSync(CONFIG_FILE, JSON.stringify(config, null, 2), 'utf8');
    return true;
  } catch (error) {
    console.error(chalk.red(`Error: Could not save config: ${error.message}`));
    return false;
  }
}

async function configCommand() {
  console.clear();
  p.intro(chalk.bold.cyan('🔧  Configuration'));

  const config = loadConfig();

  console.log('\n' + chalk.bold('📋 Current Settings'));
  console.log(`  Config file:         ${CONFIG_FILE}`);
  console.log(`  Default location:    ${config.defaultLocation || chalk.dim('None (uses ~/.claude)')}`);
  console.log(`  Compression:         ${config.compressionPreference}`);
  console.log(`  Backup retention:    ${config.backupRetentionDays} days`);
  console.log(`  Auto-delete old:     ${config.autoDeleteOldBackups ? chalk.green('Yes') : chalk.dim('No')}`);
  console.log(`  Quiet mode:          ${config.quietMode ? chalk.green('Yes') : chalk.dim('No')}`);
  console.log(`  Confirmations:       ${config.confirmations ? chalk.green('Yes') : chalk.dim('No')}`);
  console.log('');

  const action = await p.select({
    message: 'What would you like to do?',
    options: [
      { value: 'edit', label: '📝  Edit settings' },
      { value: 'reset', label: '🔄 Reset to defaults' },
      { value: 'cancel', label: '👈 Go back' }
    ]
  });

  if (p.isCancel(action) || action === 'cancel') {
    p.cancel('Cancelled');
    return;
  }

  if (action === 'reset') {
    const confirmed = await p.confirm({
      message: 'Reset all settings to defaults?',
      initialValue: false
    });

    if (p.isCancel(confirmed) || !confirmed) {
      p.cancel('Cancelled');
      return;
    }

    fs.unlinkSync(CONFIG_FILE);
    p.log.success('Settings reset to defaults');
    return;
  }

  // Edit settings
  const newLocation = await p.text({
    message: 'Default Claude location (blank for none):',
    placeholder: config.defaultLocation || '~/.claude',
    initialValue: config.defaultLocation || '',
    validate: (value) => {
      if (!value) return;
      const expanded = value.replace(/^~/, HOME);
      if (!fs.existsSync(expanded)) return 'Path does not exist';
    }
  });

  if (p.isCancel(newLocation)) {
    p.cancel('Cancelled');
    return;
  }

  const compression = await p.select({
    message: 'Compression preference:',
    options: [
      { value: 'auto', label: 'Auto-detect (recommended)' },
      { value: '7zip', label: '7zip (maximum compression)' },
      { value: 'tar', label: 'tar.gz (good compatibility)' },
      { value: 'copy', label: 'Plain copy (no compression)' }
    ],
    initialValue: config.compressionPreference
  });

  if (p.isCancel(compression)) {
    p.cancel('Cancelled');
    return;
  }

  const retention = await p.text({
    message: 'Backup retention days:',
    placeholder: '30',
    initialValue: String(config.backupRetentionDays),
    validate: (value) => {
      const num = parseInt(value);
      if (isNaN(num) || num < 1) return 'Must be a positive number';
    }
  });

  if (p.isCancel(retention)) {
    p.cancel('Cancelled');
    return;
  }

  const autoDelete = await p.confirm({
    message: 'Auto-delete old backups on startup?',
    initialValue: config.autoDeleteOldBackups
  });

  if (p.isCancel(autoDelete)) {
    p.cancel('Cancelled');
    return;
  }

  // Save new config
  const newConfig = {
    defaultLocation: newLocation || null,
    compressionPreference: compression,
    backupRetentionDays: parseInt(retention),
    autoDeleteOldBackups: autoDelete,
    quietMode: config.quietMode,
    confirmations: config.confirmations
  };

  if (saveConfig(newConfig)) {
    p.log.success(`Configuration saved to ${CONFIG_FILE}`);
  }
}

// Ensure backup directory exists
if (!fs.existsSync(BACKUP_DIR)) {
  fs.mkdirSync(BACKUP_DIR, { recursive: true });
}

// Detect available compression tools
let COMPRESSION_METHOD = 'none';

function detectCompressionTool() {
  if (COMPRESSION_METHOD !== 'none') return COMPRESSION_METHOD;

  try {
    execSync('7z', { stdio: 'pipe', windowsHide: true });
    COMPRESSION_METHOD = '7zip';
    return COMPRESSION_METHOD;
  } catch {}

  try {
    execSync('7za', { stdio: 'pipe', windowsHide: true });
    COMPRESSION_METHOD = '7za';
    return COMPRESSION_METHOD;
  } catch {}

  try {
    execSync('tar --version', { stdio: 'pipe', windowsHide: true });
    COMPRESSION_METHOD = 'tar';
    return COMPRESSION_METHOD;
  } catch {}

  COMPRESSION_METHOD = 'copy';
  return COMPRESSION_METHOD;
}

// ============================================================================
// HELPERS
// ============================================================================

function getTimestamp() {
  const now = new Date();
  return now.toISOString().replace(/[:.]/g, '-').split('T').join('_').split('Z')[0];
}

function getDirSize(dirPath, useCache = true) {
  // Check cache first
  if (useCache && sizeCache.has(dirPath)) {
    const cached = sizeCache.get(dirPath);
    const age = Date.now() - cached.timestamp;

    if (age < SIZE_CACHE_TTL) {
      return cached.size;
    }
    sizeCache.delete(dirPath);
  }

  // Calculate size
  try {
    if (!fs.existsSync(dirPath)) {
      const size = 0;
      if (useCache) {
        sizeCache.set(dirPath, { size, timestamp: Date.now() });
      }
      return size;
    }

    let totalSize = 0;
    const items = fs.readdirSync(dirPath, { withFileTypes: true });
    for (const item of items) {
      const itemPath = path.join(dirPath, item.name);
      try {
        if (item.isFile()) {
          totalSize += fs.statSync(itemPath).size;
        } else if (item.isDirectory()) {
          totalSize += getDirSize(itemPath, useCache);
        }
      } catch {
        continue;
      }
    }

    // Store in cache
    if (useCache) {
      sizeCache.set(dirPath, { size: totalSize, timestamp: Date.now() });
    }

    return totalSize;
  } catch {
    const size = 0;
    if (useCache) {
      sizeCache.set(dirPath, { size, timestamp: Date.now() });
    }
    return size;
  }
}

function clearSizeCache(paths = null) {
  if (paths === null) {
    sizeCache.clear();
    return;
  }

  const pathsArray = Array.isArray(paths) ? paths : [paths];
  for (const p of pathsArray) {
    sizeCache.delete(p);
    // Clear subdirectories
    for (const [cachedPath, _] of sizeCache) {
      if (cachedPath.startsWith(p)) {
        sizeCache.delete(cachedPath);
      }
    }
  }
}

function formatBytes(bytes, colorize = false) {
  if (bytes === 0) return '0 B';
  const k = 1024;
  const sizes = ['B', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  const formatted = (bytes / Math.pow(k, i)).toFixed(2) + ' ' + sizes[i];

  if (!colorize) return formatted;

  const mb = bytes / (1024 * 1024);
  if (mb > 100) return chalk.red(formatted);
  if (mb > 10) return chalk.yellow(formatted);
  return chalk.green(formatted);
}

function formatRelativeTime(date) {
  const relative = dayjs(date).fromNow();
  const absolute = dayjs(date).format('YYYY-MM-DD HH:mm:ss');
  return `${chalk.cyan(relative)} ${chalk.dim('(' + absolute + ')')}`;
}

function copyDirRecursive(src, dest) {
  const files = fs.readdirSync(src);
  for (const file of files) {
    const srcPath = path.join(src, file);
    const destPath = path.join(dest, file);
    const stat = fs.statSync(srcPath);

    if (stat.isDirectory()) {
      fs.mkdirSync(destPath, { recursive: true });
      copyDirRecursive(srcPath, destPath);
    } else {
      fs.copyFileSync(srcPath, destPath);
    }
  }
}

function showDryRunPreview(items, type, totalSize) {
  console.log('\n' + chalk.bold.yellow('🔍 DRY-RUN MODE - Preview Only (No Changes)'));
  console.log(chalk.dim('═══════════════════════════════════════════════════════════════'));

  console.log(`\nWould delete: ${items.length} ${type}`);
  console.log(`Space to be freed: ${formatBytes(totalSize, true)}`);

  console.log(`\nItems:`);
  items.forEach((item, idx) => {
    if (type === 'projects') {
      console.log(`  ${idx + 1}. ${chalk.cyan(item.path)}`);
      console.log(`     Size: ${formatBytes(item.size, true)} │ Sessions: ${item.sessionCount}`);
    } else {
      console.log(`  ${idx + 1}. ${chalk.cyan(item.desc)}`);
      console.log(`     Size: ${formatBytes(item.size, true)} │ Path: ${item.path}`);
    }
  });

  const method = detectCompressionTool();
  let methodDisplay = method === 'tar' ? 'tar.gz' : method === '7zip' || method === '7za' ? '7zip' : 'plain copy';

  console.log(`\nBackup details:`);
  console.log(`  Location: ${BACKUP_DIR}`);
  console.log(`  Method: ${methodDisplay}`);
  console.log(`  Estimated backup size: ${formatBytes(totalSize * 0.3, true)} (~30% compression)`);

  console.log('\n' + chalk.yellow('ℹ️  To execute, run without --dry-run flag'));
  console.log(chalk.dim('═══════════════════════════════════════════════════════════════\n'));
}

function discoverBackups() {
  const backups = [];
  if (!fs.existsSync(BACKUP_DIR)) return backups;

  const files = fs.readdirSync(BACKUP_DIR);

  for (const file of files) {
    if (file === 'manifest.jsonl') continue;

    const fullPath = path.join(BACKUP_DIR, file);
    if (!fs.existsSync(fullPath)) continue;

    const stat = fs.statSync(fullPath);

    // Parse filename: {name}.{timestamp}.{ext}
    const timestampRegex = /\d{4}_\d{2}_\d{2}-\d{2}-\d{2}-\d{2}/;
    const timestampMatch = file.match(timestampRegex);

    if (timestampMatch) {
      const timestamp = timestampMatch[0];
      const beforeTimestamp = file.substring(0, file.indexOf(timestamp) - 1);
      const extension = file.substring(file.indexOf(timestamp) + timestamp.length + 1);

      // Parse timestamp to Date
      const [y, mo, d, h, mi, s] = timestamp.split(/[-_]/).map(Number);
      const date = new Date(y, mo - 1, d, h, mi, s);

      const size = stat.isDirectory() ? getDirSize(fullPath) : stat.size;
      let method = 'unknown';
      if (extension === '7z') method = '7zip';
      else if (extension.includes('tar.gz')) method = 'tar';
      else if (extension === 'backup') method = 'copy';

      backups.push({
        filename: file,
        fullPath: fullPath,
        originalName: beforeTimestamp,
        timestamp: date,
        size: size,
        method: method,
        extension: extension,
        isDirectory: stat.isDirectory()
      });
    }
  }

  return backups.sort((a, b) => b.timestamp - a.timestamp);
}

function restoreBackup(backup, targetPath = null, showProgress = true) {
  try {
    const spinner = showProgress ? p.spinner() : null;
    if (spinner) spinner.start(`Restoring ${backup.originalName}`);

    // Determine target location
    let destination = targetPath;
    if (!destination) {
      const claudeDir = path.join(HOME, '.claude');
      if (backup.originalName.includes('--')) {
        destination = path.join(claudeDir, 'projects', backup.originalName);
      } else {
        destination = path.join(claudeDir, backup.originalName);
      }
    }

    // Check if exists
    if (fs.existsSync(destination)) {
      if (spinner) spinner.stop('Target already exists');
      return false;
    }

    // Extract based on method
    if (backup.method === '7zip') {
      const cmd = '7z';
      const parentDir = path.dirname(destination);
      fs.mkdirSync(parentDir, { recursive: true });
      execSync(`${cmd} x "${backup.fullPath}" -o"${parentDir}" -y`, { stdio: 'pipe', windowsHide: true });
    } else if (backup.method === 'tar') {
      const parentDir = path.dirname(destination);
      fs.mkdirSync(parentDir, { recursive: true });
      execSync(`tar -xzf "${backup.fullPath}" -C "${parentDir}"`, { stdio: 'pipe', windowsHide: true });
    } else if (backup.method === 'copy') {
      fs.mkdirSync(destination, { recursive: true });
      copyDirRecursive(backup.fullPath, destination);
    }

    if (spinner) spinner.stop('Restore complete');
    return true;
  } catch (error) {
    console.error(chalk.red(`  ✗ Restore failed: ${error.message}`));
    return false;
  }
}

function backupDirectory(dirPath, showProgress = true) {
  try {
    if (!fs.existsSync(dirPath)) return null;

    const spinner = showProgress ? p.spinner() : null;
    if (spinner) spinner.start('Creating backup');

    const method = detectCompressionTool();
    const dirName = path.basename(dirPath);
    const timestamp = getTimestamp();
    const parentDir = path.dirname(dirPath);

    if (method === 'tar') {
      const backupPath = path.join(BACKUP_DIR, `${dirName}.${timestamp}.tar.gz`);
      execSync(`tar -czf "${backupPath}" -C "${parentDir}" "${dirName}"`, {
        stdio: 'pipe',
        windowsHide: true
      });
      if (spinner) spinner.stop('Backup created');
      return backupPath;
    } else if (method === '7zip' || method === '7za') {
      const cmd = method === '7zip' ? '7z' : '7za';
      const backupPath = path.join(BACKUP_DIR, `${dirName}.${timestamp}.7z`);
      execSync(`${cmd} a -t7z "${backupPath}" "${dirPath}" -mx=9`, {
        stdio: 'pipe',
        windowsHide: true
      });
      if (spinner) spinner.stop('Backup created');
      return backupPath;
    } else {
      const backupPath = path.join(BACKUP_DIR, `${dirName}.${timestamp}.backup`);
      fs.mkdirSync(backupPath, { recursive: true });
      copyDirRecursive(dirPath, backupPath);
      if (spinner) spinner.stop('Backup created');
      return backupPath;
    }
  } catch (error) {
    console.error(chalk.red(`  ✗ Backup failed: ${error.message}`));
    return null;
  }
}

// ============================================================================
// MANIFEST SYSTEM
// ============================================================================

function loadManifest() {
  const entries = [];
  if (!fs.existsSync(MANIFEST_PATH)) return entries;

  try {
    const content = fs.readFileSync(MANIFEST_PATH, 'utf8');
    const lines = content.split('\n').filter(line => line.trim());

    for (const line of lines) {
      try {
        entries.push(JSON.parse(line));
      } catch {
        continue; // Skip malformed lines
      }
    }
  } catch (error) {
    console.error(chalk.yellow('Warning: Could not load manifest'));
  }

  return entries;
}

function appendToManifest(entry) {
  try {
    fs.appendFileSync(MANIFEST_PATH, JSON.stringify(entry) + '\n', 'utf8');
  } catch (error) {
    console.error(chalk.yellow(`Warning: Could not save to manifest: ${error.message}`));
  }
}

function calculateDashboardStats(entries) {
  if (entries.length === 0) {
    return {
      totalOperations: 0,
      totalFreed: 0,
      totalBackupSize: 0,
      compressionRatio: 0,
      averageDuration: 0,
      projectOperations: 0,
      globalOperations: 0,
      topProjects: [],
      recentOperations: []
    };
  }

  const stats = {
    totalOperations: entries.length,
    totalFreed: entries.reduce((sum, e) => sum + (e.totalFreed || 0), 0),
    totalBackupSize: entries.reduce((sum, e) => sum + (e.totalBackupSize || 0), 0),
    averageDuration: entries.reduce((sum, e) => sum + (e.duration || 0), 0) / entries.length,
    projectOperations: entries.filter(e => e.operation === 'clean-projects').length,
    globalOperations: entries.filter(e => e.operation === 'clean-global').length
  };

  stats.compressionRatio = stats.totalFreed > 0
    ? stats.totalBackupSize / stats.totalFreed
    : 0;

  // Top 5 projects by space freed
  const projectMap = new Map();
  for (const entry of entries) {
    if (entry.operation === 'clean-projects' && entry.items) {
      for (const item of entry.items) {
        const existing = projectMap.get(item.path) || { path: item.path, size: 0, count: 0 };
        existing.size += item.originalSize || 0;
        existing.count++;
        projectMap.set(item.path, existing);
      }
    }
  }

  stats.topProjects = Array.from(projectMap.values())
    .sort((a, b) => b.size - a.size)
    .slice(0, 5);

  // Recent 10 operations
  stats.recentOperations = entries
    .slice(-10)
    .reverse()
    .map(e => ({
      timestamp: e.timestamp,
      operation: e.operation,
      freed: e.totalFreed || 0
    }));

  return stats;
}

// ============================================================================
// LOCATION DISCOVERY
// ============================================================================

function findClaudeDirs(locationFilter) {
  const dirs = [];

  if (locationFilter) {
    const targetPath = path.normalize(locationFilter);
    if (fs.existsSync(targetPath)) {
      const baseName = path.basename(targetPath);
      dirs.push({
        path: targetPath,
        name: `Custom (${baseName})`
      });
    } else {
      return [];
    }
  } else {
    const defaultPath = path.join(HOME, '.claude');
    if (fs.existsSync(defaultPath)) {
      dirs.push({
        path: defaultPath,
        name: 'Current (.claude)'
      });
    }
  }

  return dirs;
}

function decodeProjectPath(encoded) {
  if (process.platform === 'win32') {
    return encoded.replace(/^([A-Z])--/, '$1:\\').replace(/-/g, '\\');
  } else {
    return encoded.replace(/^-/, '/').replace(/-/g, '/');
  }
}

function getProjects(projectsDir) {
  const projects = [];

  if (!fs.existsSync(projectsDir)) {
    return projects;
  }

  const dirs = fs.readdirSync(projectsDir);

  for (const dir of dirs) {
    if (dir.startsWith('.')) continue;

    const fullPath = path.join(projectsDir, dir);
    try {
      if (!fs.statSync(fullPath).isDirectory()) continue;
    } catch {
      continue;
    }

    const size = getDirSize(fullPath);
    const actualPath = decodeProjectPath(dir);

    let sessionCount = 0;
    try {
      const files = fs.readdirSync(fullPath);
      sessionCount = files.filter(f => /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/.test(f)).length;
    } catch {}

    projects.push({
      encoded: dir,
      path: actualPath,
      fullPath: fullPath,
      size: size,
      sessionCount: sessionCount
    });
  }

  return projects.sort((a, b) => b.size - a.size);
}

function getGlobalData(claudeDir) {
  const items = [];

  const candidates = [
    { name: 'history', path: path.join(claudeDir, 'history.jsonl'), type: 'file', desc: 'Command history' },
    { name: 'cache', path: path.join(claudeDir, 'cache'), type: 'dir', desc: 'Cache files' },
    { name: 'backups', path: path.join(claudeDir, 'backups'), type: 'dir', desc: 'Backup files' },
    { name: 'paste-cache', path: path.join(claudeDir, 'paste-cache'), type: 'dir', desc: 'Paste cache' },
    { name: 'shell-snapshots', path: path.join(claudeDir, 'shell-snapshots'), type: 'dir', desc: 'Shell snapshots' },
    { name: 'plans', path: path.join(claudeDir, 'plans'), type: 'dir', desc: 'Planning data' },
    { name: 'debug', path: path.join(claudeDir, 'debug'), type: 'dir', desc: 'Debug files' },
    { name: 'file-history', path: path.join(claudeDir, 'file-history'), type: 'dir', desc: 'File history' },
    { name: 'todos', path: path.join(claudeDir, 'todos'), type: 'dir', desc: 'Todo files' },
  ];

  for (const item of candidates) {
    if (fs.existsSync(item.path)) {
      const size = item.type === 'file'
        ? fs.statSync(item.path).size
        : getDirSize(item.path);

      items.push({
        ...item,
        size
      });
    }
  }

  return items;
}

// ============================================================================
// COMMANDS
// ============================================================================

async function statusCommand(location) {
  const claudeDirs = findClaudeDirs(location);

  if (claudeDirs.length === 0) {
    p.log.error(location ? `Location not found: ${location}` : 'No Claude directories found');
    return;
  }

  console.log('\n' + chalk.bold('📊 Claude Code Status'));
  console.log(chalk.dim('═══════════════════════════════════════════════════════════════'));

  for (const dir of claudeDirs) {
    console.log(chalk.bold(`\n📁 ${dir.name}`));
    console.log(chalk.dim(`   Location: ${dir.path}`));

    const globalData = getGlobalData(dir.path);
    const globalSize = globalData.reduce((sum, item) => sum + item.size, 0);

    if (globalData.length > 0) {
      console.log(`\n   ${chalk.bold('Global Data')} (${formatBytes(globalSize, true)}):`);
      globalData.forEach(item => {
        console.log(`     ${chalk.cyan(item.desc)}: ${formatBytes(item.size, true)}`);
      });
    }

    const projectsPath = path.join(dir.path, 'projects');
    const projects = getProjects(projectsPath);
    const projectsSize = projects.reduce((sum, p) => sum + p.size, 0);

    if (projects.length > 0) {
      console.log(`\n   ${chalk.bold('Projects')} (${projects.length} total, ${formatBytes(projectsSize, true)}):`);
      const top3 = projects.slice(0, 3);
      top3.forEach(p => {
        const shortPath = p.path.length > 55 ? '...' + p.path.slice(-52) : p.path;
        console.log(`     ${chalk.dim(shortPath)} (${formatBytes(p.size, true)})`);
      });
      if (projects.length > 3) {
        console.log(chalk.dim(`     ... and ${projects.length - 3} more`));
      }
    }

    const totalSize = globalSize + projectsSize;
    console.log(`\n   ${chalk.bold('Total:')} ${formatBytes(totalSize, true)}`);
  }

  console.log(chalk.dim('\n═══════════════════════════════════════════════════════════════\n'));
}

async function dashboardCommand() {
  console.clear();
  p.intro(chalk.bold.cyan('📈 Cleanup Dashboard'));

  const entries = loadManifest();

  if (entries.length === 0) {
    p.log.message('No cleanup history yet. Start cleaning to see statistics here.');
    return;
  }

  const stats = calculateDashboardStats(entries);

  // Section 1: Overview
  console.log('\n' + chalk.bold('📊 Overview'));
  console.log(`  Total Operations:        ${stats.totalOperations}`);
  console.log(`  Total Space Freed:       ${formatBytes(stats.totalFreed, true)}`);
  console.log(`  Total Backup Size:       ${formatBytes(stats.totalBackupSize, true)}`);
  console.log(`  Compression Ratio:       ${(stats.compressionRatio * 100).toFixed(1)}%`);
  console.log(`  Average Duration:        ${stats.averageDuration.toFixed(2)}s`);

  // Section 2: Operations Breakdown
  console.log('\n' + chalk.bold('📁 Operations Breakdown'));
  console.log(`  Projects:  ${stats.projectOperations} operations`);
  console.log(`  Global:    ${stats.globalOperations} operations`);

  // Section 3: Top 5 Projects
  if (stats.topProjects.length > 0) {
    console.log('\n' + chalk.bold('🏆 Top 5 Projects by Space Freed'));
    stats.topProjects.forEach((proj, idx) => {
      const shortPath = proj.path.length > 60 ? '...' + proj.path.slice(-57) : proj.path;
      console.log(`  ${idx + 1}. ${chalk.cyan(shortPath)}`);
      console.log(`     ${formatBytes(proj.size, true)} (cleaned ${proj.count}x)`);
    });
  }

  // Section 4: Recent Operations
  console.log('\n' + chalk.bold('🕐 Recent Operations'));
  stats.recentOperations.forEach(op => {
    const opType = op.operation === 'clean-projects' ? '📁 Projects' : '🖥️ Global';
    const time = dayjs(op.timestamp).fromNow();
    console.log(`  ${chalk.cyan(time)} ${opType} - ${formatBytes(op.freed, true)}`);
  });

  // Section 5: Backup Storage
  const backups = discoverBackups();
  const backupSize = backups.reduce((sum, b) => sum + b.size, 0);
  console.log('\n' + chalk.bold('💾 Backup Storage'));
  console.log(`  Location:    ${BACKUP_DIR}`);
  console.log(`  Backups:     ${backups.length} files`);
  console.log(`  Total Size:  ${formatBytes(backupSize, true)}`);

  console.log('');
}

async function helpCommand() {
  console.clear();
  p.intro(chalk.bold.cyan('❓ Claude Code Cleaner - Help'));

  // Section 1: Quick Start
  console.log('\n' + chalk.bold('🚀 Quick Start'));
  console.log('  Run without arguments for interactive menu');
  console.log('  Use arrow keys to navigate, Enter to select, ESC to go back');

  // Section 2: Commands
  console.log('\n' + chalk.bold('📋 Commands'));
  console.log(`  ${chalk.cyan('status')}      Show overview of Claude data`);
  console.log(`  ${chalk.cyan('dashboard')}   View cleanup statistics and history`);
  console.log(`  ${chalk.cyan('restore')}     Restore data from backup`);
  console.log(`  ${chalk.cyan('export')}      Export dashboard to CSV`);
  console.log(`  ${chalk.cyan('backups')}     Manage and prune backups`);
  console.log(`  ${chalk.cyan('config')}      Configure preferences`);
  console.log(`  ${chalk.cyan('help')}        Show this help menu`);

  // Section 3: Flags
  console.log('\n' + chalk.bold('🏴  Flags'));
  console.log(`  ${chalk.cyan('--location PATH')}  Specify Claude directory`);
  console.log(`  ${chalk.cyan('--dry-run, -n')}    Preview changes without executing`);
  console.log(`  ${chalk.cyan('--quiet, -q')}      Quiet mode (minimal output)`);

  // Section 4: Modes
  console.log('\n' + chalk.bold('🎯 Interactive Menu Modes'));
  console.log(`  ${chalk.yellow('📁 Sessions Mode')}`);
  console.log('     Clean project-specific conversation history');
  console.log(`  ${chalk.yellow('🖥️ System Data Mode')}`);
  console.log('     Clean global cache, history, and debug files');

  // Section 5: Data Types
  console.log('\n' + chalk.bold('📂 What Gets Stored?'));
  console.log('  ~/.claude/projects/   - Per-project sessions');
  console.log('  ~/.claude/cache/      - Temporary data');
  console.log('  ~/.claude/history     - Command history');
  console.log('  ~/.claude/debug/      - Debug logs');

  // Section 6: Backups
  console.log('\n' + chalk.bold('💾 Backup System'));
  console.log(`  Location: ${BACKUP_DIR}`);
  console.log(`  Format: {name}.{timestamp}.{ext}`);
  const method = detectCompressionTool();
  let methodDisplay = 'plain copy';
  if (method === 'tar') methodDisplay = 'tar.gz compression';
  else if (method === '7zip' || method === '7za') methodDisplay = '7zip compression';
  console.log(`  Method: ${methodDisplay}`);
  console.log('  All operations create automatic backups');

  // Section 7: Examples
  console.log('\n' + chalk.bold('💡 Examples'));
  console.log('  ' + chalk.cyan('node claude-clean.js'));
  console.log('    Start interactive menu');
  console.log('  ' + chalk.cyan('node claude-clean.js clean-projects --dry-run'));
  console.log('    Preview cleanup without executing');
  console.log('  ' + chalk.cyan('node claude-clean.js dashboard'));
  console.log('    View cleanup history and statistics');

  // Section 8: Tips
  console.log('\n' + chalk.bold('💡 Tips & Safety'));
  console.log('  • Use --dry-run to preview changes');
  console.log('  • Backups are automatic for all operations');
  console.log('  • ESC goes back to previous menu (not exit)');
  console.log('  • View dashboard to track cleanup trends');
  console.log('  • Use restore command to recover deleted data');

  console.log('');
}

async function restoreCommand() {
  console.clear();
  p.intro(chalk.bold.cyan('💾  Restore from Backup'));

  const backups = discoverBackups();

  if (backups.length === 0) {
    p.log.message('No backups found.');
    return;
  }

  // Load manifest to enrich backup info
  const manifestData = loadManifest();

  // Enrich backups with manifest data (match by timestamp)
  for (const backup of backups) {
    const manifestEntry = manifestData.find(entry => {
      const entryTime = new Date(entry.timestamp);
      return Math.abs(entryTime - backup.timestamp) < 5000;
    });
    if (manifestEntry && manifestEntry.items) {
      const match = manifestEntry.items.find(item =>
        item.path.includes(backup.originalName)
      );
      if (match) {
        backup.originalPath = match.path;
        backup.originalSize = match.originalSize;
      }
    }
  }

  // Step 1: Select backups
  const backupsToRestore = await p.multiselect({
    message: 'Select backups to restore',
    options: backups.map(backup => {
      const ageStr = dayjs(backup.timestamp).fromNow();
      const sizeStr = formatBytes(backup.size);
      const pathHint = backup.originalPath
        ? chalk.dim(` → ${backup.originalPath.length > 40 ? '...' + backup.originalPath.slice(-37) : backup.originalPath}`)
        : '';

      return {
        value: backup,
        label: `${backup.originalName} │ ${ageStr} │ ${sizeStr}${pathHint}`
      };
    }),
    required: false
  });

  if (p.isCancel(backupsToRestore) || backupsToRestore.length === 0) {
    p.cancel('Cancelled');
    return;
  }

  // Step 2: Confirm
  const confirmed = await p.confirm({
    message: `Restore ${backupsToRestore.length} backup(s)?`,
    initialValue: false
  });

  if (p.isCancel(confirmed) || !confirmed) {
    p.cancel('Cancelled');
    return;
  }

  // Step 3: Execute restoration
  const s = p.spinner();
  s.start(`Restoring ${backupsToRestore.length} backup(s)`);

  let successCount = 0;
  for (let i = 0; i < backupsToRestore.length; i++) {
    const backup = backupsToRestore[i];
    s.message(`Restoring ${i + 1}/${backupsToRestore.length}: ${backup.originalName}`);

    if (restoreBackup(backup, null, false)) {
      successCount++;
    }
  }

  s.stop('Restore complete');

  p.note(
    `${chalk.bold('Restored:')} ${successCount} backup(s)\n${chalk.bold('Failed:')} ${backupsToRestore.length - successCount}`,
    successCount > 0 ? '✅ Restore Complete' : '❌ Restore Failed'
  );
}


function exportDashboardToCSV(entries, outputPath = null) {
  if (entries.length === 0) {
    return null;
  }

  const stats = calculateDashboardStats(entries);
  
  // Create CSV content
  const lines = [];
  
  // Header
  lines.push('# Claude Cleaner Dashboard Export');
  lines.push(`# Generated: ${new Date().toISOString()}`);
  lines.push('');
  
  // Summary stats
  lines.push('# Summary Statistics');
  lines.push('Metric,Value');
  lines.push(`Total Operations,${stats.totalOperations}`);
  lines.push(`Total Space Freed (bytes),${stats.totalFreed}`);
  lines.push(`Total Space Freed,${formatBytes(stats.totalFreed)}`);
  lines.push(`Total Backup Size (bytes),${stats.totalBackupSize}`);
  lines.push(`Total Backup Size,${formatBytes(stats.totalBackupSize)}`);
  lines.push(`Compression Ratio,${(stats.compressionRatio * 100).toFixed(1)}%`);
  lines.push(`Average Duration (seconds),${stats.averageDuration.toFixed(2)}`);
  lines.push(`Project Operations,${stats.projectOperations}`);
  lines.push(`Global Operations,${stats.globalOperations}`);
  lines.push('');
  
  // Top projects
  lines.push('# Top Projects by Space Freed');
  lines.push('Rank,Path,Size (bytes),Size,Times Cleaned');
  stats.topProjects.forEach((proj, idx) => {
    lines.push(`${idx + 1},"${proj.path}",${proj.size},${formatBytes(proj.size)},${proj.count}`);
  });
  lines.push('');
  
  // All operations
  lines.push('# All Operations');
  lines.push('Timestamp,Operation,Location,Items Cleaned,Space Freed (bytes),Space Freed,Backup Size (bytes),Backup Size,Duration (seconds),Method');
  entries.forEach(entry => {
    const itemCount = entry.items ? entry.items.length : 0;
    lines.push(`${entry.timestamp},${entry.operation},"${entry.location}",${itemCount},${entry.totalFreed || 0},${formatBytes(entry.totalFreed || 0)},${entry.totalBackupSize || 0},${formatBytes(entry.totalBackupSize || 0)},${entry.duration || 0},${entry.method || 'unknown'}`);
  });
  
  const csvContent = lines.join('\n');
  
  // Determine output path
  const finalPath = outputPath || path.join(BACKUP_DIR, `dashboard-export-${getTimestamp()}.csv`);
  
  try {
    fs.writeFileSync(finalPath, csvContent, 'utf8');
    return finalPath;
  } catch (error) {
    console.error(chalk.red(`Error: Could not export CSV: ${error.message}`));
    return null;
  }
}

async function exportDashboardCommand() {
  console.clear();
  p.intro(chalk.bold.cyan('📊 Export Dashboard'));

  const entries = loadManifest();

  if (entries.length === 0) {
    p.log.message('No cleanup history to export.');
    return;
  }

  const stats = calculateDashboardStats(entries);

  console.log('\n' + chalk.bold('📈 Export Summary'));
  console.log(`  Operations:   ${stats.totalOperations}`);
  console.log(`  Space freed:  ${formatBytes(stats.totalFreed, true)}`);
  console.log(`  Time range:   ${dayjs(entries[0].timestamp).format('YYYY-MM-DD')} to ${dayjs(entries[entries.length - 1].timestamp).format('YYYY-MM-DD')}`);
  console.log('');

  const customPath = await p.text({
    message: 'Export path (blank for auto):',
    placeholder: path.join(BACKUP_DIR, `dashboard-export-${getTimestamp()}.csv`),
    initialValue: '',
    validate: (value) => {
      if (!value) return; // Blank is OK
      const dir = path.dirname(value);
      if (!fs.existsSync(dir)) return 'Directory does not exist';
    }
  });

  if (p.isCancel(customPath)) {
    p.cancel('Cancelled');
    return;
  }

  const s = p.spinner();
  s.start('Exporting to CSV');

  const outputPath = exportDashboardToCSV(entries, customPath || null);

  s.stop('Export complete');

  if (outputPath) {
    p.note(
      `${chalk.bold('Exported to:')} ${outputPath}\n${chalk.bold('Operations:')} ${stats.totalOperations}\n${chalk.bold('File size:')} ${formatBytes(fs.statSync(outputPath).size)}`,
      '✅ Export Complete'
    );
  } else {
    p.log.error('Export failed');
  }
}
async function backupManagementCommand() {
  console.clear();
  p.intro(chalk.bold.cyan('📦 Backup Management'));

  const backups = discoverBackups();

  if (backups.length === 0) {
    p.log.message('No backups found.');
    return;
  }

  // Calculate statistics
  const totalSize = backups.reduce((sum, b) => sum + b.size, 0);
  const now = new Date();
  const thirtyDaysAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
  
  const oldBackups = backups.filter(b => b.timestamp < thirtyDaysAgo);
  const oldBackupsSize = oldBackups.reduce((sum, b) => sum + b.size, 0);
  const recentBackups = backups.filter(b => b.timestamp >= thirtyDaysAgo);

  // Show statistics
  console.log('\n' + chalk.bold('📊 Backup Statistics'));
  console.log(`  Location:        ${BACKUP_DIR}`);
  console.log(`  Total Backups:   ${backups.length}`);
  console.log(`  Total Size:      ${formatBytes(totalSize, true)}`);
  console.log(`  Oldest Backup:   ${dayjs(backups[backups.length - 1].timestamp).format('YYYY-MM-DD')}`);
  console.log(`  Newest Backup:   ${dayjs(backups[0].timestamp).format('YYYY-MM-DD')}`);

  if (oldBackups.length > 0) {
    console.log('\n' + chalk.bold.yellow('🚨  Old Backups (>30 days)'));
    console.log(`  Count:           ${oldBackups.length}`);
    console.log(`  Size:            ${formatBytes(oldBackupsSize, true)}`);
    console.log(`  Space savings:   ${formatBytes(oldBackupsSize, true)} if deleted`);
  } else {
    console.log('\n' + chalk.bold.green('✅ All backups are recent (< 30 days)'));
  }

  console.log('');

  // Offer management options
  const action = await p.select({
    message: 'What would you like to do?',
    options: [
      { value: 'prune-old', label: `🗑️  Delete old backups (${oldBackups.length} backups, ${formatBytes(oldBackupsSize)})`, hint: oldBackups.length > 0 ? 'Recommended' : 'None found' },
      { value: 'select-manual', label: '🎯 Select backups manually' },
      { value: 'delete-all', label: '🚨  Delete ALL backups', hint: 'Danger zone!' },
      { value: 'cancel', label: '👈 Go back' }
    ]
  });

  if (p.isCancel(action) || action === 'cancel') {
    p.cancel('Cancelled');
    return;
  }

  let backupsToDelete = [];

  switch (action) {
    case 'prune-old':
      if (oldBackups.length === 0) {
        p.log.message('No old backups to delete.');
        return;
      }
      backupsToDelete = oldBackups;
      break;

    case 'select-manual':
      backupsToDelete = await p.multiselect({
        message: 'Select backups to delete',
        options: backups.map(backup => {
          const age = Math.floor((now - backup.timestamp) / (24 * 60 * 60 * 1000));
          const ageStr = age === 0 ? 'Today' : age === 1 ? 'Yesterday' : `${age} days ago`;
          const isOld = backup.timestamp < thirtyDaysAgo;
          const marker = isOld ? chalk.yellow('🚨 OLD') : chalk.green('✓');

          return {
            value: backup,
            label: `${marker} ${backup.originalName} │ ${ageStr} │ ${formatBytes(backup.size)}`
          };
        }),
        required: false
      });

      if (p.isCancel(backupsToDelete) || backupsToDelete.length === 0) {
        p.cancel('Cancelled');
        return;
      }
      break;

    case 'delete-all':
      const confirmAll = await p.confirm({
        message: `🚨  Delete ALL ${backups.length} backups (${formatBytes(totalSize)})? This cannot be undone!`,
        initialValue: false
      });

      if (p.isCancel(confirmAll) || !confirmAll) {
        p.cancel('Cancelled');
        return;
      }

      backupsToDelete = backups;
      break;
  }

  // Confirm deletion
  const deleteSize = backupsToDelete.reduce((sum, b) => sum + b.size, 0);
  
  const confirmed = await p.confirm({
    message: `Delete ${backupsToDelete.length} backup(s) (${formatBytes(deleteSize, true)})?`,
    initialValue: action === 'prune-old' // Default to yes for old backups
  });

  if (p.isCancel(confirmed) || !confirmed) {
    p.cancel('Cancelled');
    return;
  }

  // Execute deletion
  const s = p.spinner();
  s.start(`Deleting ${backupsToDelete.length} backup(s)`);

  let successCount = 0;
  for (const backup of backupsToDelete) {
    try {
      if (backup.isDirectory) {
        fs.rmSync(backup.fullPath, { recursive: true, force: true });
      } else {
        fs.unlinkSync(backup.fullPath);
      }
      successCount++;
    } catch (error) {
      console.error(chalk.red(`  ✗ Failed to delete ${backup.filename}: ${error.message}`));
    }
  }

  s.stop('Deletion complete');

  p.note(
    `${chalk.bold('Deleted:')} ${successCount} backup(s)\n${chalk.bold('Space freed:')} ${formatBytes(deleteSize, true)}\n${chalk.bold('Failed:')} ${backupsToDelete.length - successCount}`,
    successCount > 0 ? '✅ Cleanup Complete' : '❌ Cleanup Failed'
  );
}
async function cleanProjectsCommand(location, dryRun = false) {
  const claudeDirs = findClaudeDirs(location);

  if (claudeDirs.length === 0) {
    p.log.error(location ? `Location not found: ${location}` : 'No Claude directories found');
    return;
  }

  const selectedDir = claudeDirs[0];
  const projectsPath = path.join(selectedDir.path, 'projects');
  const projects = getProjects(projectsPath);

  if (projects.length === 0) {
    p.log.message(`No projects found in ${selectedDir.name}`);
    return;
  }

  // Step 1: Select projects with multiselect
  const projectsToClean = await p.multiselect({
    message: `Select projects to ${dryRun ? chalk.yellow('preview') : 'clean'} from ${chalk.cyan(selectedDir.name)}`,
    options: projects.map(proj => ({
      value: proj,
      label: `${proj.path} ${chalk.dim('(' + formatBytes(proj.size) + ', ' + proj.sessionCount + ' sessions)')}`
    })),
    required: true
  });

  // ESC pressed - go back to menu
  if (p.isCancel(projectsToClean)) {
    p.cancel('Cancelled');
    return;
  }

  const totalSize = projectsToClean.reduce((sum, p) => sum + p.size, 0);

  // DRY-RUN MODE - Show preview and exit
  if (dryRun) {
    showDryRunPreview(projectsToClean, 'projects', totalSize);
    return;
  }

  // Step 2: Confirm deletion
  const confirmed = await p.confirm({
    message: `Delete ${projectsToClean.length} project(s) (${formatBytes(totalSize, true)})? This will backup and DELETE session data.`,
    initialValue: false
  });

  // ESC pressed - go back to menu
  if (p.isCancel(confirmed) || !confirmed) {
    p.cancel('Cancelled');
    return;
  }

  // Step 3: Execute cleanup
  const startTime = Date.now();
  let totalBackupSize = 0;

  const s = p.spinner();
  s.start(`Cleaning ${projectsToClean.length} projects`);

  for (let i = 0; i < projectsToClean.length; i++) {
    const project = projectsToClean[i];
    s.message(`Cleaning ${i + 1}/${projectsToClean.length}: ${path.basename(project.path)}`);

    const backup = backupDirectory(project.fullPath, false);
    if (backup) {
      try {
        const backupStat = fs.statSync(backup);
        totalBackupSize += backupStat.isDirectory() ? getDirSize(backup) : backupStat.size;
      } catch {}
    }

    fs.rmSync(project.fullPath, { recursive: true, force: true });
    clearSizeCache(project.fullPath);
  }

  s.stop('Cleanup complete');

  const duration = (Date.now() - startTime) / 1000;

  // Log to manifest
  const manifestEntry = {
    timestamp: new Date().toISOString(),
    operation: 'clean-projects',
    location: selectedDir.path,
    items: projectsToClean.map(proj => ({
      path: proj.path,
      originalSize: proj.size,
      backupPath: null,
      backupSize: 0,
      type: 'project',
      sessionCount: proj.sessionCount
    })),
    totalFreed: totalSize,
    totalBackupSize: totalBackupSize,
    duration: duration,
    method: detectCompressionTool()
  };
  appendToManifest(manifestEntry);

  // Show summary
  p.note(
    `${chalk.bold('Deleted:')} ${projectsToClean.length} project(s) ${chalk.cyan('(' + formatBytes(totalSize) + ' freed)')}
${chalk.bold('Backup:')} ${chalk.dim(BACKUP_DIR)}
${chalk.bold('Backup size:')} ${formatBytes(totalBackupSize)}
${chalk.bold('Time:')} ${duration.toFixed(2)}s`,
    '✅ Cleanup Complete'
  );
}

async function cleanGlobalCommand(location, dryRun = false) {
  const claudeDirs = findClaudeDirs(location);

  if (claudeDirs.length === 0) {
    p.log.error(location ? `Location not found: ${location}` : 'No Claude directories found');
    return;
  }

  const dir = claudeDirs[0];
  const globalData = getGlobalData(dir.path);

  if (globalData.length === 0) {
    p.log.message('No global data to clean');
    return;
  }

  // Step 1: Select items to clean
  const itemsToClean = await p.multiselect({
    message: `Select global data to ${dryRun ? chalk.yellow('preview') : 'clean'} from ${chalk.cyan(dir.name)}`,
    options: globalData.map(item => ({
      value: item,
      label: `${item.desc} ${chalk.dim('(' + formatBytes(item.size) + ')')}`
    })),
    required: true
  });

  // ESC pressed - go back to menu
  if (p.isCancel(itemsToClean)) {
    p.cancel('Cancelled');
    return;
  }

  const totalSize = itemsToClean.reduce((sum, item) => sum + item.size, 0);

  // DRY-RUN MODE - Show preview and exit
  if (dryRun) {
    showDryRunPreview(itemsToClean, 'system items', totalSize);
    return;
  }

  // Step 2: Confirm deletion
  const confirmed = await p.confirm({
    message: `Clean ${itemsToClean.length} item(s) (${formatBytes(totalSize, true)})? This will backup and DELETE the selected items.`,
    initialValue: false
  });

  // ESC pressed - go back to menu
  if (p.isCancel(confirmed) || !confirmed) {
    p.cancel('Cancelled');
    return;
  }

  // Step 3: Execute cleanup
  const startTime = Date.now();
  const s = p.spinner();
  s.start(`Cleaning ${itemsToClean.length} items`);

  for (const item of itemsToClean) {
    s.message(`Cleaning: ${item.desc}`);

    if (item.type === 'file') {
      if (fs.existsSync(item.path)) {
        backupDirectory(path.dirname(item.path), false);
        fs.writeFileSync(item.path, '');
      }
    } else {
      const size = getDirSize(item.path);
      if (size > 0) {
        backupDirectory(item.path, false);
      }
      fs.rmSync(item.path, { recursive: true, force: true });
      fs.mkdirSync(item.path, { recursive: true });
      clearSizeCache(item.path);
    }
  }

  s.stop('Cleanup complete');

  const duration = (Date.now() - startTime) / 1000;

  // Log to manifest
  const manifestEntry = {
    timestamp: new Date().toISOString(),
    operation: 'clean-global',
    location: dir.path,
    items: itemsToClean.map(item => ({
      path: item.path,
      originalSize: item.size,
      backupPath: null,
      backupSize: 0,
      type: item.type,
      description: item.desc
    })),
    totalFreed: totalSize,
    totalBackupSize: 0,
    duration: duration,
    method: detectCompressionTool()
  };
  appendToManifest(manifestEntry);

  p.note(
    `${chalk.bold('Deleted:')} ${itemsToClean.length} item(s) ${chalk.cyan('(' + formatBytes(totalSize) + ' freed)')}
${chalk.bold('Backup:')} ${chalk.dim(BACKUP_DIR)}
${chalk.bold('Time:')} ${duration.toFixed(2)}s`,
    '✅ Cleanup Complete'
  );
}

// ============================================================================
// INTERACTIVE MENU
// ============================================================================

async function interactiveMenu(location) {
  let mode = 'sessions'; // Start in sessions mode

  while (true) {
    const locationDisplay = location || '~/.claude (default)';
    const method = detectCompressionTool();
    let methodDisplay = 'No compression (plain copy)';
    if (method === 'tar') methodDisplay = 'tar.gz';
    else if (method === '7zip' || method === '7za') methodDisplay = '7zip (maximum compression)';

    console.clear();
    p.intro(chalk.bold.cyan('🧹 Claude Code Cleaner'));
    console.log(chalk.dim(`📍 Location: ${locationDisplay}`));
    console.log(chalk.dim(`💾 Backup: ${methodDisplay}`));
    console.log('');

    const modeLabel = mode === 'sessions'
      ? '📁 Sessions Mode ' + chalk.dim('(per-project conversation history)')
      : '🖥️ System Data Mode ' + chalk.dim('(global cache, history, debug)');

    const choices = mode === 'sessions' ? [
      { value: 'clean-projects', label: '🗑️  View/clean projects' },
      { value: 'status', label: '📊 Show overview' },
      { value: 'dashboard', label: '📈 Dashboard', hint: 'Stats & history' },
      { value: 'restore', label: '💾  Restore from backup' },
      { value: 'backup-mgmt', label: '📦 Manage backups', hint: 'Prune old backups' },
      { value: 'help', label: '❓ Help', hint: 'Shortcuts & docs' },
      { value: 'export', label: '📤 Export dashboard', hint: 'Save to CSV' },
      { value: 'config', label: '🔧  Settings', hint: 'Configure preferences' },
      { value: 'switch-system', label: '🖥️ Switch to System Data mode →', hint: 'Clean cache/history/debug' },
      { value: 'exit', label: '🚪 Exit' }
    ] : [
      { value: 'clean-global', label: '🗑️  Clean system data' },
      { value: 'status', label: '📊 Show overview' },
      { value: 'dashboard', label: '📈 Dashboard', hint: 'Stats & history' },
      { value: 'restore', label: '💾  Restore from backup' },
      { value: 'backup-mgmt', label: '📦 Manage backups', hint: 'Prune old backups' },
      { value: 'help', label: '❓ Help', hint: 'Shortcuts & docs' },
      { value: 'export', label: '📤 Export dashboard', hint: 'Save to CSV' },
      { value: 'config', label: '🔧  Settings', hint: 'Configure preferences' },
      { value: 'switch-sessions', label: '📁 Switch to Sessions mode →', hint: 'Clean project data' },
      { value: 'exit', label: '🚪 Exit' }
    ];

    const action = await p.select({
      message: modeLabel,
      options: choices
    });

    // ESC pressed in main menu - confirm exit
    if (p.isCancel(action)) {
      const confirmExit = await p.confirm({
        message: 'Exit Claude Code Cleaner?',
        initialValue: true
      });

      if (!p.isCancel(confirmExit) && confirmExit) {
        p.outro(chalk.cyan('Goodbye!'));
        return;
      }
      // If cancelled or no, loop back to menu
      continue;
    }

    switch (action) {
      case 'clean-projects':
        await cleanProjectsCommand(location);
        break;

      case 'clean-global':
        await cleanGlobalCommand(location);
        break;

      case 'status':
        await statusCommand(location);
        break;

      case 'dashboard':
        await dashboardCommand();
        break;

      case 'export':
        await exportDashboardCommand();
        break;

      case 'config':
        await configCommand();
        break;

      case 'help':
        await helpCommand();
        break;

      case 'restore':
        await restoreCommand();
        break;
case 'backup-mgmt':        await backupManagementCommand();        break;

      case 'switch-system':
        mode = 'system';
        continue;

      case 'switch-sessions':
        mode = 'sessions';
        continue;

      case 'exit':
        p.outro(chalk.cyan('Goodbye!'));
        return;
    }

    // Pause before showing menu again
    console.log('');
    await p.text({
      message: 'Press Enter to continue',
      placeholder: '',
      
    });
  }
}

// ============================================================================
// MAIN
// ============================================================================

function parseArgs(args) {
  const parsed = {
    command: null,
    location: null,
    dryRun: false
  };

  for (let i = 0; i < args.length; i++) {
    const arg = args[i];

    if (arg === '--dry-run' || arg === '--preview' || arg === '-n') {
    } else if (arg === '--quiet' || arg === '-q') {
      parsed.quietMode = true;
      parsed.dryRun = true;
    } else if (arg.startsWith('--location=')) {
      parsed.location = arg.split('=')[1].replace(/^~/, HOME);
    } else if (arg === '--location' || arg === '-d') {
      i++;
      if (i < args.length) {
        parsed.location = args[i].replace(/^~/, HOME);
      }
    } else if (!parsed.command && !arg.startsWith('-')) {
      parsed.command = arg;
    }
  }

  return parsed;
}

async function main() {
  const rawArgs = process.argv.slice(2);
  const parsed = parseArgs(rawArgs);

  // No command - enter interactive menu
  if (!parsed.command) {
    await interactiveMenu(parsed.location);
    return;
  }

  // Direct command execution
  switch (parsed.command) {
    case 'status':
    case '-s':
      await statusCommand(parsed.location);
      break;

    case 'clean-global':
    case 'global':
      await cleanGlobalCommand(parsed.location, parsed.dryRun);
      break;

    case 'clean-projects':
    case 'projects':
      await cleanProjectsCommand(parsed.location, parsed.dryRun);
      break;

    case 'dashboard':
      await dashboardCommand();
      break;

    case 'restore':
      await restoreCommand();
      break;

case 'backup-mgmt':    case 'backups':      await backupManagementCommand();      break;
    case 'export':
      await exportDashboardCommand();
      break;

    case 'config':
      await configCommand();
      break;

    case 'help':
    case '--help':
      await helpCommand();
      break;

    default:
      console.log(chalk.red(`\n❌ Unknown command: ${parsed.command}`));
      console.log('Run "node claude-clean.js help" for usage.\n');
  }
}

// Only run main if this file is executed directly (not imported)
if (import.meta.url === `file://${process.argv[1]}`) {
  main().catch((error) => {
    p.cancel('Something went wrong');
    console.error(error);
    process.exit(1);
  });
}

// ============================================================================

// ============================================================================
// EXPORTS FOR TESTING
// ============================================================================
export {
  formatBytes,
  formatRelativeTime,
  decodeProjectPath,
  getTimestamp,
  detectCompressionTool,
  loadConfig,
  saveConfig,
  loadManifest,
  appendToManifest,
  calculateDashboardStats,
  clearSizeCache,
  findClaudeDirs
};
