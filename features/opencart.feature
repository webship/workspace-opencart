Feature: The OpenCart plugin on the dashboard
  Once the plugin is activated and installed, the sites folders offer the OpenCart builder, each AI folder lists the
  items of its kind the plugin ships, and the Settings page lists the plugin with its own page.

  # Settings lists every plugin that was added; the package and what the plugin ships are on its own page.
  Scenario: Settings lists the plugin, and its own page names its package and what it ships
    Given I am on "/settings"
     Then I should see "OpenCart"
     When I go to "/settings/plugin/opencart"
     Then I should see "@webship.co/workspace-opencart"
      And I should see "cmd-opencart-project.sh"
      And I should see "cmd-tools-opencart-cli.sh"
      And I should see "opencart-site-builder"

  Scenario: A sites folder offers the OpenCart builder
    Given I am on "/dev"
     Then "option[value='cmd-opencart-project.sh']" should be attached

  # The AI folders are searched by name: with every plugin on, a folder lists more than one page of items.
  Scenario: The AI Agents folder lists the agents the plugin ships
    Given I am on "/ai-agents?q=opencart-"
     Then I should see "opencart-site-builder"
      And I should see "opencart-tester"

  Scenario: The AI Skills folder lists the skill the plugin ships
    Given I am on "/ai-skills?q=opencart-scenarios"
     Then I should see "opencart-scenarios"

  Scenario: The AI Commands folder lists the command the plugin ships
    Given I am on "/ai-commands?q=opencart-test"
     Then I should see "opencart-test"

  Scenario: The AI Prompts folder lists the prompts the plugin ships
    Given I am on "/ai-prompts?q=opencart-"
     Then I should see "opencart-build-and-test"
      And I should see "opencart-checkout-round"
