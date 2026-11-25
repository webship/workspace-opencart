#!/usr/bin/env bash

argparse "$@" <<ARGEOF || exit 1
parser.add_argument('PROJECT_NAME',
                    help='The name of the project: an OpenCart shop of this folder.')
parser.add_argument('-r', '--run',
                    default="_none_",
                    help='A command run in the web root of the shop in the container: PHP and its arguments, or another command of the container. Example: --run "php -m" lists the PHP extensions of the shop')
parser.add_argument('-a', '--add-users',
                    action='store_true',
                    default=False,
                    help='Add the default accounts: an administrator, a catalog editor and a customer with an address. An account that is there is kept.')
parser.add_argument('-c', '--cancel-users',
                    action='store_true',
                    default=False,
                    help='Delete the default accounts, the customer with its addresses and wish list; --add-users brings them back.')
parser.add_argument('-s', '--sample-data',
                    action='store_true',
                    default=False,
                    help='Add the payment by bank transfer and the coupon WEBSHIP10 the test scenarios name (what is there already is kept).')
parser.add_argument('-t', '--tidy',
                    action='store_true',
                    default=False,
                    help='Take away what a stopped test run left: every order (voided first, so the stock comes back), the carts, the wish list and the addresses the customer added, the products, categories and coupons named "Webship test …".')
ARGEOF
