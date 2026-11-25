import test from 'node:test';
import assert from 'node:assert';
import fs from 'fs';
import path from 'path';
import { spawnSync } from 'child_process';

import { register, assistantContext, PLATFORM, COMMANDS, AGENTS } from '../src/index';

// Compiled, these tests run from dist/tests, so the package root is one folder further up.
const PKG = fs.existsSync(path.join(__dirname, '..', 'package.json')) ? path.join(__dirname, '..') : path.join(__dirname, '..', '..');
const read = (f: string) => fs.readFileSync(path.join(PKG, f), 'utf8');
const manifest = JSON.parse(read('package.json')).workspacePlugin;

test('the manifest names the platform, and every file it names ships', () => {
  assert.strictEqual(manifest.name, PLATFORM);
  const named = [...manifest.commands.files, ...manifest.scripts.functions, ...manifest.scripts.args, ...manifest.scripts.machine,
    ...manifest.ai.agents, ...manifest.ai.skills, ...manifest.ai.commands, ...manifest.ai.prompts, ...manifest.features];
  for (const f of named) assert.ok(fs.existsSync(path.join(PKG, f)), `${f} is in the package`);
  assert.deepStrictEqual(manifest.commands.files.map((f: string) => path.basename(f)), COMMANDS);
  assert.deepStrictEqual(manifest.ai.agents.map((f: string) => path.basename(f, '.md')), AGENTS);
  assert.deepStrictEqual(manifest.commands.types, ['sites'], 'the commands go to sites folders only');
  const files: string[] = JSON.parse(read('package.json')).files;
  for (const f of named) assert.ok(files.includes(f.split('/')[0]), `${f} is published with the package`);
});

test('the machine files land beside the functions, under the names the functions read', () => {
  const functions = read('scripts/functions/fun-opencart.sh');
  assert.deepStrictEqual(manifest.scripts.machine.map((f: string) => path.basename(f)).sort(), ['shop-site.php', 'shop.feature']);
  for (const f of manifest.scripts.machine) {
    assert.ok(functions.includes(`\${WORKSPACE_SCRIPTS}/plugins/opencart/${path.basename(f)}`), `the functions read ${path.basename(f)} where the installer puts it`);
  }
});

