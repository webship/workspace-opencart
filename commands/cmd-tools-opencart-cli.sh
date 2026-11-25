#!/usr/bin/env bash

# Installed by the OpenCart plugin (plugins.sh --install opencart); __WORKSPACE__ is the workspace it was installed into.
#
# The shop of one site of this workspace, in the project's web container: say what it holds (the accounts, the
# payments, the coupon, the orders), run a command in the shop's web root, add or cancel the default accounts, add the
# sample data, take away what a stopped test run left. Nothing here runs on the host.

# Bootstrap.
# Find the workspace tooling from this script, so a fresh clone needs no setup.
WORKSPACE_SCRIPTS="${WORKSPACE_SCRIPTS:-$(cd "$(dirname "${BASH_SOURCE[0]}")/../core/scripts" && pwd)}";
source ${WORKSPACE_SCRIPTS}/bootstrap.sh || exit 1 ;

# Load workspace settings.
eval $(parse_yaml ${WORKSPACE_CONFIG}/workspace.__WORKSPACE__.settings.yml);

# Distribution.
distribution_name="opencart";

ARGPARSE_DESCRIPTION="The shop of a site of __WORKSPACE__: what it holds, a command in its web root, the default accounts, the sample data, a tidy-up"
# The args file comes with the plugin: core/scripts/plugins/opencart/ is where plugins.sh --install puts it.
source ${WORKSPACE_SCRIPTS}/plugins/opencart/args/arg-opencart-cli.sh || exit 1 ;

shift $#;

opencart_cli_tool ;
