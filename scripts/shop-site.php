<?php
/**
 * The shop of the test site: the accounts' places and the test content.
 *
 * Run in the shop's web root (the folder of index.php), in the web container, once OpenCart is installed:
 *
 *   php shop-site.php content        the accounts (the administrator's name, the catalog editor and its user group,
 *                                    the storefront's customer and its address), bank transfer beside cash on
 *                                    delivery, and the coupon WEBSHIP10 (what is there already is kept); the demo
 *                                    data's addresses of products that do not exist go
 *   php shop-site.php accounts       the accounts only; sample: the payment, the coupon and the demo data's stale
 *                                    addresses only (the Webship Workspace's --add-users and --sample-data)
 *   php shop-site.php cancel-accounts  the accounts deleted (the Workspace's cancel of the test users)
 *   php shop-site.php reset-orders   every order deleted the storefront's own way: voided first, so OpenCart's
 *                                    events put the stock, the statistics and a coupon's use back
 *   php shop-site.php reset          what a stopped run left behind goes: the carts, the customer's wish list and
 *                                    added addresses, the products, categories and coupons named "Webship test …",
 *                                    the login records of the suite's accounts; the statistics are counted again
 *   php shop-site.php status         say what the shop holds for the accounts of the suite
 *   php shop-site.php counts         the counts a test run must leave as it found them (CI compares them)
 *
 * Everything is written with OpenCart's own models (the administration's user, user group, customer, coupon,
 * product, category, setting and extension models; the storefront's order model), started the way OpenCart's own
 * cron.php starts the framework. No account of the installer is created here: the administrator is the installer's.
 */

$webship_mode = $argv[1] ?? 'content';
// Every mode runs in the administration's application but the orders', which the storefront's model deletes.
define('WEBSHIP_APP', $webship_mode === 'reset-orders' ? 'Catalog' : 'Admin');

$_SERVER += ['HTTPS' => false, 'REMOTE_ADDR' => '127.0.0.1', 'HTTP_USER_AGENT' => 'webship-build', 'HTTP_ACCEPT_LANGUAGE' => 'en-gb', 'HTTP_HOST' => 'localhost', 'REQUEST_METHOD' => 'GET', 'SERVER_PORT' => 80];
require_once __DIR__ . (WEBSHIP_APP === 'Admin' ? '/admin/config.php' : '/config.php');
require_once DIR_SYSTEM . 'startup.php';

$autoloader = new \Opencart\System\Engine\Autoloader();
$autoloader->register('Opencart\\' . WEBSHIP_APP, DIR_APPLICATION);
$autoloader->register('Opencart\Extension', DIR_EXTENSION);
$autoloader->register('Opencart\System', DIR_SYSTEM);
if (is_file(DIR_STORAGE . 'vendor/autoload.php')) {
	require_once DIR_STORAGE . 'vendor/autoload.php';
}

$registry = new \Opencart\System\Engine\Registry();
$registry->set('autoloader', $autoloader);
$config = new \Opencart\System\Engine\Config();
$config->addPath(DIR_CONFIG);
$config->load('default');
$config->load(strtolower(WEBSHIP_APP));
$config->set('application', WEBSHIP_APP);
$registry->set('config', $config);
$registry->set('log', new \Opencart\System\Library\Log($config->get('error_filename')));
$event = new \Opencart\System\Engine\Event($registry);
$registry->set('event', $event);
$registry->set('factory', new \Opencart\System\Engine\Factory($registry));
$registry->set('load', new \Opencart\System\Engine\Loader($registry));
$registry->set('request', new \Opencart\System\Library\Request());
$db = new \Opencart\System\Library\DB(DB_DRIVER, DB_HOSTNAME, DB_USERNAME, DB_PASSWORD, DB_DATABASE, DB_PORT);
$registry->set('db', $db);
$registry->set('cache', new \Opencart\System\Library\Cache($config->get('cache_engine'), $config->get('cache_expire')));
foreach ($db->query("SELECT * FROM `" . DB_PREFIX . "setting` WHERE `store_id` = '0'")->rows as $setting) {
	$config->set($setting['key'], $setting['serialized'] ? json_decode($setting['value'], true) : $setting['value']);
}
$config->set('config_store_id', 0);
$language = new \Opencart\System\Library\Language($config->get('language_code') ?: 'en-gb');
$language->addPath(DIR_LANGUAGE);
$language->load('default');
$registry->set('language', $language);
// The storefront's events, as its startup registers them: the history of an order moves the statistics.
if (WEBSHIP_APP === 'Catalog') {
	foreach ($db->query("SELECT * FROM `" . DB_PREFIX . "event` WHERE `status` = '1' ORDER BY `sort_order`")->rows as $row) {
		$part = explode('/', $row['trigger']);
		if ($part[0] === 'catalog' && !str_starts_with((string)$row['code'], 'mail_')) {
			array_shift($part);
			$event->register(implode('/', $part), new \Opencart\System\Engine\Action($row['action']), (int)$row['sort_order']);
		}
	}
}

