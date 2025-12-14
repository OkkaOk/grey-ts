import { hash } from "node:crypto";
import * as path from "node:path";
import ts from "typescript";
import parseCode from "./parser.ts";

import createAssignmentHandlers from "./visitors/assignments.ts";
import createClassHandlers from "./visitors/classes.ts";
import createExpressionHandlers from "./visitors/expressions.ts";
import createFunctionHandlers from "./visitors/functions.ts";
import createIdentifierHandlers from "./visitors/identifiers.ts";
import createImportHandlers from "./visitors/imports.ts";
import createStatementHandlers from "./visitors/statements.ts";
import createVariableHandlers from "./visitors/variables.ts";

export const apiNameMap: Record<string, string> = {
	print: "print",
	getType: "typeof",
	getShell: "get_shell",
	hostComputer: "host_computer",
	localIp: "local_ip",
	publicIp: "public_ip",
	connectService: "connect_service",
	startTerminal: "start_terminal",
	isBinary: "is_binary",
	isFolder: "is_folder",
	isSymlink: "is_symlink",
	hasPermission: "has_permission",
	getFiles: "get_files",
	getFolders: "get_folders",
	getContent: "get_content",
	setContent: "set_content",
	setGroup: "set_group",
	setOwner: "set_owner",
	isClosed: "is_closed",
	getLanIp: "get_lan_ip",
	getName: "get_name",
	createFolder: "create_folder",
	activeNetCard: "active_net_card",
	changePassword: "change_password",
	closeProgram: "close_program",
	connectEthernet: "connect_ethernet",
	connectWifi: "connect_wifi",
	createGroup: "create_group",
	createUser: "create_user",
	deleteGroup: "delete_group",
	deleteUser: "delete_user",
	getPorts: "get_ports",
	isNetworkActive: "is_network_active",
	networkDevices: "network_devices",
	networkGateway: "network_gateway",
	showProcs: "show_procs",
	wifiNetworks: "wifi_networks",
	file: "File",
} as const;

const decoder = new TextDecoder();

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

export function transpileModule(relativePath: string, basePath = import.meta.dirname!) {
	let filePath = path.resolve(basePath, relativePath);
	const extname = path.extname(filePath);
	if (!extname) filePath = filePath + ".ts";

	const fileName = path.basename(filePath);

	// Everything is bundled so this should already be in the file.
	// TODO: better system
	if (cache.has(filePath)) return "";

	const code = decoder.decode(Deno.readFileSync(filePath));
	const sourceFile = parseCode(fileName, code);

	return transpile(sourceFile, filePath);
}

export function transpile(sourceFile: ts.SourceFile, cachePath: string): string {
	if (!Object.keys(handlers).length) {
		handlers = createHandlers();
	}

	const isEntry = cache.size === 0;
	cache.set(cachePath, []);

	const statements = sourceFile.statements.map(value => handleNode(value));
	if (utilFunctions.size) {
		statements.unshift(...utilFunctions.values().toArray());
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

