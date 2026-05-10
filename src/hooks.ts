import { After, Before } from '@cucumber/cucumber';
import fs from 'node:fs';
import path from 'node:path';
import { getRecordingFile, startRecording, stopRecording } from './recording';
import { page as sessionPage, clearPage } from '@/session';
import { closeBrowser } from '@/playwright';

// Environment flags (set by test-runner.ts)
const RECORD_TEST_RUN = process.env.RECORD_TEST_RUN === '1';
const TAKE_SCREENSHOTS = process.env.TAKE_SCREENSHOTS !== '0';
const TEST_RUN_ID = process.env.TEST_RUN_ID || '';

Before(async function (scenario) {
  // Start recording if enabled
  if (RECORD_TEST_RUN) {
    startRecording(`${TEST_RUN_ID}-${scenario.pickle.name}`);
  }
});

After(async function (scenario) {
  try {
    // Stop recording
    if (RECORD_TEST_RUN) {
      await stopRecording(`${TEST_RUN_ID}-${scenario.pickle.name}`);
    }

    // Take screenshot if enabled
    if (TAKE_SCREENSHOTS && sessionPage) {
      try {
        const dir = path.join(process.cwd(), 'screenshots');
        if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });

        // Include test run ID and scenario name in filename
        const safe = scenario.pickle.name.replace(/[^a-z0-9]/gi, '_');
        const status = scenario.result?.status === 'FAILED' ? 'FAILED' : 'SUCCESS';
        const ts = new Date().toISOString().replace(/[:.]/g, '-');
        const filePath = path.join(dir, `${TEST_RUN_ID}-${safe}-${ts}-${status}.png`);

        const screenshot = await sessionPage.screenshot({ path: filePath });

        // Attach to Cucumber report
        if (this.attach) {
          this.attach(screenshot.toString('base64'), 'base64:image/png');
        }

        console.log(`📸 Screenshot saved: ${filePath}`);
      } catch (e) {
        console.error('Failed to take screenshot:', e);
      }
    }

    // Selenium driver screenshot (legacy/fallback)
    if (TAKE_SCREENSHOTS && this.driver) {
      const dir = path.join(process.cwd(), 'screenshots');
      if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });

      const safe = scenario.pickle.name.replace(/[^a-z0-9]/gi, '_');
      const ts = new Date().toISOString().replace(/[:.]/g, '-');
      const filePath = path.join(dir, `${TEST_RUN_ID}-${safe}-${ts}.png`);

      const base64 = await this.driver.takeScreenshot();
      fs.writeFileSync(filePath, base64, 'base64');

      if (this.attach) {
        const buffer = Buffer.from(base64, 'base64');
        this.attach(buffer, 'image/png');
      }
    }

    // Attach recording link if present
    if (this.attach && RECORD_TEST_RUN) {
      const recordingPath = getRecordingFile(`${TEST_RUN_ID}-${scenario.pickle.name}`);
      if (recordingPath) {
        const rel = path.relative(process.cwd(), recordingPath);
        this.attach(`Recording: ${rel}`, 'text/plain');
        this.attach(`<a href="${rel}">Download recording</a>`, 'text/html');
      }
    }
  } catch (err) {
    console.error('[Hooks After] Error attaching artifacts:', err);
  } finally {
    // Close browser
    try {
      if (sessionPage) {
        await closeBrowser(sessionPage);
      }
    } catch (err) {
      console.error('Failed to close browser:', err);
    }
    // Clear session page reference
    clearPage();
  }
});
