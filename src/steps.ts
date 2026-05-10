import { Given, When, Then } from '@cucumber/cucumber';
import { Page } from 'playwright';
import { setPage, clearPage } from '@/session';
import * as pw from '@/playwright';

// ============================================================================
// STATE
// ============================================================================

let page: Page | null = null;

// ============================================================================
// NAVIGATION STEPS
// ============================================================================

Given('I navigate to {string}', async function (url: string) {
  page = await pw.openBrowser();
  setPage(page);
  await pw.goTo(page, url);
});

When('I go to {string}', async function (url: string) {
  if (!page) page = await pw.openBrowser();
  await pw.goTo(page, url);
});

// ============================================================================
// INPUT STEPS
// ============================================================================

When('I enter {string} into input field having id {string}', async function (value: string, id: string) {
  if (!page) throw new Error('Browser not initialized. Call "I navigate to" first.');
  await pw.input(page, `id:${id}`, value);
});

When('I enter {string} into input field having name {string}', async function (value: string, name: string) {
  if (!page) throw new Error('Browser not initialized. Call "I navigate to" first.');
  await pw.input(page, `name:${name}`, value);
});

When('I enter {string} into input field having css selector {string}', async function (value: string, selector: string) {
  if (!page) throw new Error('Browser not initialized. Call "I navigate to" first.');
  await pw.input(page, `css:${selector}`, value);
});

When('I enter {string} into input field having xpath {string}', async function (value: string, xpath: string) {
  if (!page) throw new Error('Browser not initialized. Call "I navigate to" first.');
  const sel = `xpath=${xpath}`;
  await page.waitForSelector(sel, { state: 'visible' });
  await page.fill(sel, value);
});

When('I clear input field having id {string}', async function (id: string) {
  if (!page) throw new Error('Browser not initialized. Call "I navigate to" first.');
  await pw.clearInput(page, `id:${id}`);
});

When('I type {string} into input field having id {string}', async function (value: string, id: string) {
  if (!page) throw new Error('Browser not initialized. Call "I navigate to" first.');
  await pw.sendInput(page, `id:${id}`, value);
});

// ============================================================================
// CLICK/INTERACTION STEPS
// ============================================================================

When('I click on element having id {string}', async function (id: string) {
  if (!page) throw new Error('Browser not initialized. Call "I navigate to" first.');
  await pw.click(page, `id:${id}`);
});

When('I click on element having css selector {string}', async function (selector: string) {
  if (!page) throw new Error('Browser not initialized. Call "I navigate to" first.');
  await pw.click(page, `css:${selector}`);
});

When('I click on element having xpath {string}', async function (xpath: string) {
  if (!page) throw new Error('Browser not initialized. Call "I navigate to" first.');
  const sel = `xpath=${xpath}`;
  await page.waitForSelector(sel, { state: 'visible' });
  await page.click(sel);
});

When('I click on element having name {string}', async function (name: string) {
  if (!page) throw new Error('Browser not initialized. Call "I navigate to" first.');
  await pw.click(page, `name:${name}`);
});

When('I double click on element having id {string}', async function (id: string) {
  if (!page) throw new Error('Browser not initialized. Call "I navigate to" first.');
  await pw.doubleClick(page, `id:${id}`);
});

When('I right click on element having id {string}', async function (id: string) {
  if (!page) throw new Error('Browser not initialized. Call "I navigate to" first.');
  await pw.rightClick(page, `id:${id}`);
});

When('I hover over element having id {string}', async function (id: string) {
  if (!page) throw new Error('Browser not initialized. Call "I navigate to" first.');
  await pw.hover(page, `id:${id}`);
});

When('I submit the form having id {string}', async function (id: string) {
  if (!page) throw new Error('Browser not initialized. Call "I navigate to" first.');
  await pw.submitInput(page, `id:${id}`);
});

// ============================================================================
// CHECKBOX/RADIO/DROPDOWN STEPS
// ============================================================================

When('I check checkbox having id {string}', async function (id: string) {
  if (!page) throw new Error('Browser not initialized. Call "I navigate to" first.');
  await pw.check(page, `id:${id}`);
});

When('I uncheck checkbox having id {string}', async function (id: string) {
  if (!page) throw new Error('Browser not initialized. Call "I navigate to" first.');
  await pw.uncheck(page, `id:${id}`);
});

When('I select {string} from dropdown having id {string}', async function (value: string, id: string) {
  if (!page) throw new Error('Browser not initialized. Call "I navigate to" first.');
  await pw.selectOption(page, `id:${id}`, value);
});

// ============================================================================
// ASSERTION/VERIFICATION STEPS
// ============================================================================

Then('I should see {string} text on page', async function (expectedText: string) {
  if (!page) throw new Error('Browser not initialized.');
  const pageText = await pw.getPageText(page);
  if (!pageText.includes(expectedText)) {
    throw new Error(`Expected text "${expectedText}" not found on page`);
  }
});

Then('I should see {string} text in element having id {string}', async function (expectedText: string, id: string) {
  if (!page) throw new Error('Browser not initialized.');
  const actualText = await pw.getText(page, `id:${id}`);
  if (!actualText.includes(expectedText)) {
    throw new Error(`Expected text "${expectedText}" not found in element. Got: "${actualText}"`);
  }
});

Then('I should see {string} text in element having css selector {string}', async function (expectedText: string, selector: string) {
  if (!page) throw new Error('Browser not initialized.');
  const actualText = await pw.getText(page, `css:${selector}`);
  if (!actualText.includes(expectedText)) {
    throw new Error(`Expected text "${expectedText}" not found in element. Got: "${actualText}"`);
  }
});

