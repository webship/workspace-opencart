Feature: The shop answers, and its accounts are in it
  As the owner of the shop
  I want the storefront, the cart and each default account to work
  So that a build that came out broken is caught before anything else is tested

  # Placed by the workspace's testing setup as a starting point: it is yours to change.
  # The accounts are the default ones (cmd-tools-opencart-cli.sh --add-users); a scenario logs in by a handle of the
  # users registry in cucumber.js, so no password is written here. It passes on a shop built with --install
  # --add-users, with or without --sample-data. What a scenario puts in the cart goes when it ends.

  @critical
  Scenario: A visitor finds a product and puts it in the cart
    When I search the shop for "MacBook"
    Then the product list should show "MacBook Air"
    When I go to the product "iPhone"
    And I add the product to the cart
    Then the shop should say "Success: You have added iPhone to your shopping cart!"
    And the cart button should read "1 item(s)"

  Scenario: The customer logs in and finds its address
    Given I am logged in to the shop as "customer"
    When I open "Address Book" in my account
    Then my address book should list "1 Webship Street" as the default

  Scenario: The administrator opens the dashboard and the products
    Given I am logged in to the administration as "admin"
    Then I should be logged in to the administration as "Administrator Test"
    When I go to "Products" in the administration
    Then the administration list should show "Canon EOS 5D"

  Scenario: The catalog editor is offered the catalog only
    Given I am logged in to the administration as "editor"
    Then the administration menu should offer "Products"
    And the administration menu should not offer "Orders"
