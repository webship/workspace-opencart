#!/usr/bin/env bash

# OpenCart for the Webship Workspace: build a shop, run a file of the shop, add its default accounts and the sample
# data, and wire its step pack into the testing setup.
#
# Placed by `plugins.sh --install opencart` in core/scripts/plugins/opencart/functions/, where bootstrap sources it
# after the core's own functions. Everything runs in the project's container (DDEV by default: `ddev exec …`), never
# on the host. The container tool has no project type for OpenCart, so a shop is a `php` project whose docroot is the
# release's `upload/` folder; its admin/config.php is how the functions here recognise one. The installer is given
# the container's own database values (db / db / db) and nothing personal.
#
# The accounts' places and the sample data are written with OpenCart's own models by shop-site.php (beside these
# functions, the step pack's own script), run with PHP in the container's docroot, started the way OpenCart's own
# cron.php starts the framework.
#
# The runtimes: a shop is built on DDEV, or with --runtime on Docker Compose, Podman, Kubernetes, Lando or Docksal.
# The commands are the same on each: `ddev <verb>` is DDEV itself on a DDEV project, and on another runtime the core's
# layer (fun-runtime.sh) gives the verb its meaning there. What differs is behind opencart_runtime: the address
# (opencart_url, which the installer is given), where the shop is in the container (/var/www/html on DDEV; asked of
# the container elsewhere, opencart_container_root), and the docroot (in the x-webship block there).
#
# The claim: the type php says nothing of the platform, so the builder claims the project for the plugin, by which the
# dashboard's row knows the shop and offers its test users. On DDEV that is .ddev/config.opencart.yaml
# (opencart_write_claim); on another runtime it is `platform: opencart` in the x-webship block (the core's rt_claim).
#
# Only the open-source release is built, from the project's releases; no extension of the marketplace is installed,
# and nothing here signs in to an account anywhere.
#
# Four names are the ones the core's tools look for:
#   set_opencart_users          the default accounts            (cmd-tools-add-users.sh <project> opencart)
#   add_opencart_users          create them in the shop         (the same tool, and --add-users of the builder)
#   cancel_opencart_users       delete them                     (cmd-tools-cancel-users.sh <project> opencart)
#   testing_configure_opencart  the step pack in the testing stack (cmd-tools-testing.sh <project>)

# The step pack an OpenCart shop is tested with, and the release line it is required at.
readonly OPENCART_STEPS_PACKAGE='@webship-js/opencart-steps';
readonly OPENCART_STEPS_VERSION='^2.0.0';

# Where the project publishes its releases, the major line this plugin builds, and the release it was proven on.
readonly OPENCART_RELEASES='https://api.github.com/repos/opencart/opencart/releases?per_page=30';
readonly OPENCART_MAJOR='4';
readonly OPENCART_PROVEN_VERSION='4.1.0.4';

# The default accounts: the administrator, the catalog editor and the customer, the ones a scenario logs in as.
# Accounts are configuration, created once in the shop; a test suite never creates or deletes one. The workspace
# account is the installer's, one more administrator, and is in no test. The storefront logs a customer in by its
# address. The role is the user group of an account of the administration, or "Customer".
function set_opencart_users() {
  users=(administrator editor customer);
  local roles=('Administrator' 'Catalog editor' 'Customer') names=('Administrator Test' 'Editor Test' 'Customer Test') i user ;
  for i in "${!users[@]}" ; do
    user="${users[$i]}" ;
    printf -v "user_${user}_name" '%s' "${user}" ;
    printf -v "user_${user}_mail" '%s' "${user}@example.com" ;
    printf -v "user_${user}_password" '%s' 'dD.123123ddd' ;
    printf -v "user_${user}_role" '%s' "${roles[$i]}" ;
    printf -v "user_${user}_fullname" '%s' "${names[$i]}" ;
  done
  # The customer logs in with its address.
  user_customer_name='customer@example.com' ;
}

