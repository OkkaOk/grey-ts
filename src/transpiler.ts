import ts from "typescript";
import * as fs from "fs";
import * as path from "path";
import parseCode from "./parser";

import createIdentifierHandlers from "./visitors/identifiers";
import createFunctionHandlers from "./visitors/functions";
import createVariableHandlers from "./visitors/variables";
import createExpressionHandlers from "./visitors/expressions";
import createClassHandlers from "./visitors/classes";
import createImportHandlers from "./visitors/imports";

type Mode = "ts" | "js";

export type TranspileContext = {
	basePath?: string;
	mode?: Mode;
	cache?: Map<string, string>;
};

let handlers: Record<number, (node: ts.Node) => string> = {};
const cache = new Map<string, string>()

function createHandlers(visit: (n: ts.Node) => string) {
    const handlers: Record<number, (node: ts.Node) => string> = {};

    Object.assign(handlers, createIdentifierHandlers());
    Object.assign(handlers, createFunctionHandlers());
    Object.assign(handlers, createVariableHandlers());
    Object.assign(handlers, createExpressionHandlers());
    Object.assign(handlers, createClassHandlers());
    Object.assign(handlers, createImportHandlers());

	// ignored ones
	handlers[ts.SyntaxKind.TypeAliasDeclaration] = () => ""
	handlers[ts.SyntaxKind.InterfaceDeclaration] = () => ""

    return handlers;
}

export function handleNode(node: ts.Node) {
	const handler = handlers[node.kind];
	if (handler) return handler(node);

	console.log(`Found syntax kind ${node.kind} that was not transpiled: ${node.getText()}`);
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
		handlers = createHandlers(handleNode);
	}

	const result = sourceFile.statements.map(value => handleNode(value)).join("\n");

	cache.set(filePath, result);
	return result;
}

