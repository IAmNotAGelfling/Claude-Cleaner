# Tests

Comprehensive test suite for Claude Cleaner's core utility functions, config system, and manifest handling.

## Running Tests

```bash
npm test
```

## What's Tested

### Test Coverage (63 tests across 3 files):

**tests/unit.test.js** (20 tests):
- **formatBytes** (4 tests) - Size formatting with proper units
- **decodeProjectPath** (2 tests) - Project path decoding (platform-specific)
- **getTimestamp** (3 tests) - Timestamp generation and format
- **detectCompressionTool** (2 tests) - Compression tool detection
- **calculateDashboardStats** (5 tests) - Dashboard statistics aggregation
- **formatRelativeTime** (3 tests) - Relative time formatting
- **Integration** (1 test) - Functions working together

**tests/config-manifest.test.js** (25 tests):
- **Config System** (3 tests) - Configuration loading and validation
- **Manifest System** (5 tests) - JSONL parsing and error handling
- **Helper Functions** (3 tests) - Config validation and date parsing
- **Edge Cases** (4 tests) - Large numbers, zero values, missing fields
- **Data Integrity** (3 tests) - Timestamp consistency, concurrent access
- **Additional Tests** (7 tests) - Various edge cases and scenarios

**tests/helpers.test.js** (18 tests):
- **formatBytes Extended** (4 tests) - Large numbers, precision, edge cases
- **calculateDashboardStats Extended** (7 tests) - Missing fields, aggregation, sorting
- **formatRelativeTime Extended** (3 tests) - Future dates, date ranges, invalid input
- **getTimestamp Extended** (3 tests) - Uniqueness, sortability, format validation
- **decodeProjectPath Extended** (platform-specific tests)
- **clearSizeCache** (3 tests) - Cache clearing functionality
- **Integration Tests** (2 tests) - Real-world scenarios and workflows

## What's NOT Tested

The following are intentionally not tested due to complexity/risk:

- **Interactive TUI** - Requires mocking @clack/prompts interactions
- **File System Operations** - Deletion, backup creation (too risky for tests)
- **Real ~/.claude/ Data** - Would require fixtures and is dangerous
- **User Interactions** - Confirmations, menu navigation

## Test Philosophy

This tool relies on:
- ✅ **Unit tests** for pure logic functions (these tests)
- ✅ **Safety features** instead of integration tests:
  - Dry-run mode (users preview before executing)
  - Automatic backups (operations are reversible)
  - Confirmations (prevents accidents)
  - Manual testing (we've run it successfully)

## Coverage

- **Tested**: Core utility functions, config system, manifest handling (~40-50% of testable logic)
- **Not Tested**: TUI, file operations, main workflows (~50-60% of codebase)
- **Acceptable**: For a CLI tool with strong safety features (dry-run, backups, confirmations)

## Adding Tests

To add tests for new utility functions:

1. Export the function in `claude-clean.js`:
```javascript
export {
  formatBytes,
  // ... add your function here
  newUtilityFunction
};
```

2. Import and test in `tests/unit.test.js`:
```javascript
import { newUtilityFunction } from '../claude-clean.js';

describe('newUtilityFunction', () => {
  it('should do something', () => {
    assert.equal(newUtilityFunction('input'), 'expected output');
  });
});
```

3. Run: `npm test`

## Test Framework

Uses **Node.js built-in test runner** (v16+):
- No external test dependencies
- Native to Node.js
- Simple and fast
