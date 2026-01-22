/**
 * Playwright E2E Testing Helper Library
 *
 * A simplified wrapper around Playwright for browser automation.
 * Optimized for Cucumber/Cucumber-js testing scenarios.
 *
 * @example
 * ```ts
 * import { openBrowser, goTo, click, input, closeBrowser } from './playwright';
 *
 * const page = await openBrowser();
 * await goTo(page, 'https://example.com');
 * await click(page, 'id:submit-button');
 * await closeBrowser(page);
 * ```
 *
 * @remarks
 * Environment variables:
 * - E2E_BROWSER / PW_BROWSER / PLAYWRIGHT_BROWSER: Browser engine ('chromium', 'firefox', 'webkit')
 * - HEADLESS: Run headless mode ('true' or 'false', default: 'true')
 */
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

// ============================================================================
// SELECTOR NOTATION
// ============================================================================
/**
 * Supported selector prefixes for element identification:
 *
 * @example
 * - `'id:myId'` → `#myId` (element by ID)
 * - `'name:myName'` → `[name="myName"]` (element by name attribute)
 * - `'input:myName'` → `input[name="myName"]` (input by name, tries id fallback)
 * - `'css:.myClass'` → `.myClass` (CSS selector)
 * - `'button'` → `button` (plain CSS, no prefix)
 *
 * @remarks
 * All interaction methods automatically wait for the element to be visible
 * before performing actions. Default timeout is 10 seconds.
 */

// ============================================================================
// NAVIGATION
// ============================================================================

/**
 * Launch a new browser instance and create a page.
 *
 * @example
 * ```ts
 * const page = await openBrowser();
 * ```
 *
 * @returns A Playwright Page instance with browser/context metadata attached
 *
 * @remarks
 * - Detects browser engine from environment variables (defaults to chromium)
 * - Uses headless mode unless HEADLESS=false is set
 * - Sets default viewport to 1366x768
 * - Stores browser/context metadata for proper cleanup
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
 * Close the browser and cleanup all resources.
 *
 * @param page - The Page instance returned from openBrowser()
 *
 * @example
 * ```ts
 * await closeBrowser(page);
 * ```
 *
 * @remarks
 * Safely closes page, context, and browser. Silently handles errors
 * if resources are already closed.
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
 * Navigate to the specified URL.
 *
 * @param page - The Page instance
 * @param url - The URL to navigate to (can be relative or absolute)
 *
 * @example
 * ```ts
 * await goTo(page, 'https://example.com');
 * await goTo(page, '/login');
 * ```
 *
 * @remarks
 * Waits for the page 'load' event before returning.
 */
export async function goTo(page: Page, url: string): Promise<void> {
  await page.goto(url, { waitUntil: 'load' });
}

/**
 * Pause execution for a specified duration.
 *
 * @param ms - Milliseconds to wait
 *
 * @example
 * ```ts
 * await wait(1000); // Wait 1 second
 * ```
 *
 * @remarks
 * Prefer using explicit waits (waitUntilVisible, waitUntilUrl) over
 * fixed delays for more reliable tests.
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

/**
 * Get the page title.
 *
 * @param page - The Page instance
 * @returns The page title text
 *
 * @example
 * ```ts
 * const title = await getTitle(page);
 * console.log('Page title:', title);
 * ```
 */
export async function getTitle(page: Page): Promise<string> {
  return page.title();
}

/**
 * Get the current URL.
 *
 * @param page - The Page instance
 * @returns The current page URL
 *
 * @example
 * ```ts
 * const url = await getUrl(page);
 * console.log('Current URL:', url);
 * ```
 */
export async function getUrl(page: Page): Promise<string> {
  return page.url();
}

/**
 * Get the relative URL path from a base URL.
 *
 * @param page - The Page instance
 * @param baseurl - The base URL to strip from the current URL
 * @returns The relative path (e.g., '/dashboard' or '/user/profile')
 *
 * @example
 * ```ts
 * // If current URL is 'https://example.com/dashboard/users'
 * const path = await endUrl(page, 'https://example.com');
 * // Returns: '/dashboard/users'
 * ```
 */
export async function endUrl(page: Page, baseurl: string): Promise<string> {
  const current = await getUrl(page);
  const cleanBase = baseurl.replace(/\/+$/, '');
  const cleanCurrent = String(current).replace(/\/+$/, '');
  const relative = cleanCurrent.startsWith(cleanBase) ? cleanCurrent.slice(cleanBase.length) : cleanCurrent;
  return relative.startsWith('/') ? relative : '/' + relative;
}

// ============================================================================
// SCREENSHOTS
// ============================================================================

