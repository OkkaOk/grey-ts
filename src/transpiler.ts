import { hash } from "node:crypto";
import * as fs from "node:fs";
import * as path from "node:path";
import ts from "typescript";
import parseCode from "./parser.js";

import createAssignmentHandlers from "./visitors/assignments.js";
import createClassHandlers from "./visitors/classes.js";
import createExpressionHandlers from "./visitors/expressions.js";
import createFunctionHandlers from "./visitors/functions.js";
import createIdentifierHandlers from "./visitors/identifiers.js";
import createImportHandlers from "./visitors/imports.js";
import createStatementHandlers from "./visitors/statements.js";
import createVariableHandlers from "./visitors/variables.js";

export const apiNameMap: Record<string, string> = {
	// AptClient
	addRepo: "add_repo",
	checkUpgrade: "check_upgrade",
	delRepo: "del_repo",
	// Blockchain
	amountMined: "amount_mined",
	coinPrice: "coin_price",
	createWallet: "create_wallet",
	deleteCoin: "delete_coin",
	getCoin: "get_coin",
	getCoinName: "get_coin_name",
	loginWallet: "login_wallet",
	showHistory: "show_history",
	// Coin
	createSubwallet: "create_subwallet",
	getAddress: "get_address",
	getCycle_mining: "get_cycle_mining",
	getMinedCoins: "get_mined_coins",
	getReward: "get_reward",
	getSubwallet: "get_subwallet",
	getSubwallets: "get_subwallets",
	resetPassword: "reset_password", // Also in Wallet
	setAddress: "set_address",
	setCycle_mining: "set_cycle_mining",
	setReward: "set_reward",
	// Computer
	file: "File",
	activeNetCard: "active_net_card",
	changePassword: "change_password",
	closeProgram: "close_program",
	connectEthernet: "connect_ethernet",
	connectWifi: "connect_wifi",
	createFolder: "create_folder",
	createGroup: "create_group",
	createUser: "create_user",
	deleteGroup: "delete_group",
	deleteUser: "delete_user",
	getName: "get_name",
	getPorts: "get_ports",
	isNetworkActive: "is_network_active",
	localIp: "local_ip", // Also in router
	networkDevices: "network_devices",
	networkGateway: "network_gateway",
	publicIp: "public_ip", // Also in router
	showProcs: "show_procs",
	wifiNetworks: "wifi_networks",
	// Crypto
	isEncrypted: "is_encrypted",
	smtpUserList: "smtp_user_list",
	// Ctfevent
	getCreatorName: "get_creator_name",
	getDescription: "get_description",
	getMailContent: "get_mail_content",
	getTemplate: "get_template",
	playerSuccess: "player_success",
	// DebugLibrary
	applyPatch: "apply_patch",
	unitTesting: "unit_testing",
	// File
	allowImport: "allow_import",
	getContent: "get_content",
	getFiles: "get_files",
	getFolders: "get_folders",
	hasPermission: "has_permission",
	isBinary: "is_binary",
	isFolder: "is_folder",
	isSymlink: "is_symlink",
	setContent: "set_content",
	setGroup: "set_group",
	setOwner: "set_owner",
	// General
	activeUser: "active_user",
	clearScreen: "clear_screen",
	commandInfo: "command_info",
	currentDate: "current_date",
	currentPath: "current_path",
	formatColumns: "format_columns",
	getAbsPath: "get_abs_path",
	getCtf: "get_ctf",
	getCustomObject: "get_custom_object",
	getRouter: "get_router",
	getShell: "get_shell",
	getSwitch: "get_switch",
	homeDir: "home_dir",
	importCode: "import_code",
	includeLib: "include_lib",
	isLanIp: "is_lan_ip",
	isValidIp: "is_valid_ip",
	launchPath: "launch_path",
	mailLogin: "mail_login",
	parentPath: "parent_path",
	programPath: "program_path",
	resetCtfPassword: "reset_ctf_password",
	getType: "typeof",
	isType: "is_type", // custom
	userBankNumber: "user_bank_number",
	userInput: "user_input",
	userMailAddress: "user_mail_address",
	// MetaLib
	debugTools: "debug_tools",
	isPatched: "is_patched",
	libName: "lib_name",
	// MetaMail
	// Metaxploit
	netUse: "net_use",
	rshellClient: "rshell_client",
	rshellServer: "rshell_server",
	scanAddress: "scan_address",
	// NetSession
	dumpLib: "dump_lib",
	floodConnection: "flood_connection",
	getNumConnGateway: "get_num_conn_gateway",
	getNumPortforward: "get_num_portforward",
	getNumUsers: "get_num_users",
	isAnyActiveUser: "is_any_active_user",
	isRootActiveUser: "is_root_active_user",
	// Port
	getLanIp: "get_lan_ip",
	isClosed: "is_closed",
	portNumber: "port_number",
	// Router
	bssidName: "bssid_name",
	devicePorts: "device_ports",
	devicesLanIp: "devices_lan_ip",
	essidName: "essid_name",
	firewallRules: "firewall_rules",
	kernelVersion: "kernel_version",
	pingPort: "ping_port",
	portInfo: "port_info",
	usedPorts: "used_ports",
	// Service
	installService: "install_service",
	startService: "start_service",
	stopService: "stop_service",
	// Shell
	connectService: "connect_service",
	hostComputer: "host_computer",
	startTerminal: "start_terminal",
	// SmartAppliance
	overrideSettings: "override_settings",
	setAlarm: "set_alarm",
	// string
	isMatch: "is_match",
	toInt: "to_int",
	// SubWallet
	checkPassword: "check_password",
	getBalance: "get_balance", // Also in wallet
	getInfo: "get_info",
	getUser: "get_user",
	lastTransaction: "last_transaction",
	setInfo: "set_info",
	walletUsername: "wallet_username",
	// TrafficNet
	cameraLinkSystem: "camera_link_system",
	getCredentialsInfo: "get_credentials_info",
	locateVehicle: "locate_vehicle",
	// Wallet
	buyCoin: "buy_coin",
	cancelPendingTrade: "cancel_pending_trade",
	getGlobalOffers: "get_global_offers",
	getPendingTrade: "get_pending_trade",
	getPin: "get_pin",
	listCoins: "list_coins",
	listGlobalCoins: "list_global_coins",
	sellCoin: "sell_coin",
	showNodes: "show_nodes",
} as const;

