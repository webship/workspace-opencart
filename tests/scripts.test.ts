import test, { after } from 'node:test';
import assert from 'node:assert';
import fs from 'fs';
import os from 'os';
import path from 'path';
import { spawnSync } from 'child_process';

// Compiled, these tests run from dist/tests, so the package root is one folder further up.
const PKG = fs.existsSync(path.join(__dirname, '..', 'package.json')) ? path.join(__dirname, '..') : path.join(__dirname, '..', '..');
const FUNCTIONS = path.join(PKG, 'scripts', 'functions', 'fun-opencart.sh');

// The cucumber.js webship-js scaffolds, as far as the testing hook reads it.
const SCAFFOLD = `module.exports = {
  default: {
    requireModule: ['ts-node/register'],
    require: [
      'node_modules/webship-js/tests/step-definitions/**/*.js',          // Webship-js core step definitions.
      'tests/step-definitions/**/*.js',                                  // Your custom step definitions.
    ],
    paths: ['tests/features/**/*.feature'],
    worldParameters: {
      launchUrl: process.env.LAUNCH_URL || 'http://localhost:8080',
    },
  },
};
`;

// Every folder a test makes goes when the tests are done.
const ROOTS: string[] = [];
after(() => {
  for (const root of ROOTS) fs.rmSync(root, { recursive: true, force: true });
});

/** The files of a release of the shop in a docroot: what makes a php project a shop; installed, its configuration. */
function shopFiles(docroot: string, installed: boolean) {
  fs.mkdirSync(path.join(docroot, 'admin'), { recursive: true });
  for (const f of ['config-dist.php', 'admin/config-dist.php', 'cron.php']) fs.writeFileSync(path.join(docroot, f), '');
  fs.writeFileSync(path.join(docroot, 'index.php'), "<?php\n// Version\ndefine('VERSION', '4.1.0.4');\n");
  const config = installed ? "<?php\ndefine('DB_DATABASE', 'db');\n" : '';
  fs.writeFileSync(path.join(docroot, 'config.php'), config);
  fs.writeFileSync(path.join(docroot, 'admin', 'config.php'), config);
}

/**
 * A project folder with the testing stack scaffolded, and the tooling folder the installer would have filled.
 * `kind` says what it holds: an installed shop, a shop whose release waits for its installer, or another platform.
 */
function project(kind: 'opencart' | 'uninstalled' | 'other' = 'opencart') {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'opencart-plugin-'));
  ROOTS.push(root);
  const dir = path.join(root, 'dev', 'shop1');
  fs.mkdirSync(path.join(dir, '.ddev'), { recursive: true });
  fs.writeFileSync(path.join(dir, '.ddev', 'config.yaml'), `name: shop1\ntype: ${kind === 'other' ? 'drupal11' : 'php'}\ndocroot: ${kind === 'other' ? 'web' : 'upload'}\n`);
  if (kind !== 'other') shopFiles(path.join(dir, 'upload'), kind === 'opencart');
  fs.writeFileSync(path.join(dir, 'cucumber.js'), SCAFFOLD);
  fs.writeFileSync(path.join(dir, 'package.json'), JSON.stringify({ name: 'shop1', devDependencies: { 'webship-js': '^2.0.16' } }, null, 2));
  const scripts = path.join(root, 'core', 'scripts');
  fs.mkdirSync(path.join(scripts, 'plugins', 'opencart'), { recursive: true });
  fs.copyFileSync(path.join(PKG, 'testing', 'shop.feature'), path.join(scripts, 'plugins', 'opencart', 'shop.feature'));
  fs.copyFileSync(path.join(PKG, 'scripts', 'shop-site.php'), path.join(scripts, 'plugins', 'opencart', 'shop-site.php'));
  return { root, dir, scripts };
}

// The recorder of the container tool: every call is written to DDEV_LOG; a run of the shop's script also says whether
// the script is in the docroot then (the folder the call runs in is in the call). What a command is fed is read.
const RECORDER = `ddev() { echo "ddev $*" >> "\${DDEV_LOG:-/dev/null}" ; case "$*" in *'php .webship-shop-site.php'*) echo "the script is there: $(ls -a upload 2>/dev/null | grep -c '^\\.webship-shop-site\\.php$')" >> "\${DDEV_LOG:-/dev/null}" ;; esac ; [ -t 0 ] || cat > /dev/null ; return 0 ; }`;

/** Run bash with the plugin's functions sourced and `ddev` replaced by the recorder. */
function bash(script: string, env: Record<string, string> = {}) {
  return spawnSync('bash', ['-c', `${RECORDER}\nsource ${FUNCTIONS}\n${script}`],
    { encoding: 'utf8', env: { ...process.env, ...env }, stdio: ['ignore', 'pipe', 'pipe'] });
}

