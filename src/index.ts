/**
 * OpenCart for Webship Workspace: a platform plugin.
 *
 * What the package carries is placed by the installer from the manifest: the builder and the shop's tool in the
 * sites folders, their functions and argparse under core/scripts/plugins/opencart/, the shop's first feature and the
 * script that writes the accounts' places and the sample data beside them, and its AI items (ai/ in this package) in
 * the folder of their kind: the agents in AI Agents, the skill in AI Skills, the command in AI Commands, the prompts
 * in AI Prompts. The dashboard needs nothing drawn for it: the builder is in the Build list because it is a
 * cmd-*-project.sh, the row menus are the core's, the AI items are listed like any other. What register() adds is
 * what the assistant is told.
 *
 * Everything the dashboard is asked for goes through `api`; this package requires nothing from the dashboard's own
 * files, so it can be installed from npm and removed without a trace.
 */

import type { PluginApi } from '@webship.co/workspace-plugin-api';

/**
 * The plugin's name: the folder of its scripts and the name its functions carry. A shop is a php project of the
 * container tool: the plugin claims it with .ddev/config.opencart.yaml (or the x-webship block on another runtime),
 * and the core's tools call its functions under opencart.
 */
export const PLATFORM = 'opencart';

/** The commands the installer places in every sites folder. */
export const COMMANDS = ['cmd-opencart-project.sh', 'cmd-tools-opencart-cli.sh'];

/** The agents the installer places in the AI Agents folder. */
export const AGENTS = ['opencart-site-builder', 'opencart-tester'];

/** The skill the installer places in the AI Skills folder (a folder each, with its SKILL.md). */
export const SKILLS = ['opencart-scenarios'];

/** The slash command the installer places in the AI Commands folder. */
export const AI_COMMANDS = ['opencart-test'];

/** The prompts the installer places in the AI Prompts folder: each a whole launch command for a new session. */
export const PROMPTS = ['opencart-build-and-test', 'opencart-checkout-round'];

/** What the assistant is told about OpenCart in this workspace. */
export function assistantContext(): string {
  return [
    'OpenCart (a plugin, @webship.co/workspace-opencart): a shop is built with',
    '`bash cmd-opencart-project.sh <name> --install --add-users --sample-data` from a sites folder (dev, test, sandboxes, demos):',
    'the latest OpenCart 4 from its releases, installed with its own command-line installer and its demo catalog, the workspace account as its administrator,',
    'in a container like every other project: on DDEV by default, at https://<name>.ddev.site/ (the administration at /admin/), or with `--runtime docker|podman|kubernetes|lando|docksal` on that runtime, at the address the build prints;',
    '`--add-users` adds the default accounts (administrator; editor, a catalog editor; the customer customer@example.com with an address),',
    '`--sample-data` the payment by bank transfer beside cash on delivery and the coupon WEBSHIP10 the step pack\'s features name.',
    '`bash cmd-tools-opencart-cli.sh <name>` says what the shop holds; with `--run "<command>"` it runs a command in the shop\'s web root (`--run "php -m"`), and with `--add-users`, `--cancel-users`, `--sample-data` or `--tidy` it changes it.',
    '`bash cmd-tools-testing.sh <name>` sets up webship-js with the OpenCart step pack; `--run` runs the suite.',
    `For OpenCart work, hand over to the agents ${AGENTS.map((a) => `\`${a}\``).join(' and ')}.`,
    `The plugin also places the skill ${SKILLS.map((a) => `\`${a}\``).join(', ')} (the step pack's phrases, by area) in ai-skills/,`,
    `the command ${AI_COMMANDS.map((a) => `\`/${a} <site>\``).join(', ')} in ai-commands/ and the prompts ${PROMPTS.map((a) => `\`${a}\``).join(' and ')} in ai-prompts/.`,
    'Never run php or composer on the host for a project; never install an extension of the marketplace or connect the shop to an account anywhere.',
  ].join(' ');
}

export function register(api: PluginApi): void {
  api.addAssistantContext(assistantContext);
}
