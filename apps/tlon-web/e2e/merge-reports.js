#!/usr/bin/env node

/**
 * Merge Playwright test reports from multiple shards
 * This script combines test results from parallel test execution
 */

const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

// Configuration
const RESULTS_DIR = 'test-results';
const TOTAL_SHARDS = parseInt(process.env.TOTAL_SHARDS || '2');
const PROJECT_ROOT = path.join(__dirname, '..');

// Colors for console output
const colors = {
  reset: '\x1b[0m',
  bright: '\x1b[1m',
  dim: '\x1b[2m',
  red: '\x1b[31m',
  green: '\x1b[32m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
};

function log(message, color = '') {
  console.log(`${color}${message}${colors.reset}`);
}

function logError(message) {
  console.error(`${colors.red}Error: ${message}${colors.reset}`);
}

function logSuccess(message) {
  log(`✓ ${message}`, colors.green);
}

function logInfo(message) {
  log(`ℹ ${message}`, colors.blue);
}

function logWarning(message) {
  log(`⚠ ${message}`, colors.yellow);
}

// Check if shard reports exist
function checkShardReports() {
  const missingShards = [];
  const existingShards = [];

  for (let shard = 1; shard <= TOTAL_SHARDS; shard++) {
    const shardReportDir = path.join(PROJECT_ROOT, RESULTS_DIR, `shard-${shard}-report`);
    if (fs.existsSync(shardReportDir)) {
      existingShards.push(shard);
    } else {
      missingShards.push(shard);
    }
  }

  return { existingShards, missingShards };
}

// Merge JUnit XML reports
function mergeJUnitReports(existingShards) {
  logInfo('Merging JUnit XML reports...');

  const junitReports = [];
  let totalTests = 0;
  let totalFailures = 0;
  let totalErrors = 0;
  let totalTime = 0;

  for (const shard of existingShards) {
    const junitPath = path.join(PROJECT_ROOT, RESULTS_DIR, `shard-${shard}`, 'junit.xml');
    if (fs.existsSync(junitPath)) {
      const content = fs.readFileSync(junitPath, 'utf8');

      // Parse basic test statistics from JUnit XML
      const testsMatch = content.match(/tests="(\d+)"/);
      const failuresMatch = content.match(/failures="(\d+)"/);
      const errorsMatch = content.match(/errors="(\d+)"/);
      const timeMatch = content.match(/time="([\d.]+)"/);

      if (testsMatch) totalTests += parseInt(testsMatch[1]);
      if (failuresMatch) totalFailures += parseInt(failuresMatch[1]);
      if (errorsMatch) totalErrors += parseInt(errorsMatch[1]);
      if (timeMatch) totalTime += parseFloat(timeMatch[1]);

      // Extract test cases
      const testCases = content.match(/<testcase[^>]*>[\s\S]*?<\/testcase>/g);
      if (testCases) {
        junitReports.push(...testCases);
      }
    } else {
      logWarning(`No JUnit report found for shard ${shard}`);
    }
  }

  // Create merged JUnit report
  if (junitReports.length > 0) {
    const mergedJUnit = `<?xml version="1.0" encoding="UTF-8"?>
<testsuites name="Playwright Tests" tests="${totalTests}" failures="${totalFailures}" errors="${totalErrors}" time="${totalTime.toFixed(2)}">
  <testsuite name="E2E Tests" tests="${totalTests}" failures="${totalFailures}" errors="${totalErrors}" time="${totalTime.toFixed(2)}">
    ${junitReports.join('\n    ')}
  </testsuite>
</testsuites>`;

    const mergedJunitPath = path.join(PROJECT_ROOT, RESULTS_DIR, 'junit-merged.xml');
    fs.writeFileSync(mergedJunitPath, mergedJUnit);
    logSuccess(`JUnit reports merged: ${mergedJunitPath}`);

    return {
      totalTests,
      totalFailures,
      totalErrors,
      totalTime: totalTime.toFixed(2),
    };
  }

  return null;
}