test('the default accounts are an administrator, a catalog editor and a customer, with example addresses and the names the shop shows', () => {
  const r = bash('set_opencart_users ; for u in "${users[@]}" ; do n="user_${u}_name" ; m="user_${u}_mail" ; p="user_${u}_password" ; l="user_${u}_role" ; f="user_${u}_fullname" ; echo "${!n}|${!m}|${!p}|${!l}|${!f}" ; done');
  assert.strictEqual(r.status, 0, r.stderr);
  const rows = r.stdout.trim().split('\n').map((l) => l.split('|'));
  assert.deepStrictEqual(rows.map((x) => x[0]), ['administrator', 'editor', 'customer@example.com'], 'the customer logs in with its address');
  assert.deepStrictEqual(rows.map((x) => x[1]), ['administrator@example.com', 'editor@example.com', 'customer@example.com'], 'test accounts of their own, never the workspace account');
  assert.deepStrictEqual(rows.map((x) => x[3]), ['Administrator', 'Catalog editor', 'Customer']);
  assert.deepStrictEqual(rows.map((x) => x[4]), ['Administrator Test', 'Editor Test', 'Customer Test']);
  for (const row of rows) assert.ok(row[2].length >= 5 && row[2].length <= 20, 'the shop takes a password of 5 to 20 characters');
  // The script of the shop writes the same accounts: the list and the script never part.
  const script = fs.readFileSync(path.join(PKG, 'scripts', 'shop-site.php'), 'utf8');
  for (const [, mail, password] of rows) {
    assert.ok(script.includes(`'${mail}'`) || script.includes(`'${mail.split('@')[0]}@example.com'`), `the script writes ${mail}`);
    assert.ok(script.includes(`'password' => '${password}'`), 'with the password of the list');
  }
});

test('a shop is a project whose docroot holds the administration\'s configuration and the cron of the storefront', () => {
  assert.strictEqual(bash(`opencart_is_project ${project('opencart').dir}`).status, 0);
  assert.strictEqual(bash(`opencart_is_project ${project('uninstalled').dir}`).status, 0, 'a release that waits for its installer is a shop too');
  assert.strictEqual(bash(`opencart_is_project ${project('other').dir}`).status, 1);
  assert.strictEqual(bash(`opencart_is_installed ${project('opencart').dir}`).status, 0);
  assert.strictEqual(bash(`opencart_is_installed ${project('uninstalled').dir}`).status, 1, 'the installer writes the database into config.php');
  assert.strictEqual(bash(`opencart_version ${project('opencart').dir}`).stdout, '4.1.0.4\n', 'the release, as its index.php names it');
});

