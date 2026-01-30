import * as fs from "node:fs";
import * as path from "node:path";
import ts from "typescript";

import { NodeHandler } from "./nodeHandler";
import parseCode from "./parser";
import { findProjectRoot } from "./utils";

import "./visitors/assignments";
import "./visitors/classes";
import "./visitors/expressions";
import "./visitors/functions";
import "./visitors/identifiers";
import "./visitors/imports";
import "./visitors/objects";
import "./visitors/statements";
import "./visitors/variables";

import "./call_transformers/array";
import "./call_transformers/object";
import "./call_transformers/string";

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

export let program: ts.Program;
export let checker: ts.TypeChecker;

export const utilitiesToInsert = new Map<string, string>();

export const extensionFunctions = {
	"Array.map": [
		"list.map = function(callback)",
		"	index = 0",
		"	out = []",
		"	for item in self",
		"		out.push(callback(item, index, self))",
		"		index = index + 1",
		"	end for",
		"	return out",
		"end function",
	].join("\n"),
	"Array.filter": [
		"list.filter = function(predicate)",
		"	index = 0",
		"	out = []",
		"	for item in self",
		"		if predicate(item, index, self) then out.push(item)",
		"		index = index + 1",
		"	end for",
		"	return out",
		"end function",
	].join("\n"),
	"Array.find": [
		"list.find = function(predicate)",
		"	index = 0",
		"	for item in self",
		"		if predicate(item, index, self) then return item",
		"		index = index + 1",
		"	end for",
		"	return null",
		"end function",
	].join("\n"),
	"Array.some": [
		"list.some = function(predicate)",
		"	index = 0",
		"	for item in self",
		"		if predicate(item, index, self) then return 1",
		"		index = index + 1",
		"	end for",
		"	return 0",
		"end function",
	].join("\n"),
	"Array.every": [
		"list.every = function(predicate)",
		"	index = 0",
		"	for item in self",
		"		if not predicate(item, index, self) then return 0",
		"		index = index + 1",
		"	end for",
		"	return 1",
		"end function",
	].join("\n"),
	"Array.concat": [
		"list.concat = function(items)",
		"	out = self[0:]",
		"	for item in items",
		"		if item isa list then out = out + item else out.push(item)",
		"	end for",
		"	return out",
		"end function"
	].join("\n"),
	"Array.push": [
		"list.push_many = function(items)",
		"	for item in items[:]",
		"		self.push(@item)",
		"	end for",
		"	return self.len",
		"end function"
	].join("\n"),
	"Array.unshift": [
		"list.unshift = function(items)",
		"	if not items.len then return self.len",
		"	for i in range(items.len-1)",
		"		self.insert(0, items[i])",
		"	end for",
		"	return self.len",
		"end function"
	].join("\n"),
	"Array.reverse": [
		"list.old_reverse = @list.reverse",
		"list.reverse = function",
		"	self.old_reverse",
		"	return self",
		"end function"
	].join("\n"),
	"String.startsWith": [
		"string.startsWith = function(search, pos = 0)",
		"	if pos < 0 then pos = 0",
		"	return self.indexOf(search) == pos",
		"end function",
	].join("\n"),
	"String.endsWith": [
		"string.endsWith = function(search, pos = null)",
		"	if pos == null then pos = self.len",
		"	if pos < 0 then pos = 0",
		"	return self.indexOf(search) + search.len == pos",
		"end function",
	].join("\n"),
	"String.repeat": [
		"string.repeatSelf = function(count = 0)",
		"	return self * count",
		"end function",
	].join("\n"),
	"Math.min": [
		"Math.min = function(numbers)",
		"	curr_min = null",
		"	for num in numbers",
		"		if curr_min == null or num < curr_min then curr_min = num",
		"	end for",
		"	return curr_min",
		"end function"
	].join("\n"),
	"Math.max": [
		"Math.max = function(numbers)",
		"	curr_max = null",
		"	for num in numbers",
		"		if curr_max == null or num > curr_max then curr_max = num",
		"	end for",
		"	return curr_max",
		"end function"
	].join("\n"),
};

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
		"			res = obj[key]",
		"			if typeof(@res) == \"function\" and str(@res)[8:][1:-1].indexOf(\"self\") == 0 then return res(obj)",
		"			return obj[key]",
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
	"nullish_coalescing_op": "nullish_coalescing_op = function(left, right)\n\tif left == null then return @right\n\treturn @left\nend function",
	"or_op": "or_op = function(left, right)\n\tif not left then return @right\n\treturn @left\nend function",
	"is_type": "is_type = function(value, type)\n\tif typeof(value) == type then return 1\n\treturn 0\nend function",
	"conditional_expr": "conditional_expr = function(cond, when_true, when_false)\n\tif cond then return when_true\n\treturn when_false\nend function",
	...extensionFunctions
};

export function createAnonFunction(body: string, params: string[]) {
	const defaultParams = new Array(3).fill(0).map((_, i) => `param${i}`);

	const nextName = `func_${utilitiesToInsert.size}`; // A unique name
	const paramString = Object.assign(defaultParams, params).join(",");

	const result = `${nextName} = function(${paramString})\n${body}\nend function`;
	utilitiesToInsert.set(nextName, result);

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

	if (utilitiesToInsert.size) {
		ctx.output.unshift(...utilitiesToInsert.values());
		utilitiesToInsert.clear();
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

	if (!parsed.options.types)
		parsed.options.types = [];

	if (!parsed.options.types.includes("@grey-ts/types")) {
		parsed.options.types.push("@grey-ts/types");
	}

	parsed.options.noLib = true;

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

	if (utilitiesToInsert.size) {
		ctx.output.unshift(...utilitiesToInsert.values());
		utilitiesToInsert.clear();
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