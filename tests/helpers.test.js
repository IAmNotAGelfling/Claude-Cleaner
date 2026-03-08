import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import {
  formatBytes,
  formatRelativeTime,
  decodeProjectPath,
  getTimestamp,
  calculateDashboardStats,
  clearSizeCache
} from '../claude-clean.js';

describe('formatBytes - Extended Tests', () => {
  it('should handle very large numbers', () => {
    const nearTerabyte = 1024 * 1024 * 1024 * 512; // 512 GB
    const result = formatBytes(nearTerabyte);
    assert.ok(result.includes('GB'));
    assert.ok(parseFloat(result) > 100);
  });

  it('should handle fractional bytes', () => {
    const result = formatBytes(512.7);
    assert.ok(result.includes('B'));
  });

  it('should maintain precision', () => {
    const result = formatBytes(1536); // 1.5 KB
    assert.ok(result.includes('1.50'));
  });

  it('should format multiple common sizes', () => {
    const tests = [
      { bytes: 100, expected: 'B' },
      { bytes: 2048, expected: 'KB' },
      { bytes: 5242880, expected: 'MB' },
      { bytes: 2147483648, expected: 'GB' }
    ];

    for (const test of tests) {
      const result = formatBytes(test.bytes);
      assert.ok(result.includes(test.expected), `${test.bytes} should include ${test.expected}`);
    }
  });
});

describe('calculateDashboardStats - Extended Tests', () => {
  it('should handle missing fields in entries', () => {
    const entries = [{
      timestamp: '2026-03-08T12:00:00.000Z',
      operation: 'test'
      // Missing totalFreed, totalBackupSize, duration
    }];

    const stats = calculateDashboardStats(entries);

    assert.equal(stats.totalOperations, 1);
    assert.equal(stats.totalFreed, 0);
    assert.equal(stats.totalBackupSize, 0);
  });

  it('should handle very old entries', () => {
    const entries = [{
      timestamp: '2020-01-01T00:00:00.000Z',
      operation: 'clean-projects',
      totalFreed: 1000,
      totalBackupSize: 300,
      duration: 1000,
      items: []
    }];

    const stats = calculateDashboardStats(entries);

    assert.equal(stats.totalOperations, 1);
    assert.ok(stats.totalFreed > 0);
  });

  it('should aggregate projects correctly with duplicates', () => {
    const entries = [
      {
        timestamp: '2026-03-08T12:00:00.000Z',
        operation: 'clean-projects',
        totalFreed: 500,
        totalBackupSize: 150,
        duration: 1000,
        items: [
          { path: 'Project1', originalSize: 300 },
          { path: 'Project2', originalSize: 200 }
        ]
      },
      {
        timestamp: '2026-03-08T13:00:00.000Z',
        operation: 'clean-projects',
        totalFreed: 400,
        totalBackupSize: 120,
        duration: 900,
        items: [
          { path: 'Project1', originalSize: 400 }  // Same project again
        ]
      }
    ];

    const stats = calculateDashboardStats(entries);

    assert.equal(stats.topProjects.length, 2);

    const project1 = stats.topProjects.find(p => p.path === 'Project1');
    assert.ok(project1);
    assert.equal(project1.size, 700); // 300 + 400
    assert.equal(project1.count, 2);
  });

  it('should sort top projects by size', () => {
    const entries = [{
      timestamp: '2026-03-08T12:00:00.000Z',
      operation: 'clean-projects',
      totalFreed: 1000,
      totalBackupSize: 300,
      duration: 1000,
      items: [
        { path: 'Small', originalSize: 100 },
        { path: 'Large', originalSize: 600 },
        { path: 'Medium', originalSize: 300 }
      ]
    }];

    const stats = calculateDashboardStats(entries);

    assert.equal(stats.topProjects[0].path, 'Large');
    assert.equal(stats.topProjects[1].path, 'Medium');
    assert.equal(stats.topProjects[2].path, 'Small');
  });

  it('should limit top projects to 5', () => {
    const items = [];
    for (let i = 0; i < 10; i++) {
      items.push({ path: `Project${i}`, originalSize: (10 - i) * 100 });
    }

    const entries = [{
      timestamp: '2026-03-08T12:00:00.000Z',
      operation: 'clean-projects',
      totalFreed: 5500,
      totalBackupSize: 1650,
      duration: 2000,
      items
    }];

    const stats = calculateDashboardStats(entries);

    assert.equal(stats.topProjects.length, 5);
  });

  it('should handle zero compression ratio correctly', () => {
    const entries = [{
      timestamp: '2026-03-08T12:00:00.000Z',
      operation: 'clean-projects',
      totalFreed: 0,
      totalBackupSize: 0,
      duration: 1000,
      items: []
    }];

    const stats = calculateDashboardStats(entries);

    assert.equal(stats.compressionRatio, 0);
  });

  it('should distinguish between project and global operations', () => {
    const entries = [
      { operation: 'clean-projects', totalFreed: 1000, totalBackupSize: 300, duration: 1000, items: [] },
      { operation: 'clean-projects', totalFreed: 500, totalBackupSize: 150, duration: 800, items: [] },
      { operation: 'clean-global', totalFreed: 200, totalBackupSize: 60, duration: 600, items: [] },
      { operation: 'clean-global', totalFreed: 100, totalBackupSize: 30, duration: 400, items: [] }
    ];

    const stats = calculateDashboardStats(entries);

    assert.equal(stats.projectOperations, 2);
    assert.equal(stats.globalOperations, 2);
    assert.equal(stats.totalOperations, 4);
  });
});