/** The suite's accounts: the administration's logins and the storefront's address. */
const WEBSHIP_USERS = ['administrator', 'editor'];
const WEBSHIP_CUSTOMER = 'customer@example.com';
const WEBSHIP_COUPON = 'WEBSHIP10';

function webship_q($db, string $sql): array {
	return $db->query($sql)->rows;
}

function webship_n($db, string $sql): int {
	return (int)$db->query($sql)->row['n'];
}

/** A row of a table by a condition, the first only. */
function webship_row($db, string $table, string $where): array {
	return $db->query("SELECT * FROM `" . DB_PREFIX . $table . "` WHERE " . $where . " LIMIT 1")->row;
}

function webship_customer_id($db): int {
	return (int)(webship_row($db, 'customer', "`email` = '" . WEBSHIP_CUSTOMER . "'")['customer_id'] ?? 0);
}

/**
 * The administrator, in the Administrator group, with the name the administration shows: the installer's account
 * when the build named it so, else an account of its own (the Webship Workspace's installer is the workspace
 * account); and the catalog editor.
 */
function webship_set_users($registry): void {
	$db = $registry->get('db');
	$load = $registry->get('load');
	$load->model('user/user_group');
	$load->model('user/user');
	$users = $registry->get('model_user_user');
	$admin = $users->getUserByUsername('administrator');
	if (!$admin) {
		$group = webship_row($db, 'user_group', "`name` = 'Administrator'");
		$users->addUser(['username' => 'administrator', 'user_group_id' => (int)($group['user_group_id'] ?? 1), 'password' => 'dD.123123ddd', 'firstname' => 'Administrator', 'lastname' => 'Test', 'email' => 'administrator@example.com', 'image' => '', 'status' => 1]);
		echo "  user administrator (Administrator)\n";
	} elseif ($admin['firstname'] !== 'Administrator' || $admin['lastname'] !== 'Test') {
		$db->query("UPDATE `" . DB_PREFIX . "user` SET `firstname` = 'Administrator', `lastname` = 'Test' WHERE `user_id` = '" . (int)$admin['user_id'] . "'");
		echo "  administrator: Administrator Test\n";
	}
	$routes = ['catalog/attribute', 'catalog/attribute_group', 'catalog/category', 'catalog/download', 'catalog/filter', 'catalog/filter_group', 'catalog/information', 'catalog/manufacturer', 'catalog/option', 'catalog/product', 'catalog/review', 'catalog/subscription_plan', 'common/filemanager'];
	$group = webship_row($db, 'user_group', "`name` = 'Catalog editor'");
	$group_id = $group ? (int)$group['user_group_id'] : $registry->get('model_user_user_group')->addUserGroup(['name' => 'Catalog editor', 'permission' => ['access' => $routes, 'modify' => $routes]]);
	if (!$group) {
		echo "  user group Catalog editor: the catalog's screens only\n";
	}
	if (!$users->getUserByUsername('editor')) {
		$users->addUser(['username' => 'editor', 'user_group_id' => $group_id, 'password' => 'dD.123123ddd', 'firstname' => 'Editor', 'lastname' => 'Test', 'email' => 'editor@example.com', 'image' => '', 'status' => 1]);
		echo "  user editor (Catalog editor)\n";
	}
}