# The runtime of the project in this folder, or of a new build (--runtime, else the workspace's setting, else DDEV).
# A core without the runtime layer has DDEV only.
function opencart_runtime() {
  if declare -f runtime_of > /dev/null ; then runtime_of ; else echo 'ddev' ; fi
}

# The address of the shop in this folder: https://<name>.ddev.site on DDEV, http://127.0.0.1:<port> on Docker Compose,
# Podman and Lando, the node's address and a port on Kubernetes, http://<name>.docksal.site on Docksal. Asked after
# `ddev config`.
function opencart_url() {
  if declare -f rt_url > /dev/null ; then rt_url ; else echo "https://${PROJECT_NAME}.ddev.site" ; fi
}

# The docroot of a project, from its own container configuration: .ddev/config.yaml on DDEV, the x-webship block (the
# core's rt_meta) on another runtime.
function opencart_docroot() {
  local project_path="$1" docroot ;
  if [ ! -f "${project_path}/.ddev/config.yaml" ] && declare -f rt_meta > /dev/null ; then
    docroot="$(rt_meta docroot "${project_path}")" ;
  else
    docroot="$(grep -E '^docroot:' "${project_path}/.ddev/config.yaml" 2>/dev/null | head -1 | sed -E 's/^docroot:[[:space:]]*//; s/^"(.*)"$/\1/; s/[[:space:]]*$//')" ;
  fi
  printf '%s' "${docroot}" ;
}

# Is this folder an OpenCart shop? Its docroot holds the administration's configuration and the storefront's cron.
function opencart_is_project() {
  local project_path="$1" docroot ;
  # A DDEV project, or one of another runtime the plugin claims (the core's rt_is_platform reads it).
  if [ ! -f "${project_path}/.ddev/config.yaml" ] ; then
    declare -f rt_is_platform > /dev/null && rt_is_platform "${project_path}" opencart || return 1 ;
  fi
  docroot="$(opencart_docroot "${project_path}")" ;
  [ -f "${project_path}/${docroot:+${docroot}/}admin/config-dist.php" ] || [ -f "${project_path}/${docroot:+${docroot}/}admin/config.php" ] || return 1 ;
  [ -f "${project_path}/${docroot:+${docroot}/}cron.php" ] ;
}

# Is the shop installed? The installer writes the database into config.php, and removes nothing else.
function opencart_is_installed() {
  local project_path="$1" docroot ;
  docroot="$(opencart_docroot "${project_path}")" ;
  grep -q "DB_DATABASE', '[^']" "${project_path}/${docroot:+${docroot}/}config.php" 2>/dev/null ;
}

# The release of the shop in a project folder, as its index.php names it.
function opencart_version() {
  local project_path="$1" docroot ;
  docroot="$(opencart_docroot "${project_path}")" ;
  sed -n "s/^define('VERSION', '\([^']*\)');.*/\1/p" "${project_path}/${docroot:+${docroot}/}index.php" 2>/dev/null | head -1 ;
}

# Go to the project a tool was asked about, or say why not.
function opencart_enter_project() {
  local project_path="${WORKSPACE_ROOT}/${doc_name}/${PROJECT_NAME}";
  if [ ! -d "${project_path}" ] ; then
    echo "No project ${PROJECT_NAME} in ${WORKSPACE_ROOT}/${doc_name}." ;
    return 1 ;
  fi
  if ! opencart_is_project "${project_path}" ; then
    echo "${doc_name}/${PROJECT_NAME} is not an OpenCart shop (its docroot has no admin/config.php and cron.php of a shop)." ;
    return 1 ;
  fi
  cd "${project_path}" || return 1 ;
}