test('the testing hook adds the step pack, the tags, the shop\'s settings, the users registry and a first feature to a shop, once', () => {
  const p = project('opencart');
  const log = path.join(p.root, 'ddev.log');
  const run = () => bash(`cd ${p.dir} && testing_configure_opencart ${p.dir}`, { WORKSPACE_ROOT: p.root, WORKSPACE_SCRIPTS: p.scripts, doc_name: 'dev', PROJECT_NAME: 'shop1', DDEV_LOG: log });
  const r = run();
  assert.strictEqual(r.status, 0, r.stderr + r.stdout);
  const pkg = JSON.parse(fs.readFileSync(path.join(p.dir, 'package.json'), 'utf8'));
  assert.strictEqual(pkg.devDependencies['@webship-js/opencart-steps'], '^2.0.0');
  assert.strictEqual(pkg.devDependencies['webship-js'], '^2.0.16', 'what was there stays');
  const cucumber = fs.readFileSync(path.join(p.dir, 'cucumber.js'), 'utf8');
  const lines = cucumber.split('\n');
  const core = lines.findIndex((l) => l.includes('node_modules/webship-js/tests/step-definitions'));
  assert.strictEqual(lines[core + 1], "      'node_modules/@webship-js/opencart-steps/tests/step-definitions/**/*.js',", 'the pack is listed right after webship-js');
  assert.match(cucumber, /^\s*tags: process\.env\.CUCUMBER_TAGS \|\| 'not @wip and not @must-fail',$/m);
  assert.match(cucumber, /^\s*shop: \{ language: 'en-gb', admin: 'admin', manager: 'admin', voidStatusId: 16 \},$/m);
  assert.match(cucumber, /^\s*admin: \{ username: process\.env\.OC_ADMIN_USER \|\| 'administrator', password: process\.env\.OC_ADMIN_PASSWORD \|\| '[^']+', email: 'administrator@example\.com', name: 'Administrator Test' \},$/m);
  assert.match(cucumber, /^\s*customer: \{ username: process\.env\.OC_CUSTOMER_USER \|\| 'customer@example\.com', password: [^\n]*, email: 'customer@example\.com', name: 'Customer Test' \},$/m);
  assert.doesNotMatch(cucumber, /webmaster|account_/, 'the workspace account is in no registry');
  // Still a module node can load, with the registry and the settings where the pack reads them.
  const loaded = spawnSync(process.execPath, ['-e', `const c = require(${JSON.stringify(path.join(p.dir, 'cucumber.js'))}).default; const w = c.worldParameters; console.log(JSON.stringify([c.require, Object.keys(w.users), w.shop.manager, w.users.editor.name, c.tags]))`], { encoding: 'utf8' });
  assert.strictEqual(loaded.status, 0, loaded.stderr);
  const [requires, handles, manager, editor, tags] = JSON.parse(loaded.stdout);
  assert.strictEqual(requires.length, 3);
  assert.deepStrictEqual(handles, ['admin', 'editor', 'customer'], 'the handles the pack\'s features log in as');
  assert.strictEqual(manager, 'admin', 'the account that puts back what a scenario changed');
  assert.strictEqual(editor, 'Editor Test');
  assert.match(tags, /not @must-fail/);
  assert.ok(fs.existsSync(path.join(p.dir, 'tests', 'features', 'shop.feature')));
  // An installed shop gets the default accounts, in its docroot, with the script of the shop.
  const calls = fs.readFileSync(log, 'utf8');
  assert.match(calls, /^ddev exec -d \/var\/www\/html\/upload php \.webship-shop-site\.php accounts$/m);
  assert.match(calls, /^the script is there: 1$/m);
  assert.deepStrictEqual(fs.readdirSync(path.join(p.dir, 'upload')).filter((f) => f.startsWith('.webship-')), [], 'and gone afterwards');
  // Again, after a person changed the feature: nothing is doubled, nothing is reset.
  fs.writeFileSync(path.join(p.dir, 'tests', 'features', 'shop.feature'), 'Feature: mine\n');
  assert.strictEqual(run().status, 0);
  assert.strictEqual(fs.readFileSync(path.join(p.dir, 'cucumber.js'), 'utf8'), cucumber);
  assert.strictEqual(fs.readFileSync(path.join(p.dir, 'tests', 'features', 'shop.feature'), 'utf8'), 'Feature: mine\n');
});

test('the testing hook adds the shop\'s handles to a users registry that is there, and keeps its own', () => {
  const p = project('opencart');
  const own = SCAFFOLD.replace("    worldParameters: {\n", "    worldParameters: {\n      users: {\n        admin: { username: 'boss', password: 'Secret.123' },\n      },\n");
  fs.writeFileSync(path.join(p.dir, 'cucumber.js'), own);
  const r = bash(`cd ${p.dir} && testing_configure_opencart ${p.dir}`, { WORKSPACE_ROOT: p.root, WORKSPACE_SCRIPTS: p.scripts, doc_name: 'dev', PROJECT_NAME: 'shop1' });
  assert.strictEqual(r.status, 0, r.stderr + r.stdout);
  const loaded = spawnSync(process.execPath, ['-e', `const u = require(${JSON.stringify(path.join(p.dir, 'cucumber.js'))}).default.worldParameters.users; console.log(JSON.stringify([Object.keys(u), u.admin.username]))`], { encoding: 'utf8' });
  assert.strictEqual(loaded.status, 0, loaded.stderr);
  const [handles, admin] = JSON.parse(loaded.stdout);
  assert.deepStrictEqual(handles.sort(), ['admin', 'customer', 'editor']);
  assert.strictEqual(admin, 'boss', 'a handle that is there is kept as it was written');
});

test('the testing hook leaves a project of another platform alone, and asks for the scaffold when it is not there', () => {
  const p = project('other');
  const r = bash(`cd ${p.dir} && testing_configure_opencart ${p.dir}`, { WORKSPACE_ROOT: p.root, WORKSPACE_SCRIPTS: p.scripts, doc_name: 'dev', PROJECT_NAME: 'shop1' });
  assert.strictEqual(r.status, 0);
  assert.strictEqual(r.stdout, '');
  assert.strictEqual(fs.readFileSync(path.join(p.dir, 'cucumber.js'), 'utf8'), SCAFFOLD);
  assert.ok(!fs.existsSync(path.join(p.dir, 'tests')));
  const shop = project('opencart');
  fs.rmSync(path.join(shop.dir, 'cucumber.js'));
  const s = bash(`cd ${shop.dir} && testing_configure_opencart ${shop.dir}`, { WORKSPACE_ROOT: shop.root, WORKSPACE_SCRIPTS: shop.scripts, doc_name: 'dev', PROJECT_NAME: 'shop1' });
  assert.strictEqual(s.status, 1);
  assert.match(s.stdout, /cucumber\.js is not here yet/);
});

test('the user tools write the accounts with the script of the shop, in its docroot, and refuse a project that is not a shop', () => {
  const p = project('opencart');
  const log = path.join(p.root, 'ddev.log');
  const env = { WORKSPACE_ROOT: p.root, WORKSPACE_SCRIPTS: p.scripts, doc_name: 'dev', PROJECT_NAME: 'shop1', DDEV_LOG: log };
  let r = bash('set_opencart_users ; add_opencart_users', env);
  assert.strictEqual(r.status, 0, r.stderr + r.stdout);
  assert.match(r.stdout, /User name: customer@example\.com/);
  assert.match(r.stdout, /User role: Catalog editor/);
  assert.match(fs.readFileSync(log, 'utf8'), /^ddev exec -d \/var\/www\/html\/upload php \.webship-shop-site\.php accounts$/m);
  fs.writeFileSync(log, '');
  r = bash('set_opencart_users ; cancel_opencart_users', env);
  assert.strictEqual(r.status, 0, r.stderr + r.stdout);
  assert.match(fs.readFileSync(log, 'utf8'), /^ddev exec -d \/var\/www\/html\/upload php \.webship-shop-site\.php cancel-accounts$/m);
  assert.deepStrictEqual(fs.readdirSync(path.join(p.dir, 'upload')).filter((f) => f.startsWith('.webship-')), [], 'the script is gone from the docroot afterwards');
  const other = project('other');
  const refused = bash('set_opencart_users ; add_opencart_users', { WORKSPACE_ROOT: other.root, WORKSPACE_SCRIPTS: other.scripts, doc_name: 'dev', PROJECT_NAME: 'shop1' });
  assert.strictEqual(refused.status, 1);
  assert.match(refused.stdout, /is not an OpenCart shop/);
});

test('the shop\'s tool runs the first of its flags, and says what the shop holds without one', () => {
  const p = project('opencart');
  const log = path.join(p.root, 'ddev.log');
  const env = { WORKSPACE_ROOT: p.root, WORKSPACE_SCRIPTS: p.scripts, doc_name: 'dev', PROJECT_NAME: 'shop1', DDEV_LOG: log };
  // `ddev describe` answers that the project runs, as DDEV does for a started one.
  const running = `ddev() { echo "ddev $*" >> "$DDEV_LOG" ; [ "$1" == describe ] && echo '{"raw":{"status":"running"}}' ; [ -t 0 ] || cat > /dev/null ; return 0 ; } ;`;
  const run = (flags: string) => {
    fs.writeFileSync(log, '');
    const r = bash(`${running} trim_project_name() { :; } ; RUN=_none_ ; ADD_USERS=no ; CANCEL_USERS=no ; SAMPLE_DATA=no ; TIDY=no ; ${flags} opencart_cli_tool`, env);
    assert.strictEqual(r.status, 0, r.stderr + r.stdout);
    return { out: r.stdout, calls: fs.readFileSync(log, 'utf8') };
  };
  const status = run('');
  assert.match(status.calls, /^ddev exec -d \/var\/www\/html\/upload php \.webship-shop-site\.php status$/m);
  assert.match(status.out, /^dev\/shop1: OpenCart 4\.1\.0\.4 at https:\/\/shop1\.ddev\.site\/ \(the administration: https:\/\/shop1\.ddev\.site\/admin\/\)$/m);
  assert.doesNotMatch(status.calls, /ddev start/, 'a running project is not started again');
  assert.match(run('RUN="php -m"').calls, /^ddev exec -d \/var\/www\/html\/upload php -m$/m, 'a command in the web root of the shop');
  assert.match(run('SAMPLE_DATA=yes').calls, /php \.webship-shop-site\.php sample$/m);
  const tidy = run('TIDY=yes').calls.split('\n');
  assert.ok(tidy.findIndex((l) => l.endsWith('php .webship-shop-site.php reset-orders')) >= 0, 'the orders first, voided');
  assert.ok(tidy.findIndex((l) => l.endsWith('php .webship-shop-site.php reset')) > tidy.findIndex((l) => l.endsWith('php .webship-shop-site.php reset-orders')), 'then the rest');
  assert.match(run('ADD_USERS=yes').calls, /php \.webship-shop-site\.php accounts$/m);
  assert.match(run('CANCEL_USERS=yes').calls, /php \.webship-shop-site\.php cancel-accounts$/m);
  assert.doesNotMatch(run('ADD_USERS=yes SAMPLE_DATA=yes').calls, /php \.webship-shop-site\.php sample/, 'one thing at a time: the first flag');
});

test('the shop\'s tool starts a stopped project, and says so when the shop is not installed', () => {
  const p = project('uninstalled');
  const log = path.join(p.root, 'ddev.log');
  const r = bash('trim_project_name() { :; } ; RUN=_none_ ; ADD_USERS=no ; CANCEL_USERS=no ; SAMPLE_DATA=no ; TIDY=no ; opencart_cli_tool', { WORKSPACE_ROOT: p.root, WORKSPACE_SCRIPTS: p.scripts, doc_name: 'dev', PROJECT_NAME: 'shop1', DDEV_LOG: log });
  assert.strictEqual(r.status, 1);
  assert.match(r.stdout, /the shop is not installed yet: open https:\/\/shop1\.ddev\.site\/install\/, or build it again with --install/);
  assert.match(fs.readFileSync(log, 'utf8'), /^ddev start -y$/m);
  assert.doesNotMatch(fs.readFileSync(log, 'utf8'), /webship-shop-site/);
});

test('a version of another major line, or a workspace account the installer would refuse, is refused before anything is built', () => {
  const p = project('other');
  const log = path.join(p.root, 'ddev.log');
  const env = { WORKSPACE_ROOT: p.root, WORKSPACE_SCRIPTS: p.scripts, doc_name: 'dev', DDEV_LOG: log, PROJECT_NAME: 'shop2', RUNTIME: '_none_' };
  let r = bash('VERSION=3.0.4.1 ; trim_project_name() { :; } ; opencart_build', env);
  assert.strictEqual(r.status, 1);
  assert.match(r.stdout, /This builder makes an OpenCart 4 shop/);
  for (const account of ['account_name=ab account_pass=Long.enough1 account_mail=a@example.com', 'account_name=webmaster account_pass=abcd account_mail=a@example.com',
    'account_name=webmaster account_pass=Twenty-one-characters account_mail=a@example.com', 'account_name=webmaster account_pass=Long.enough1 account_mail=nobody']) {
    r = bash(`VERSION=latest ; INSTALL=yes ; ${account} ; trim_project_name() { :; } ; opencart_build`, env);
    assert.strictEqual(r.status, 1, account);
    assert.match(r.stdout, /a user name of 3 to 20 characters, a password of 5 to 20 and an e-mail address/, account);
  }
  assert.ok(!fs.existsSync(log), 'the container tool was not called');
  assert.ok(!fs.existsSync(path.join(p.root, 'dev', 'shop2')), 'no folder was made');
});

test('a release is chosen from the project\'s releases: the newest stable one of the line by number, the one named, or the proven one', () => {
  const list = JSON.stringify([
    { tag_name: '4.2.0.0', prerelease: true, draft: false },
    { tag_name: '4.1.0.10', prerelease: false, draft: false },
    { tag_name: '4.1.0.4', prerelease: false, draft: false },
    { tag_name: '4.0.2.3', prerelease: false, draft: false },
    { tag_name: '3.0.4.1', prerelease: false, draft: false },
    { tag_name: '5.0.0.0', prerelease: false, draft: false },
  ]);
  const pick = (wanted: string, answer: string) => spawnSync('bash', ['-c', `ddev() { printf '%s' "$LIST" ; }\nsource ${FUNCTIONS}\nopencart_release ${wanted}`], { encoding: 'utf8', env: { ...process.env, LIST: answer } });
  assert.strictEqual(pick('latest', list).stdout.trim(), '4.1.0.10', 'by number, not by text, and never another major line or a pre-release');
  assert.strictEqual(pick('4.0.2.3', list).stdout.trim(), '4.0.2.3');
  assert.strictEqual(pick('latest', 'rate limit exceeded').stdout.trim(), '4.1.0.4', 'the release the plugin was proven on, when the list cannot be read');
});

// ---- The runtimes: DDEV as before, and Docker Compose, Podman, Kubernetes, Lando and Docksal through the core's layer ----

const ADDRESSES: Record<string, string> = {
  docker: 'http://127.0.0.1:41234', podman: 'http://127.0.0.1:41234', lando: 'http://127.0.0.1:41234',
  kubernetes: 'http://172.18.0.2:30080', docksal: 'http://shop1.docksal.site',
};
// Where each runtime keeps the project in its container: what `ddev exec pwd` answers from the project folder.
const CONTAINER_ROOTS: Record<string, string> = { docker: '/var/www/html', podman: '/var/www/html', kubernetes: '/var/www/html', lando: '/app', docksal: '/var/www' };

/**
 * Run the builder in a throwaway workspace with `ddev` replaced by a recorder, the release list by a stand-in, and the
 * core's layer by stand-ins: `layer` is the runtime it answers with (runtime_of, rt_url, rt_claim, rt_meta,
 * rt_is_platform), or '' for a core that has no layer yet. The recorder does what the container tool would leave on
 * disk: `ddev config` writes the project file on DDEV, the download unpacks a release into the docroot; and it answers
 * `ddev exec pwd` with the runtime's root in the container.
 */
function build(layer: string, env: Record<string, string> = {}) {
  const p = project('other');
  fs.rmSync(p.dir, { recursive: true });
  const log = path.join(p.root, 'ddev.log');
  const address = ADDRESSES[layer] || '';
  const prelude = [
    `ddev() { echo "ddev $*" >> "${log}" ;`,
    `  [ "$1" == config ] && [ "\${RUNTIME_ANSWER}" == ddev ] && mkdir -p .ddev && printf 'name: shop1\\ntype: php\\ndocroot: upload\\n' > .ddev/config.yaml ;`,
    `  case "$*" in *'cp -a opencart-release/upload/.'*) mkdir -p upload/admin && touch upload/config-dist.php upload/admin/config-dist.php upload/cron.php upload/config.php upload/admin/config.php ;; esac ;`,
    `  [ "$*" == "exec pwd" ] && echo "${CONTAINER_ROOTS[layer] || '/var/www/html'}" ;`,
    '  [ -t 0 ] || cat > /dev/null ; return 0 ; }',
    'trim_project_name() { :; } ; drop_database() { echo "drop_database" >> "$DDEV_LOG" ; } ; ddev_nodejs_version() { echo 24 ; } ; ddev_up() { ddev "$@" ; }',
    layer ? [
      'runtime_of() { echo "${RUNTIME_ANSWER}" ; }',
      `rt_url() { [ "\${RUNTIME_ANSWER}" == ddev ] && echo "https://\${PROJECT_NAME}.ddev.site" || echo "${address}" ; }`,
      `rt_claim() { echo "rt_claim $* in $(basename "$PWD")" >> "${log}" ; printf 'x-webship:\\n  platform: %s\\n  docroot: upload\\n' "$1" > compose.yaml ; }`,
      'rt_meta() { sed -n "s/^  $1: *//p" "$2/compose.yaml" 2>/dev/null | head -1 ; }',
      'rt_is_platform() { grep -q "^  platform: $2$" "$1/compose.yaml" 2>/dev/null ; }',
    ].join('\n') : '',
    `source ${FUNCTIONS}`,
    'opencart_release() { echo "${1/latest/4.1.0.4}" ; }',
    'opencart_build',
  ].join('\n');
  const r = spawnSync('bash', ['-c', prelude], { encoding: 'utf8', env: { ...process.env, WORKSPACE_ROOT: p.root, WORKSPACE_SCRIPTS: p.scripts, doc_name: 'dev', PROJECT_NAME: 'shop1', DDEV_LOG: log,
    INSTALL: 'yes', ADD_USERS: 'no', SAMPLE_DATA: 'no', LAUNCH: 'no', VERSION: 'latest', PHP_VERSION: '8.3', distribution_webroot: 'upload',
    RUNTIME: '_none_', RUNTIME_ANSWER: layer || 'ddev', account_name: 'webmaster', account_pass: 'Change_Me.123', account_mail: 'webmaster@example.com', ...env },
    stdio: ['ignore', 'pipe', 'pipe'] });
  const calls = fs.existsSync(log) ? fs.readFileSync(log, 'utf8').trim().split('\n').filter((c) => /^(ddev|rt_claim|drop_database)( |$)/.test(c)) : [];
  return { r, calls, dir: path.join(p.root, 'dev', 'shop1') };
}

test('on DDEV the shop is built in order: a php project, the claim, the release, the installer with the workspace account, no install folder', () => {
  const b = build('');
  assert.strictEqual(b.r.status, 0, b.r.stderr + b.r.stdout);
  const at = (re: RegExp) => b.calls.findIndex((c) => re.test(c));
  assert.strictEqual(b.calls[0], 'drop_database', 'a build is a clean slate');
  assert.match(b.calls[1], /^ddev config --project-type=php --docroot=upload --project-name=shop1 --php-version=8\.3 --database=mariadb:10\.11 --nodejs-version=24$/);
  assert.strictEqual(b.calls[2], 'ddev start -y');
  assert.ok(at(/curl -fsSL --retry 3 --retry-delay 2 -o opencart-release\/release\.zip 'https:\/\/github\.com\/opencart\/opencart\/releases\/download\/4\.1\.0\.4\/opencart-4\.1\.0\.4\.zip'/) > 2, 'the release of the project');
  assert.ok(at(/cp -a opencart-release\/upload\/\. '\/var\/www\/html\/upload\/'/) > 2, 'its upload folder is the docroot');
  assert.ok(at(/^ddev exec -d \/var\/www\/html\/upload cp config-dist\.php config\.php && cp admin\/config-dist\.php admin\/config\.php$/) > at(/cp -a opencart-release/));
  const install = b.calls[at(/cli_install\.php install/)];
  assert.ok(install.startsWith('ddev exec -d /var/www/html/upload php install/cli_install.php install '), install);
  assert.match(install, / --username webmaster --email webmaster@example\.com --password Change_Me\.123 /, 'the workspace account is the installer\'s');
  assert.match(install, / --http_server https:\/\/shop1\.ddev\.site\/ --language en-gb /);
  assert.ok(at(/^ddev exec -d \/var\/www\/html\/upload rm -rf install$/) > at(/cli_install\.php install/), 'the install folder goes after the install');
  const settings = at(/^ddev mysql -e /);
  assert.ok(settings > at(/cli_install\.php install/), 'once the shop is installed');
  assert.ok(b.calls[settings].includes("UPDATE oc_user SET firstname='Workspace', lastname='Owner' WHERE user_id=1"), 'the installer\'s account is named after its owner, not "John Doe"');
  assert.ok(b.calls[settings].includes("UPDATE oc_setting SET value='mail' WHERE store_id=0 AND `key`='config_mail_engine'"), 'the shop\'s mail goes to the mail catcher: the installer sets no mail engine');
  assert.ok(!b.calls.some((c) => c.includes('webship-shop-site')), 'no account and no sample data were asked for');
  const claim = fs.readFileSync(path.join(b.dir, '.ddev', 'config.opencart.yaml'), 'utf8');
  // An overlay of the container tool, with one key nothing of the shop reads: the dashboard takes the name between
  // "config." and ".yaml", and finds the list of the same name (set_opencart_users) in the plugin's functions.
  assert.deepStrictEqual(claim.split('\n').filter((l) => /^[a-z_]+:/.test(l)), ['web_environment:']);
  assert.match(claim, /^web_environment:\n {2}- WEBSHIP_WORKSPACE_PLATFORM=opencart\n$/m);
  assert.match(b.r.stdout, /Go to https:\/\/shop1\.ddev\.site\/, and https:\/\/shop1\.ddev\.site\/admin\/ as webmaster/);
  assert.ok(!b.calls.includes('ddev exec pwd'), 'DDEV is not asked where the project is');
  assert.deepStrictEqual(build('ddev').calls, b.calls, 'the same commands with the layer as without it');
});

test('--add-users and --sample-data write the accounts, then the payment and the coupon, with the script of the shop in its docroot', () => {
  const b = build('', { ADD_USERS: 'yes', SAMPLE_DATA: 'yes' });
  assert.strictEqual(b.r.status, 0, b.r.stderr + b.r.stdout);
  const at = (re: RegExp) => b.calls.findIndex((c) => re.test(c));
  assert.ok(at(/^ddev exec -d \/var\/www\/html\/upload php \.webship-shop-site\.php accounts$/) > at(/rm -rf install/));
  assert.ok(at(/^ddev exec -d \/var\/www\/html\/upload php \.webship-shop-site\.php sample$/) > at(/webship-shop-site\.php accounts/));
  assert.deepStrictEqual(fs.readdirSync(path.join(b.dir, 'upload')).filter((f) => f.startsWith('.webship-')), [], 'the script is gone from the docroot afterwards');
  assert.match(b.r.stdout, /User name: customer@example\.com/);
});

test('without --install the release waits for its web installer, and the accounts and the sample data are said to need one', () => {
  const b = build('', { INSTALL: 'no', ADD_USERS: 'yes', SAMPLE_DATA: 'yes' });
  assert.strictEqual(b.r.status, 0, b.r.stderr + b.r.stdout);
  assert.ok(!b.calls.some((c) => /cli_install|webship-shop-site|rm -rf install/.test(c)), 'nothing is installed');
  assert.match(b.r.stdout, /--add-users needs --install/);
  assert.match(b.r.stdout, /--sample-data needs --install/);
  assert.match(b.r.stdout, /Go to https:\/\/shop1\.ddev\.site\/install\//);
});

test('on Docker Compose, Podman, Kubernetes, Lando and Docksal the plugin claims the shop and installs it at the runtime\'s address, in the runtime\'s root', () => {
  for (const runtime of Object.keys(ADDRESSES)) {
    const address = ADDRESSES[runtime];
    const root = `${CONTAINER_ROOTS[runtime]}/upload`;
    const b = build(runtime, { RUNTIME: runtime, ADD_USERS: 'yes' });
    assert.strictEqual(b.r.status, 0, runtime + ': ' + b.r.stderr + b.r.stdout);
    assert.deepStrictEqual(b.calls.slice(1, 3).map((c) => c.split(' --')[0]), ['ddev config', 'rt_claim opencart in shop1'], runtime);
    assert.ok(b.calls.some((c) => c.includes(`cp -a opencart-release/upload/. '${root}/'`)), `${runtime}: the code goes to the runtime's root`);
    const install = b.calls.find((c) => c.includes('cli_install.php install')) || '';
    assert.ok(install.startsWith(`ddev exec -d ${root} php install/cli_install.php install `), `${runtime}: ${install}`);
    assert.ok(install.includes(` --http_server ${address}/ `), `${runtime}: the shop is installed at the runtime's address`);
    assert.ok(b.calls.includes(`ddev exec -d ${root} php .webship-shop-site.php accounts`), `${runtime}: the accounts, in the runtime's root`);
    assert.ok(!fs.existsSync(path.join(b.dir, '.ddev')), `${runtime}: nothing of DDEV's is written`);
    assert.match(b.r.stdout, new RegExp(`Go to ${address.replace(/[.]/g, '\\.')}/, and ${address.replace(/[.]/g, '\\.')}/admin/ as webmaster`), runtime);
    assert.doesNotMatch(b.r.stdout, /ddev\.site/, runtime);
  }
});

test('--runtime on a workspace without the runtime layer is refused, never built on DDEV in silence', () => {
  const b = build('', { RUNTIME: 'docker' });
  assert.strictEqual(b.r.status, 1);
  assert.match(b.r.stdout, /--runtime docker needs a Webship Workspace with the container runtimes/);
  assert.deepStrictEqual(b.calls, []);
  assert.ok(!fs.existsSync(b.dir), 'no folder was made');
  assert.strictEqual(build('', { RUNTIME: 'ddev' }).r.status, 0);
});

test('the builder takes --runtime, with the runtimes of the core\'s own builders', () => {
  const args = fs.readFileSync(path.join(PKG, 'scripts', 'args', 'arg-opencart.sh'), 'utf8');
  assert.match(args, /parser\.add_argument\('--runtime',\s+dest='RUNTIME',\s+default="_none_",\s+choices=\['ddev', 'docker', 'podman', 'kubernetes', 'lando', 'docksal'\],/);
});

/** A shop of another runtime: compose.yaml with the plugin's claim and the docroot, the shop's files, no .ddev folder. */
function runtimeShop() {
  const p = project('opencart');
  fs.rmSync(path.join(p.dir, '.ddev'), { recursive: true });
  fs.writeFileSync(path.join(p.dir, 'compose.yaml'), 'name: shop1\nx-webship:\n  platform: opencart\n  runtime: lando\n  type: php\n  docroot: "upload"\n  port: 41234\n');
  return p;
}
const LAYER = 'runtime_of() { echo lando ; } ; rt_is_platform() { grep -q "^  platform: $2$" "$1/compose.yaml" 2>/dev/null ; } ; rt_meta() { sed -n "s/^  $1: *//p" "$2/compose.yaml" | head -1 | tr -d \'"\' ; } ; rt_url() { echo http://127.0.0.1:41234 ; } ; ';

test('a shop is known on every runtime: the claim through the core\'s layer, its docroot from the x-webship block', () => {
  const rt = runtimeShop();
  assert.strictEqual(bash(`${LAYER} opencart_is_project ${rt.dir}`).status, 0);
  assert.notStrictEqual(bash(`opencart_is_project ${rt.dir}`).status, 0, 'an older core reads no compose.yaml');
  assert.strictEqual(bash(`${LAYER} opencart_docroot ${rt.dir}`).stdout, 'upload');
  fs.writeFileSync(path.join(rt.dir, 'compose.yaml'), 'name: shop1\nx-webship:\n  runtime: lando\n  type: php\n  docroot: "upload"\n');
  assert.notStrictEqual(bash(`${LAYER} opencart_is_project ${rt.dir}`).status, 0, 'a php project the plugin does not claim is not one');
});

test('the shop\'s tool runs in the runtime\'s root on a shop of a runtime, and says its address', () => {
  const rt = runtimeShop();
  const log = path.join(rt.root, 'ddev.log');
  const env = { WORKSPACE_ROOT: rt.root, WORKSPACE_SCRIPTS: rt.scripts, doc_name: 'dev', PROJECT_NAME: 'shop1', DDEV_LOG: log };
  const pwd = 'ddev() { echo "ddev $*" >> "${DDEV_LOG:-/dev/null}" ; [ "$*" == "exec pwd" ] && echo /app ; [ "$1" == describe ] && echo \'"status":"running"\' ; [ -t 0 ] || cat > /dev/null ; return 0 ; } ; ';
  const what = bash(`${pwd} ${LAYER} trim_project_name() { :; } ; RUN=_none_ ; ADD_USERS=no ; CANCEL_USERS=no ; SAMPLE_DATA=no ; TIDY=no ; opencart_cli_tool`, env);
  assert.strictEqual(what.status, 0, what.stdout + what.stderr);
  assert.match(what.stdout, /^dev\/shop1: OpenCart 4\.1\.0\.4 at http:\/\/127\.0\.0\.1:41234\/ \(the administration: http:\/\/127\.0\.0\.1:41234\/admin\/\)$/m);
  assert.doesNotMatch(what.stdout, /ddev\.site/);
  assert.match(fs.readFileSync(log, 'utf8'), /^ddev exec -d \/app\/upload php \.webship-shop-site\.php status$/m);
  fs.writeFileSync(log, '');
  bash(`${pwd} ${LAYER} trim_project_name() { :; } ; RUN="php -m" ; opencart_cli_tool`, env);
  assert.match(fs.readFileSync(log, 'utf8'), /^ddev exec -d \/app\/upload php -m$/m);
});

test('the feature of the runtimes drives a shop the plugin claims, and names no platform in a step', () => {
  const feature = fs.readFileSync(path.join(PKG, 'features', 'opencart-runtimes.feature'), 'utf8');
  const scenarios = feature.split(/\n(?=  @needs-runtime-)/).slice(1);
  assert.strictEqual(scenarios.length, 6);
  for (const s of scenarios) assert.match(s, /^  @needs-runtime-(docker|kubernetes) @needs-platform-opencart\n  Scenario: /);
  const steps = feature.split('\n').filter((l) => /^\s*(Given|When|Then|And|But) /.test(l));
  for (const s of steps) assert.doesNotMatch(s, /opencart/i, s);
  assert.doesNotMatch(feature, /ddev\.site|127\.0\.0\.1/);
  const manifest = JSON.parse(fs.readFileSync(path.join(PKG, 'package.json'), 'utf8')).workspacePlugin;
  assert.ok(manifest.features.includes('features/opencart-runtimes.feature'));
  // The CI shop has the demo catalog: the feature reads a product of it.
  assert.match(manifest.featuresSite, /^cmd-opencart-project\.sh ci-opencart( [A-Za-z0-9._=-]+)* --install( [A-Za-z0-9._=-]+)* --runtime docker$/);
});

test('the first feature names no platform in a step, logs in as each account by its handle, and creates no account', () => {
  const feature = fs.readFileSync(path.join(PKG, 'testing', 'shop.feature'), 'utf8');
  const steps = feature.split('\n').filter((l) => /^\s*(Given|When|Then|And|But) /.test(l));
  assert.ok(steps.length >= 10);
  for (const s of steps) assert.doesNotMatch(s, /opencart/i, s);
  for (const handle of ['customer', 'admin', 'editor']) assert.match(feature, new RegExp(`logged in to the (shop|administration) as "${handle}"`), `${handle} logs in`);
  assert.doesNotMatch(feature, /webmaster/, 'the workspace account is never written into a test');
  assert.doesNotMatch(feature, /password "|I register|create an account/i, 'no password, and a suite never creates an account');
  const functions = fs.readFileSync(FUNCTIONS, 'utf8');
  assert.match(functions, /tests\/features\/shop\.feature/);
});