/** The storefront's customer, with an address in London (the demo store is in the United Kingdom). */
function webship_set_customer($registry): void {
	$db = $registry->get('db');
	$config = $registry->get('config');
	$registry->get('load')->model('customer/customer');
	$customers = $registry->get('model_customer_customer');
	$customer_id = webship_customer_id($db);
	if (!$customer_id) {
		$customer_id = $customers->addCustomer([
			'store_id' => 0, 'language_id' => (int)$config->get('config_language_id') ?: 1, 'customer_group_id' => (int)$config->get('config_customer_group_id') ?: 1,
			'firstname' => 'Customer', 'lastname' => 'Test', 'email' => WEBSHIP_CUSTOMER, 'telephone' => '0123456789',
			'custom_field' => [], 'newsletter' => 0, 'password' => 'dD.123123ddd', 'status' => 1, 'safe' => 0, 'commenter' => 0,
		]);
		echo "  customer " . WEBSHIP_CUSTOMER . "\n";
	}
	if (webship_n($db, "SELECT COUNT(*) AS n FROM `" . DB_PREFIX . "address` WHERE `customer_id` = '" . $customer_id . "'")) {
		return;
	}
	$country = webship_row($db, 'country', "`iso_code_2` = 'GB'");
	$zone = $db->query("SELECT z.`zone_id` FROM `" . DB_PREFIX . "zone` z JOIN `" . DB_PREFIX . "zone_description` zd ON zd.`zone_id` = z.`zone_id` WHERE z.`country_id` = '" . (int)($country['country_id'] ?? 0) . "' AND zd.`name` = 'Greater London' LIMIT 1")->row;
	$customers->addAddress($customer_id, [
		'firstname' => 'Customer', 'lastname' => 'Test', 'company' => '', 'address_1' => '1 Webship Street', 'address_2' => '',
		'city' => 'London', 'postcode' => 'SW1A 1AA', 'country_id' => (int)($country['country_id'] ?? 0), 'zone_id' => (int)($zone['zone_id'] ?? 0),
		'custom_field' => [], 'default' => 1,
	]);
	echo "  " . WEBSHIP_CUSTOMER . ": its address in London\n";
}

/** Bank transfer beside cash on delivery: the shop's own extension, installed and turned on, with its instructions. */
function webship_set_bank_transfer($registry): void {
	$db = $registry->get('db');
	$load = $registry->get('load');
	$load->model('setting/extension');
	$load->model('setting/setting');
	$load->model('user/user_group');
	if (webship_row($db, 'extension', "`type` = 'payment' AND `code` = 'bank_transfer'")) {
		return;
	}
	$registry->get('model_setting_extension')->install('payment', 'opencart', 'bank_transfer');
	$language_id = (int)($registry->get('config')->get('config_language_id') ?: 1);
	$pending = webship_row($db, 'order_status', "`name` = 'Pending' AND `language_id` = '" . $language_id . "'");
	$registry->get('model_setting_setting')->editSetting('payment_bank_transfer', [
		'payment_bank_transfer_bank_' . $language_id => "Webship Test Bank\nAccount 12345678, sort code 00-00-00",
		'payment_bank_transfer_order_status_id' => (int)($pending['order_status_id'] ?? 1),
		'payment_bank_transfer_geo_zone_id' => 0,
		'payment_bank_transfer_status' => 1,
		'payment_bank_transfer_sort_order' => 2,
	]);
	// The administrators may open its settings, as the extension's own install gives them.
	$admin = webship_row($db, 'user_group', "`name` = 'Administrator'");
	if ($admin) {
		$permission = json_decode($admin['permission'] ?: '{}', true);
		foreach (['access', 'modify'] as $type) {
			if (!in_array('extension/opencart/payment/bank_transfer', $permission[$type] ?? [], true)) {
				$registry->get('model_user_user_group')->addPermission((int)$admin['user_group_id'], $type, 'extension/opencart/payment/bank_transfer');
			}
		}
	}
	echo "  payment: bank transfer, beside cash on delivery\n";
}