/**
 * Take a full-page screenshot and save it to the screenshots directory.
 *
 * @param page - The Page instance
 *
 * @example
 * ```ts
 * await takeShoot(page);
 * // Saves to: ./screenshots/screenshot-2024-01-15T10-30-45-123Z.png
 * ```
 *
 * @remarks
 * - Creates './screenshots' directory if it doesn't exist
 * - Uses ISO timestamp for filename (with sanitized characters)
 * - Captures full page (scrolls to capture everything)
 * - Logs the saved file path to console
 */
export async function takeShoot(page: Page): Promise<void> {
  const screenshotsDir = path.join(__dirname, '../screenshots');
  ensureDir(screenshotsDir);
  const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
  const filename = path.join(screenshotsDir, `screenshot-${timestamp}.png`);
  await page.screenshot({ path: filename, fullPage: true });
  console.log(`📸 Screenshot saved: ${filename}`);
}

// ============================================================================
// ELEMENT QUERY & ASSERTION HELPERS
// ============================================================================

/**
 * Get the visible text content of an element.
 *
 * @param page - The Page instance
 * @param selector - Element selector (with optional prefix)
 * @returns The visible text content
 *
 * @example
 * ```ts
 * const text = await getText(page, 'id:greeting');
 * console.log('Element text:', text); // "Hello World"
 * ```
 */
export async function getText(page: Page, selector: string): Promise<string> {
  const sel = await waitUntilVisible(page, selector);
  return await page.innerText(sel);
}

/**
 * Get the value of an element's attribute.
 *
 * @param page - The Page instance
 * @param selector - Element selector (with optional prefix)
 * @param attribute - The attribute name to retrieve
 * @returns The attribute value or null if not present
 *
 * @example
 * ```ts
 * const href = await getAttribute(page, 'id:link', 'href');
 * const className = await getAttribute(page, 'css:.button', 'class');
 * ```
 */
export async function getAttribute(page: Page, selector: string, attribute: string): Promise<string | null> {
  const sel = await waitUntilVisible(page, selector);
  return await page.getAttribute(sel, attribute);
}

/**
 * Check if an element is visible on the page.
 *
 * @param page - The Page instance
 * @param selector - Element selector (with optional prefix)
 * @returns true if the element is visible, false otherwise
 *
 * @example
 * ```ts
 * const isVisible = await isVisible(page, 'id:modal');
 * if (isVisible) {
 *   console.log('Modal is visible');
 * }
 * ```
 */
export async function isVisible(page: Page, selector: string): Promise<boolean> {
  try {
    const [prefix, rawValue] = splitSelector(selector);
    const css = toCssSelector(prefix, rawValue);
    await page.waitForSelector(css, { state: 'visible', timeout: 5000 });
    return true;
  } catch {
    return false;
  }
}

/**
 * Check if an element exists in the DOM (may not be visible).
 *
 * @param page - The Page instance
 * @param selector - Element selector (with optional prefix)
 * @returns true if the element exists, false otherwise
 *
 * @example
 * ```ts
 * const exists = await isElementPresent(page, 'id:hidden-div');
 * console.log('Element exists:', exists);
 * ```
 */
export async function isElementPresent(page: Page, selector: string): Promise<boolean> {
  try {
    const [prefix, rawValue] = splitSelector(selector);
    const css = toCssSelector(prefix, rawValue);
    await page.waitForSelector(css, { state: 'attached', timeout: 5000 });
    return true;
  } catch {
    return false;
  }
}

/**
 * Check if an element is enabled (not disabled).
 *
 * @param page - The Page instance
 * @param selector - Element selector (with optional prefix)
 * @returns true if the element is enabled, false if disabled
 *
 * @example
 * ```ts
 * const isEnabled = await isEnabled(page, 'id:submit-btn');
 * if (!isEnabled) {
 *   console.log('Button is disabled');
 * }
 * ```
 */
export async function isEnabled(page: Page, selector: string): Promise<boolean> {
  const sel = await waitUntilVisible(page, selector);
  return !(await page.isDisabled(sel));
}

/**
 * Check if a checkbox or radio button is checked.
 *
 * @param page - The Page instance
 * @param selector - Element selector (with optional prefix)
 * @returns true if checked, false otherwise
 *
 * @example
 * ```ts
 * const isChecked = await isChecked(page, 'id:remember-me');
 * if (isChecked) {
 *   console.log('Checkbox is checked');
 * }
 * ```
 */
export async function isChecked(page: Page, selector: string): Promise<boolean> {
  const sel = await waitUntilVisible(page, selector);
  return await page.isChecked(sel);
}