# The claim of this plugin on a DDEV project, in the folder of the container tool: a config overlay with one key the
# shop does not read, the name of the platform the project was built as. The dashboard reads the file's name: a
# project that carries config.<plugin>.yaml takes the test users of that plugin.
function opencart_write_claim() {
  local project_path="$1" ;
  mkdir -p "${project_path}/.ddev" || return 1 ;
  cat > "${project_path}/.ddev/config.opencart.yaml" <<'YAMLEOF'
# Written by the OpenCart plugin of the Webship Workspace (cmd-opencart-project.sh).
#
# It is the plugin's claim on this project: the project type php names no platform, so the workspace's tools and its
# dashboard read this file to know the shop, and take its test users for it (cmd-tools-add-users.sh <project>
# opencart). The key below is in the environment of the web container from its next start; nothing of the shop reads it.
web_environment:
  - WEBSHIP_WORKSPACE_PLATFORM=opencart
YAMLEOF
}

# Where the shop is in the container of the project the shell is in: under /var/www/html on DDEV; on another runtime
# the container is asked where the project is (/var/www/html on Docker Compose, Podman and Kubernetes, /app on Lando,
# /var/www on Docksal).
function opencart_container_root() {
  local docroot base='/var/www/html' ; docroot="$(opencart_docroot "$(pwd)")" ;
  if [ "$(opencart_runtime)" != 'ddev' ] ; then
    base="$(ddev exec pwd 2>/dev/null | tr -d '\r' | tail -1)" ;
    base="${base:-/var/www/html}" ;
  fi
  printf '%s' "${base}${docroot:+/${docroot}}" ;
}

# Run shop-site.php in the shop, in the project folder: the accounts, the sample data, a reset, a status, the counts,
# each written or read with OpenCart's own models. The script is copied into the docroot for the run, and removed.
function opencart_shop_site() {
  local script="${WORKSPACE_SCRIPTS}/plugins/opencart/shop-site.php" docroot status ;
  if [ ! -f "${script}" ] ; then
    echo "The OpenCart plugin's shop-site.php is not at ${script}: install the plugin again (plugins.sh --install opencart)." ;
    return 1 ;
  fi
  docroot="$(opencart_docroot "$(pwd)")" ;
  cp "${script}" "${docroot:+${docroot}/}.webship-shop-site.php" || return 1 ;
  ddev exec -d "$(opencart_container_root)" php .webship-shop-site.php "$@" < /dev/null ;
  status=$? ;
  rm -f "${docroot:+${docroot}/}.webship-shop-site.php" ;
  return ${status} ;
}

# Give the installer's account (user 1, the workspace account) the workspace password, stored as the shop stores one
# (PHP's password_hash), with the database settings of the shop's own config.php. For a password longer than the 20
# characters the installer takes; the shop's own forms take up to 40. Run in the project folder; the script is written
# into the docroot for the run, and removed.
function opencart_set_owner_password() {
  local root="$1" docroot status ;
  docroot="$(opencart_docroot "$(pwd)")" ;
  cat > "${docroot:+${docroot}/}.webship-owner.php" <<'PHPEOF'
<?php
// The password of the workspace account, user 1 of the shop (written by the OpenCart plugin of the Webship Workspace).
require __DIR__ . '/config.php';
$db = new mysqli(DB_HOSTNAME, DB_USERNAME, DB_PASSWORD, DB_DATABASE, (int)DB_PORT);
$hash = password_hash((string)getenv('WEBSHIP_OWNER_PASSWORD'), PASSWORD_DEFAULT);
$query = $db->prepare('UPDATE `' . DB_PREFIX . 'user` SET `password` = ? WHERE `user_id` = 1');
$query->bind_param('s', $hash);
exit($query->execute() && $db->affected_rows === 1 ? 0 : 1);
PHPEOF
  ddev exec -d "${root}" "WEBSHIP_OWNER_PASSWORD=$(printf '%q' "${account_pass}") php .webship-owner.php" < /dev/null ;
  status=$? ;
  rm -f "${docroot:+${docroot}/}.webship-owner.php" ;
  return ${status} ;
}

