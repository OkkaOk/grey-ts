import * as fs from "fs";
import * as path from "path";
import ts from "typescript";
import parseCode from "./parser";

import { hash } from "crypto";
import createAssignmentHandlers from "./visitors/assignments";
import createClassHandlers from "./visitors/classes";
import createExpressionHandlers from "./visitors/expressions";
import createFunctionHandlers from "./visitors/functions";
import createIdentifierHandlers from "./visitors/identifiers";
import createImportHandlers from "./visitors/imports";
import createStatementHandlers from "./visitors/statements";
import createVariableHandlers from "./visitors/variables";

type Mode = "ts" | "js";

export type TranspileContext = {
	basePath?: string;
	mode?: Mode;
	cache?: Map<string, string>;
};

let handlers: Record<number, (node: ts.Node) => string> = {};
const cache = new Map<string, string>();
const anonFunctions = new Map<string, string>();

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

function createConditionalFunction() {
	const name = "conditional_func";

	const result = `\n
${name} = function(condition,true_val,false_val)
if condition then
	return true_val
else
	return false_val
end if
end function`;

	return result;
}

export function createAnonFunction(body: string, params: string) {
	const randomName = "func_" + hash("sha1", `${Date.now()} ${Math.random()}`).slice(0, 10);

	const result = `${randomName} = function(${params})\n${body}\nend function`;
	anonFunctions.set(randomName, result);

	return { name: randomName, str: result };
}

export function handleNode(node: ts.Node) {
	const handler = handlers[node.kind];
	if (handler) return handler(node);

	console.log(`Found SyntaxKind ${node.kind} that was not transpiled: ${node.getText()}`);
	return "";
}

export function transpile(relativePath: string, basePath = __dirname): string {
	let filePath = path.resolve(basePath, relativePath);
	const extname = path.extname(filePath);
	if (!extname) filePath = filePath + ".ts";

	const code = fs.readFileSync(filePath, { encoding: "utf-8" });

	if (cache.has(filePath)) return cache.get(filePath)!;

	const fileName = path.basename(filePath);
	const sourceFile = parseCode(fileName, code);

	if (!Object.keys(handlers).length) {
		handlers = createHandlers();
	}

	let result = sourceFile.statements.map(value => handleNode(value)).join("\n");
	if (anonFunctions.size) {
		result = anonFunctions.values().toArray().join("\n") + "\n" + result;
		anonFunctions.clear();
	}

	if (cache.size === 0)
		result = "\n" + createConditionalFunction() + "\n" + result;

	cache.set(filePath, result);
	return result;
}