// Merge Playwright blob reports using Playwright's built-in merge functionality
function mergeHTMLReports(existingShards) {
  logInfo('Merging Playwright blob reports...');

  // Blob reports are stored directly in shard-N-report directories
  const shardReports = existingShards.map(shard =>
    path.join(PROJECT_ROOT, RESULTS_DIR, `shard-${shard}-report`)
  ).filter(dir => fs.existsSync(dir));

  if (shardReports.length === 0) {
    logWarning('No blob reports found to merge');
    return false;
  }

  const mergedReportDir = path.join(PROJECT_ROOT, RESULTS_DIR, 'merged-report');

  // Remove existing merged report
  if (fs.existsSync(mergedReportDir)) {
    fs.rmSync(mergedReportDir, { recursive: true, force: true });
  }
  fs.mkdirSync(mergedReportDir, { recursive: true });

  try {
    // Playwright merge-reports expects a SINGLE directory containing all blob reports
    // Copy all shard blob reports into a temporary directory
    const blobDir = path.join(PROJECT_ROOT, RESULTS_DIR, 'blob-reports-temp');
    if (fs.existsSync(blobDir)) {
      fs.rmSync(blobDir, { recursive: true, force: true });
    }
    fs.mkdirSync(blobDir, { recursive: true });

    for (const shardReport of shardReports) {
      const files = fs.readdirSync(shardReport);
      for (const file of files) {
        if (file.endsWith('.zip')) {
          const src = path.join(shardReport, file);
          const dest = path.join(blobDir, file);
          fs.copyFileSync(src, dest);
        }
      }
    }

    // Generate HTML report from merged blobs
    const configContent = `
export default {
  reporter: [['html', { outputFolder: '${mergedReportDir}', open: 'never' }]]
};`;
    const tempConfigPath = path.join(PROJECT_ROOT, 'merge.config.js');
    fs.writeFileSync(tempConfigPath, configContent);

    const command = `npx playwright merge-reports ${blobDir} --config ${tempConfigPath}`;
    logInfo(`Merging reports from ${shardReports.length} shards...`);

    execSync(command, {
      cwd: PROJECT_ROOT,
      stdio: 'pipe',
      encoding: 'utf8',
    });

    // Clean up temp files
    fs.unlinkSync(tempConfigPath);
    fs.rmSync(blobDir, { recursive: true, force: true });

    logSuccess(`HTML report generated: ${mergedReportDir}`);
    return true;
  } catch (error) {
    logError(`Failed to merge HTML reports: ${error.message}`);

    // Fallback: Copy individual shard reports
    logInfo('Falling back to copying individual shard reports...');
    fs.mkdirSync(mergedReportDir, { recursive: true });

    for (const shardReport of shardReports) {
      const shardNum = path.basename(shardReport).match(/shard-(\d+)/)?.[1];
      if (shardNum) {
        const destDir = path.join(mergedReportDir, `shard-${shardNum}`);
        fs.cpSync(shardReport, destDir, { recursive: true });
      }
    }

    // Create index file for fallback
    const indexContent = `
<!DOCTYPE html>
<html>
<head>
  <title>E2E Test Results - All Shards</title>
  <style>
    body { font-family: Arial, sans-serif; margin: 20px; }
    h1 { color: #333; }
    .shard-link {
      display: block;
      margin: 10px 0;
      padding: 10px;
      background: #f0f0f0;
      text-decoration: none;
      color: #333;
      border-radius: 5px;
    }
    .shard-link:hover { background: #e0e0e0; }
  </style>
</head>
<body>
  <h1>E2E Test Results - All Shards</h1>
  ${existingShards.map(shard => `
    <a class="shard-link" href="shard-${shard}/index.html">
      View Shard ${shard} Results
    </a>
  `).join('')}
</body>
</html>`;

    fs.writeFileSync(path.join(mergedReportDir, 'index.html'), indexContent);
    logWarning('Created fallback index for individual shard reports');
    return true;
  }
}

// Copy test artifacts (screenshots, videos, traces)
function copyTestArtifacts(existingShards) {
  logInfo('Copying test artifacts...');

  const artifactsDir = path.join(PROJECT_ROOT, RESULTS_DIR, 'artifacts');

  // Remove existing artifacts directory
  if (fs.existsSync(artifactsDir)) {
    fs.rmSync(artifactsDir, { recursive: true, force: true });
  }
  fs.mkdirSync(artifactsDir, { recursive: true });

  let totalArtifacts = 0;

  for (const shard of existingShards) {
    const shardResultsDir = path.join(PROJECT_ROOT, RESULTS_DIR, `shard-${shard}`);

    if (fs.existsSync(shardResultsDir)) {
      // Copy all non-XML files as artifacts
      const files = fs.readdirSync(shardResultsDir, { withFileTypes: true });

      for (const file of files) {
        if (file.isDirectory() || !file.name.endsWith('.xml')) {
          const sourcePath = path.join(shardResultsDir, file.name);
          const destPath = path.join(artifactsDir, `shard-${shard}-${file.name}`);

          if (file.isDirectory()) {
            fs.cpSync(sourcePath, destPath, { recursive: true });
          } else {
            fs.copyFileSync(sourcePath, destPath);
          }
          totalArtifacts++;
        }
      }
    }
  }

  if (totalArtifacts > 0) {
    logSuccess(`Copied ${totalArtifacts} artifacts to ${artifactsDir}`);
  } else {
    logInfo('No test artifacts found');
  }
}

// Main merge function
async function main() {
  log('\n=== Playwright Report Merger ===\n', colors.bright + colors.blue);

  // Check which shards have reports
  const { existingShards, missingShards } = checkShardReports();

  if (existingShards.length === 0) {
    logError('No shard reports found!');
    process.exit(1);
  }

  logInfo(`Found reports for shards: ${existingShards.join(', ')}`);

  if (missingShards.length > 0) {
    logWarning(`Missing reports for shards: ${missingShards.join(', ')}`);
  }

  // Merge JUnit reports
  const junitStats = mergeJUnitReports(existingShards);

  // Validate merged blob reports
  mergeHTMLReports(existingShards);

  // Copy test artifacts
  copyTestArtifacts(existingShards);

  // Print summary
  log('\n=== Merge Summary ===\n', colors.bright + colors.green);

  if (junitStats) {
    logInfo(`Total tests: ${junitStats.totalTests}`);
    logInfo(`Total failures: ${junitStats.totalFailures}`);
    logInfo(`Total errors: ${junitStats.totalErrors}`);
    logInfo(`Total time: ${junitStats.totalTime}s`);
  }

  // Provide instructions for viewing HTML report
  log('\nTo view HTML report:', colors.dim);
  log(`  npx playwright show-report ${RESULTS_DIR}/merged-report`, colors.bright);

  // Exit with error if there were test failures
  if (junitStats && (junitStats.totalFailures > 0 || junitStats.totalErrors > 0)) {
    logError('\nTests failed! Check the report for details.');
    process.exit(1);
  }

  logSuccess('\nAll tests passed! 🎉');
}

// Run the merge
main().catch(error => {
  logError(`Unexpected error: ${error.message}`);
  console.error(error);
  process.exit(1);
});