# The release of OpenCart to download: the number asked for, or the newest stable one of the major line this plugin
# builds, from the project's releases (read in the container; the proven release when the list cannot be read).
function opencart_release() {
  local wanted="$1" ;
  if [ "${wanted}" != 'latest' ] ; then echo "${wanted}" ; return 0 ; fi
  ddev exec "curl -fsSL --retry 3 --retry-delay 2 '${OPENCART_RELEASES}'" 2>/dev/null < /dev/null | python3 -c '
import json, sys
major = sys.argv[1]
try:
    releases = json.load(sys.stdin)
except ValueError:
    sys.exit(1)
tags = [r["tag_name"] for r in releases if not r.get("prerelease") and not r.get("draft") and str(r.get("tag_name", "")).startswith(major + ".")]
if not tags:
    sys.exit(1)
print(sorted(tags, key=lambda t: [int(x) for x in t.split(".") if x.isdigit()])[-1])
' "${OPENCART_MAJOR}" || echo "${OPENCART_PROVEN_VERSION}" ;
}

# Build an OpenCart shop from nothing: the container, the code, and with --install the shop itself.
function opencart_build() {
  trim_project_name ;
  local base_url runtime ;
  runtime="$(opencart_runtime)" ;
  if [ "${RUNTIME:-_none_}" != '_none_' ] && [ "${RUNTIME}" != "${runtime}" ] ; then
    echo "--runtime ${RUNTIME} needs a Webship Workspace with the container runtimes (webship/workspace#694): update the workspace, or build on DDEV." ;
    exit 1 ;
  fi
  local version="${VERSION:-${site_version:-latest}}" ;
  local php_version="${PHP_VERSION:-${site_php_version:-8.3}}" ;
  local docroot="${distribution_webroot:-upload}" ;
  local root="/var/www/html/${docroot}" ;

  if [ ! "${version}" == 'latest' ] && [[ ! "${version}" == ${OPENCART_MAJOR}.* ]] ; then
    echo "This builder makes an OpenCart ${OPENCART_MAJOR} shop: --version is latest or a ${OPENCART_MAJOR}.x number such as ${OPENCART_PROVEN_VERSION}." ;
    exit 1 ;
  fi
  # The installer takes a user name of 3 to 20 characters and a password of 5 to 20; the shop's own forms take a
  # password of up to 40, so a longer one is set once the shop is installed. A workspace account the shop would refuse
  # is said before anything is built.
  local install_pass="${account_pass}" ;
  if [ "${INSTALL}" == 'yes' ] ; then
    if [ "${#account_name}" -lt 3 ] || [ "${#account_name}" -gt 20 ] || [ "${#account_pass}" -lt 5 ] || [ "${#account_pass}" -gt 40 ] || [[ ! "${account_mail}" == ?*@?*.?* ]] ; then
      echo "OpenCart takes a user name of 3 to 20 characters, a password of 5 to 40 and an e-mail address, and the workspace account does not fit." ;
      echo "Change account: in core/config/settings.yml, or build without --install." ;
      exit 1 ;
    fi
    [ "${#account_pass}" -gt 20 ] && install_pass="Ws-$(date +%s%N | sha256sum | head -c 16)" ;
  fi

  cd ${WORKSPACE_ROOT}/${doc_name} || exit 1 ;
  drop_database ;
  rm -rf "${PROJECT_NAME}" ;
  mkdir -p "${PROJECT_NAME}/${docroot}" ;
  cd ${WORKSPACE_ROOT}/${doc_name}/${PROJECT_NAME} || exit 1 ;

  ddev config --project-type=php --docroot="${docroot}" --project-name=${PROJECT_NAME} \
    --php-version=${php_version} --database=mariadb:10.11 --nodejs-version=$(ddev_nodejs_version) || exit 1 ;
  # The plugin claims the project, so the tools and the dashboard know it is a shop (the type php says nothing of
  # the platform): a file of its own in .ddev/ on DDEV, the x-webship block on another runtime.
  if [ "${runtime}" != 'ddev' ] ; then
    rt_claim opencart || exit 1 ;
  else
    opencart_write_claim "$(pwd)" || { echo "The plugin's claim on the project could not be written." ; exit 1 ; } ;
  fi
  # The address is the runtime's to say, once the project is configured: never a written ddev.site.
  base_url="$(opencart_url)" ;
  ddev_up start -y || exit 1 ;
  [ "${runtime}" != 'ddev' ] && root="$(opencart_container_root)" ;

  version="$(opencart_release "${version}")" ;
  echo "Downloading OpenCart ${version}." ;
  ddev exec "cd /tmp && rm -rf opencart-release && mkdir opencart-release && curl -fsSL --retry 3 --retry-delay 2 -o opencart-release/release.zip 'https://github.com/opencart/opencart/releases/download/${version}/opencart-${version}.zip' \
    && unzip -q -o opencart-release/release.zip -d opencart-release && cp -a opencart-release/upload/. '${root}/' && rm -rf opencart-release" < /dev/null \
    || { echo "The OpenCart ${version} release could not be downloaded or unpacked." ; exit 1 ; } ;
  ddev exec -d "${root}" "cp config-dist.php config.php && cp admin/config-dist.php admin/config.php" < /dev/null || exit 1 ;

  if [ "${INSTALL}" == 'yes' ] ; then
    # The container's own database values, the same in every project: nothing personal is written.
    echo "Installing the shop with the demo catalog." ;
    ddev exec -d "${root}" "php install/cli_install.php install \
      --username $(printf '%q' "${account_name}") --email $(printf '%q' "${account_mail}") --password $(printf '%q' "${install_pass}") \
      --http_server $(printf '%q' "${base_url}/") --language en-gb \
      --db_driver mysqli --db_hostname db --db_username db --db_password db --db_database db --db_port 3306 --db_prefix oc_" < /dev/null \
      || { echo "The OpenCart installer failed." ; exit 1 ; } ;
    # OpenCart asks for its install folder to go once the shop is installed.
    ddev exec -d "${root}" "rm -rf install" < /dev/null ;
    # The installer names its account "John Doe" in the administration's header: the workspace account is its owner.
    # And it sets no mail engine, so the shop sends nothing: PHP's mail() it is ("Mail" in its settings), which the
    # container hands to the runtime's mail catcher (Mailpit on DDEV), so no mail leaves the machine.
    ddev mysql -e "UPDATE oc_user SET firstname='Workspace', lastname='Owner' WHERE user_id=1 ; UPDATE oc_setting SET value='mail' WHERE store_id=0 AND \`key\`='config_mail_engine'" < /dev/null ;
    # A workspace password longer than the installer takes is the account's now, stored the way the shop stores one.
    if [ "${install_pass}" != "${account_pass}" ] ; then
      opencart_set_owner_password "${root}" || { echo "The workspace account's password could not be set in the shop." ; exit 1 ; } ;
    fi

    if [ "${ADD_USERS}" == 'yes' ] ; then
      set_opencart_users ;
      add_opencart_users ;
      cd ${WORKSPACE_ROOT}/${doc_name}/${PROJECT_NAME} || exit 1 ;
    fi
    if [ "${SAMPLE_DATA}" == 'yes' ] ; then
      opencart_shop_site sample || { echo "The sample data could not be added." ; exit 1 ; } ;
    fi

    echo "${doc_name} ${PROJECT_NAME} has been installed: OpenCart ${version}.";
    echo "Go to ${base_url}/, and ${base_url}/admin/ as ${account_name}";
  else
    [ "${ADD_USERS}" == 'yes' ] && echo "--add-users needs --install: there is no shop to add accounts to yet." ;
    [ "${SAMPLE_DATA}" == 'yes' ] && echo "--sample-data needs --install: there is no shop to add it to yet." ;
    echo "${doc_name} ${PROJECT_NAME} is ready to install.";
    echo "Go to ${base_url}/install/";
  fi

  if [ "${LAUNCH}" == 'yes' ] ; then
    ddev launch ;
  fi

  cd ${WORKSPACE_ROOT}/${doc_name};
}

