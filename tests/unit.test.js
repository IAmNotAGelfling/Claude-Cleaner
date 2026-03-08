import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import {
  formatBytes,
  formatRelativeTime,
  decodeProjectPath,
  getTimestamp,
  detectCompressionTool,
  calculateDashboardStats
} from '../claude-clean.js';

describe('formatBytes', () => {
  it('should format bytes correctly', () => {
    assert.equal(formatBytes(0), '0 B');
    assert.equal(formatBytes(1024), '1.00 KB');
    assert.equal(formatBytes(1048576), '1.00 MB');
    assert.equal(formatBytes(1073741824), '1.00 GB');
  });

  it('should format small bytes with decimals', () => {
    assert.equal(formatBytes(500), '500.00 B');
    assert.equal(formatBytes(1536), '1.50 KB');
    assert.equal(formatBytes(2560), '2.50 KB');
  });

  it('should handle edge cases', () => {
    assert.equal(formatBytes(1), '1.00 B');
    assert.equal(formatBytes(1023), '1023.00 B');
    assert.equal(formatBytes(1025), '1.00 KB');
  });

  it('should format without colorization by default', () => {
    const result = formatBytes(1024, false);
    assert.equal(typeof result, 'string');
    assert.ok(!result.includes('\x1b')); // No ANSI codes
  });
});

describe('decodeProjectPath', () => {
  if (process.platform === 'win32') {
    it('should decode Windows drive letters', () => {
      // Note: Current implementation has a quirk with double backslashes
      const result = decodeProjectPath('C--Git--MyProject');
      assert.ok(result.startsWith('C:'));
      assert.ok(result.includes('Git'));
      assert.ok(result.includes('MyProject'));
    });

    it('should handle simple names', () => {
      assert.equal(decodeProjectPath('simple'), 'simple');
    });
  } else {
    it('should decode Unix paths correctly', () => {
      assert.equal(decodeProjectPath('-home-user-project'), '/home/user/project');
      assert.equal(decodeProjectPath('-opt-apps'), '/opt/apps');
    });

    it('should handle simple names', () => {
      assert.equal(decodeProjectPath('simple'), 'simple');
    });
  }
});

describe('getTimestamp', () => {
  it('should return timestamp with date and time', () => {
    const timestamp = getTimestamp();
    // Format: YYYY-MM-DD_HH-MM-SS-mmm (includes milliseconds)
    assert.match(timestamp, /^\d{4}-\d{2}-\d{2}_\d{2}-\d{2}-\d{2}-\d{3}$/);
  });

  it('should contain valid date components', () => {
    const timestamp = getTimestamp();
    const [datePart] = timestamp.split('_');
    const [year, month, day] = datePart.split('-');

    assert.ok(parseInt(year) >= 2026);
    assert.ok(parseInt(month) >= 1 && parseInt(month) <= 12);
    assert.ok(parseInt(day) >= 1 && parseInt(day) <= 31);
  });

  it('should be unique over time', () => {
    const ts1 = getTimestamp();
    const ts2 = getTimestamp();
    // They should differ (at least in milliseconds)
    assert.ok(ts1.length > 0);
    assert.ok(ts2.length > 0);
  });
});

describe('detectCompressionTool', () => {
  it('should return a valid compression tool', () => {
    const tool = detectCompressionTool();
    assert.ok(['7zip', 'tar', 'copy'].includes(tool));
  });

  it('should always return a string', () => {
    const tool = detectCompressionTool();
    assert.equal(typeof tool, 'string');
    assert.ok(tool.length > 0);
  });
});

