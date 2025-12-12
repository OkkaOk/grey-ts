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

const decoder = new TextDecoder();

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

export function createConditionalFunction() {
	const name = "conditional_func";

	const result = `\
${name} = function(condition,true_val,false_val)
if condition then
	return true_val
else
	return false_val
end if
end function`;

	anonFunctions.set(name, result)
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

export function transpileModule(relativePath: string, basePath = import.meta.dirname!) {
	let filePath = path.resolve(basePath, relativePath);
	const extname = path.extname(filePath);
	if (!extname) filePath = filePath + ".ts";

	const fileName = path.basename(filePath);
	const code = decoder.decode(Deno.readFileSync(filePath));

	if (cache.has(filePath)) return cache.get(filePath)!;

	const sourceFile = parseCode(fileName, code);
	return transpile(sourceFile);
}

export function transpile(sourceFile: ts.SourceFile): string {
	if (!Object.keys(handlers).length) {
		handlers = createHandlers();
	}

	let result = sourceFile.statements.map(value => handleNode(value)).join("\n");
	if (anonFunctions.size) {
		result = anonFunctions.values().toArray().join("\n") + "\n" + result;
		anonFunctions.clear();
	}

	cache.set(sourceFile.fileName, result);
	return result;
}

