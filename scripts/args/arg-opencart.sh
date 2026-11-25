#!/usr/bin/env bash

argparse "$@" <<ARGEOF || exit 1
parser.add_argument('PROJECT_NAME',
                    help='The name of the project: its folder, and its name on the container runtime (on DDEV its host name too).')
parser.add_argument('--runtime',
                    dest='RUNTIME',
                    default="_none_",
                    choices=['ddev', 'docker', 'podman', 'kubernetes', 'lando', 'docksal'],
                    help='The container runtime to build on: ddev (the default, or container.runtime of settings.yml), docker (Docker Compose), podman, kubernetes, lando or docksal.')
parser.add_argument('-v', '--version',
                    default="${site_version}",
                    help='The OpenCart 4 release to download: latest, or a version number. Example: --version 4.1.0.4 [default %(default)s]')
parser.add_argument('-i', '--install',
                    action='store_true',
                    default=False,
                    help='Install the shop with the command-line installer of OpenCart and its demo catalog, with the workspace account as its administrator, then remove its install folder.')
parser.add_argument('-a', '--add-users',
                    action='store_true',
                    default=False,
                    help='With --install, add the default accounts: an administrator, a catalog editor (a user group with the catalog only) and a customer with an address, the ones the test scenarios log in as.')
parser.add_argument('-s', '--sample-data',
                    action='store_true',
                    default=False,
                    help='With --install, add what the test scenarios name besides the demo catalog: the payment by bank transfer beside cash on delivery, and the coupon WEBSHIP10.')
parser.add_argument('-l', '--launch',
                    action='store_true',
                    default=False,
                    help='Open the shop in a browser when it is ready.')
parser.add_argument('--php-version',
                    default="8.3",
                    choices=['8.3', '8.2', '8.1'],
                    help='PHP version for the project container: OpenCart 4.1 was proven on 8.3 and 8.1. Example: --php-version 8.1 [default %(default)s]')
ARGEOF