/**
 * Count the number of elements matching the selector.
 *
 * @param page - The Page instance
 * @param selector - Element selector (with optional prefix)
 * @returns The count of matching elements
 *
 * @example
 * ```ts
 * const itemCount = await getElementCount(page, 'css:.item');
 * console.log(`Found ${itemCount} items`);
 * ```
 */
export async function getElementCount(page: Page, selector: string): Promise<number> {
  const [prefix, rawValue] = splitSelector(selector);
  const css = toCssSelector(prefix, rawValue);
  return await page.locator(css).count();
}

/**
 * Select an option from a dropdown (select) element.
 *
 * @param page - The Page instance
 * @param selector - Element selector (with optional prefix)
 * @param value - The option value to select
 *
 * @example
 * ```ts
 * await selectOption(page, 'id:country', 'us');
 * await selectOption(page, 'name:language', 'javascript');
 * ```
 */
export async function selectOption(page: Page, selector: string, value: string): Promise<void> {
  const sel = await waitUntilVisible(page, selector);
  await page.selectOption(sel, value);
}

/**
 * Hover over an element.
 *
 * @param page - The Page instance
 * @param selector - Element selector (with optional prefix)
 *
 * @example
 * ```ts
 * await hover(page, 'id:menu-item');
 * // Useful for triggering dropdown menus or tooltips
 * ```
 */
export async function hover(page: Page, selector: string): Promise<void> {
  const sel = await waitUntilVisible(page, selector);
  await page.hover(sel);
}

/**
 * Double-click on an element.
 *
 * @param page - The Page instance
 * @param selector - Element selector (with optional prefix)
 *
 * @example
 * ```ts
 * await doubleClick(page, 'id:editable-text');
 * // Useful for selecting text or triggering double-click actions
 * ```
 */
export async function doubleClick(page: Page, selector: string): Promise<void> {
  const sel = await waitUntilVisible(page, selector);
  await page.dblclick(sel);
}

/**
 * Right-click (context menu click) on an element.
 *
 * @param page - The Page instance
 * @param selector - Element selector (with optional prefix)
 *
 * @example
 * ```ts
 * await rightClick(page, 'id:image');
 * // Opens the context menu
 * ```
 */
export async function rightClick(page: Page, selector: string): Promise<void> {
  const sel = await waitUntilVisible(page, selector);
  await page.click(sel, { button: 'right' });
}

/**
 * Scroll to a specific element to bring it into view.
 *
 * @param page - The Page instance
 * @param selector - Element selector (with optional prefix)
 *
 * @example
 * ```ts
 * await scrollToElement(page, 'id:footer');
 * // Useful for interacting with elements below the fold
 * ```
 */
export async function scrollToElement(page: Page, selector: string): Promise<void> {
  const sel = await waitUntilVisible(page, selector);
  await page.locator(sel).scrollIntoViewIfNeeded();
}

/**
 * Scroll the page by a specific offset.
 *
 * @param page - The Page instance
 * @param x - Horizontal scroll offset in pixels
 * @param y - Vertical scroll offset in pixels
 *
 * @example
 * ```ts
 * await scrollBy(page, 0, 500); // Scroll down 500px
 * await scrollBy(page, 100, 0); // Scroll right 100px
 * ```
 */
export async function scrollBy(page: Page, x: number, y: number): Promise<void> {
  await page.evaluate(({ x, y }) => {
    window.scrollBy(x, y);
  }, { x, y });
}

/**
 * Wait for an element to be attached to the DOM (may not be visible).
 *
 * @param page - The Page instance
 * @param selector - Element selector (with optional prefix)
 * @param timeout - Maximum time to wait in milliseconds (default: 10000)
 *
 * @example
 * ```ts
 * await waitForElement(page, 'id:dynamic-content');
 * // Useful for waiting for dynamically added elements
 * ```
 */
export async function waitForElement(page: Page, selector: string, timeout = 10000): Promise<string> {
  const [prefix, rawValue] = splitSelector(selector);
  const css = toCssSelector(prefix, rawValue);
  await page.waitForSelector(css, { state: 'attached', timeout });
  return css;
}

/**
 * Get the HTML content of an element.
 *
 * @param page - The Page instance
 * @param selector - Element selector (with optional prefix)
 * @returns The inner HTML of the element
 *
 * @example
 * ```ts
 * const html = await getHtml(page, 'id:content');
 * console.log('Element HTML:', html);
 * ```
 */
export async function getHtml(page: Page, selector: string): Promise<string> {
  const sel = await waitUntilVisible(page, selector);
  return await page.innerHTML(sel);
}