/** A coupon the storefront takes: the demo data's are disabled and long expired. */
function webship_set_coupon($registry): void {
	$db = $registry->get('db');
	if (webship_row($db, 'coupon', "`code` = '" . WEBSHIP_COUPON . "'")) {
		return;
	}
	$registry->get('load')->model('marketing/coupon');
	$registry->get('model_marketing_coupon')->addCoupon([
		'name' => 'Webship Ten', 'code' => WEBSHIP_COUPON, 'discount' => 10, 'type' => 'P', 'total' => 0, 'logged' => 0, 'shipping' => 0,
		'date_start' => '2026-01-01', 'date_end' => '2099-12-31', 'uses_total' => 100000, 'uses_customer' => 100000, 'status' => 1,
	]);
	echo "  coupon " . WEBSHIP_COUPON . ": 10% off the products\n";
}

/**
 * The suite's accounts deleted with the administration's own models: the customer (its addresses, wish list, cart and
 * the rest the model removes with it), the editor, and the administrator when it is not the only account of the
 * Administrator group. The user group of the editor stays, as the user groups of the shop do.
 */
function webship_cancel_users($registry): void {
	$db = $registry->get('db');
	$load = $registry->get('load');
	$load->model('customer/customer');
	$load->model('user/user');
	$customer_id = webship_customer_id($db);
	if ($customer_id) {
		$registry->get('model_customer_customer')->deleteCustomer($customer_id);
		echo "  customer " . WEBSHIP_CUSTOMER . " deleted\n";
	} else {
		echo "  customer " . WEBSHIP_CUSTOMER . " is not there\n";
	}
	foreach (['editor', 'administrator'] as $login) {
		$user = $registry->get('model_user_user')->getUserByUsername($login);
		if (!$user) {
			echo "  user {$login} is not there\n";
			continue;
		}
		$others = webship_n($db, "SELECT COUNT(*) AS n FROM `" . DB_PREFIX . "user` WHERE `user_group_id` = '" . (int)$user['user_group_id'] . "' AND `user_id` <> '" . (int)$user['user_id'] . "' AND `status` = '1'");
		$group = webship_row($db, 'user_group', "`user_group_id` = '" . (int)$user['user_group_id'] . "'");
		if (($group['name'] ?? '') === 'Administrator' && !$others) {
			echo "  user {$login} stays: it is the only administrator of the shop\n";
			continue;
		}
		$registry->get('model_user_user')->deleteUser((int)$user['user_id']);
		echo "  user {$login} deleted\n";
	}
}

/** Every order, deleted the storefront's way (voided first: the stock, the statistics and a coupon's use come back). */
function webship_reset_orders($registry): void {
	$db = $registry->get('db');
	$registry->get('load')->model('checkout/order');
	foreach (webship_q($db, "SELECT `order_id` FROM `" . DB_PREFIX . "order` ORDER BY `order_id`") as $order) {
		$registry->get('model_checkout_order')->deleteOrder((int)$order['order_id']);
		echo "  order #{$order['order_id']} removed\n";
	}
}