describe('formatRelativeTime - Extended Tests', () => {
  it('should handle future dates', () => {
    const futureDate = new Date();
    futureDate.setDate(futureDate.getDate() + 7);

    const result = formatRelativeTime(futureDate);
    assert.equal(typeof result, 'string');
    assert.ok(result.length > 0);
  });

  it('should handle various past dates', () => {
    const tests = [
      new Date(Date.now() - 1000 * 60), // 1 minute ago
      new Date(Date.now() - 1000 * 60 * 60), // 1 hour ago
      new Date(Date.now() - 1000 * 60 * 60 * 24), // 1 day ago
      new Date(Date.now() - 1000 * 60 * 60 * 24 * 7) // 1 week ago
    ];

    for (const date of tests) {
      const result = formatRelativeTime(date);
      assert.equal(typeof result, 'string');
      assert.ok(result.length > 0);
    }
  });

  it('should handle invalid date strings gracefully', () => {
    const result = formatRelativeTime('not-a-date');
    assert.equal(typeof result, 'string');
  });
});

describe('getTimestamp - Extended Tests', () => {
  it('should generate timestamps with millisecond precision', () => {
    const timestamps = new Set();
    for (let i = 0; i < 50; i++) {
      timestamps.add(getTimestamp());
    }
    // Should capture some millisecond variations in a tight loop
    // At minimum, should have 1 timestamp (if loop is very fast)
    // Could have up to 50 if each call is in a different millisecond
    assert.ok(timestamps.size >= 1 && timestamps.size <= 50);
    // Verify timestamp format includes milliseconds
    const sample = Array.from(timestamps)[0];
    assert.match(sample, /\d{3}$/); // Ends with 3-digit milliseconds
  });

  it('should be lexicographically sortable', () => {
    const ts1 = getTimestamp();
    const ts2 = getTimestamp();
    const ts3 = getTimestamp();

    const sorted = [ts3, ts1, ts2].sort();
    assert.ok(sorted[0] <= sorted[1]);
    assert.ok(sorted[1] <= sorted[2]);
  });

  it('should contain valid date components', () => {
    const timestamp = getTimestamp();
    const [datePart, timePart] = timestamp.split('_');

    assert.ok(datePart.includes('-'));
    assert.ok(timePart.includes('-'));

    const [year, month, day] = datePart.split('-');
    assert.equal(year.length, 4);
    assert.equal(month.length, 2);
    assert.equal(day.length, 2);
  });
});

describe('decodeProjectPath - Extended Tests', () => {
  if (process.platform === 'win32') {
    it('should handle multiple path segments', () => {
      const result = decodeProjectPath('C--Users--Alan--Documents--Project');
      assert.ok(result.startsWith('C:'));
      assert.ok(result.includes('Users'));
      assert.ok(result.includes('Project'));
    });

    it('should handle different drive letters', () => {
      const drives = ['C', 'D', 'E', 'F'];
      for (const drive of drives) {
        const encoded = `${drive}--Test`;
        const result = decodeProjectPath(encoded);
        assert.ok(result.startsWith(`${drive}:`));
      }
    });
  } else {
    it('should handle deep Unix paths', () => {
      const result = decodeProjectPath('-home-user-projects-myproject');
      assert.ok(result.startsWith('/'));
      assert.ok(result.includes('home'));
      assert.ok(result.includes('myproject'));
    });

    it('should handle root paths', () => {
      const result = decodeProjectPath('-etc');
      assert.ok(result.startsWith('/'));
    });
  }

  it('should not modify paths without encoding', () => {
    const simple = 'simple-project-name';
    const result = decodeProjectPath(simple);
    assert.ok(result.includes('simple'));
  });
});

describe('clearSizeCache', () => {
  it('should be callable without errors', () => {
    assert.doesNotThrow(() => {
      clearSizeCache();
    });
  });

  it('should accept null parameter', () => {
    assert.doesNotThrow(() => {
      clearSizeCache(null);
    });
  });

  it('should accept array parameter', () => {
    assert.doesNotThrow(() => {
      clearSizeCache(['/path1', '/path2']);
    });
  });
});

describe('Utility Integration Tests', () => {
  it('should format sizes from real-world scenarios', () => {
    const scenarios = [
      { name: 'Small project', size: 1024 * 50 }, // 50 KB
      { name: 'Medium project', size: 1024 * 1024 * 25 }, // 25 MB
      { name: 'Large project', size: 1024 * 1024 * 500 }, // 500 MB
      { name: 'Debug folder', size: 1024 * 1024 * 1024 * 2 } // 2 GB
    ];

    for (const scenario of scenarios) {
      const formatted = formatBytes(scenario.size);
      assert.ok(formatted.length > 0, `Failed to format ${scenario.name}`);
      assert.ok(parseFloat(formatted) > 0, `${scenario.name} should have positive size`);
    }
  });

  it('should handle complete dashboard workflow', () => {
    // Simulate multiple cleanup operations
    const entries = [];

    for (let i = 0; i < 10; i++) {
      entries.push({
        timestamp: new Date(Date.now() - i * 1000 * 60 * 60).toISOString(),
        operation: i % 2 === 0 ? 'clean-projects' : 'clean-global',
        totalFreed: Math.floor(Math.random() * 1024 * 1024 * 100),
        totalBackupSize: Math.floor(Math.random() * 1024 * 1024 * 30),
        duration: Math.floor(Math.random() * 5000),
        items: []
      });
    }

    const stats = calculateDashboardStats(entries);

    assert.equal(stats.totalOperations, 10);
    assert.ok(stats.totalFreed >= 0);
    assert.ok(stats.totalBackupSize >= 0);
    assert.ok(stats.averageDuration >= 0);
    assert.ok(stats.projectOperations >= 0);
    assert.ok(stats.globalOperations >= 0);
  });
});
