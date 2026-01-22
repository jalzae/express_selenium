// File: src/selenium-functions.ts
import webdriver from 'selenium-webdriver';
const By = webdriver.By;

let driver: webdriver.WebDriver;
export async function startWebDriver() {
  driver = new webdriver.Builder().forBrowser('chrome').build();
}

export async function openGoogle(url: string = 'google.com') {
  await driver.get('https://www.' + url);
}

export async function searchKeyword(keyword: string) {
  const searchBox = await driver.findElement(By.name('q'));
  await searchBox.sendKeys(keyword, webdriver.Key.ENTER);
}

export async function getTitle(expectedTerm: string): Promise<string> {
  try {
    const title = await driver.getTitle();
    console.log('Title:', title);
    return title;
  } catch (error) {
    console.error('Error getting title:', error);
    return '';
  }
}

export async function quitWebDriver() {
  await driver.quit();
}
