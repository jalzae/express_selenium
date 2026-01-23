import { type Page } from 'playwright';

export let page: Page | undefined;

export function setPage(p: Page) {
  page = p;
}

export function clearPage() {
  page = undefined;
}
