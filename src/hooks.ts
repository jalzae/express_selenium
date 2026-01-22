import { After } from '@cucumber/cucumber';
import fs from 'fs';
import path from 'path';
import { getRecordingFile } from './recording';

import { page } from '~/repository/google';

After(async function (scenario) {
  try {
    // Playwright screenshot
    if (page) {
      const base64 = await page.screenshot({ encoding: 'base64' });
      await this.attach(base64, 'image/png;base64');
    }

    // Selenium driver screenshot (legacy/fallback)
    if (this.driver) {
      const dir = path.join(process.cwd(), 'screenshots');
      if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
      const safe = scenario.pickle.name.replace(/[^a-z0-9]/gi, '_');
      const ts = new Date().toISOString().replace(/[:.]/g, '-');
      const filePath = path.join(dir, `${safe}-${ts}.png`);

      const base64 = await this.driver.takeScreenshot();
      fs.writeFileSync(filePath, base64, 'base64');

      if (this.attach) {
        // Attach inline image so cucumber-html-reporter can render it
        const buffer = Buffer.from(base64, 'base64');
        await this.attach(buffer, 'image/png');
      }
    }

    // Attach recording link if present (recording module stores the path by scenario name)
    const recordingPath = getRecordingFile?.(scenario.pickle.name);
    if (recordingPath && this.attach) {
      const rel = path.relative(process.cwd(), recordingPath);
      await this.attach(`Recording: ${rel}`, 'text/plain');
      // Also provide clickable HTML link
      await this.attach(`<a href="${rel}">Download recording</a>`, 'text/html');
    }
  } catch (err) {
    console.error('[Hooks After] Error attaching artifacts:', err);
  }
});