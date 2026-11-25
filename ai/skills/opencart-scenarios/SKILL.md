---
name: opencart-scenarios
description: Write and run webship-js scenarios for an OpenCart shop of the Webship Workspace with the OpenCart step pack (`@webship-js/opencart-steps`) — the phrases by area (the storefront and a product with options, the cart and a coupon, the checkout as a guest and as the customer, the customer's account, the administration's catalog, orders and customers), the accounts by handle, the traps found on a real shop, and three example features. Use when asked to "write a scenario for the shop", "test the checkout of <site>", or "which step checks the cart's total".
argument-hint: '<site> [what to cover]'
---

# opencart-scenarios

Scenarios for an OpenCart shop of a Webship Workspace (`~/workspace`, container-based, DDEV by default), written from
the steps of [`@webship-js/opencart-steps`](https://github.com/webship/opencart-steps) and of
[webship-js](https://github.com/webship/webship-js) itself, and run in the shop's container by the workspace's own
command. It comes with the OpenCart plugin (`@webship.co/workspace-opencart`), like the builder
(`cmd-opencart-project.sh`), the shop's tool (`cmd-tools-opencart-cli.sh`) and the agents `opencart-site-builder` and
`opencart-tester`.

## Where everything is

| What | Where |
| --- | --- |
| The shop | `~/workspace/<folder>/<site>`, at `https://<site>.ddev.site/`, its administration at `/admin/` (`<folder>` is a sites folder: `dev`, `test`, `sandboxes`, `demos`) |
| The suite's configuration | `<site>/cucumber.js`: the step definitions it loads, the shop's settings (`worldParameters.shop`), the users registry (`worldParameters.users`) |
| The features | `<site>/tests/features/*.feature` (`shop.feature` is the first one the setup wrote) |
| The shop's steps | `<site>/node_modules/@webship-js/opencart-steps/tests/step-definitions/*.steps.js` |
| webship-js's steps | `<site>/node_modules/webship-js/tests/step-definitions/*.js` |
| The reports | `<site>/tests/reports/` |

## The order of work

1. **Make sure the testing stack is there.** From the sites folder:
   ```bash
   cd ~/workspace/<folder>
   bash cmd-tools-testing.sh <site>
   ```
   It adds webship-js, the step pack, the shop's settings, the users registry with the handles of the shop's
   accounts and `tests/features/shop.feature`, and makes sure the default accounts are in the shop. It is safe to
   run again: it adds what is missing and keeps what was changed.
2. **Read the installed steps before writing a phrase.** They are the source of truth: the pack moves, and a phrase
   from memory is a guess.
   ```bash
   cd ~/workspace/<folder>/<site>
   grep -hE "^(Given|When|Then)\(" node_modules/@webship-js/opencart-steps/tests/step-definitions/*.steps.js
   ```
   Every step carries a comment block with five examples above it; open the file when a phrase is not obvious.
3. **Look at the page first** (the Playwright MCP browser, a tab of your own) when the scenario is about a page you
   have not seen.
4. **Write the feature** in `<site>/tests/features/`, from phrases that exist (the lists below).
5. **Match every step without a browser**, then run the feature, then the suite:
   ```bash
   cd ~/workspace/<folder>
   bash cmd-tools-testing.sh <site> --dry-run --path tests/features/<name>.feature
   bash cmd-tools-testing.sh <site> --run --path tests/features/<name>.feature
   bash cmd-tools-testing.sh <site> --run --tags "@critical"
   bash cmd-tools-testing.sh <site> --run
   ```
   A dry run says `Undefined` for a phrase no definition matches: fix the phrase, do not write a step for it.

## Accounts: a handle, never a password

```gherkin
Feature: Accounts
  Scenario: The customer finds its address
    Given I am logged in to the shop as "customer"
    When I open "Address Book" in my account
    Then my address book should list "1 Webship Street" as the default
```

The handles of the default accounts: `admin` (the administration's `administrator`), `editor` (the catalog editor)
and `customer` (`customer@example.com` on the storefront). A visitor is a scenario that logs in as nobody. Never
create an account in a scenario, and never log in as the workspace account.

## The phrases, by area

The storefront:

```gherkin
When I go to the category "Desktops"
When I search the shop for "MacBook"
Then the product list should show "MacBook Air"
Then the product list should show "MacBook", "MacBook Air", "MacBook Pro" in this order
Then the product "MacBook" of the list should read "Ex Tax: $500.00"
When I go to the product "Canon EOS 5D"
Then the product page should show "Brand" as "Canon"
When I choose "Red" for the option "Select"
When I add the product to the cart with a quantity of 2
When I add "iPhone" to the cart from the list
When I add the product to my wish list
Then the option "Select" should say "Select required!"
Then the shop should say "Success: You have added Canon EOS 5D to your shopping cart!"
Then the cart button should read "1 item(s) - $123.20"
```

The cart:

```gherkin
When I go to the cart
Then the cart should list "Canon EOS 5D" with "Select: Red"
When I change the quantity of "Canon EOS 5D" in the cart to 2
Then the cart should show "Sub-Total" as "$402.00"
When I apply the coupon "WEBSHIP10"
Then the cart should show "Coupon (WEBSHIP10)" as "$-20.20"
When I remove "iPhone" from the cart
Then the cart should be empty
```

The checkout:

```gherkin
When I go to the checkout
When I ship to my address "1 Webship Street"
When I choose the shipping method "Flat Shipping Rate"
When I choose the payment method "Cash On Delivery"
Then the order summary should show "Total" as "$131.20"
Then the checkout field "E-Mail" should say "E-Mail Address does not appear to be valid!"
When I confirm the order
Then the order should be placed
```

A guest's checkout takes a table (`When I check out as a guest with:`, its rows First Name, Last Name, E-Mail,
Address 1, City, Post Code, Country, Region / State): see `examples/checkout-and-orders.feature`.

The customer's account:

```gherkin
When I open "Address Book" in my account
Then my address book should list "1 Webship Street" as the default
When I delete the address "3 Webship Lane"
Then my order history should list my order as "Pending"
Then my order history should be empty
Then my wish list should list "iPhone"
When I remove "iPhone" from my wish list
```

An address is added with a table (`When I add the address:`): see `examples/administration-and-account.feature`.

The administration:

```gherkin
Given I am logged in to the administration as "admin"
Then I should be logged in to the administration as "Administrator Test"
Then the dashboard should show "Total Customers" as "1"
When I go to "Products" in the administration
Then the administration menu should not offer "Orders"
Then the administration list should show "Canon EOS 5D" with "Product 3"
Given there is no product "Webship test product"
When I start a new product "Webship test product"
When I set "Model" to "WT-1" in the "Data" tab
When I save the form
Then the field "Model" should say "Product Model must be greater than 1 and less than 64 characters!"
When I delete the product "Webship test product" in the administration
When I open the order I placed in the administration
Then the order status should be "Pending"
When I change the order status to "Processing"
Then the order history should list "Processing"
```

## Three example features

`examples/` beside this file holds three features that pass on a fresh shop built with `--install --add-users
--sample-data`; copy one into `<site>/tests/features/` to start from it:

- `examples/storefront-and-cart.feature`: a category and its prices, the search, a product's required option, the
  cart button, the cart's products, a quantity and the totals, a coupon refused and one applied, products removed.
- `examples/checkout-and-orders.feature`: a guest's address refused for its e-mail, a guest's order paid on delivery,
  the customer's order to its own address paid by bank transfer and its history, an order opened in the
  administration and its status changed.
- `examples/administration-and-account.feature`: the dashboard, a product made (its errors first) and deleted, a
  category and a coupon made, the customers read, the catalog editor's menu, an address added and deleted, a product
  kept in the wish list, an empty order history.

## Traps found on a real shop

- **The tokens.** Every page of the customer's account carries a `customer_token`, every screen of the administration
  a `user_token`: the steps follow the shop's own links (the menu, "My Account"); an address written in a feature
  without the token sends the browser to the login.
- **The forms answer by Ajax.** "Add to Cart", the cart's quantities and coupon, the checkout's steps and the saves of
  the administration answer with an alert ("Success: …", "Warning: …") and reload a part of the page: the steps wait
  for the answer, never for a fixed time.
- **The checkout needs an address first.** Its shipping methods load once a guest's address is saved or the customer
  chose one of its own ("Choose" says "Shipping address required!" otherwise).
- **An order moves the shop's statistics and stock.** The administration's "Delete" leaves both: the steps void an
  order first, as its "Add History" does, then delete it.
- **The demo catalog.** The Apple Cinema 30" asks for a file among its options and its name holds a double quote: use
  the Canon EOS 5D as the product with an option. The MacBook needs no shipping: its checkout has no shipping method.
- **A coupon cannot be taken off the cart** on OpenCart 4.1.0.4: its "Remove" does nothing. A coupon stays in the
  session only.

## The book

For any automated functional testing in this work (a Gherkin feature, a step definition, choosing a
step, a test run and its failures), read the book *Automated Functional Testing Recipes* first.

- **Where.** Use the first that exists: `.claude/automated-functional-testing-recipes/` in the project,
  `~/.claude/automated-functional-testing-recipes/` (installed by webship/webship-js-ai-agent,
  webship/webship-js-skills or webship/ai-agents), or
  https://github.com/webship/webship-js-ai-agent/tree/2.0.x/automated-functional-testing-recipes
- **How.** Its `README.md` first, then the chapter that matches the task (one file per chapter,
  named by its subject), not the single complete file.
- **Which wins.** The installed webship-js package and the step pack are the source of truth for
  step phrasing. When they differ from the book, follow them and say so.
- **For OpenCart.** Start with `ch06-form-testing-recipes.md` (the checkout's address and the administration's
  forms), `ch07-waiting-dynamic-content.md` (the Ajax answers of the cart, the checkout and the saves),
  `ch08-modal-dialog-testing.md` (the checkout's shipping and payment dialogs, the confirmation of a delete) and
  `ch10-authentication-authorization.md` (the customer, the administrator and the catalog editor).
