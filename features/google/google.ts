import assert from "assert";
import { startWebDriver, openGoogle, searchKeyword, getTitle } from '~/repository/google'
import { Given, When, Then } from "@cucumber/cucumber";


Given('I have opened Google', async () => {
	await startWebDriver();
	await openGoogle();
});

When('I search for {string}', async (searchTerm: string) => {
	await searchKeyword(searchTerm);
});

Then('Title is include with {string}', async (expectedTerm: string) => {
	const result = await getTitle(expectedTerm);
	assert(
		result.includes(expectedTerm),
		`Expected title to include "${expectedTerm}", but it was "${result}".`
	);
});

