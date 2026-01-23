Feature: Saucedemo Login

  Scenario Outline: Open Saucedemo and login
    Given I have opened Saucedemo
    When I login with "<username>" and "<password>"
    Then I see the inventory page

    Examples:
      | username      | password     |
      | standard_user | secret_sauce |