/**
 * Get all text from the page (including hidden elements).
 *
 * @param page - The Page instance
 * @returns All text content on the page
 *
 * @example
 * ```ts
 * const allText = await getPageText(page);
 * console.log('Page text:', allText);
 * ```
 */
export async function getPageText(page: Page): Promise<string> {
  return await page.evaluate(() => document.body.innerText ?? '');
}

/**
 * Refresh/reload the current page.
 *
 * @param page - The Page instance
 *
 * @example
 * ```ts
 * await refresh(page);
 * // Reloads the current page
 * ```
 */
export async function refresh(page: Page): Promise<void> {
  await page.reload();
}

/**
 * Navigate back in browser history.
 *
 * @param page - The Page instance
 *
 * @example
 * ```ts
 * await goBack(page);
 * // Equivalent to clicking the browser's back button
 * ```
 */
export async function goBack(page: Page): Promise<void> {
  await page.goBack();
}

/**
 * Navigate forward in browser history.
 *
 * @param page - The Page instance
 *
 * @example
 * ```ts
 * await goForward(page);
 * // Equivalent to clicking the browser's forward button
 * ```
 */
export async function goForward(page: Page): Promise<void> {
  await page.goForward();
}

// ============================================================================
// REPORTING
// ============================================================================
/**
 * Lightweight report helpers (JSON + simple HTML), Bun-friendly
 *
 * @example
 * ```ts
 * await appendReport({
 *   scenario: 'User Login',
 *   step: 'Enter credentials',
 *   status: 'pass',
 *   message: 'Successfully logged in'
 * });
 * ```
 */
export interface ReportEntry {
  /** Scenario or test name */
  scenario?: string;
  /** Step description */
  step?: string;
  /** Test result status */
  status: 'pass' | 'fail' | 'info' | 'skip';
  /** Optional message or error details */
  message?: string;
  /** Additional custom fields */
  [k: string]: any;
}

/**
 * Append a test result entry to the report file.
 *
 * @param entry - The report entry to add
 * @param jsonPath - Path to the JSON report file (default: 'api_test_report.json')
 *
 * @remarks
 * - Automatically adds a timestamp to each entry
 * - Creates the file if it doesn't exist
 * - Auto-generates an HTML report alongside the JSON
 *
 * @example
 * ```ts
 * await appendReport({
 *   scenario: 'User Registration',
 *   step: 'Submit form',
 *   status: 'pass'
 * }, 'test-results.json');
 * ```
 */
export async function appendReport(entry: ReportEntry, jsonPath = 'api_test_report.json'): Promise<void> {
  const enriched = { timestamp: new Date().toISOString(), ...entry };
  const arr = readJsonArray(jsonPath);
  arr.push(enriched);
  await writeFileSmart(jsonPath, JSON.stringify(arr, null, 2));
  // Auto-generate simple HTML alongside JSON
  const htmlPath = jsonPath.replace(/\.json$/i, '.html');
  await generateHtmlReport(jsonPath, htmlPath);
}

/**
 * Generate an HTML report from a JSON report file.
 *
 * @param jsonPath - Path to the JSON report file
 * @param htmlPath - Path where the HTML report should be saved
 *
 * @remarks
 * Creates a simple HTML table view of the JSON report data.
 * The HTML includes timestamp, name, status, and message columns.
 *
 * @example
 * ```ts
 * await generateHtmlReport('results.json', 'report.html');
 * ```
 */
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

// ============================================================================
// FORM & INPUT HELPERS
// ============================================================================

/**
 * Check a checkbox or radio button.
 *
 * @param page - The Page instance
 * @param selector - Element selector (with optional prefix)
 *
 * @example
 * ```ts
 * await check(page, 'id:terms-agree');
 * await check(page, 'name:newsletter');
 * ```
 */
export async function check(page: Page, selector: string): Promise<void> {
  const sel = await waitUntilVisible(page, selector);
  await page.check(sel);
}

/**
 * Uncheck a checkbox.
 *
 * @param page - The Page instance
 * @param selector - Element selector (with optional prefix)
 *
 * @example
 * ```ts
 * await uncheck(page, 'id:terms-agree');
 * ```
 */
export async function uncheck(page: Page, selector: string): Promise<void> {
  const sel = await waitUntilVisible(page, selector);
  await page.uncheck(sel);
}

/**
 * Upload a file using a file input element.
 *
 * @param page - The Page instance
 * @param selector - File input element selector (with optional prefix)
 * @param filePath - Absolute or relative path to the file to upload
 *
 * @example
 * ```ts
 * await uploadFile(page, 'id:avatar-input', '/path/to/image.png');
 * await uploadFile(page, 'name:document', './files/report.pdf');
 * ```
 */
