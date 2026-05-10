Feature: User Login on Sauce Demo Shopify
  As a registered user
  I want to log into the Sauce Demo website
  So that I can access my account and shop products

  Background:
    Given I navigate to "https://sauce-demo.myshopify.com/account/login"

  Scenario: Successful login with valid credentials
    When I enter "test@example.com" into input field having id "CustomerEmail"
    And I enter "TestPassword123!" into input field having id "CustomerPassword"
    And I click on element having css selector "button[type='submit']"
    And I wait for element having id "customer_logout_link" to be visible
    Then the URL should contain "/account"
    And element having id "customer_logout_link" should be visible

  Scenario: Failed login with invalid credentials
    When I enter "wrong@example.com" into input field having id "CustomerEmail"
    And I enter "WrongPassword123!" into input field having id "CustomerPassword"
    And I click on element having css selector "button[type='submit']"
    And I wait 2000 milliseconds
    Then I should see "incorrect" or "invalid" text on page
    And the URL should contain "/account/login"

  Scenario: Reset password from login page
    When I click on element having css selector "a[href*='/account/recover']"
    And I wait for element having id "RecoverEmail" to be visible
    And I enter "test@example.com" into input field having id "RecoverEmail"
    And I click on element having css selector "button[type='submit']"
    And I wait 2000 milliseconds
    Then I should see "email" or "sent" text on page

  Scenario: Login with empty fields
    When I clear input field having id "CustomerEmail"
    And I clear input field having id "CustomerPassword"
    And I click on element having css selector "button[type='submit']"
    And I wait 1000 milliseconds
    Then element having css selector ".form-message--error" should be visible

  Scenario: Navigate to account registration
    When I click on element having css selector "a[href='/account/register']"
    And I wait for element having id "FirstName" to be visible
    Then the URL should be "https://sauce-demo.myshopify.com/account/register"
    And element having id "FirstName" should be visible