export let program: ts.Program;
export let checker: ts.TypeChecker;
const currFiles: string[] = [];

type Mode = "ts" | "js";

export type TranspileContext = {
	basePath?: string;
	mode?: Mode;
	cache?: Map<string, string>;
};

const totalStatements: string[] = [];

let handlers: Record<number, (node: ts.Node) => string> = {};
const cache = new Map<string, string[]>();
const utilFunctions = new Map<string, string>();

export const declaredFunctions: Record<string, boolean> = {};

function createHandlers() {
	const handlers: Record<number, (node: ts.Node) => string> = {};

	Object.assign(handlers, createClassHandlers());
	Object.assign(handlers, createExpressionHandlers());
	Object.assign(handlers, createFunctionHandlers());
	Object.assign(handlers, createIdentifierHandlers());
	Object.assign(handlers, createImportHandlers());
	Object.assign(handlers, createStatementHandlers());
	Object.assign(handlers, createVariableHandlers());
	Object.assign(handlers, createAssignmentHandlers());

	// ignored ones
	handlers[ts.SyntaxKind.TypeAliasDeclaration] = () => "";
	handlers[ts.SyntaxKind.InterfaceDeclaration] = () => "";

	return handlers;
}

export function createAnonFunction(body: string, params: string) {
	const randomName = "func_" + hash("sha1", `${Date.now()} ${Math.random()}`).slice(0, 10);

	const result = `${randomName} = function(${params})\n${body}\nend function`;
	utilFunctions.set(randomName, result);

	return { name: randomName, str: result };
}

export function handleNode(node: ts.Node) {
	// console.log(ts.SyntaxKind[node.kind]);
	try {
		const handler = handlers[node.kind];
		if (handler) return handler(node);
	} catch (error) {
		console.error(error instanceof Error ? `Error: ${error.message}` : error);

		const source = node.getSourceFile();
		const lineAndChar = source.getLineAndCharacterOfPosition(node.pos);
		console.error(`At ${source.fileName}: line ${lineAndChar.line + 1}, col ${lineAndChar.character}`);
		return "null";
	}

	console.log(`Unsupported syntax ${ts.SyntaxKind[node.kind]} (kind ${node.kind}) was not transpiled: ${node.getText()}`);
	return "";
}

export function transpileModule(relativePath: string, basePath?: string) {
	if (!basePath && currFiles.length) basePath = path.dirname(currFiles[currFiles.length - 1]);
	if (!basePath) basePath = __dirname;

	// console.log(relativePath, basePath, __dirname)
	let filePath = path.resolve(basePath, relativePath);
	const extname = path.extname(filePath);
	if (!extname) filePath = filePath + ".ts";

	if (!fs.existsSync(filePath)) {
		console.error(`Error: file '${filePath}' doesn't exist`);
		process.exit(1);
	}

	const fileName = path.basename(filePath);

	if (cache.size === 0) {
		program = ts.createProgram({ rootNames: [filePath], options: {} });
		checker = program.getTypeChecker();
		handlers = createHandlers();
	}

	// Everything is bundled so this should already be in the file.
	// TODO: better system
	if (cache.has(filePath)) return "";

	const code = fs.readFileSync(filePath, { encoding: "utf-8" });
	const sourceFile = parseCode(fileName, code);

	currFiles.push(filePath);
	const result = transpile(sourceFile, filePath);
	currFiles.pop();

	return result;
}

export function transpile(sourceFile: ts.SourceFile, cachePath: string): string {
	const isEntry = cache.size === 0;
	cache.set(cachePath, []);

	const statements = sourceFile.statements.map(value => handleNode(value));
	if (utilFunctions.size) {
		statements.unshift(...Array.from(utilFunctions.values()));
		utilFunctions.clear();
	}

	totalStatements.push(...statements);

	if (isEntry) {
		const joined = totalStatements.join("\n");
		return joined;
	}

	cache.set(cachePath, statements);
	return "";
}

