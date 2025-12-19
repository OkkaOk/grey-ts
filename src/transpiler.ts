import { hash } from "node:crypto";
import * as fs from "node:fs";
import * as path from "node:path";
import ts, { type SourceFile } from "typescript";

import { findProjectRoot } from "./utils.js";
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
	inFunctionCall?: boolean;
	basePath?: string;
	mode?: Mode;
	cache: Map<string, string[]>;
	output: string[];
	sources: SourceFile[];
};

let handlers: Record<number, (node: ts.Node, ctx: TranspileContext) => string> = {};

export const utilFunctions = new Map<string, string>();

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
	// console.log(ts.SyntaxKind[node.kind], node.getText())
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

export function transpileProgram(entryFileRelativePath: string) {
	const ctx: TranspileContext = {
		currentFolder: process.cwd(),
		currentFilePath: path.resolve(process.cwd(), entryFileRelativePath),
		namedImports: {},
		cache: new Map(),
		sources: [],
		output: [],
	};

	if (!fs.existsSync(ctx.currentFilePath)) {
		console.error(`Error: file '${ctx.currentFilePath}' doesn't exist`);
		process.exit(1);
	}

	const start = Date.now();

	const tsconfigPath = findProjectRoot(process.cwd(), "tsconfig.json") + "/tsconfig.json";
	const res = ts.readConfigFile(tsconfigPath, ts.sys.readFile);
	const parsed = ts.parseJsonConfigFileContent(res.config, ts.sys, path.dirname(tsconfigPath));
	// console.log(parsed)

	program = ts.createProgram({
		rootNames: parsed.fileNames,
		options: parsed.options,
		// rootNames: [ctx.currentFilePath],
		// options: {
		// 	target: ts.ScriptTarget.Latest,
		// 	noLib: true,
		// 	types: ["@grey-ts/types"],
		// 	verbatimModuleSyntax: true,
		// },
	});


	checker = program.getTypeChecker();
	handlers = createHandlers();

	ctx.sources = program.getSourceFiles().filter(source => {
		if (source.isDeclarationFile)
			return false;
		if (program.isSourceFileDefaultLibrary(source))
			return false;
		if (program.isSourceFileFromExternalLibrary(source))
			return false;
		return true;
	});

	const entry = ctx.sources.find(s => s.fileName === ctx.currentFilePath);
	if (!entry) {
		console.error(`Error: failed to find '${ctx.currentFilePath}' from the included sources`);
		process.exit(1);
	}

	// Todo: Maybe use worker threads if it takes too long to transpile
	transpileSourceFile(entry, ctx);

	// const output: string[] = [];
	// for (const source of sources) {
	// 	const result = transpileSourceFile(source, ctx);
	// 	output.push(result);
	// }

	if (utilFunctions.size) {
		ctx.output.unshift(...Array.from(utilFunctions.values()));
		utilFunctions.clear();
	}

	console.log(`Transpiling took ${Date.now() - start} ms`);

	return ctx.output.join("\n");
}

export function transpileSourceFile(sourceFile: ts.SourceFile, ctx: TranspileContext) {
	if (ctx.cache.has(sourceFile.fileName))
		return "";

	const output: string[] = [];
	ctx.cache.set(sourceFile.fileName, output);

	const prevFile = ctx.currentFilePath;

	ctx.currentFilePath = sourceFile.fileName;
	ctx.currentFolder = path.dirname(sourceFile.fileName);
	ctx.namedImports = {};

	sourceFile.forEachChild((node) => {
		const result = handleNode(node, ctx);
		if (result) output.push(result);
	});

	ctx.currentFilePath = prevFile;
	ctx.currentFolder = path.dirname(prevFile);

	console.log(`Transpiled ${path.basename(sourceFile.fileName)}`);
	const result = output.join("\n");
	ctx.output.push(result);

	return "";
}