/** What a stopped run left behind, put back as the build left it. */
function webship_reset($registry): void {
	$db = $registry->get('db');
	$load = $registry->get('load');
	$p = DB_PREFIX;
	$customer_id = webship_customer_id($db);
	// The carts (the customer's and the visitors'), the customer's wish list and the addresses it added.
	$db->query("DELETE FROM `{$p}cart` WHERE `customer_id` = '{$customer_id}' OR `customer_id` = '0'");
	$db->query("DELETE FROM `{$p}customer_wishlist` WHERE `customer_id` = '{$customer_id}'");
	$first = (int)($db->query("SELECT MIN(`address_id`) AS a FROM `{$p}address` WHERE `customer_id` = '{$customer_id}'")->row['a'] ?? 0);
	if ($first) {
		$load->model('customer/customer');
		foreach (webship_q($db, "SELECT `address_id` FROM `{$p}address` WHERE `customer_id` = '{$customer_id}' AND `address_id` <> '{$first}'") as $address) {
			$registry->get('model_customer_customer')->deleteAddresses($customer_id, (int)$address['address_id']);
			echo "  address #{$address['address_id']} of the customer removed\n";
		}
		$db->query("UPDATE `{$p}address` SET `default` = (`address_id` = '{$first}') WHERE `customer_id` = '{$customer_id}'");
	}
	// The suite's own catalog: products, categories and coupons named "Webship test " (case and space included).
	$load->model('catalog/product');
	foreach (webship_q($db, "SELECT DISTINCT `product_id` FROM `{$p}product_description` WHERE `name` LIKE BINARY 'Webship test %'") as $row) {
		$registry->get('model_catalog_product')->deleteProduct((int)$row['product_id']);
		echo "  product #{$row['product_id']} removed\n";
	}
	$load->model('catalog/category');
	foreach (webship_q($db, "SELECT DISTINCT `category_id` FROM `{$p}category_description` WHERE `name` LIKE BINARY 'Webship test %'") as $row) {
		$registry->get('model_catalog_category')->deleteCategory((int)$row['category_id']);
		echo "  category #{$row['category_id']} removed\n";
	}
	$load->model('marketing/coupon');
	foreach (webship_q($db, "SELECT `coupon_id` FROM `{$p}coupon` WHERE `name` LIKE BINARY 'Webship test %'") as $row) {
		$registry->get('model_marketing_coupon')->deleteCoupon((int)$row['coupon_id']);
		echo "  coupon #{$row['coupon_id']} removed\n";
	}
	// The login records of the suite's accounts, which every login writes and no screen removes, and the attempts.
	$db->query("DELETE FROM `{$p}customer_ip` WHERE `customer_id` = '{$customer_id}'");
	$db->query("DELETE FROM `{$p}customer_login` WHERE LCASE(`email`) = '" . WEBSHIP_CUSTOMER . "'");
	foreach (WEBSHIP_USERS as $login) {
		$user = webship_row($db, 'user', "`username` = '" . $db->escape($login) . "'");
		if ($user) {
			$db->query("DELETE FROM `{$p}user_login` WHERE `user_id` = '" . (int)$user['user_id'] . "'");
		}
	}
	// The statistics the dashboard reads, counted again the way its Reports > Statistics refresh counts them.
	$load->model('sale/order');
	$load->model('report/statistics');
	$config = $registry->get('config');
	$processing = (array)$config->get('config_processing_status');
	$complete = (array)$config->get('config_complete_status');
	$orders = $registry->get('model_sale_order');
	$statistics = $registry->get('model_report_statistics');
	$statistics->editValue('order_sale', $orders->getTotalSales(['filter_order_status' => implode(',', array_merge($complete, $processing))]));
	$statistics->editValue('order_processing', $orders->getTotalOrders(['filter_order_status' => implode(',', $processing)]));
	$statistics->editValue('order_complete', $orders->getTotalOrders(['filter_order_status' => implode(',', $complete)]));
}