# Create the default accounts in the shop with OpenCart's own models (shop-site.php accounts): the administrator, the
# catalog editor and its user group, the customer with its address. An account that is already there is kept. The
# list is loaded by the caller (set_opencart_users): the core's add_users, the builder, the shop's tool.
function add_opencart_users() {
  opencart_enter_project || return 1 ;
  local user user_name user_mail user_password user_role user_fullname status ;
  for user in "${users[@]}" ; do
    user_name="user_${user}_name"; user_mail="user_${user}_mail";
    user_password="user_${user}_password"; user_role="user_${user}_role"; user_fullname="user_${user}_fullname";
    echo " ---------------------------------------------------------------- ";
    echo "      User name: ${!user_name}";
    echo "      User mail: ${!user_mail}";
    echo "  User password: ${!user_password}";
    echo "      User role: ${!user_role}";
    echo "   Display name: ${!user_fullname}";
    echo " ================================================================= ";
  done
  opencart_shop_site accounts ; status=$? ;
  cd ${WORKSPACE_ROOT}/${doc_name};
  return ${status} ;
}

# Delete the default accounts with OpenCart's own models (shop-site.php cancel-accounts): the customer with its
# addresses and wish list, the editor, and the administrator unless it is the shop's only one.
function cancel_opencart_users() {
  opencart_enter_project || return 1 ;
  local user user_name status ;
  for user in "${users[@]}" ; do
    user_name="user_${user}_name";
    echo " ---------------------------------------------------------------- ";
    echo "      User name: ${!user_name}";
    echo " ================================================================= ";
  done
  opencart_shop_site cancel-accounts ; status=$? ;
  cd ${WORKSPACE_ROOT}/${doc_name};
  return ${status} ;
}

