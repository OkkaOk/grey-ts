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

export let program: ts.Program;
export let checker: ts.TypeChecker;

type Mode = "ts" | "js";

export type TranspileContext = {
	currentFilePath: string;
	currentFolder: string;
	namedImports: Record<string, boolean>;
	basePath?: string;
	mode?: Mode;
	cache: Map<string, string[]>;
};

let handlers: Record<number, (node: ts.Node, ctx: TranspileContext) => string> = {};
const utilFunctions = new Map<string, string>();

export const declaredFunctions: Record<string, boolean> = {};

function createHandlers() {
	const result: typeof handlers = {};

	Object.assign(result, createClassHandlers());
	Object.assign(result, createExpressionHandlers());
	Object.assign(result, createFunctionHandlers());
	Object.assign(result, createIdentifierHandlers());
	Object.assign(result, createImportHandlers());
	Object.assign(result, createStatementHandlers());
	Object.assign(result, createVariableHandlers());
	Object.assign(result, createAssignmentHandlers());

	// ignored ones
	result[ts.SyntaxKind.TypeAliasDeclaration] = () => "";
	result[ts.SyntaxKind.InterfaceDeclaration] = () => "";
	result[ts.SyntaxKind.EndOfFileToken] = () => "";

	return result;
}

export function createAnonFunction(body: string, params: string) {
	const randomName = "func_" + hash("sha1", `${Date.now()} ${Math.random()}`).slice(0, 10);

	const result = `${randomName} = function(${params})\n${body}\nend function`;
	utilFunctions.set(randomName, result);

	return { name: randomName, str: result };
}

export function handleNode(node: ts.Node, ctx: TranspileContext) {

	try {
		const handler = handlers[node.kind];
		if (handler) {
			const result = handler(node, ctx);
			return result;
		};
	} catch (error) {
		console.error(error);

		const source = node.getSourceFile();
		const lineAndChar = source.getLineAndCharacterOfPosition(node.pos);
		console.error(`At ${source.fileName}: line ${lineAndChar.line + 1}, col ${lineAndChar.character}`);
		return "null";
	}

	console.log(`Unsupported syntax ${ts.SyntaxKind[node.kind]} (kind ${node.kind}) was not transpiled: ${node.getText()}`);
	return "";
}

export function transpileEntryFile(entryFileRelativePath: string) {
	const ctx: TranspileContext = {
		currentFolder: process.cwd(),
		currentFilePath: path.join(process.cwd(), entryFileRelativePath),
		namedImports: {},
		cache: new Map()
	};

	if (!fs.existsSync(ctx.currentFilePath)) {
		console.error(`Error: file '${ctx.currentFilePath}' doesn't exist`);
		process.exit(1);
	}

	program = ts.createProgram({
		rootNames: [ctx.currentFilePath, path.resolve(__dirname, "../globals.d.ts")],
		options: {
			target: ts.ScriptTarget.Latest,
			noLib: true,
			typeRoots: [],
		},
	});

	checker = program.getTypeChecker();
	handlers = createHandlers();

	const sources = program.getSourceFiles().filter(source => {
		if (source.isDeclarationFile)
			return false;
		if (program.isSourceFileDefaultLibrary(source))
			return false;
		if (program.isSourceFileFromExternalLibrary(source))
			return false;
		return true;
	});

	const output: string[] = [];
	for (const source of sources) {
		console.log(`Transpiling ${path.basename(source.fileName)}`);
		ctx.currentFilePath = source.fileName;
		ctx.currentFolder = path.dirname(source.fileName);
		ctx.namedImports = {};

		const result = transpileSourceFile(source, ctx);
		output.push(result);
	}

	if (utilFunctions.size) {
		output.unshift(...Array.from(utilFunctions.values()));
		utilFunctions.clear();
	}

	return output.join("\n");
}

export function transpileModule(relativePath: string, ctx: TranspileContext) {
	// console.log(relativePath, basePath, __dirname)
	let filePath = path.resolve(ctx.currentFolder, relativePath);
	const extname = path.extname(filePath);
	if (!extname) filePath = filePath + ".ts";

	if (!fs.existsSync(filePath)) {
		console.error(`Error: file '${filePath}' doesn't exist`);
		process.exit(1);
	}

	const fileName = path.basename(filePath);

	// Everything is bundled so this should already be in the file.
	// TODO: better system
	if (ctx.cache.has(filePath)) return "";

	const code = fs.readFileSync(filePath, { encoding: "utf-8" });
	const sourceFile = parseCode(fileName, code);

	const prevFilePath = ctx.currentFilePath;
	const prevFolder = ctx.currentFolder;

	ctx.currentFilePath = filePath;
	ctx.currentFolder = path.dirname(filePath);
	const result = transpileSourceFile(sourceFile, ctx);
	ctx.currentFilePath = prevFilePath;
	ctx.currentFolder = prevFolder;

	return result;
}

export function transpileSourceFile(sourceFile: ts.SourceFile, ctx: TranspileContext): string {
	const output: string[] = [];

	sourceFile.forEachChild((node) => {
		const result = handleNode(node, ctx);
		if (result) output.push(result);
	});

	ctx.cache.set(ctx.currentFilePath, output);
	return output.join("\n");
}