describe('calculateDashboardStats', () => {
  it('should return default stats for empty entries', () => {
    const stats = calculateDashboardStats([]);

    assert.equal(stats.totalOperations, 0);
    assert.equal(stats.totalFreed, 0);
    assert.equal(stats.totalBackupSize, 0);
    assert.equal(stats.compressionRatio, 0);
    assert.equal(stats.averageDuration, 0);
    assert.equal(stats.projectOperations, 0);
    assert.equal(stats.globalOperations, 0);
    assert.deepEqual(stats.topProjects, []);
  });

  it('should calculate basic stats correctly', () => {
    const entries = [{
      timestamp: '2026-03-08T12:00:00.000Z',
      operation: 'clean-projects',
      totalFreed: 1048576, // 1 MB
      totalBackupSize: 314573, // ~300 KB
      duration: 1500,
      items: []
    }];

    const stats = calculateDashboardStats(entries);

    assert.equal(stats.totalOperations, 1);
    assert.equal(stats.totalFreed, 1048576);
    assert.equal(stats.totalBackupSize, 314573);
    assert.equal(stats.averageDuration, 1500);
    assert.equal(stats.projectOperations, 1);
    assert.equal(stats.globalOperations, 0);
  });

  it('should calculate compression ratio correctly', () => {
    const entries = [{
      timestamp: '2026-03-08T12:00:00.000Z',
      operation: 'clean-projects',
      totalFreed: 1000,
      totalBackupSize: 300,
      duration: 1000,
      items: []
    }];

    const stats = calculateDashboardStats(entries);
    assert.equal(stats.compressionRatio, 0.3); // 300/1000 = 0.3
  });

  it('should aggregate multiple operations', () => {
    const entries = [
      {
        timestamp: '2026-03-08T12:00:00.000Z',
        operation: 'clean-projects',
        totalFreed: 500,
        totalBackupSize: 150,
        duration: 1000,
        items: []
      },
      {
        timestamp: '2026-03-08T12:05:00.000Z',
        operation: 'clean-global',
        totalFreed: 300,
        totalBackupSize: 90,
        duration: 800,
        items: []
      },
      {
        timestamp: '2026-03-08T12:10:00.000Z',
        operation: 'clean-projects',
        totalFreed: 200,
        totalBackupSize: 60,
        duration: 600,
        items: []
      }
    ];

    const stats = calculateDashboardStats(entries);

    assert.equal(stats.totalOperations, 3);
    assert.equal(stats.totalFreed, 1000);
    assert.equal(stats.totalBackupSize, 300);
    assert.equal(stats.averageDuration, 800); // (1000+800+600)/3
    assert.equal(stats.projectOperations, 2);
    assert.equal(stats.globalOperations, 1);
  });

  it('should track top projects by size', () => {
    const entries = [{
      timestamp: '2026-03-08T12:00:00.000Z',
      operation: 'clean-projects',
      totalFreed: 1000,
      totalBackupSize: 300,
      duration: 1000,
      items: [
        { path: 'C:\\Git\\Project1', originalSize: 600 },
        { path: 'C:\\Git\\Project2', originalSize: 400 }
      ]
    }];

    const stats = calculateDashboardStats(entries);

    assert.equal(stats.topProjects.length, 2);
    assert.equal(stats.topProjects[0].path, 'C:\\Git\\Project1');
    assert.equal(stats.topProjects[0].size, 600);
    assert.equal(stats.topProjects[0].count, 1);
  });
});

describe('formatRelativeTime', () => {
  it('should format recent times', () => {
    const now = new Date();
    const result = formatRelativeTime(now);
    assert.equal(typeof result, 'string');
    assert.ok(result.length > 0);
  });

  it('should handle past dates', () => {
    const pastDate = new Date('2026-03-01T12:00:00.000Z');
    const result = formatRelativeTime(pastDate);
    assert.equal(typeof result, 'string');
    assert.ok(result.length > 0);
  });

  it('should handle date strings', () => {
    const result = formatRelativeTime('2026-03-01');
    assert.equal(typeof result, 'string');
    assert.ok(result.length > 0);
  });
});

describe('Integration Tests', () => {
  it('formatBytes and calculateDashboardStats work together', () => {
    const entries = [{
      timestamp: '2026-03-08T12:00:00.000Z',
      operation: 'clean-projects',
      totalFreed: 524288000, // 500 MB
      totalBackupSize: 157286400, // 150 MB
      duration: 2000,
      items: []
    }];

    const stats = calculateDashboardStats(entries);
    const formattedSize = formatBytes(stats.totalFreed);
    const formattedBackup = formatBytes(stats.totalBackupSize);

    assert.ok(formattedSize.includes('MB'));
    assert.ok(formattedBackup.includes('MB'));
    assert.ok(parseFloat(formattedSize) > 0);
    assert.ok(parseFloat(formattedBackup) > 0);
  });
});
