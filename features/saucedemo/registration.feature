Feature: User Registration on Sauce Demo Shopify
  As a new user
  I want to create an account
  So that I can access the website features and shop products

  Background:
    Given I navigate to "https://sauce-demo.myshopify.com/account/register"

  Scenario: Successful account registration
    When I enter "John" into input field having id "FirstName"
    And I enter "Doe" into input field having id "LastName"
    And I enter "john.doe.test@example.com" into input field having id "Email"
    And I enter "TestPassword123!" into input field having id "CreatePassword"
    And I click on element having css selector "button[type='submit']"
    And I wait for element having id "customer_logout_link" to be visible
    Then the URL should contain "/account"
    And I should see "Welcome" text on page

  Scenario: Registration with existing email
    When I enter "Jane" into input field having id "FirstName"
    And I enter "Smith" into input field having id "LastName"
    And I enter "existing@example.com" into input field having id "Email"
    And I enter "TestPassword123!" into input field having id "CreatePassword"
    And I click on element having css selector "button[type='submit']"
    And I wait 2000 milliseconds
    Then I should see "already been taken" or "exists" text on page

  Scenario: Registration with empty fields
    When I clear input field having id "FirstName"
    And I clear input field having id "LastName"
    And I clear input field having id "Email"
    And I clear input field having id "CreatePassword"
    And I click on element having css selector "button[type='submit']"
    And I wait 1000 milliseconds
    Then element having css selector ".form-message--error" should be visible

  Scenario: Navigate to login page
    When I click on element having css selector "a[href='/account/login']"
    And I wait for element having id "CustomerEmail" to be visible
    Then the URL should be "https://sauce-demo.myshopify.com/account/login"
    And element having id "CustomerEmail" should be visible

  Scenario: Login with valid credentials
    Given I navigate to "https://sauce-demo.myshopify.com/account/login"
    When I enter "test@example.com" into input field having id "CustomerEmail"
    And I enter "TestPassword123!" into input field having id "CustomerPassword"
    And I click on element having css selector "button[type='submit']"
    And I wait for element having id "customer_logout_link" to be visible
    Then the URL should contain "/account"
    And element having id "customer_logout_link" should be visible

  Scenario: Login with invalid credentials
    Given I navigate to "https://sauce-demo.myshopify.com/account/login"
    When I enter "wrong@example.com" into input field having id "CustomerEmail"
    And I enter "WrongPassword123!" into input field having id "CustomerPassword"
    And I click on element having css selector "button[type='submit']"
    And I wait 2000 milliseconds
    Then I should see "incorrect" or "invalid" text on page