# What cmd-tools-opencart-cli.sh does: the first of --run (a command in the shop's web root), --add-users, --cancel-users,
# --sample-data, --tidy that was asked for; with none of them, what the shop holds.
function opencart_cli_tool() {
  trim_project_name ;
  opencart_enter_project || exit 1 ;
  if ! ddev describe -j 2>/dev/null < /dev/null | grep -q '"status":"running"' ; then
    ddev start -y < /dev/null || exit 1 ;
  fi
  if [ ! "${RUN}" == '_none_' ] ; then
    # One string on purpose: --run "php -m" is a command and its arguments, run in the shop's web root.
    # (OpenCart 4.1.0.4's own cron.php stops on the command line: it does not load the libraries its templates need.
    # The shop's scheduled tasks run from the address its Cron Jobs page gives, index.php?route=cron/cron.)
    ddev exec -d "$(opencart_container_root)" "${RUN}" < /dev/null ;
    exit $? ;
  fi
  if ! opencart_is_installed "$(pwd)" ; then
    echo "${doc_name}/${PROJECT_NAME}: the shop is not installed yet: open $(opencart_url)/install/, or build it again with --install." ;
    exit 1 ;
  fi
  if [ "${ADD_USERS}" == 'yes' ] ; then
    set_opencart_users ;
    add_opencart_users ;
  elif [ "${CANCEL_USERS}" == 'yes' ] ; then
    set_opencart_users ;
    cancel_opencart_users ;
  elif [ "${SAMPLE_DATA}" == 'yes' ] ; then
    opencart_shop_site sample || exit 1 ;
  elif [ "${TIDY}" == 'yes' ] ; then
    opencart_shop_site reset-orders || exit 1 ;
    opencart_shop_site reset || exit 1 ;
    echo "The shop is back as the build left it." ;
  else
    echo "${doc_name}/${PROJECT_NAME}: OpenCart $(opencart_version "$(pwd)") at $(opencart_url)/ (the administration: $(opencart_url)/admin/)" ;
    echo "" ;
    opencart_shop_site status || exit 1 ;
  fi
  cd ${WORKSPACE_ROOT}/${doc_name};
}