function webship_status($registry): void {
	$db = $registry->get('db');
	$p = DB_PREFIX;
	foreach (WEBSHIP_USERS as $login) {
		$user = webship_row($db, 'user', "`username` = '" . $db->escape($login) . "'");
		$group = $user ? webship_row($db, 'user_group', "`user_group_id` = '" . (int)$user['user_group_id'] . "'") : [];
		echo "{$login}: " . ($user ? ($group['name'] ?? '?') . ", {$user['firstname']} {$user['lastname']}" : 'not on the site') . "\n";
	}
	$customer_id = webship_customer_id($db);
	echo 'customer: ' . ($customer_id ? webship_n($db, "SELECT COUNT(*) AS n FROM `{$p}order` WHERE `customer_id` = '{$customer_id}'") . ' orders, ' . webship_n($db, "SELECT COUNT(*) AS n FROM `{$p}address` WHERE `customer_id` = '{$customer_id}'") . ' addresses, ' . webship_n($db, "SELECT COUNT(*) AS n FROM `{$p}customer_wishlist` WHERE `customer_id` = '{$customer_id}'") . ' in the wish list' : 'not on the site') . "\n";
	echo 'payments: ' . implode(', ', array_column(webship_q($db, "SELECT `code` FROM `{$p}extension` WHERE `type` = 'payment' ORDER BY `code`"), 'code')) . "\n";
	echo 'coupon ' . WEBSHIP_COUPON . ': ' . (webship_row($db, 'coupon', "`code` = '" . WEBSHIP_COUPON . "' AND `status` = '1'") ? 'on' : 'not on the site') . "\n";
	echo 'orders: ' . webship_n($db, "SELECT COUNT(*) AS n FROM `{$p}order`") . "\n";
}

/**
 * What a run must leave as it found it, one count a line, the same on every run of the same site: the catalog (the
 * products by status, their stock and their options' stock, the categories and their links), the orders by status and
 * their products, options, totals and history, the coupons and their history, the statistics the dashboard reads, the
 * customers, the customer's addresses, wish list and carts, the visitors' carts, the reviews and returns, the users
 * and their groups, and the failed logins. The login records (customer_ip, user_login) and the sessions are not
 * counted: every login writes them, and no screen removes them. CI compares it before and after the suite.
 */
function webship_counts($registry): void {
	$db = $registry->get('db');
	$p = DB_PREFIX;
	$lines = [];
	$by = function (string $sql) use ($db): string {
		$rows = $db->query($sql)->rows;
		return $rows ? implode(', ', array_map(fn($r) => $r['k'] . ' ' . $r['n'], $rows)) : 'none';
	};
	$lines[] = 'products: ' . $by("SELECT `status` AS k, COUNT(*) AS n FROM `{$p}product` GROUP BY `status` ORDER BY `status`");
	$lines[] = 'stock: ' . (int)$db->query("SELECT SUM(`quantity`) AS n FROM `{$p}product`")->row['n'] . ', options ' . (int)$db->query("SELECT SUM(`quantity`) AS n FROM `{$p}product_option_value`")->row['n'];
	$lines[] = 'categories: ' . webship_n($db, "SELECT COUNT(*) AS n FROM `{$p}category`") . ', links ' . webship_n($db, "SELECT COUNT(*) AS n FROM `{$p}product_to_category`") . ', descriptions ' . webship_n($db, "SELECT COUNT(*) AS n FROM `{$p}product_description`") . ' products, ' . webship_n($db, "SELECT COUNT(*) AS n FROM `{$p}category_description`") . ' categories';
	$lines[] = 'seo urls: ' . webship_n($db, "SELECT COUNT(*) AS n FROM `{$p}seo_url`");
	$lines[] = 'orders: ' . $by("SELECT `order_status_id` AS k, COUNT(*) AS n FROM `{$p}order` GROUP BY `order_status_id` ORDER BY `order_status_id`");
	foreach (['order_product', 'order_option', 'order_total', 'order_history', 'order_subscription'] as $table) {
		$lines[] = str_replace('_', ' ', $table) . ' rows: ' . webship_n($db, "SELECT COUNT(*) AS n FROM `{$p}{$table}`");
	}
	$lines[] = 'coupons: ' . $by("SELECT `status` AS k, COUNT(*) AS n FROM `{$p}coupon` GROUP BY `status` ORDER BY `status`") . ', history ' . webship_n($db, "SELECT COUNT(*) AS n FROM `{$p}coupon_history`");
	$lines[] = 'statistics: ' . implode(', ', array_map(fn($r) => $r['code'] . ' ' . (float)$r['value'], webship_q($db, "SELECT `code`, `value` FROM `{$p}statistics` ORDER BY `code`")));
	$lines[] = 'customers: ' . webship_n($db, "SELECT COUNT(*) AS n FROM `{$p}customer`") . ', addresses ' . webship_n($db, "SELECT COUNT(*) AS n FROM `{$p}address`");
	$customer_id = webship_customer_id($db);
	$lines[] = 'customer: ' . ($customer_id ? webship_n($db, "SELECT COUNT(*) AS n FROM `{$p}address` WHERE `customer_id` = '{$customer_id}'") . ' addresses (default ' . ($db->query("SELECT `address_1` AS a FROM `{$p}address` WHERE `customer_id` = '{$customer_id}' AND `default` = '1'")->row['a'] ?? 'none') . '), ' . webship_n($db, "SELECT COUNT(*) AS n FROM `{$p}customer_wishlist` WHERE `customer_id` = '{$customer_id}'") . ' in the wish list, ' . webship_n($db, "SELECT COUNT(*) AS n FROM `{$p}cart` WHERE `customer_id` = '{$customer_id}'") . ' in the cart, ' . webship_n($db, "SELECT COUNT(*) AS n FROM `{$p}order` WHERE `customer_id` = '{$customer_id}'") . ' orders' : 'not on the site');
	$lines[] = 'visitors\' carts: ' . webship_n($db, "SELECT COUNT(*) AS n FROM `{$p}cart` WHERE `customer_id` = '0'");
	$lines[] = 'reviews: ' . webship_n($db, "SELECT COUNT(*) AS n FROM `{$p}review`") . ', returns ' . webship_n($db, "SELECT COUNT(*) AS n FROM `{$p}return`");
	$lines[] = 'users: ' . webship_n($db, "SELECT COUNT(*) AS n FROM `{$p}user`") . ', groups ' . webship_n($db, "SELECT COUNT(*) AS n FROM `{$p}user_group`");
	$lines[] = 'failed logins: ' . webship_n($db, "SELECT COUNT(*) AS n FROM `{$p}customer_login`");
	echo implode("\n", $lines) . "\n";
}

