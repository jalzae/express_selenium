import path from 'node:path';
import fs from 'node:fs';
import { spawn } from 'node:child_process';
import { config } from 'dotenv';
import { eq } from 'drizzle-orm';
import { db } from './db';
import { projects, features, testRuns } from './db/schema';

config({ path: path.join(__dirname, '..', '.env') });

const TEST_RUN_ID = process.env.TEST_RUN_ID;
const PROJECT_TYPE = process.env.PROJECT_TYPE;

if (!TEST_RUN_ID) {
  console.error('TEST_RUN_ID environment variable required');
  process.exit(1);
}

async function main() {
  const [run] = await db.select().from(testRuns).where(eq(testRuns.id, TEST_RUN_ID));
  if (!run) {
    console.error('Test run not found:', TEST_RUN_ID);
    process.exit(1);
  }

  const [project] = await db.select().from(projects).where(eq(projects.id, run.projectId));
  if (!project) {
    console.error('Project not found:', run.projectId);
    process.exit(1);
  }

  const featureIds = JSON.parse(run.featureIds);
  const featureList = await db.select()
    .from(features)
    .where(eq(features.projectId, run.projectId));

  const filteredFeatures = featureList.filter(f => featureIds.includes(f.id));

  console.log(`[TestRunner] Starting test run: ${TEST_RUN_ID}`);
  console.log(`[TestRunner] Project: ${project.name} (${project.type})`);
  console.log(`[TestRunner] Features: ${filteredFeatures.map((f) => f.name).join(', ')}`);
  console.log(`[TestRunner] Record: ${run.recordTestRun ? 'YES' : 'NO'}, Screenshots: ${run.takeScreenshots ? 'YES' : 'NO'}`);

  await db.update(testRuns)
    .set({ status: 'running', startedAt: new Date() })
    .where(eq(testRuns.id, TEST_RUN_ID));

  const resultsDir = path.join(process.cwd(), 'test-results', TEST_RUN_ID);
  fs.mkdirSync(resultsDir, { recursive: true });

  const featuresDir = path.join(resultsDir, 'features');
  fs.mkdirSync(featuresDir, { recursive: true });

  for (const feature of filteredFeatures) {
    const featurePath = path.join(featuresDir, `${feature.id}.feature`);
    fs.writeFileSync(featurePath, feature.content, 'utf8');
    console.log(`[TestRunner] Wrote feature: ${feature.name} -> ${featurePath}`);
  }

  const env = {
    ...process.env,
    TEST_RUN_ID,
    PROJECT_TYPE: project.type,
    RECORD_TEST_RUN: run.recordTestRun ? '1' : '0',
    TAKE_SCREENSHOTS: run.takeScreenshots ? '1' : '0',
    BASE_URL: project.baseUrl || '',
    HEADLESS: 'false',
  };

  if (project.type === 'mobile') {
    let mobileConfig: any = {};
    if (project.mobileConfig) {
      try {
        mobileConfig = JSON.parse(project.mobileConfig);
      } catch {}
    } else {
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

  const cucumberArgs = [
    'cucumber-js',
    '--require', 'ts-node/register',
    '--require', 'tsconfig-paths/register',
    '--require', 'src/steps.ts',
    '--require', 'src/hooks.ts',
    `${featuresDir}/**/*.feature`,
    '--format', `json:${path.join(resultsDir, 'cucumber-report.json')}`,
    '--format', `message:${path.join(resultsDir, 'cucumber-messages.ndjson')}`,
    '--format', 'progress',
  ];

  console.log('[TestRunner] Running Cucumber with args:', cucumberArgs.join(' '));

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
    const completedAt = new Date();

    const screenshots: string[] = [];
    if (run.takeScreenshots) {
      const screenshotsDir = path.join(process.cwd(), 'dashboard/public/screenshots');
      if (fs.existsSync(screenshotsDir)) {
        const files = fs.readdirSync(screenshotsDir);
        for (const file of files) {
          if (file.includes(TEST_RUN_ID)) {
            screenshots.push(file);
          }
        }
      }
    }

    const recordings: string[] = [];
    if (run.recordTestRun) {
      const recordingsDir = path.join(process.cwd(), 'dashboard/public/recordings');
      if (fs.existsSync(recordingsDir)) {
        const files = fs.readdirSync(recordingsDir);
        for (const file of files) {
          if (file.includes(TEST_RUN_ID) || file.includes(featureIds[0])) {
            recordings.push(file);
          }
        }
      }
    }

    let cucumberResults: any = null;
    const reportPath = path.join(resultsDir, 'cucumber-report.json');
    if (fs.existsSync(reportPath)) {
      try {
        cucumberResults = JSON.parse(fs.readFileSync(reportPath, 'utf8'));
      } catch (e) {
        console.error('[TestRunner] Failed to parse cucumber report:', e);
      }
    }

    await db.update(testRuns)
      .set({
        status,
        completedAt,
        errorMessage: status === 'failed' ? stderr.slice(0, 1000) : null,
        screenshotPaths: JSON.stringify(screenshots),
        recordingPath: JSON.stringify(recordings),
        resultJson: JSON.stringify({
          cucumberResults,
          duration: run.startedAt ? completedAt.getTime() - new Date(run.startedAt).getTime() : 0
        })
      })
      .where(eq(testRuns.id, TEST_RUN_ID));

    console.log(`[TestRunner] Test run completed: ${status}`);
    console.log(`[TestRunner] Screenshots: ${screenshots.length}, Recordings: ${recordings.length}`);

    process.exit(code ?? 1);
  });

  cucumber.on('error', async (err) => {
    console.error('[TestRunner] Failed to start Cucumber:', err);
    await db.update(testRuns)
      .set({
        status: 'failed',
        errorMessage: `Cucumber error: ${err.message}`
      })
      .where(eq(testRuns.id, TEST_RUN_ID));
    process.exit(1);
  });
}

main().catch((err) => {
  console.error('[TestRunner] Fatal error:', err);
  process.exit(1);
});