# The step pack in the testing stack of an OpenCart shop. The core's testing_configure calls this in the project
# folder once webship-js is scaffolded and before the dependencies are installed; for a project that is not a shop it
# changes nothing.
#
# It adds the pack to package.json, lists its step definitions in cucumber.js after webship-js's own, the tags that
# keep its assertions that must fail out of a normal run, the shop's settings the steps read (its language, the folder
# of its administration, the account that puts back what a scenario changed, the order status that voids an order),
# the users registry (a handle a scenario reads, mapped to an account; never the workspace account), and writes a
# first feature when the project has none of its own. Every part is skipped when it is already there, so a second run
# adds what the first missed and never resets a suite.
function testing_configure_opencart() {
  local project_path="$1";
  opencart_is_project "${project_path}" || return 0 ;
  if [ ! -f "${project_path}/cucumber.js" ] || [ ! -f "${project_path}/package.json" ] ; then
    echo "  OpenCart: cucumber.js is not here yet — run the testing setup again once webship-js is scaffolded." ;
    return 1 ;
  fi
  echo "Adding the OpenCart step pack (${OPENCART_STEPS_PACKAGE} ${OPENCART_STEPS_VERSION}).";
  set_opencart_users ;
  local registry="" user user_name user_mail user_password user_fullname handle ;
  for user in "${users[@]}" ; do
    user_name="user_${user}_name"; user_mail="user_${user}_mail"; user_password="user_${user}_password"; user_fullname="user_${user}_fullname";
    # The pack's features call the administrator "admin".
    handle="${user}" ; [ "${user}" == 'administrator' ] && handle="admin" ;
    registry="${registry}${handle}|${!user_name}|${!user_password}|${!user_mail}|${!user_fullname}"$'\n' ;
  done

  python3 - "${project_path}" "${OPENCART_STEPS_PACKAGE}" "${OPENCART_STEPS_VERSION}" 'OC' "${registry}" <<'PYEOF' || return 1
import json, re, sys

project, pack, version, prefix, registry = sys.argv[1:6]

# package.json: the pack as a dev dependency, at the release line this plugin was proven on.
pkg_file = project + '/package.json'
pkg = json.load(open(pkg_file))
if pack not in pkg.get('dependencies', {}) and pack not in pkg.get('devDependencies', {}):
    pkg.setdefault('devDependencies', {})[pack] = version
    open(pkg_file, 'w').write(json.dumps(pkg, indent=2) + '\n')
    print('  package.json: %s %s' % (pack, version))

cucumber_file = project + '/cucumber.js'
src = open(cucumber_file).read()
before = src

# The pack's step definitions, after webship-js's own.
if ('node_modules/%s/' % pack) not in src:
    line = "'node_modules/%s/tests/step-definitions/**/*.js'," % pack
    core = re.search(r"^([ \t]*)'node_modules/webship-js/tests/step-definitions/[^']*',.*$", src, re.M)
    opening = re.search(r"^([ \t]*)require:[ \t]*\[[ \t]*$", src, re.M)
    if core:
        src = src[:core.end()] + '\n' + core.group(1) + line + src[core.end():]
    elif opening:
        src = src[:opening.end()] + '\n' + opening.group(1) + '  ' + line + src[opening.end():]
    else:
        sys.exit("  cucumber.js has no require list this can add to. Add this line to it:\n    " + line)
    print('  cucumber.js: the step definitions of %s' % pack)

# The pack's assertions that must fail are no part of a normal run.
if not re.search(r"^[ \t]*tags:", src, re.M):
    default = re.search(r"^([ \t]*)default:[ \t]*\{[ \t]*$", src, re.M)
    if default:
        pad = default.group(1) + '  '
        src = src[:default.end()] + '\n' + pad + "// Work in progress and the assertions that must fail (@must-fail) stay out of a normal run.\n" \
            + pad + "tags: process.env.CUCUMBER_TAGS || 'not @wip and not @must-fail'," + src[default.end():]
        print('  cucumber.js: the tags that keep the assertions that must fail out of a normal run')

world = re.search(r"^([ \t]*)worldParameters:[ \t]*\{[ \t]*$", src, re.M)
if not world:
    sys.exit("  cucumber.js has no worldParameters block to add the shop's settings and the users registry to.")
pad = world.group(1) + '  '

# The shop's settings the steps read.
if not re.search(r"^[ \t]*shop:[ \t]*\{", src, re.M):
    block = pad + "// The shop: its language, the folder of its administration, the account that puts back what a scenario\n" \
        + pad + "// changed, and the order status that voids an order (OpenCart's \"Voided\").\n" \
        + pad + "shop: { language: 'en-gb', admin: 'admin', manager: 'admin', voidStatusId: 16 },"
    src = src[:world.end()] + '\n' + block + src[world.end():]
    print("  cucumber.js: the shop's settings (its language, its administration, the manager's account)")
    world = re.search(r"^([ \t]*)worldParameters:[ \t]*\{[ \t]*$", src, re.M)

rows = [r.split('|') for r in registry.splitlines() if r.strip()]
entry = lambda handle, login, password, mail, name: "%s: { username: process.env.%s_%s_USER || '%s', password: process.env.%s_%s_PASSWORD || '%s', email: '%s', name: '%s' }," % (
    handle, prefix, handle.upper(), login, prefix, handle.upper(), password, mail, name)
users = re.search(r"^([ \t]*)users:[ \t]*\{[ \t]*$", src, re.M)
if users:
    missing = [r for r in rows if not re.search(r"^[ \t]*%s:[ \t]*\{" % re.escape(r[0]), src, re.M)]
    if missing:
        inner = users.group(1) + '  '
        src = src[:users.end()] + '\n' + '\n'.join(inner + entry(*r) for r in missing) + src[users.end():]
        print("  cucumber.js: the shop's accounts in the users registry (%s)" % ', '.join(r[0] for r in missing))
else:
    block = [
        pad + "// The users registry: a handle a scenario reads, mapped to an account of this shop (the default",
        pad + "// accounts: cmd-tools-add-users.sh <project> opencart). Override one with %s_<HANDLE>_USER and %s_<HANDLE>_PASSWORD." % (prefix, prefix),
        pad + "users: {",
    ] + [pad + '  ' + entry(*r) for r in rows] + [pad + "},"]
    src = src[:world.end()] + '\n' + '\n'.join(block) + src[world.end():]
    print('  cucumber.js: the users registry (%s)' % ', '.join(r[0] for r in rows))

if src != before:
    open(cucumber_file, 'w').write(src)
PYEOF

  # A first feature for the shop, when the project has none: the storefront, a product in the cart, each account.
  local feature="${WORKSPACE_SCRIPTS}/plugins/opencart/shop.feature" ;
  if [ -f "${feature}" ] && [ ! -f "${project_path}/tests/features/shop.feature" ] ; then
    mkdir -p "${project_path}/tests/features" && cp "${feature}" "${project_path}/tests/features/shop.feature" \
      && echo "  tests/features/shop.feature: a first feature for the shop" ;
  fi

  # The scenarios log in as the default accounts: make sure an installed shop has them.
  if opencart_is_installed "${project_path}" ; then
    ( add_opencart_users > /dev/null ) && echo "  the default accounts of the shop are there (${users[*]})" ;
  fi
}