export async function uploadFile(page: Page, selector: string, filePath: string): Promise<void> {
  const sel = await waitUntilVisible(page, selector);
  await page.setInputFiles(sel, filePath);
}

/**
 * Execute custom JavaScript in the page context.
 *
 * @param page - The Page instance
 * @param script - JavaScript function or string to execute
 * @param args - Arguments to pass to the script (must be serializable)
 * @returns The result of the script execution
 *
 * @example
 * ```ts
 * // Get scroll position
 * const scrollY = await executeScript(page, () => window.scrollY);
 *
 * // Set a variable
 * await executeScript(page, (value) => window.myVar = value, 'test');
 *
 * // Complex calculation
 * const result = await executeScript(page, (a, b) => a + b, 10, 20);
 * ```
 */
export async function executeScript<R = any>(
  page: Page,
  script: (arg: any) => R,
  arg?: any
): Promise<R> {
  return await page.evaluate(script, arg);
}

/**
 * Clear an input or textarea field.
 *
 * @param page - The Page instance
 * @param selector - Element selector (with optional prefix)
 *
 * @example
 * ```ts
 * await clearInput(page, 'id:username');
 * ```
 */
export async function clearInput(page: Page, selector: string): Promise<void> {
  const sel = await waitUntilVisible(page, selector);
  await page.fill(sel, '');
}

/**
 * Switch to an iframe by selector.
 *
 * @param page - The Page instance
 * @param selector - iframe element selector (with optional prefix)
 * @returns A Frame object for interacting with the iframe content
 *
 * @example
 * ```ts
 * const frame = await switchToFrame(page, 'id:my-iframe');
 * await frame.click('button_inside_iframe');
 * ```
 */
export async function switchToFrame(page: Page, selector: string): Promise<any> {
  const sel = await waitUntilVisible(page, selector);
  const frame = page.frameLocator(sel);
  return frame;
}

/**
 * Get the value of an input, select, or textarea element.
 *
 * @param page - The Page instance
 * @param selector - Element selector (with optional prefix)
 * @returns The element's value property
 *
 * @example
 * ```ts
 * const value = await getInputValue(page, 'id:email');
 * console.log('Input value:', value);
 * ```
 */
export async function getInputValue(page: Page, selector: string): Promise<string> {
  const sel = await waitUntilVisible(page, selector);
  return await page.inputValue(sel);
}

/**
 * Wait for an element to be hidden (not visible).
 *
 * @param page - The Page instance
 * @param selector - Element selector (with optional prefix)
 * @param timeout - Maximum time to wait in milliseconds (default: 10000)
 *
 * @example
 * ```ts
 * await waitUntilHidden(page, 'id:loading-spinner');
 * console.log('Spinner is now hidden');
 * ```
 */
export async function waitUntilHidden(page: Page, selector: string, timeout = 10000): Promise<void> {
  const [prefix, rawValue] = splitSelector(selector);
  const css = toCssSelector(prefix, rawValue);
  await page.waitForSelector(css, { state: 'hidden', timeout });
}

/**
 * Get CSS property value of an element.
 *
 * @param page - The Page instance
 * @param selector - Element selector (with optional prefix)
 * @param property - CSS property name (e.g., 'color', 'background-color')
 * @returns The computed CSS property value
 *
 * @example
 * ```ts
 * const color = await getCssValue(page, 'id:header', 'background-color');
 * console.log('Header color:', color);
 * ```
 */
export async function getCssValue(page: Page, selector: string, property: string): Promise<string> {
  const sel = await waitUntilVisible(page, selector);
  return await page.$eval(sel, (el: HTMLElement, prop: string) => {
    return window.getComputedStyle(el).getPropertyValue(prop);
  }, property);
}

/**
 * Get the bounding box (position and size) of an element.
 *
 * @param page - The Page instance
 * @param selector - Element selector (with optional prefix)
 * @returns Object with x, y, width, height properties
 *
 * @example
 * ```ts
 * const box = await getElementBounds(page, 'id:my-element');
 * console.log(`Position: ${box.x}, ${box.y}`);
 * console.log(`Size: ${box.width}x${box.height}`);
 * ```
 */
export async function getElementBounds(page: Page, selector: string): Promise<{ x: number; y: number; width: number; height: number }> {
  const sel = await waitUntilVisible(page, selector);
  return await page.locator(sel).boundingBox() ?? { x: 0, y: 0, width: 0, height: 0 };
}