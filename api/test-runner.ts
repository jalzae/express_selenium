import Database from 'better-sqlite3';
import path from 'node:path';
import fs from 'node:fs';
import { spawn } from 'node:child_process';

const dbPath = path.join(process.cwd(), 'e2e-dashboard.db');
const db = new Database(dbPath);

const TEST_RUN_ID = process.env.TEST_RUN_ID;
const PROJECT_TYPE = process.env.PROJECT_TYPE;

if (!TEST_RUN_ID) {
  console.error('TEST_RUN_ID environment variable required');
  process.exit(1);
}

// Get test run details
const run = db.prepare('SELECT * FROM test_runs WHERE id = ?').get(TEST_RUN_ID) as any;
if (!run) {
  console.error('Test run not found:', TEST_RUN_ID);
  process.exit(1);
}

const project = db.prepare('SELECT * FROM projects WHERE id = ?').get(run.projectId) as any;
if (!project) {
  console.error('Project not found:', run.projectId);
  process.exit(1);
}

const featureIds = JSON.parse(run.featureIds);
const features = db.prepare(`SELECT * FROM features WHERE id IN (${featureIds.map(() => '?').join(',')})`).all(...featureIds) as any[];

console.log(`[TestRunner] Starting test run: ${TEST_RUN_ID}`);
console.log(`[TestRunner] Project: ${project.name} (${project.type})`);
console.log(`[TestRunner] Features: ${features.map((f) => f.name).join(', ')}`);
console.log(`[TestRunner] Record: ${run.recordTestRun ? 'YES' : 'NO'}, Screenshots: ${run.takeScreenshots ? 'YES' : 'NO'}`);

// Update status to running
db.prepare('UPDATE test_runs SET status = ?, startedAt = datetime("now") WHERE id = ?').run('running', TEST_RUN_ID);

// Create results directory
const resultsDir = path.join(process.cwd(), 'test-results', TEST_RUN_ID);
fs.mkdirSync(resultsDir, { recursive: true });

// Create features directory for this run
const featuresDir = path.join(resultsDir, 'features');
fs.mkdirSync(featuresDir, { recursive: true });

// Write feature files to disk
for (const feature of features) {
  const featurePath = path.join(featuresDir, `${feature.id}.feature`);
  fs.writeFileSync(featurePath, feature.content, 'utf8');
  console.log(`[TestRunner] Wrote feature: ${feature.name} -> ${featurePath}`);
}

// Set environment for Cucumber
const env = {
  ...process.env,
  TEST_RUN_ID,
  PROJECT_TYPE: project.type,
  RECORD_TEST_RUN: run.recordTestRun ? '1' : '0',
  TAKE_SCREENSHOTS: run.takeScreenshots ? '1' : '0',
  BASE_URL: project.baseUrl || '',
  HEADLESS: 'true',
};

// Add mobile config if applicable
if (project.type === 'mobile') {
  let mobileConfig = {};
  if (project.mobileConfig) {
    try {
      mobileConfig = JSON.parse(project.mobileConfig);
    } catch {}
  } else {
    // Legacy support
    mobileConfig = {
      appPackage: project.appPackage,
      appActivity: project.appActivity,
      deviceName: project.deviceName,
      platformVersion: project.platformVersion,
      automationName: project.automationName,
      appiumPath: project.appiumPath,
      appiumHost: project.appiumHost,
      appiumPort: project.appiumPort,
    };
  }
  env.APPIUM_PATH = mobileConfig.appiumPath || '/';
  env.APPIUM_HOST = mobileConfig.appiumHost || 'localhost';
  env.APPIUM_PORT = mobileConfig.appiumPort || '4723';
  env.APPIUM_DEVICE_NAME = mobileConfig.deviceName || 'emulator-5554';
  env.APPIUM_APP_PACKAGE = mobileConfig.appPackage || '';
  env.APPIUM_APP_ACTIVITY = mobileConfig.appActivity || '';
  env.APPIUM_AUTOMATION_NAME = mobileConfig.automationName || 'UiAutomator2';
}

