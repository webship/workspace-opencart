# @webship.co/workspace-opencart

OpenCart for the [Webship Workspace](https://github.com/webship/workspace) dashboard: a builder that makes a real
shop in a container — the latest OpenCart 4 from the project's releases, installed with its own command-line
installer and its demo catalog — the default accounts (an administrator, a catalog editor and a customer), the
sample data the tests name (the payment by bank transfer beside cash on delivery, the coupon `WEBSHIP10`), the
shop's own tool, the [OpenCart step pack](https://github.com/webship/opencart-steps) wired into the workspace's
testing setup, and its AI items — two agents, a skill, a command and two prompts — each listed in the workspace
folder of its kind.

The workspace is container-based (DDEV by default): a shop is a `php` project like any other, so the row menus the
core draws (start, stop, launch, backup, clone, remove, tests) work on it unchanged. The plugin claims its shops with
a file of its own (`.ddev/config.opencart.yaml`), so the Tests menu of the row offers the shop's test users.

## Use it

```bash
cd ~/workspace
bash core/scripts/plugins.sh --require @webship.co/workspace-opencart --with-needs   # npm install into the dashboard
bash core/scripts/plugins.sh --activate opencart --with-needs                         # plugins.opencart in settings.yml, and what it needs
bash core/scripts/plugins.sh --install opencart                                       # the builder, the tool, functions, args, AI items
bash core/scripts/plugins.sh --configure opencart                                     # nothing to configure: it has no settings file
```

The same four steps are buttons on the dashboard's **Settings → Plugins** page. `--install` is
idempotent. `--uninstall` removes what it placed; an AI item you edited stays.

Everything the plugin carries lands in the folder it belongs to, when that folder is an active
workspace folder:

| What | Lands in |
| --- | --- |
| `cmd-opencart-project.sh`, `cmd-tools-opencart-cli.sh` | every active sites folder: `dev/`, `test/`, `sandboxes/`, `demos/` |
| The first feature of the shop, and the script that writes the accounts and the sample data, a tidy-up, a status and the counts | `core/scripts/plugins/opencart/`, beside its functions |
| The agents `opencart-site-builder`, `opencart-tester` | `ai-agents/` |
| The skill `opencart-scenarios` | `ai-skills/` |
| The command `/opencart-test` | `ai-commands/` |
| The prompts `opencart-build-and-test`, `opencart-checkout-round` | `ai-prompts/` |

There they are listed like any other item of the folder, and installed into Claude Code from there.

## What it needs

A workspace starts empty, so the manifest says what else this plugin needs (`needs`):

- one sites folder, for the builder: `dev`, `test`, `sandboxes`, `demos` (`dev` is the one added when none is there). The folder also carries `cmd-tools-testing.sh` and the Users tools this plugin's hooks answer to.
- `ai-agents`, `ai-skills`, `ai-commands` and `ai-prompts`: the AI folders its agents, its skill, its command and its prompts are placed in.

`--require` says so, `--activate` and `--install` stop until the workspace has them, and `--with-needs` adds what is missing first:

```bash
bash core/scripts/plugins.sh --activate opencart --with-needs   # dev and the four AI folders are required, activated and installed first
bash core/scripts/plugins.sh --install opencart
```

Everything the builder runs for a shop runs in the shop's own container, through the container tool the workspace
already needs: PHP, `curl` and `unzip` are in the web container. The plugin asks for no command of its own on the
machine.

## What the package holds

| Path | What it is |
| --- | --- |
| `commands/cmd-opencart-project.sh` | The builder, in the Build list as **OpenCart (4.x)**, installed into every sites folder |
| `commands/cmd-tools-opencart-cli.sh` | The shop's tool: what the shop holds, a command in its web root, the default accounts, the sample data, a tidy-up |
| `scripts/functions/fun-opencart.sh` | The bash functions behind them, sourced by bootstrap once installed; the names the core's tools look for (`set_opencart_users`, `add_opencart_users`, `cancel_opencart_users`, `testing_configure_opencart`) |
| `scripts/args/arg-opencart.sh`, `arg-opencart-cli.sh` | Their argparse; the Build form draws the builder's flags from the first |
| `scripts/shop-site.php` | The script the functions run in the shop with PHP: the accounts, the sample data, a tidy-up, a status and the counts, each through OpenCart's own models (the step pack's own script) |
| `testing/shop.feature` | The first feature a shop gets when testing is set up |
| `ai/agents/opencart-site-builder.md` | The agent that builds and maintains shops with these commands |
| `ai/agents/opencart-tester.md` | The agent that writes and runs scenarios with the shop's step pack |
| `ai/skills/opencart-scenarios/` | The skill: the step pack's phrases by area, the traps found on a real shop, three example features |
| `ai/commands/opencart-test.md` | The slash command `/opencart-test <site>`: set up, match every step, run, report |
| `ai/prompts/opencart-build-and-test.md`, `opencart-checkout-round.md` | Two prompts: whole launch commands for a new session |
| `src/index.ts` | `register(api)`: what the assistant is told about OpenCart here |
| `features/opencart.feature` | Scenarios for the dashboard's own browser suite |
| `features/opencart-runtimes.feature` | The row, the test users and two pages of the storefront of a shop built on Docker Compose and on Kubernetes |

