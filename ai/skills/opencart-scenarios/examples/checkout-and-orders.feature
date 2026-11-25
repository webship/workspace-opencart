Feature: The checkout as a guest and as the customer
  As a buyer
  I want to give my address, choose how my order comes and how I pay
  So that the shop takes my order

  # An example of the opencart-scenarios skill. It passes on a shop built with --install --add-users --sample-data;
  # an order a scenario places is voided and deleted when it ends.

  Scenario: A guest's details are checked before they are saved
    Given I am on the product "iPhone"
    When I add the product to the cart
    And I go to the checkout
    And I check out as a guest with:
      | First Name     | Guest            |
      | Last Name      | Shopper          |
      | E-Mail         | not-an-address   |
      | Address 1      | 2 Webship Street |
      | City           | London           |
      | Post Code      | SW1A 2AA         |
      | Country        | United Kingdom   |
      | Region / State | Greater London   |
    Then the checkout field "E-Mail" should say "E-Mail Address does not appear to be valid!"

  Scenario: A guest orders a product, paid on delivery
    Given I am on the product "iPhone"
    When I add the product to the cart
    And I go to the checkout
    And I check out as a guest with:
      | First Name     | Guest             |
      | Last Name      | Shopper           |
      | E-Mail         | guest@example.com |
      | Address 1      | 2 Webship Street  |
      | City           | London            |
      | Post Code      | SW1A 2AA          |
      | Country        | United Kingdom    |
      | Region / State | Greater London    |
    Then the shop should say "Success: Your guest account information has been saved!"
    When I choose the shipping method "Flat Shipping Rate"
    Then the shop should say "Success: You have changed shipping method!"
    When I choose the payment method "Cash On Delivery"
    Then the shop should say "Success: You have changed payment method!"
    And the order summary should show "Sub-Total" as "$101.00"
    And the order summary should show "Total" as "$131.20"
    When I confirm the order
    Then the order should be placed

  Scenario: The customer orders to its own address, paid by bank transfer, and finds the order in its history
    Given I am logged in to the shop as "customer"
    And I am on the product "iPhone"
    When I add the product to the cart
    And I go to the checkout
    And I ship to my address "1 Webship Street"
    Then the shop should say "Success: You have changed shipping address!"
    When I choose the shipping method "Flat Shipping Rate"
    And I choose the payment method "Bank Transfer"
    And I confirm the order
    Then the order should be placed
    When I open "Order History" in my account
    Then my order history should list my order as "Pending"

  Scenario: A guest's order opened in the administration, its status changed
    Given I am on the product "iPhone"
    When I add the product to the cart
    And I go to the checkout
    And I check out as a guest with:
      | First Name     | Guest             |
      | Last Name      | Buyer             |
      | E-Mail         | buyer@example.com |
      | Address 1      | 4 Webship Road    |
      | City           | London            |
      | Post Code      | SW1A 4AA          |
      | Country        | United Kingdom    |
      | Region / State | Greater London    |
    And I choose the shipping method "Flat Shipping Rate"
    And I choose the payment method "Cash On Delivery"
    And I confirm the order
    Then the order should be placed
    Given I am logged in to the administration as "admin"
    Then the dashboard should show "Total Orders" as "1"
    When I open the order I placed in the administration
    Then the order status should be "Pending"
    And the order history should not list "Processing"
    When I change the order status to "Processing"
    Then the shop should say "Success: You have modified orders!"
    And the order history should list "Processing"
    And the order status should be "Processing"
