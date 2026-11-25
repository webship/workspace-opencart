Feature: The storefront: categories, the search and a product
  As a visitor of the shop
  I want to find a product and put it in my cart
  So that I can buy it

  # An example of the opencart-scenarios skill. It passes on a shop built with --install --add-users --sample-data;
  # what a scenario puts in the cart goes when it ends.

  Scenario: A category of the menu lists its products with their prices
    Given I am on the category "Desktops"
    Then the product list should show "Canon EOS 5D"
    And the product "MacBook" of the list should read "$602.00"
    And the product "MacBook" of the list should read "Ex Tax: $500.00"
    And the product "iPhone" of the list should not read "$602.00"

  Scenario: The search keeps the products whose name holds the words
    When I search the shop for "MacBook"
    Then the product list should show "MacBook", "MacBook Air", "MacBook Pro" in this order
    And the product list should not show "Canon EOS 5D"

  Scenario: A product page shows its details, and asks for its required option
    Given I am on the product "Canon EOS 5D"
    Then the product page should show "Brand" as "Canon"
    And the product page should show "Availability" as "In Stock"
    When I add the product to the cart
    Then the option "Select" should say "Select required!"
    And the cart button should read "0 item(s) - $0.00"
    When I choose "Red" for the option "Select"
    And I add the product to the cart with a quantity of 2
    Then the shop should say "Success: You have added Canon EOS 5D to your shopping cart!"
    And the cart button should read "2 item(s) - $242.00"

  Scenario: A product with no option goes to the cart from its list
    Given I am on the category "Desktops"
    When I add "iPhone" to the cart from the list
    Then the shop should say "Success: You have added iPhone to your shopping cart!"
    And the cart button should read "1 item(s) - $123.20"

  Scenario: The cart lists the products with their options, and counts a new quantity
    Given I am on the product "Canon EOS 5D"
    When I choose "Red" for the option "Select"
    And I add the product to the cart
    And I go to the product "iPhone"
    And I add the product to the cart with a quantity of 2
    When I go to the cart
    Then the cart should list "Canon EOS 5D" with "Select: Red"
    And the cart should list "iPhone"
    And the cart should show "Sub-Total" as "$302.00"
    When I change the quantity of "Canon EOS 5D" in the cart to 2
    Then the shop should say "Success: You have modified your shopping cart!"
    And the cart should show "Sub-Total" as "$402.00"
    And the cart should show "Total" as "$486.40"

  Scenario: A coupon of the shop takes its share off, and an unknown one is refused
    Given I am on the product "iPhone"
    When I add the product to the cart with a quantity of 2
    And I go to the cart
    And I apply the coupon "NO-SUCH-CODE"
    Then the shop should say "Warning: Coupon is either invalid, expired or reached its usage limit!"
    And the cart should not show "Coupon (WEBSHIP10)"
    When I apply the coupon "WEBSHIP10"
    Then the shop should say "Success: Your coupon discount has been applied!"
    And the cart should show "Coupon (WEBSHIP10)" as "$-20.20"

  Scenario: Products removed one by one leave the cart empty
    Given I am on the product "iPhone"
    When I add the product to the cart
    And I go to the product "MacBook"
    And I add the product to the cart
    And I go to the cart
    When I remove "iPhone" from the cart
    Then the cart should not list "iPhone"
    And the cart should list "MacBook"
    When I remove "MacBook" from the cart
    Then the cart should be empty
