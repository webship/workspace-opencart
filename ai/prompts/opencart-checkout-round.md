Write and run the webship-js scenario of a round of an order on an OpenCart shop: the cart, the checkout, the order in the administration.

The launch command below is for Claude Code, the default; the text between the triple quotes can be given to another AI CLI as it is.

```
claude --permission-mode bypassPermissions """
Write the scenario of a round of an order on the shop of this site, and run it
# ~/workspace/<folder>/<site> · https://<site>.ddev.site/ · container-based (DDEV by default)
# the phrases are in the opencart-scenarios skill; the opencart-tester agent is the one to hand this work over to
# look at the shop first: in the Playwright MCP browser, in a tab of your own, do the round by hand once before writing its scenario
# a feature to write or a run to read: the book Automated Functional Testing Recipes first (its README.md, then the matching chapter), from .claude/automated-functional-testing-recipes/ in the project, ~/.claude/automated-functional-testing-recipes/ or https://github.com/webship/webship-js-ai-agent/tree/2.0.x/automated-functional-testing-recipes

The round: <a guest|the customer> puts <a product> in the cart, <applies the coupon WEBSHIP10|uses no coupon>,
checks out with <Flat Shipping Rate> and <Cash On Delivery|Bank Transfer>, the order is placed,
and the administration opens it and moves it to <Processing|Shipped>.

Read the installed steps first:
grep -hE '^(Given|When|Then)\(' node_modules/@webship-js/opencart-steps/tests/step-definitions/*.steps.js

Write one feature in tests/features/<name>.feature, from phrases that exist.
Log in by the handle of the users registry (admin, editor, customer):
no password in the feature, no account created by a scenario, no platform name in a step phrase.
The steps put back what they change when the scenario ends: the order is voided (its stock and the statistics come back) and deleted, the cart emptied.

Then, from the sites folder (cd ..):
bash cmd-tools-testing.sh <site> --dry-run --path tests/features/<name>.feature
bash cmd-tools-testing.sh <site> --run --path tests/features/<name>.feature

A failing scenario is a result: tell me what the shop did, do not loosen the scenario.
When you are done: the scenario, the result of the run, and any step you could not find in the pack
"""
```