Then('I should not see {string} text on page', async function (unexpectedText: string) {
  if (!page) throw new Error('Browser not initialized.');
  const pageText = await pw.getPageText(page);
  if (pageText.includes(unexpectedText)) {
    throw new Error(`Unexpected text "${unexpectedText}" found on page`);
  }
});

Then('element having id {string} should be visible', async function (id: string) {
  if (!page) throw new Error('Browser not initialized.');
  const visible = await pw.isVisible(page, `id:${id}`);
  if (!visible) {
    throw new Error(`Element with id "${id}" is not visible`);
  }
});

Then('element having id {string} should not be visible', async function (id: string) {
  if (!page) throw new Error('Browser not initialized.');
  const visible = await pw.isVisible(page, `id:${id}`);
  if (visible) {
    throw new Error(`Element with id "${id}" is visible but should not be`);
  }
});

Then('element having id {string} should be enabled', async function (id: string) {
  if (!page) throw new Error('Browser not initialized.');
  const enabled = await pw.isEnabled(page, `id:${id}`);
  if (!enabled) {
    throw new Error(`Element with id "${id}" is not enabled`);
  }
});

Then('element having id {string} should be disabled', async function (id: string) {
  if (!page) throw new Error('Browser not initialized.');
  const enabled = await pw.isEnabled(page, `id:${id}`);
  if (enabled) {
    throw new Error(`Element with id "${id}" is enabled but should be disabled`);
  }
});

Then('checkbox having id {string} should be checked', async function (id: string) {
  if (!page) throw new Error('Browser not initialized.');
  const checked = await pw.isChecked(page, `id:${id}`);
  if (!checked) {
    throw new Error(`Checkbox with id "${id}" is not checked`);
  }
});

Then('the title should be {string}', async function (expectedTitle: string) {
  if (!page) throw new Error('Browser not initialized.');
  const actualTitle = await pw.getTitle(page);
  if (actualTitle !== expectedTitle) {
    throw new Error(`Expected title "${expectedTitle}" but got "${actualTitle}"`);
  }
});

Then('the URL should be {string}', async function (expectedUrl: string) {
  if (!page) throw new Error('Browser not initialized.');
  const actualUrl = await pw.getUrl(page);
  if (actualUrl !== expectedUrl) {
    throw new Error(`Expected URL "${expectedUrl}" but got "${actualUrl}"`);
  }
});

Then('the URL should contain {string}', async function (expectedFragment: string) {
  if (!page) throw new Error('Browser not initialized.');
  const actualUrl = await pw.getUrl(page);
  if (!actualUrl.includes(expectedFragment)) {
    throw new Error(`URL "${actualUrl}" does not contain "${expectedFragment}"`);
  }
});

// ============================================================================
// WAIT STEPS
// ============================================================================

When('I wait {int} milliseconds', async function (ms: number) {
  await pw.wait(ms);
});

When('I wait for element having id {string} to be visible', async function (id: string) {
  if (!page) throw new Error('Browser not initialized.');
  await pw.waitUntilVisible(page, `id:${id}`);
});

When('I wait for element having id {string} to be hidden', async function (id: string) {
  if (!page) throw new Error('Browser not initialized.');
  await pw.waitUntilHidden(page, `id:${id}`);
});

// ============================================================================
// SCREENSHOT STEPS
// ============================================================================

When('I take a screenshot', async function () {
  if (!page) throw new Error('Browser not initialized.');
  await pw.takeShoot(page);
});

// ============================================================================
// ATTRIBUTE/PROPERTY STEPS
// ============================================================================

Then('element having id {string} should have attribute {string} with value {string}', async function (id: string, attr: string, value: string) {
  if (!page) throw new Error('Browser not initialized.');
  const actualValue = await pw.getAttribute(page, `id:${id}`, attr);
  if (actualValue !== value) {
    throw new Error(`Expected attribute "${attr}" to be "${value}" but got "${actualValue}"`);
  }
});

Then('the value of input having id {string} should be {string}', async function (id: string, expectedValue: string) {
  if (!page) throw new Error('Browser not initialized.');
  const actualValue = await pw.getInputValue(page, `id:${id}`);
  if (actualValue !== expectedValue) {
    throw new Error(`Expected input value "${expectedValue}" but got "${actualValue}"`);
  }
});

// ============================================================================
// SCROLL STEPS
// ============================================================================

When('I scroll to element having id {string}', async function (id: string) {
  if (!page) throw new Error('Browser not initialized.');
  await pw.scrollToElement(page, `id:${id}`);
});

When('I scroll down {int} pixels', async function (pixels: number) {
  if (!page) throw new Error('Browser not initialized.');
  await pw.scrollBy(page, 0, pixels);
});

When('I scroll up {int} pixels', async function (pixels: number) {
  if (!page) throw new Error('Browser not initialized.');
  await pw.scrollBy(page, 0, -pixels);
});

// ============================================================================
// JAVASCRIPT EXECUTION STEPS
// ============================================================================

When('I execute script {string}', async function (script: string) {
  if (!page) throw new Error('Browser not initialized.');
  await page.evaluate(script);
});

Then('there should be {int} elements with css selector {string}', async function (count: number, selector: string) {
  if (!page) throw new Error('Browser not initialized.');
  const actualCount = await pw.getElementCount(page, `css:${selector}`);
  if (actualCount !== count) {
    throw new Error(`Expected ${count} elements but found ${actualCount}`);
  }
});
