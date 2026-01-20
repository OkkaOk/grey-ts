import * as fs from "node:fs";
import * as path from "node:path";
import ts from "typescript";

import parseCode from "./parser.js";
import { findProjectRoot } from "./utils.js";

type Mode = "ts" | "js";

export type TranspileContext = {
	currentFilePath: string;
	currentFolder: string;
	namespaceImports: Record<string, Set<string>>;
	namedImports: Record<string, Record<string, string>>;
	basePath?: string;
	mode?: Mode;
	visitedFiles: Record<string, boolean>;
	output: string[];
};

type HandlerType<T extends ts.Node> = (node: T, ctx: TranspileContext, ...extraArgs: any[]) => string;
export class NodeHandler {
	static handlers: Map<ts.SyntaxKind, HandlerType<any>> = new Map();
	static transpileContext: TranspileContext;

	static register<T extends ts.Node>(kind: T["kind"], handler: HandlerType<T>) {
		if (this.handlers.has(kind))
			throw `${ts.SyntaxKind[kind]} (${kind}) is already registered`;

		this.handlers.set(kind, handler);
	}

	static handle(node: ts.Node): string {
		const handler = this.handlers.get(node.kind);
		if (!handler) {
			console.log(`Unsupported syntax ${ts.SyntaxKind[node.kind]} (kind ${node.kind}) was not transpiled: ${node.getText()}`);
			this.printLineAndCol(node);
			return "null";
		}

		// console.log(ts.SyntaxKind[node.kind], node.kind, node.getText());
		try {
			const result = handler(node, this.transpileContext);
			return result;
		} catch (error) {
			console.error(error);

			this.printLineAndCol(node);
			return "null";
		}
	}

	private static printLineAndCol(node: ts.Node) {
		const source = node.getSourceFile();
		const lineAndChar = source.getLineAndCharacterOfPosition(node.pos);
		console.log(`At ${source.fileName}: line ${lineAndChar.line + 1}, col ${lineAndChar.character + 1}`);
	}
}

NodeHandler.register(ts.SyntaxKind.TypeAliasDeclaration, () => "");
NodeHandler.register(ts.SyntaxKind.InterfaceDeclaration, () => "");
NodeHandler.register(ts.SyntaxKind.EndOfFileToken, () => "");

export let program: ts.Program;
export let checker: ts.TypeChecker;

const anonFunctions = new Map<string, string>();
export const calledUtilFunctions = new Set<keyof typeof utilFunctions>()
export const utilFunctions = {
	"get_property": [
		"get_property = function(obj, key)",
		"	if not obj then return null",
		"	if obj.hasIndex(key) then return obj[key]",
		// "	if obj isa list and list.hasIndex(key) then return obj[key]",
		// "	if obj isa map and map.hasIndex(key) then return obj[key]",
		// "	if obj isa string and string.hasIndex(key) then return obj[key]",
		// "	if obj isa number and number.hasIndex(key) then return obj[key]",
		"	isaobj = obj",
		"	while isaobj.hasIndex(\"__isa\")",
		"		isaobj = obj[\"__isa\"]",
		"		if isaobj.hasIndex(key) then",
		"			val = obj[key]",
		"			return val", // Doesn't seem to like obj[key]() so this is a workaround
		"		end if",
		"	end while",
		"	return null",
		"end function",
	].join("\n"),
	"assign_objects": [
		"assign_objects = function(target, source1, source2, source3)",
		"	assign_to_list = function(target, source)",
		"		if source isa list then",
		"			for i in range(0, source.len - 1, 1)",
		"				if target.len <= i then target.push(null)",
		"				target[i] = source[i]",
		"			end for",
		"		else if source isa map then",
		"			for item in source",
		"				key = str(item.key).to_int",
		"				if key isa number then target[key] = item.value",
		"			end for",
		"		end if",
		"		return target",
		"	end function",
		"	counter = 0",
		"	assign_object = function(target, source)",
		"		if target isa list then return assign_to_list(target, source)",
		"		if source isa list then",
		"			for i in range(0, source.len - 1, 1)",
		"				target[str(i)] = source[i]",
		"			end for",
		"		else if source isa map then",
		"			for item in source",
		"				target[item.key] = item.value",
		"			end for",
		"		else",
		"			target[str(outer.counter)] = source",
		"			outer.counter = outer.counter + 1",
		"		end if",
		"	end function",
		"	if source1 isa list then",
		"		if target isa list then return assign_to_list(target, source1)",
		"		for source in source1",
		"			assign_object(target, source)",
		"		end for",
		"		return target",
		"	end if",
		"	if source1 then assign_object(target, source1)",
		"	if source2 then assign_object(target, source2)",
		"	if source3 then assign_object(target, source3)",
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
		"		if predicate(item, index, array) then out.push(item)",
		"		index = index + 1",
		"	end for",
		"	return out",
		"end function",
	].join("\n"),
	"array_find": [
		"array_find = function(array, predicate)",
		"	index = 0",
		"	for item in array",
		"		if predicate(item, index, array) then return item",
		"		index = index + 1",
		"	end for",
		"	return null",
		"end function",
	].join("\n"),
	"array_some": [
		"array_some = function(array, predicate)",
		"	index = 0",
		"	for item in array",
		"		if predicate(item, index, array) then return 1",
		"		index = index + 1",
		"	end for",
		"	return 0",
		"end function",
	].join("\n"),
	"array_every": [
		"array_every = function(array, predicate)",
		"	index = 0",
		"	for item in array",
		"		if not predicate(item, index, array) then return 0",
		"		index = index + 1",
		"	end for",
		"	return 1",
		"end function",
	].join("\n"),
	"array_concat": [
		"array_concat = function(target, items)",
		"	out = target[0:]",
		"	for item in items",
		"		if item isa list then out = out + item else out.push(item)",
		"	end for",
		"	return out",
		"end function"
	].join("\n"),
	"math_min": [
		"math_min = function(numbers)",
		"	curr_min = null",
		"	for num in numbers",
		"		if curr_min == null or num < curr_min then curr_min = num",
		"	end for",
		"	return curr_min",
		"end function"
	].join("\n"),
	"math_max": [
		"math_max = function(numbers)",
		"	curr_max = null",
		"	for num in numbers",
		"		if curr_max == null or num > curr_max then curr_max = num",
		"	end for",
		"	return curr_max",
		"end function"
	].join("\n"),
	"nullish_coalescing_op": "nullish_coalescing_op = function(left, right)\n\tif left == null then return @right\n\treturn @left\nend function",
	"or_op": "or_op = function(left, right)\n\tif not left then return @right\n\treturn @left\nend function",
	"is_type": "is_type = function(value, type)\n\tif typeof(value) == type then return 1\n\treturn 0\nend function",
	"conditional_expr": "conditional_expr = function(cond, when_true, when_false)\n\tif cond then return when_true\n\treturn when_false\nend function",
};

