Feature: The administration: the login, the dashboard, the catalog, the customers, the coupons
  As the shop's staff
  I want to look after the catalog and see the customers
  So that the shop sells what it has

  # An example of the opencart-scenarios skill. It passes on a shop built with --install --add-users --sample-data;
  # a product, a category or a coupon a scenario starts is deleted when it ends.

  Scenario: The administrator opens the dashboard
    Given I am logged in to the administration as "admin"
    Then I should be logged in to the administration as "Administrator Test"
    And the dashboard should show "Total Orders" as "0"
    And the dashboard should show "Total Customers" as "1"

  Scenario: A product made, its errors first, then deleted
    Given there is no product "Webship test product"
    And I am logged in to the administration as "admin"
    When I go to "Products" in the administration
    Then the administration list should show "Canon EOS 5D" with "Product 3"
    When I start a new product "Webship test product"
    And I save the form
    Then the shop should say "Warning: Please check the form carefully for errors!"
    And the field "Model" should say "Product Model must be greater than 1 and less than 64 characters!"
    When I set "Model" to "WT-1" in the "Data" tab
    And I set "Price" to "12.50" in the "Data" tab
    And I save the form
    Then the shop should say "Success: You have modified products!"
    When I go to "Products" in the administration
    Then the administration list should show "Webship test product" with "WT-1"
    When I delete the product "Webship test product" in the administration
    Then the shop should say "Success: You have modified products!"
    And the administration list should not show "Webship test product"

  Scenario: A category and a coupon made
    Given there is no category "Webship test category"
    And there is no coupon "Webship test coupon"
    And I am logged in to the administration as "admin"
    When I start a new category "Webship test category"
    And I save the form
    Then the shop should say "Success: You have modified categories!"
    When I start a new coupon "Webship test coupon"
    And I set "Code" to "WTEST"
    And I set "Discount" to "5"
    And I save the form
    Then the shop should say "Success: You have modified coupons!"
    When I go to "Coupons" in the administration
    Then the administration list should show "Webship test coupon" with "WTEST"
    And the administration list should show "Webship Ten" with "WEBSHIP10"

  Scenario: The customers, read only
    Given I am logged in to the administration as "admin"
    When I go to "Customers" in the administration
    Then the administration list should show "customer@example.com" with "Customer Test"

  Scenario: The catalog editor sees the catalog only
    Given I am logged in to the administration as "editor"
    Then I should be logged in to the administration as "Editor Test"
    And the administration menu should offer "Products"
    And the administration menu should offer "Categories"
    And the administration menu should not offer "Orders"
    And the administration menu should not offer "Customers"

  Scenario: An address added to the address book, then deleted
    Given I am logged in to the shop as "customer"
    When I open "Address Book" in my account
    Then my address book should list "1 Webship Street" as the default
    When I add the address:
      | First Name      | Customer           |
      | Last Name       | Test               |
      | Address 1       | 3 Webship Lane     |
      | City            | Manchester         |
      | Post Code       | M1 1AE             |
      | Country         | United Kingdom     |
      | Region / State  | Greater Manchester |
      | Default Address | No                 |
    Then the shop should say "Your address has been successfully added"
    And my address book should list "3 Webship Lane"
    And my address book should list "1 Webship Street" as the default
    When I delete the address "3 Webship Lane"
    Then the shop should say "Your address has been successfully deleted"
    And my address book should not list "3 Webship Lane"

  Scenario: A product kept in the wish list, then taken out
    Given I am logged in to the shop as "customer"
    When I go to the product "iPhone"
    And I add the product to my wish list
    Then the shop should say "Success: You have added iPhone to your wish list!"
    When I open "Wish List" in my account
    Then my wish list should list "iPhone"
    When I remove "iPhone" from my wish list
    Then my wish list should not list "iPhone"

  Scenario: The order history of a customer who has not ordered yet
    Given I am logged in to the shop as "customer"
    When I open "Order History" in my account
    Then my order history should be empty