test('every command finds the workspace by itself, names its folder, and sources its args from where the installer puts them', () => {
  for (const f of manifest.commands.files) {
    const src = read(f);
    assert.match(src, /^#!\/usr\/bin\/env bash/, `${f} is a bash script`);
    assert.match(src, /WORKSPACE_SCRIPTS="\$\{WORKSPACE_SCRIPTS:-\$\(cd "\$\(dirname "\$\{BASH_SOURCE\[0\]\}"\)\/\.\.\/core\/scripts" && pwd\)\}"/, `${f} locates the tooling from its own path`);
    assert.match(src, /workspace\.__WORKSPACE__\.settings\.yml/, `${f} loads the settings of the folder it is installed into`);
    assert.match(src, /source \$\{WORKSPACE_SCRIPTS\}\/plugins\/opencart\/args\/arg-[a-z-]+\.sh \|\| exit 1 ;/, `${f} reads its arguments from the plugin's args`);
    const last = src.trim().split('\n').pop() as string;
    assert.match(read('scripts/functions/fun-opencart.sh'), new RegExp(`^function ${last.replace(/ ;$/, '')}\\(\\)`, 'm'), `${f} ends by calling a function the plugin defines`);
  }
  assert.match(read('commands/cmd-opencart-project.sh'), /^# workspace-name: OpenCart/m, 'the builder carries the name the Build list shows');
  assert.doesNotMatch(read('commands/cmd-tools-opencart-cli.sh'), /^# workspace-name:/m, 'a tool is not a builder');
});

test('the help of the builder and of the tool asks for nothing and changes nothing', () => {
  // The args files are argparse input: every option has a help line, and the flags the brief names are there.
  const args = read('scripts/args/arg-opencart.sh');
  for (const flag of ['--install', '--add-users', '--sample-data', '--version', '--runtime', '--launch', '--php-version']) {
    assert.match(args, new RegExp(`'${flag}'`), `the builder has ${flag}`);
  }
  const tool = read('scripts/args/arg-opencart-cli.sh');
  for (const flag of ['--run', '--add-users', '--cancel-users', '--sample-data', '--tidy']) {
    assert.match(tool, new RegExp(`'${flag}'`), `the shop's tool has ${flag}`);
  }
  for (const src of [args, tool]) {
    assert.strictEqual((src.match(/parser\.add_argument\(/g) || []).length, (src.match(/help=/g) || []).length, 'every option says what it does');
    // The dashboard's Build form reads a help in single quotes (core/workspace-app/builder-args.js): one in double
    // quotes is drawn without its text, and an apostrophe inside one ends it early.
    assert.doesNotMatch(src, /help="/, 'every help is in single quotes, as the Build form reads it');
    for (const m of src.matchAll(/help='([^\n]*)'\)$/gm)) assert.doesNotMatch(m[1], /'/, `no apostrophe inside a help: ${m[1]}`);
  }
});

test('every shell script parses', () => {
  for (const f of [...manifest.commands.files, ...manifest.scripts.functions, ...manifest.scripts.args]) {
    const r = spawnSync('bash', ['-n', path.join(PKG, f)], { encoding: 'utf8' });
    assert.strictEqual(r.status, 0, `${f}: ${r.stderr}`);
  }
});

test('the PHP script of the shop parses', { skip: spawnSync('php', ['-v']).status !== 0 && 'no php on this machine' }, () => {
  const r = spawnSync('php', ['-l', path.join(PKG, 'scripts', 'shop-site.php')], { encoding: 'utf8' });
  assert.strictEqual(r.status, 0, r.stdout + r.stderr);
});

test('the functions carry the names the core\'s tools look for, and give the installer only the container\'s database values', () => {
  const src = read('scripts/functions/fun-opencart.sh');
  for (const fn of ['set_opencart_users', 'add_opencart_users', 'cancel_opencart_users', 'testing_configure_opencart', 'opencart_build', 'opencart_cli_tool',
    'opencart_is_project', 'opencart_write_claim', 'opencart_shop_site', 'opencart_release']) {
    assert.match(src, new RegExp(`^function ${fn}\\(\\) \\{`, 'm'), `${fn} is defined`);
  }
  assert.match(src, /--project-type=php /, 'the container tool has no project type for OpenCart');
  assert.match(src, /--db_driver mysqli --db_hostname db --db_username db --db_password db --db_database db --db_port 3306 --db_prefix oc_/, 'the installer gets the container\'s own database values');
  assert.doesNotMatch(src, /--db_(hostname|username|password|database) (?!db )/, 'and no other');
  assert.match(src, /php install\/cli_install\.php install /, 'the shop is installed with its own command-line installer');
  assert.match(src, /rm -rf install/, 'its install folder goes, as it asks');
  assert.match(src, /--nodejs-version=\$\(ddev_nodejs_version\)/, 'the build runs the Node.js of the workspace rule');
  assert.doesNotMatch(src, /ddev stop -y/, 'ddev stop takes no -y');
});

test('the build keeps the shop to itself: the open-source release from its own releases, nothing of a marketplace', () => {
  const src = read('scripts/functions/fun-opencart.sh');
  assert.match(src, /api\.github\.com\/repos\/opencart\/opencart\/releases/, 'the release list is the project\'s own');
  assert.match(src, /https:\/\/github\.com\/opencart\/opencart\/releases\/download\/\$\{version\}\/opencart-\$\{version\}\.zip/, 'the archive of the release');
  assert.doesNotMatch(src.replace(/^\s*#.*$/gm, ''), /marketplace|opencart\.com\/index\.php\?route=marketplace|api_key|OPENCART_API/i, 'no marketplace, no account');
  assert.doesNotMatch(src.replace(/^\s*#.*$/gm, '').replace(/echo "https:\/\/\$\{PROJECT_NAME\}\.ddev\.site"/, ''), /ddev\.site/, 'ddev.site only as the answer of a core with no layer');
  assert.doesNotMatch(src.replace(/^\s*#.*$/gm, ''), /(?<![.\w])(docker|podman|kubectl) |command ddev/, 'only `ddev <verb>`: the layer chooses');
  assert.match(src, /rt_claim opencart/, 'on another runtime the plugin claims the shop: its type is php');
});

test('every container call is a plain verb of the container tool, and reads no file of it but the docroot', () => {
  const src = read('scripts/functions/fun-opencart.sh').replace(/^\s*#.*$/gm, '');
  assert.doesNotMatch(src, /docker (exec|compose|run)|ddev-[A-Za-z${}_-]*-web/, 'no container is reached by its name');
  const verbs = new Set([...src.matchAll(/\bddev ([a-z-]+)/g)].map((m) => m[1]));
  assert.deepStrictEqual([...verbs].sort(), ['config', 'describe', 'exec', 'launch', 'mysql', 'start'], 'the verbs the plugin runs');
  // The files of the tool the plugin touches: its claim, which the core asks for by that name, and the project file,
  // read for the docroot only (another runtime answers through the core's rt_meta).
  const files = new Set([...src.matchAll(/\.ddev\/([A-Za-z0-9._-]+)/g)].map((m) => m[1]));
  assert.deepStrictEqual([...files].sort(), ['config.opencart.yaml', 'config.yaml']);
});

test('the script of the shop uses the shop\'s own models, and creates no account of the installer', () => {
  const src = read('scripts/shop-site.php');
  for (const mode of ['content', 'accounts', 'cancel-accounts', 'sample', 'reset-orders', 'reset', 'status', 'counts']) assert.ok(src.includes(`case '${mode}':`), `the mode ${mode}`);
  // Started the way the shop's own cron.php starts the framework.
  for (const part of ['new \\Opencart\\System\\Engine\\Registry()', 'new \\Opencart\\System\\Engine\\Loader($registry)', "require_once DIR_SYSTEM . 'startup.php';"]) assert.ok(src.includes(part), part);
  // An order is deleted the storefront's way, voided first: OpenCart's events put the stock and the statistics back.
  assert.ok(src.includes("define('WEBSHIP_APP', $webship_mode === 'reset-orders' ? 'Catalog' : 'Admin');"));
  // What a run made is named "Webship test …", in that case.
  assert.match(src, /LIKE BINARY 'Webship test %'/);
  assert.doesNotMatch(src, /cli_install|DROP TABLE|TRUNCATE/i, 'it never installs or empties the shop');
});

test('each agent is a definition the AI Agents folder can list: named after its file, described, on the fable model', () => {
  for (const f of manifest.ai.agents) {
    const src = read(f);
    const head = src.split('\n---\n')[0];
    assert.match(head, /^---\n/, `${f} opens with frontmatter`);
    assert.match(head, new RegExp(`^name: ${path.basename(f, '.md')}$`, 'm'));
    assert.match(head, /^description: .{80,}$/m, `${f} says when to use it`);
    assert.match(head, /^model: fable$/m);
    assert.match(head, /^tools:\n(  - \S+\n?)+/m);
    assert.match(src, /cmd-tools-testing\.sh|cmd-opencart-project\.sh/, `${f} names the plugin's commands`);
  }
  const tester = read('ai/agents/opencart-tester.md');
  assert.match(tester, /Never create an account in a suite/);
  assert.match(tester, /No platform name in a step phrase/);
  assert.match(tester, /Playwright MCP browser first/);
  assert.match(tester, /Never the workspace account/);
  assert.match(tester, /\| `admin` \| `administrator` \|/, 'the tester knows the administrator test account by its handle');
  const builder = read('ai/agents/opencart-site-builder.md');
  assert.match(builder, /never on the host/);
  assert.match(builder, /no extension of the marketplace/);
});

test('register() adds the assistant context and nothing else', () => {
  const calls: string[] = [];
  const api: any = { name: 'opencart', addAssistantContext: (fn: () => string) => calls.push(fn()) };
  register(api);
  assert.strictEqual(calls.length, 1);
  assert.strictEqual(calls[0], assistantContext());
  for (const c of COMMANDS) assert.ok(calls[0].includes(c), `the assistant is told about ${c}`);
  for (const a of AGENTS) assert.ok(calls[0].includes(a), `the assistant is told about ${a}`);
});

test('the docs say container-based, name only what ships, and carry no personal value', () => {
  const docs = ['README.md', ...manifest.ai.agents, 'scripts/functions/fun-opencart.sh'];
  for (const f of docs) {
    const src = read(f);
    assert.doesNotMatch(src, /DDEV-only/i, `${f}: the workspace is container-based, DDEV by default`);
    assert.doesNotMatch(src, /\/home\/(?!YOUR_USER)[a-z]/, `${f} carries no personal path`);
    const mails = src.match(/[A-Za-z0-9._%+-]+@[A-Za-z0-9-]+\.[a-z]{2,}/g) || [];
    for (const m of mails) assert.match(m, /@example\.(com|org)$/, `${f}: ${m} is not an example address`);
  }
  for (const c of COMMANDS) assert.ok(read('README.md').includes(c), `the README lists ${c}`);
  assert.match(read('README.md'), /container-based \(DDEV by default\)/);
  assert.match(read('README.md'), /\| `editor` \| `editor@example\.com` \|/, 'the README lists the catalog editor');
});