The `workspacePlugin` block in `package.json` is the manifest the installer reads.

## The builder

Run it from a sites folder. `--help` is safe.

```bash
cd ~/workspace/dev
bash cmd-opencart-project.sh myshop --install --add-users --sample-data
```

| Flag | What it does |
| --- | --- |
| `--install` | Install the shop with OpenCart's own command-line installer (`install/cli_install.php`) and its demo catalog, with the workspace account (`account:` of `settings.yml`) as its administrator, then remove its `install/` folder, as OpenCart asks. Without it the release is unpacked, and the shop waits for its web installer at `/install/` |
| `--add-users` | With `--install`: add the default accounts: an administrator, a catalog editor in a user group of its own, and a customer with an address |
| `--sample-data` | With `--install`: add what the tests name besides the demo catalog: the payment by bank transfer beside cash on delivery, and the coupon `WEBSHIP10` (10% off; the demo's coupons are disabled and out of date) |
| `--version <x>` | The OpenCart 4 release (`latest` by default: the newest stable 4.x of the project's releases) |
| `--php-version <x>` | The PHP of the project container: 8.3 (the default), 8.2 or 8.1 |
| `--runtime <name>` | The container runtime to build on: `ddev` (the default), `docker`, `kubernetes`, `podman`, `lando` or `docksal`. See [Runtimes](#runtimes) |
| `--launch` | Open the shop when it is ready |

On DDEV the shop answers at `https://myshop.ddev.site/`, its administration at `/admin/`, the mail catcher at
`https://myshop.ddev.site:8026`. The container tool has no project type for OpenCart, so a shop is a `php` project
whose docroot is the release's `upload/` folder; the installer is given the container's own database values (`db`),
and nothing personal is written. A project of the same name is deleted first.

- **The workspace account** is the installer's, named "Workspace Owner" in the administration. The installer takes a
  user name of 3 to 20 characters, a password of 5 to 20 and an e-mail address; the shop's own forms take a password
  of up to 40, so a longer workspace password is set once the shop is installed (stored as the shop stores one). A
  workspace account the shop would refuse is said before anything is built.
- **The mail.** OpenCart installs with no mail engine, so it would send nothing: the builder sets PHP's mail ("Mail"
  in the shop's settings), which the container hands to the runtime's mail catcher. The shop's mail (an order's
  confirmation, a forgotten password) is in the mailbox, and none leaves the machine.

Nothing paid and no account anywhere: the open-source release from the project's releases, no extension of the
marketplace, the theme the release comes with, and the sample data written by OpenCart's own models.

### Runtimes

```bash
bash cmd-opencart-project.sh myshop --install --add-users --sample-data                        # DDEV, the default
bash cmd-opencart-project.sh myshop --install --add-users --sample-data --runtime docker       # Docker Compose
bash cmd-opencart-project.sh myshop --install --add-users --sample-data --runtime kubernetes   # a Kubernetes cluster
bash cmd-opencart-project.sh myshop --install --add-users --sample-data --runtime lando        # Lando
bash cmd-opencart-project.sh myshop --install --add-users --sample-data --runtime docksal      # Docksal
```

Without `--runtime` a build takes `container.runtime` of the workspace's `settings.yml`, then DDEV.
It needs a Webship Workspace with the container runtimes
([webship/workspace#694](https://github.com/webship/workspace/issues/694)); on an older one the
builder refuses `--runtime` and builds on DDEV only. Lando and Docksal need a Workspace whose runtime
layer has them ([webship/workspace#729](https://github.com/webship/workspace/issues/729),
[#730](https://github.com/webship/workspace/issues/730)).

| | DDEV | Docker Compose | Kubernetes | Podman | Lando | Docksal |
| --- | --- | --- | --- | --- | --- | --- |
| Build with `--install --add-users --sample-data` | Yes | Yes | Not yet run | Not yet run | Not yet run | Not yet run |
| The storefront and the administration; a login as the workspace account and the default accounts | Yes | Yes | Not yet run | Not yet run | Not yet run | Not yet run |
| `cmd-tools-opencart-cli.sh` (what the shop holds, `--run "php -m"`) | Yes | Yes | Not yet run | Not yet run | Not yet run | Not yet run |
| Test users, cancelled and added | Yes | Yes | Not yet run | Not yet run | Not yet run | Not yet run |
| Mail caught by Mailpit (the storefront's forgotten-password mail) | Yes | Yes | Not yet run | Not yet run | Not yet run | Not yet run |
| The testing setup and the first feature | Yes | Yes | Not yet run | Not yet run | Not yet run | Not yet run |
| The step pack's examples, with the sample data (19 scenarios) | Yes | Yes | Not yet run | Not yet run | Not yet run | Not yet run |
| Export and import the database | Yes | Yes | Not yet run | Not yet run | Not yet run | Not yet run |
| The row in the dashboard, and remove | Yes | Yes | Not yet run | Not yet run | Not yet run | Not yet run |

"Yes" means it was run on a real shop of that runtime. A runtime "Not yet run" runs the same code (the same calls of
the container tool, through the core's runtime layer) and was not run yet; Podman runs the same code as Docker
Compose.

| Runtime | The shop's address | What the project carries |
| --- | --- | --- |
| DDEV | `https://myshop.ddev.site` | `.ddev/config.yaml`, and the plugin's claim `.ddev/config.opencart.yaml` |
| Docker Compose | `http://127.0.0.1:<port>`, printed by the build | `compose.yaml`, `.webship/runtime/Dockerfile` |
| Kubernetes | `http://<node address>:<port>`, printed by the build | The same, and `k8s/` (the namespace `ws-myshop`) |
| Lando | `http://127.0.0.1:<port>`, printed by the build | `.lando.yml` (Lando's proxy stays off) |
| Docksal | `http://myshop.docksal.site`, on Docksal's own proxy | `.docksal/docksal.env`, `.docksal/docksal.yml` |

What differs on Docker Compose, Kubernetes, Lando and Docksal:

- **The claim** is `platform: opencart` in the `x-webship` block (the core's `rt_claim`): no `.ddev/` folder is written there, and the row's Tests menu offers the shop's list by it.
- **The address** the installer is given is the runtime's: the shop writes it into its `config.php` and `admin/config.php`, and makes its links with it. A shop moved to another address needs both files changed.
- **The shop's root in the container** is asked of the container (`/var/www/html` on Docker Compose, Podman and Kubernetes, `/app` on Lando, `/var/www` on Docksal); the tool and the testing hook run there.
- **HTTPS and a host name** are DDEV's: a runtime's address is plain HTTP.

The same commands work on every runtime: `cmd-tools-opencart-cli.sh`, `cmd-tools-add-users.sh`,
`cmd-tools-testing.sh`. The pattern is the Workspace's
[`core/docs/plugins-on-runtimes.md`](https://github.com/webship/workspace/blob/1.0.x/core/docs/plugins-on-runtimes.md).

### The plugin's claim on the project

A shop is a project of the type `php`, which says nothing of the platform. On DDEV the builder leaves
`.ddev/config.opencart.yaml` in the project: a config overlay of the container tool with one key
(`web_environment: WEBSHIP_WORKSPACE_PLATFORM=opencart`, in the web container's environment from its next start;
nothing of the shop reads it). The file's name is what the workspace reads: a project that carries
`config.<plugin>.yaml` takes the test users of that plugin, so the row's Tests menu offers the shop's list
(`opencart`). On another runtime the claim is `platform: opencart` in the `x-webship` block (see
[Runtimes](#runtimes)). For the plugin's own tools, a project whose docroot holds the administration's
configuration and the storefront's `cron.php` is a shop too.

### The shop's tool

`--run` runs a command in the shop's web root in its container: PHP and its arguments, or another command of the
container. OpenCart 4.1.0.4's own `cron.php` stops on the command line (it does not load the libraries its templates need);
the shop's scheduled tasks run from the address its **Extensions > Cron Jobs** page gives (`index.php?route=cron/cron`).

The tool runs the plugin's `shop-site.php` with PHP in the shop's container, which reads and writes with OpenCart's
own models (the administration's user, user group, customer, coupon, product, category, setting and extension
models; the storefront's order model), started the way OpenCart's own `cron.php` starts the framework.

```bash
bash cmd-tools-opencart-cli.sh myshop                   # the version, the address, the accounts, the payments, the coupon, the orders
bash cmd-tools-opencart-cli.sh myshop --run "php -m"    # a command in the shop's web root: here PHP's extensions
bash cmd-tools-opencart-cli.sh myshop --add-users       # the default accounts; an account that is there is kept
bash cmd-tools-opencart-cli.sh myshop --cancel-users    # delete them, the customer with its addresses and wish list
bash cmd-tools-opencart-cli.sh myshop --sample-data     # the bank transfer and the coupon; what is there is kept
bash cmd-tools-opencart-cli.sh myshop --tidy            # take away what a stopped test run left
```

The tidy-up deletes every order the storefront's own way, voided first: an order moves the statistics the dashboard
reads and the stock of its products, and the administration's "Delete" leaves both, while voiding an order lets
OpenCart's own events put them back. It then empties the carts, takes the customer's wish list and the addresses it
added away, deletes the products, categories and coupons named "Webship test …", removes the login records of the
default accounts (every login writes one, and no screen removes it), and counts the statistics again as the shop's
Reports > Statistics does.

### The default accounts

| Account | Address | Place in the shop | Handle in the tests |
| --- | --- | --- | --- |
| `administrator` | `administrator@example.com` | The Administrator group: every screen of the administration | `admin` |
| `editor` | `editor@example.com` | The "Catalog editor" group: the catalog's screens only (products, categories, options, brands, reviews, information pages) | `editor` |
| `customer@example.com` | `customer@example.com` | The storefront's customer "Customer Test", with its default address at 1 Webship Street, London | `customer` |

Each is named after its place ("Editor Test" in the administration's header), with the password of the workspace's
other default lists. They are for local shops and for tests; a test suite logs in as them and never creates or deletes
one. The workspace account is the installer's, one more administrator of the shop, and it stays when the default
accounts are added or cancelled.

The row's Tests menu offers **Add the test users** and **Cancel the test users** for a shop this plugin claims: they
run the same list as

```bash
bash cmd-tools-add-users.sh myshop opencart       # the core's tool, with the plugin's list
bash cmd-tools-cancel-users.sh myshop opencart
```

Adding them again gives each its group and its name back. Cancelling deletes the customer (with its addresses, wish
list and cart), the editor, and the administrator unless it is the shop's only active one; the "Catalog editor" group
stays.

### Test a shop

```bash
bash cmd-tools-testing.sh myshop                 # webship-js, the step pack, the users registry, the first feature
bash cmd-tools-testing.sh myshop --run           # run the suite in the container
bash cmd-tools-testing.sh myshop --run --path tests/features/shop.feature
bash cmd-tools-testing.sh myshop --list-steps    # the step packs the project has
```

`cmd-tools-testing.sh` is the workspace's own. For a shop, this plugin's hook adds `@webship-js/opencart-steps` to
`package.json` and its step definitions to `cucumber.js` after webship-js's own, the tags that keep the pack's
assertions that must fail out of a normal run, the shop's settings the steps read (`worldParameters.shop`: its
language, the folder of its administration, the account that puts back what a scenario changed, and the order status
that voids an order), the handles of the shop's accounts in the users registry (with the names the shop shows;
overridable with `OC_<HANDLE>_USER` and `OC_<HANDLE>_PASSWORD`), and `tests/features/shop.feature` (the search and a
product put in the cart by a visitor, the customer's address book, the administrator's dashboard and products, the
catalog editor's menu); it makes sure the default accounts are in the shop. It is idempotent: a second run adds what
is missing and keeps what was changed.

## The AI items

`ai/` in the package holds one folder per kind, the manifest's `ai` block names each item, and
`--install` places it in the workspace folder of that kind.

| Kind | Item | Use it to |
| --- | --- | --- |
| Agent | `opencart-site-builder` | Build, update, maintain or remove a shop with the builder and the shop's tool, in containers only, with nothing paid and no account anywhere |
| Agent | `opencart-tester` | Set the testing stack up, look at the shop in the Playwright MCP browser first, write scenarios from the pack's steps and run them; it never creates an account in a suite and never writes a platform name into a step phrase |
| Skill | `opencart-scenarios` | Write a scenario from phrases that exist: the pack's steps by area, the handles of the users registry, the traps found on a real shop, and three features that pass on a fresh shop with the sample data |
| Command | `/opencart-test <site> [feature or @tag]` | Run the suite of a shop from inside a session: set up when missing, match every step, run, report what failed and why |
| Prompt | `opencart-build-and-test` | Start a session that builds a shop, says what it holds, sets the testing stack up and runs the first feature |
| Prompt | `opencart-checkout-round` | Start a session that writes and runs the scenario of a round of an order: the cart, the checkout, the order in the administration |

After `--install` each is in its folder on the dashboard. **Install** there puts an agent, a skill
or a command into Claude Code (`~/.claude/agents`, `~/.claude/skills`, `~/.claude/commands`), or
from the command line:

```bash
cd ~/workspace/ai-agents   && bash cmd-tools-ai-items.sh opencart-tester --install
cd ~/workspace/ai-skills   && bash cmd-tools-ai-items.sh opencart-scenarios --install
cd ~/workspace/ai-commands && bash cmd-tools-ai-items.sh opencart-test --install
```

A prompt is not installed: it is the whole `claude …` launch command of a new session, and the
dashboard's **New screen** form lists it as a template. By hand, fill the placeholders in and run
the command of the file from the folder it names.

The items are written for any AI CLI, with Claude Code as the default shape: the frontmatter and
the file layout are Claude Code's, the body of each item is plain Markdown that names no tool or
feature of one CLI, a command says in words what its arguments are, and the text between the
triple quotes of a prompt can be given to another AI CLI as it is.

Every step phrase the items show is checked against the definitions of the shop's step pack and of webship-js
(`tests/fixtures/step-definitions.txt`), and every command and flag against the plugin's own and the workspace's.

## What is tied to the container tool

The builder and the tools call the container tool with plain verbs only (`ddev config`, `ddev start`, `ddev exec`,
`ddev mysql`, `ddev describe`, `ddev launch`): no container is reached by its name. On DDEV three things are DDEV's by name: the
claim file lives in the tool's folder (`.ddev/config.opencart.yaml`, the place the workspace looks for it), the
docroot is read from the project file (`.ddev/config.yaml`; on another runtime the core's `rt_meta` answers), and the
addresses the builder prints (`https://<name>.ddev.site`, the mail catcher at port 8026) are the ones DDEV's router
gives a project. On another runtime the claim is in the `x-webship` block and the addresses are the runtime's
(`rt_url`).

## Develop it

```bash
npm install     # builds dist/ (TypeScript)
npm run lint
npm test        # the manifest, the builder, the AI items, the functions against a scaffolded project
```

CI runs the same on Node.js 24 and 26, parses every shell script, and runs the plugin's
`features/opencart.feature` and `features/opencart-runtimes.feature` against a dashboard with this plugin installed
(`webship/workspace/.github/workflows/plugin-browser-suite.yml`), with a shop built on Docker Compose for the second.

When the step pack's release line changes, refresh the fixture from a project whose testing stack is
set up: `node <this plugin>/tests/fixtures/refresh-step-definitions.js > <this plugin>/tests/fixtures/step-definitions.txt`.
