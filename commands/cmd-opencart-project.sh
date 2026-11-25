#!/usr/bin/env bash

# workspace-name: OpenCart (4.x)

# Installed by the OpenCart plugin (plugins.sh --install opencart); __WORKSPACE__ is the workspace it was installed into.
#
# Build an OpenCart shop in a container: the latest release of OpenCart 4 from its releases, or the one --version
# names, on DDEV (the default) at https://<name>.ddev.site, or with --runtime docker, podman, kubernetes, lando or
# docksal at the address the build prints. With --install the shop is installed with OpenCart's own command-line
# installer, its demo catalog and the workspace account as its administrator; with --add-users it also gets the
# default accounts: an administrator, a catalog editor and a customer; with --sample-data the payment by bank transfer
# and the coupon the step pack's features name. The shop's own tool is cmd-tools-opencart-cli.sh.

# Bootstrap.
# Find the workspace tooling from this script, so a fresh clone needs no setup.
WORKSPACE_SCRIPTS="${WORKSPACE_SCRIPTS:-$(cd "$(dirname "${BASH_SOURCE[0]}")/../core/scripts" && pwd)}";
source ${WORKSPACE_SCRIPTS}/bootstrap.sh || exit 1 ;

# Load workspace settings.
eval $(parse_yaml ${WORKSPACE_CONFIG}/workspace.__WORKSPACE__.settings.yml);

# Set site version.
site_version="latest";

# Distribution.
distribution_name="opencart";
distribution_title="OpenCart";
distribution_webroot="upload";

ARGPARSE_DESCRIPTION="Build an ${distribution_title} shop in __WORKSPACE__"
# The args file comes with the plugin: core/scripts/plugins/opencart/ is where plugins.sh --install puts it.
source ${WORKSPACE_SCRIPTS}/plugins/opencart/args/arg-opencart.sh || exit 1 ;

shift $#;

opencart_build ;