// Cucumber arguments
const cucumberArgs = [
  'cucumber-js',
  `--require-module ts-node/register`,
  `--require-module tsconfig-paths/register`,
  `--require src/steps.ts`,
  `--require src/hooks.ts`,
  `${featuresDir}/**/*.feature`,
  `--format json:${path.join(resultsDir, 'cucumber-report.json')}`,
  `--format message:${path.join(resultsDir, 'cucumber-messages.ndjson')}`,
  `--format progress`,
];

console.log('[TestRunner] Running Cucumber with args:', cucumberArgs.join(' '));

// Spawn Cucumber process
const cucumber = spawn('npx', cucumberArgs, {
  cwd: process.cwd(),
  env,
  stdio: ['ignore', 'pipe', 'pipe'],
});

let stdout = '';
let stderr = '';

cucumber.stdout.on('data', (data) => {
  const text = data.toString();
  stdout += text;
  console.log(text.trimEnd());
});

cucumber.stderr.on('data', (data) => {
  const text = data.toString();
  stderr += text;
  console.error(text.trimEnd());
});

cucumber.on('close', async (code) => {
  console.log(`[TestRunner] Cucumber exited with code: ${code}`);

  const status = code === 0 ? 'passed' : 'failed';
  const completedAt = new Date().toISOString();

  // Collect screenshots
  const screenshots: string[] = [];
  if (run.takeScreenshots) {
    const screenshotsDir = path.join(process.cwd(), 'screenshots');
    if (fs.existsSync(screenshotsDir)) {
      const files = fs.readdirSync(screenshotsDir);
      for (const file of files) {
        if (file.includes(TEST_RUN_ID)) {
          screenshots.push(path.join(screenshotsDir, file));
        }
      }
    }
  }

  // Collect recordings
  const recordings: string[] = [];
  if (run.recordTestRun) {
    const recordingsDir = path.join(process.cwd(), 'recordings');
    if (fs.existsSync(recordingsDir)) {
      const files = fs.readdirSync(recordingsDir);
      for (const file of files) {
        if (file.includes(TEST_RUN_ID) || file.includes(featureIds[0])) {
          recordings.push(path.join(recordingsDir, file));
        }
      }
    }
  }

  // Read cucumber report
  let cucumberResults: any = null;
  const reportPath = path.join(resultsDir, 'cucumber-report.json');
  if (fs.existsSync(reportPath)) {
    try {
      cucumberResults = JSON.parse(fs.readFileSync(reportPath, 'utf8'));
    } catch (e) {
      console.error('[TestRunner] Failed to parse cucumber report:', e);
    }
  }

  // Update test run with results
  db.prepare(
    `
    UPDATE test_runs
    SET status = ?, completedAt = ?, errorMessage = ?, screenshotPaths = ?, recordingPath = ?, resultJson = ?
    WHERE id = ?
  `
  ).run(
    status,
    completedAt,
    status === 'failed' ? stderr.slice(0, 1000) : null,
    JSON.stringify(screenshots),
    JSON.stringify(recordings),
    JSON.stringify({ cucumberResults, duration: Date.now() - new Date(run.startedAt || completedAt).getTime() }),
    TEST_RUN_ID
  );

  console.log(`[TestRunner] Test run completed: ${status}`);
  console.log(`[TestRunner] Screenshots: ${screenshots.length}, Recordings: ${recordings.length}`);

  db.close();
  process.exit(code ?? 1);
});

cucumber.on('error', (err) => {
  console.error('[TestRunner] Failed to start Cucumber:', err);
  db.prepare('UPDATE test_runs SET status = ?, errorMessage = ? WHERE id = ?').run('failed', `Cucumber error: ${err.message}`, TEST_RUN_ID);
  db.close();
  process.exit(1);
});
