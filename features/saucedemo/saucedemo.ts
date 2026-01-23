import { startWebDriver, openSauceDemo, login, verifyInventoryPage } from '~/repository/saucedemo';
import { Given, When, Then } from "@cucumber/cucumber";

Given('I have opened Saucedemo', async () => {
    await startWebDriver();
    await openSauceDemo();
});

When('I login with {string} and {string}', async (user: string, pass: string) => {
    await login(user, pass);
});

Then('I see the inventory page', async () => {
    await verifyInventoryPage();
});