/**
 * The demo data's addresses (seo_url) of a product, a category, a brand or a page that does not exist: the first
 * product a run makes takes the id of such a row, and its save replaces it, so a run would leave one address fewer.
 */
function webship_drop_stale_seo_urls($registry): void {
	$db = $registry->get('db');
	$p = DB_PREFIX;
	$gone = 0;
	foreach (['product_id' => 'product', 'category_id' => 'category', 'manufacturer_id' => 'manufacturer', 'information_id' => 'information'] as $key => $table) {
		$db->query("DELETE FROM `{$p}seo_url` WHERE `key` = '{$key}' AND CAST(`value` AS UNSIGNED) NOT IN (SELECT `{$key}` FROM `{$p}{$table}`)");
		$gone += $db->countAffected();
	}
	if ($gone) {
		echo "  {$gone} address(es) of the demo data that point at nothing removed\n";
	}
}

switch ($webship_mode) {
	case 'content':
		webship_drop_stale_seo_urls($registry);
		webship_set_users($registry);
		webship_set_customer($registry);
		webship_set_bank_transfer($registry);
		webship_set_coupon($registry);
		break;
	case 'accounts':
		webship_set_users($registry);
		webship_set_customer($registry);
		break;
	case 'cancel-accounts':
		webship_cancel_users($registry);
		break;
	case 'sample':
		webship_drop_stale_seo_urls($registry);
		webship_set_bank_transfer($registry);
		webship_set_coupon($registry);
		break;
	case 'reset-orders':
		webship_reset_orders($registry);
		break;
	case 'reset':
		webship_reset($registry);
		break;
	case 'status':
		webship_status($registry);
		break;
	case 'counts':
		webship_counts($registry);
		break;
	default:
		fwrite(STDERR, "Unknown mode {$webship_mode}: content, accounts, cancel-accounts, sample, reset-orders, reset, status or counts.\n");
		exit(1);
}
