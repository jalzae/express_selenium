
import { type Page } from 'playwright';
import { openBrowser, closeBrowser, goTo, input, pressKey, getTitle as pwGetTitle, wait } from '@/playwright';

export let page: Page;

export async function startWebDriver() {
  page = await openBrowser();
}

export async function openGoogle(url: string = 'google.com') {
  await goTo(page, 'https://www.' + url);
}

export async function searchKeyword(keyword: string) {
  // 'q' is the name of the search input on Google
  await input(page, 'name:q', keyword);
  await pressKey(page, 'name:q', 'Enter');
}

export async function getTitle(expectedTerm: string): Promise<string> {
  // Wait for title to include the expected term to avoid race conditions
  // Playwright doesn't have a direct "waitUntilTitleContains" helper in our src/playwright.ts
  // but we can poll for it or just wait a bit.
  // Given the previous issue was timing, let's try a simple wait first or check if we can implement a smart wait.
  // Converting the explicit wait logic:
  
  const startTime = Date.now();
  const timeout = 10000;
  
  while (Date.now() - startTime < timeout) {
    const title = await pwGetTitle(page);
    if (title.includes(expectedTerm)) {
      return title;
    }
    await wait(500);
  }
  
  return await pwGetTitle(page);
}

export async function quitWebDriver() {
  await closeBrowser(page);
}
