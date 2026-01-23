import { type Page } from 'playwright';
import { openBrowser, closeBrowser, goTo, input, click, waitUntilUrl } from '@/playwright';
import { setPage } from '@/session';

export let page: Page;

export async function startWebDriver() {
  page = await openBrowser();
  setPage(page);
}

export async function openSauceDemo() {
  await goTo(page, 'https://www.saucedemo.com/');
}

export async function login(user: string, pass: string) {
  await input(page, 'id:user-name', user);
  await input(page, 'id:password', pass);
  await click(page, 'id:login-button');
}

export async function verifyInventoryPage() {
  await waitUntilUrl(page, 'https://www.saucedemo.com/inventory.html');
}

export async function quitWebDriver() {
  await closeBrowser(page);
}
