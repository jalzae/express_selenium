/* Playwright-only E2E helpers + simple Bun-friendly reporting */
import { chromium, firefox, webkit, type Browser, type BrowserContext, type Page } from 'playwright';
import fs from 'fs';
import path from 'path';

type Engine = 'chromium' | 'firefox' | 'webkit';

function getBrowserEngine(): Engine {
  const raw =
    (process.env.E2E_BROWSER ??
      process.env.PW_BROWSER ??
      process.env.PLAYWRIGHT_BROWSER ??
      'chromium') as string;
  const val = raw.toLowerCase();
  if (val === 'firefox') return 'firefox';
  if (val === 'webkit') return 'webkit';
  return 'chromium';
}

function ensureDir(dirPath: string) {
  if (!fs.existsSync(dirPath)) fs.mkdirSync(dirPath, { recursive: true });
}

async function writeFileSmart(filePath: string, data: string | Uint8Array) {
  if ((globalThis as any).Bun && typeof (globalThis as any).Bun.write === 'function') {
    await (globalThis as any).Bun.write(filePath, data);
    return;
  }
  fs.writeFileSync(filePath, data as any);
}

function readJsonArray(filePath: string): any[] {
  try {
    if (!fs.existsSync(filePath)) return [];
    const raw = fs.readFileSync(filePath, 'utf8');
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

function splitSelector(selector: string): [string, string] {
  return selector.includes(':') ? (selector.split(':', 2) as [string, string]) : ['css', selector];
}

function toCssSelector(prefix: string, rawValue: string): string {
  switch (prefix) {
    case 'id':
      return `#${rawValue}`;
    case 'name':
      return `[name="${rawValue}"]`;
    case 'css':
      return rawValue;
    case 'input':
      // Prefer input[name="..."]; fallback handled in waitUntilVisible if needed
      return `input[name="${rawValue}"]`;
    default:
      return rawValue; // treat original as css
  }
}

/**
 * Launch Playwright browser and return a Page
 */
export async function openBrowser(): Promise<Page> {
  const engine = getBrowserEngine();
  const headless = String(process.env.HEADLESS ?? 'true') !== 'false';
  const launcher = engine === 'firefox' ? firefox : engine === 'webkit' ? webkit : chromium;

  const browser: Browser = await launcher.launch({ headless });
  const context: BrowserContext = await browser.newContext();
  const page: Page = await context.newPage();
  try {
    await page.setViewportSize({ width: 1366, height: 768 });
  } catch { }
  (page as any).__pwMeta = { browser, context };
  return page;
}

/**
 * Close Playwright page/context/browser
 */
export async function closeBrowser(page: Page): Promise<void> {
  const meta = (page as any).__pwMeta as { browser?: Browser; context?: BrowserContext } | undefined;
  try {
    await page.close();
  } catch { }
  try {
    await meta?.context?.close();
  } catch { }
  try {
    await meta?.browser?.close();
  } catch { }
}

/**
 * Wait for selector to be visible and return the normalized CSS selector
 */
export async function waitUntilVisible(page: Page, selector: string, timeout = 10000): Promise<string> {
  const [prefix, rawValue] = splitSelector(selector);
  if (prefix === 'input') {
    try {
      const sel = `input[name="${rawValue}"]`;
      await page.waitForSelector(sel, { state: 'visible', timeout });
      return sel;
    } catch {
      const sel = `input#${rawValue}`;
      await page.waitForSelector(sel, { state: 'visible', timeout });
      return sel;
    }
  }
  const css = toCssSelector(prefix, rawValue);
  await page.waitForSelector(css, { state: 'visible', timeout });
  return css;
}

/**
 * Click element after it becomes visible
 */
export async function click(page: Page, selector: string): Promise<void> {
  const sel = await waitUntilVisible(page, selector);
  await page.click(sel);
}

/**
 * Focus element (optional clear)
 */
export async function focus(page: Page, selector: string, clear = false): Promise<void> {
  const sel = await waitUntilVisible(page, selector);
  await page.focus(sel);
  if (clear) await page.fill(sel, '');
}

/**
 * Type into element (clear by default)
 */
export async function input(page: Page, selector: string, value: string, clear = true): Promise<void> {
  const sel = await waitUntilVisible(page, selector);
  if (clear) await page.fill(sel, value);
  else await page.type(sel, value);
}

/**
 * Navigate to URL
 */
export async function goTo(page: Page, url: string): Promise<void> {
  await page.goto(url, { waitUntil: 'load' });
}

/**
 * Wait helper (ms)
 */
export function wait(ms: number): Promise<void> {
  return new Promise((r) => setTimeout(r, ms));
}

const PW_KEY_MAP: Record<string, string> = {
  ENTER: 'Enter',
  TAB: 'Tab',
  BACK_SPACE: 'Backspace',
  ESCAPE: 'Escape',
  ARROW_LEFT: 'ArrowLeft',
  ARROW_RIGHT: 'ArrowRight',
  ARROW_UP: 'ArrowUp',
  ARROW_DOWN: 'ArrowDown',
};

/**
 * Press a key on the element
 */
export async function pressKey(page: Page, selector: string, key: string): Promise<void> {
  const sel = await waitUntilVisible(page, selector);
  const mapped = PW_KEY_MAP[key] ?? key;
  await page.press(sel, mapped);
}

/**
 * Send input without clearing
 */
export async function sendInput(page: Page, selector: string, value: string): Promise<void> {
  await input(page, selector, value, false);
}

/**
 * Submit via Enter key on input
 */
export async function submitInput(page: Page, selector: string): Promise<void> {
  const sel = await waitUntilVisible(page, selector);
  await page.press(sel, 'Enter');
}

/**
 * Wait until URL equals expected
 */
export async function waitUntilUrl(page: Page, url: string, timeout = 5000): Promise<void> {
  await page.waitForURL(url, { timeout });
}

export async function getTitle(page: Page): Promise<string> {
  return page.title();
}

export async function getUrl(page: Page): Promise<string> {
  return page.url();
}

export async function endUrl(page: Page, baseurl: string): Promise<string> {
  const current = await getUrl(page);
  const cleanBase = baseurl.replace(/\/+$/, '');
  const cleanCurrent = String(current).replace(/\/+$/, '');
  const relative = cleanCurrent.startsWith(cleanBase) ? cleanCurrent.slice(cleanBase.length) : cleanCurrent;
  return relative.startsWith('/') ? relative : '/' + relative;
}

/**
 * Take a screenshot to ./screenshots
 */
export async function takeShoot(page: Page): Promise<void> {
  const screenshotsDir = path.join(__dirname, '../screenshots');
  ensureDir(screenshotsDir);
  const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
  const filename = path.join(screenshotsDir, `screenshot-${timestamp}.png`);
  await page.screenshot({ path: filename, fullPage: true });
  console.log(`📸 Screenshot saved: ${filename}`);
}

/**
 * Lightweight report helpers (JSON + simple HTML), Bun-friendly
 */
export interface ReportEntry {
  scenario?: string;
  step?: string;
  status: 'pass' | 'fail' | 'info' | 'skip';
  message?: string;
  [k: string]: any;
}

export async function appendReport(entry: ReportEntry, jsonPath = 'api_test_report.json'): Promise<void> {
  const enriched = { timestamp: new Date().toISOString(), ...entry };
  const arr = readJsonArray(jsonPath);
  arr.push(enriched);
  await writeFileSmart(jsonPath, JSON.stringify(arr, null, 2));
  // Auto-generate simple HTML alongside JSON
  const htmlPath = jsonPath.replace(/\.json$/i, '.html');
  await generateHtmlReport(jsonPath, htmlPath);
}

export async function generateHtmlReport(jsonPath = 'api_test_report.json', htmlPath = 'api_test_report.html'): Promise<void> {
  const data = readJsonArray(jsonPath);
  const rows = data
    .map((e: any, idx: number) => {
      const ts = e.timestamp ?? '';
      const name = e.scenario ?? e.step ?? e.name ?? '';
      const status = e.status ?? '';
      const msg = (e.message ?? '').toString().replace(/</g, '&lt;').replace(/>/g, '&gt;');
      return `<tr><td>${idx + 1}</td><td>${ts}</td><td>${name}</td><td>${status}</td><td>${msg}</td></tr>`;
    })
    .join('\n');

  const html = `<!doctype html>
<html>
<head>
  <meta charset="utf-8"/>
  <title>API Test Report</title>
  <style>
    body { font-family: system-ui, Arial, sans-serif; padding: 16px; }
    table { border-collapse: collapse; width: 100%; }
    th, td { border: 1px solid #ddd; padding: 8px; }
    th { background: #f5f5f5; }
  </style>
</head>
<body>
  <h1>API Test Report</h1>
  <p>Generated: ${new Date().toLocaleString()}</p>
  <table>
    <thead>
      <tr><th>#</th><th>Timestamp</th><th>Name</th><th>Status</th><th>Message</th></tr>
    </thead>
    <tbody>
      ${rows}
    </tbody>
  </table>
</body>
</html>`;
  await writeFileSmart(htmlPath, html);
}