export function createAnonFunction(body: string, params: string[]) {
	const defaultParams = new Array(3).fill(0).map((_, i) => `param${i}`);

	const nextName = `func_${anonFunctions.size}`;
	const paramString = Object.assign(defaultParams, params).join(",");

	const result = `${nextName} = function(${paramString})\n${body}\nend function`;
	anonFunctions.set(nextName, result);

	return { name: nextName, str: result };
}

// type TranspileOptions = {
// 	entryFileRelativePath: string,
// }

export function transpileString(typescriptString: string) {
	const ctx: TranspileContext = {
		currentFolder: process.cwd(),
		currentFilePath: path.resolve(process.cwd(), "file.ts"),
		namedImports: {},
		namespaceImports: {},
		visitedFiles: {},
		output: [],
	};

	NodeHandler.transpileContext = ctx;

	const sourceFile = parseCode("file.ts", typescriptString);

	program = ts.createProgram({
		rootNames: [sourceFile.fileName],
		options: {
			target: ts.ScriptTarget.Latest,
			noLib: true,
			types: ["@grey-ts/types"],
			verbatimModuleSyntax: true,
		},
	});

	checker = program.getTypeChecker();

	transpileSourceFile(sourceFile, ctx);

	if (anonFunctions.size) {
		for (const declaration of anonFunctions.values())
			ctx.output.unshift(declaration);
		anonFunctions.clear();
	}

	if (calledUtilFunctions.size) {
		for (const call of calledUtilFunctions.keys())
			ctx.output.unshift(utilFunctions[call]);
		calledUtilFunctions.clear();
	}

	return ctx.output.join("\n");
}

export function transpileProgram(entryFileRelativePath: string) {
	const ctx: TranspileContext = {
		currentFolder: "",
		currentFilePath: path.resolve(process.cwd(), entryFileRelativePath),
		namedImports: {},
		namespaceImports: {},
		visitedFiles: {},
		output: [],
	};

	NodeHandler.transpileContext = ctx;

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

	const entry = program.getSourceFile(ctx.currentFilePath);
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
		anonFunctions.clear();
	}

	if (calledUtilFunctions.size) {
		for (const call of calledUtilFunctions.keys())
			ctx.output.unshift(utilFunctions[call]);
		calledUtilFunctions.clear();
	}

	console.log(`Transpiling took ${Date.now() - start} ms`);

	return ctx.output.join("\n");
}

export function transpileSourceFile(sourceFile: ts.SourceFile, ctx: TranspileContext, returnResult?: boolean) {
	if (ctx.visitedFiles[sourceFile.fileName])
		return "";

	ctx.visitedFiles[sourceFile.fileName] = true;

	if (sourceFile.isDeclarationFile)
		return "";

	if (program.isSourceFileDefaultLibrary(sourceFile) || program.isSourceFileFromExternalLibrary(sourceFile))
		return "";

	const prevFile = ctx.currentFilePath;

	// printNodeAST(sourceFile);

	ctx.currentFilePath = sourceFile.fileName;
	ctx.currentFolder = path.dirname(sourceFile.fileName);
	ctx.namedImports[sourceFile.fileName] = {};
	ctx.namespaceImports[sourceFile.fileName] = new Set();

	const output: string[] = [];

	sourceFile.forEachChild((node) => {
		const result = NodeHandler.handle(node);
		if (!result) return;

		if (!returnResult)
			ctx.output.push(result);
		else
			output.push(result);
	});

	ctx.currentFilePath = prevFile;
	ctx.currentFolder = path.dirname(prevFile);

	return output.join("\n");
}