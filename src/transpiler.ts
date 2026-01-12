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
	namedImports: Record<string, Record<string, boolean>>;
	inFunctionCall?: boolean;
	isAssignment?: boolean;
	basePath?: string;
	mode?: Mode;
	visitedFiles: Record<string, boolean>;
	output: string[];
	sources: SourceFile[];
};

let handlers: Record<number, (node: ts.Node, ctx: TranspileContext) => string> = {};

const anonFunctions = new Map<string, string>()
export const calledUtilFunctions = new Map<keyof typeof utilFunctions, boolean>()
export const utilFunctions = {
	"get_property": [
		"get_property = function(obj, key)",
		"	if not obj then return null",
		"	if obj isa list and list.hasIndex(key) then return obj[key]()",
		"	if obj isa map and map.hasIndex(key) then return obj[key]()",
		"	if obj isa string and string.hasIndex(key) then return obj[key]()",
		"	if obj isa number and number.hasIndex(key) then return obj[key]()",
		"	if (obj.hasIndex(key)) then return @obj[key]",
		`	if (obj.hasIndex("__isa")) then return get_property(obj["__isa"], key)`,
		"	return null",
		"end function",
	].join("\n"),
	"assign_objects": [
		"assign_objects = function(target, sources)",
		"	for source in sources",
		"		if (typeof(source) == \"list\") then",
		"			if (typeof(target) == \"list\" and not target.len() and source.len()) then target.push(null)",
		"			for i in range(0, source.len() - 1, 1)",
		"				target[str(i)] = source[i]",
		"			end for",
		"		else if (typeof(source) == \"map\") then",
		"			for item in source",
		"				target[item.key] = item.value",
		"			end for",
		"		end if",
		"	end for",
		"	return target",
		"end function"
	].join("\n"),
	"array_map": [
		"array_map = function(array, callback)",
		"	index = 0",
		"	out = []",
		"	for item in array",
		"		out.push(callback(item, index, array))",
		"		index = index + 1",
		"	end for",
		"	return out",
		"end function",
	].join("\n"),
	"array_filter": [
		"array_filter = function(array, predicate)",
		"	index = 0",
		"	out = []",
		"	for item in array",
		"		if (predicate(item, index, array)) then out.push(item)",
		"		index = index + 1",
		"	end for",
		"	return out",
		"end function",
	].join("\n"),
	"array_find": [
		"array_find = function(array, predicate)",
		"	index = 0",
		"	for item in array",
		"		if (predicate(item, index, array)) then return item",
		"		index = index + 1",
		"	end for",
		"	return null",
		"end function",
	].join("\n"),
	"array_some": [
		"array_some = function(array, predicate)",
		"	index = 0",
		"	for item in array",
		"		if (predicate(item, index, array)) then return 1",
		"		index = index + 1",
		"	end for",
		"	return 0",
		"end function",
	].join("\n"),
	"array_every": [
		"array_every = function(array, predicate)",
		"	index = 0",
		"	for item in array",
		"		if (not predicate(item, index, array)) then return 0",
		"		index = index + 1",
		"	end for",
		"	return 1",
		"end function",
	].join("\n"),
	"nullish_coalescing_op": "nullish_coalescing_op = function(left, right)\n\tif (left == null) then return @right\n\treturn @left\nend function",
	"or_op": "or_op = function(left, right)\n\tif (not left) then return @right\n\treturn @left\nend function",
	"is_type": "is_type = function(value, type)\n\tif typeof(value) == type then return 1\n\treturn 0\nend function",
	"conditional_expr": "conditional_expr = function(cond, when_true, when_false)\n\tif cond then return when_true\n\treturn when_false\nend function",
}

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

export function createAnonFunction(body: string, params: string[]) {
	const defaultParams = new Array(3).fill(0).map((_, i) => `param${i}`);

	const nextName = `func_${anonFunctions.size}`;
	const paramString = Object.assign(defaultParams, params).join(",");

	const result = `${nextName} = function(${paramString})\n${body}\nend function`;
	anonFunctions.set(nextName, result);

	return { name: nextName, str: result };
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
		console.error(`At ${source.fileName}: line ${lineAndChar.line + 1}, col ${lineAndChar.character + 1}`);
		return ts.isSourceFile(node.parent) ? "" : "null";
	}

	const source = node.getSourceFile();
	const lineAndChar = source.getLineAndCharacterOfPosition(node.pos);
	console.log(`Unsupported syntax ${ts.SyntaxKind[node.kind]} (kind ${node.kind}) was not transpiled: ${node.getText()}`);
	console.log(`At ${source.fileName}: line ${lineAndChar.line + 1}, col ${lineAndChar.character + 1}`);
	return "";
}

// type TranspileOptions = {
// 	entryFileRelativePath: string,
// }

export function transpileProgram(entryFileRelativePath: string) {
	const ctx: TranspileContext = {
		currentFolder: "",
		currentFilePath: path.resolve(process.cwd(), entryFileRelativePath),
		namedImports: {},
		visitedFiles: {},
		sources: [],
		output: [],
	};

	ctx.currentFolder = path.dirname(ctx.currentFilePath);

	if (!fs.existsSync(ctx.currentFilePath)) {
		console.error(`Error: file '${ctx.currentFilePath}' doesn't exist`);
		process.exit(1);
	}

	let start = Date.now();

	const tsconfigPath = findProjectRoot(process.cwd(), "tsconfig.json") + "/tsconfig.json";
	const res = ts.readConfigFile(tsconfigPath, ts.sys.readFile);
	const parsed = ts.parseJsonConfigFileContent(res.config, ts.sys, path.dirname(tsconfigPath));
	// console.log(parsed)

	program = ts.createProgram({
		rootNames: parsed.fileNames,
		options: Object.assign(parsed.options, { noLib: true }),
		// rootNames: [ctx.currentFilePath],
		// options: {
		// 	target: ts.ScriptTarget.Latest,
		// 	noLib: true,
		// 	types: ["@grey-ts/types"],
		// 	verbatimModuleSyntax: true,
		// },
	});

	console.log(`Program creation took ${Date.now() - start} ms`);
	start = Date.now();

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

	if (anonFunctions.size) {
		for (const declaration of anonFunctions.values())
			ctx.output.unshift(declaration);
	}

	if (calledUtilFunctions.size) {
		for (const call of calledUtilFunctions.keys())
			ctx.output.unshift(utilFunctions[call]);
	}


	console.log(`Transpiling took ${Date.now() - start} ms`);

	return ctx.output.join("\n");
}

export function transpileSourceFile(sourceFile: ts.SourceFile, ctx: TranspileContext) {
	if (ctx.visitedFiles[sourceFile.fileName])
		return "";

	ctx.visitedFiles[sourceFile.fileName] = true;

	const prevFile = ctx.currentFilePath;

	ctx.currentFilePath = sourceFile.fileName;
	ctx.currentFolder = path.dirname(sourceFile.fileName);
	ctx.namedImports[sourceFile.fileName] = {};

	sourceFile.forEachChild((node) => {
		const result = handleNode(node, ctx);
		if (result) ctx.output.push(result);
	});

	ctx.currentFilePath = prevFile;
	ctx.currentFolder = path.dirname(prevFile);

	console.log(`Transpiled ${path.basename(sourceFile.fileName)}`);
	return "";
}

