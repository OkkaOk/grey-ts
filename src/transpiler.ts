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
	visitedFiles: Set<string>;
	output: string[];
	extraOutput: Map<ts.Node, { before: string, after: string; }>;
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
	"Array.includes": [
		"list.includes = function(value, pos = 0)",
		"	index = self.indexOf(value)",
		"	if index == null then return 0",
		"	if pos < 0 then pos = 0",
		"	return index >= pos",
		"end function",
	].join("\n"),
	"Array.splice": [
		"list.splice = function(start, count)",
		"	deleted = []",
		"	if start < 0 then start = self.len + start",
		"	if start < 0 then start = 0",
		"	if count == null then count = self.len - start",
		"	if count <= 0 then return deleted",
		"	while deleted.len < count",
		"		if not self.hasIndex(start) then return deleted",
		"		deleted.push(self[start])",
		"		self.remove(start)",
		"	end while",
		"	return deleted",
		"end function",
	].join("\n"),
	"Array.fill": [
		"list.fill = function(value, start, endI)",
		"	len = self.len",
		"	if not len then return self",
		"	if start == null then start = 0",
		"	if endI == null then endI = len - 1",
		"	if start < 0 then start = len + start",
		"	if start < 0 then start = 0",
		"	if endI < 0 then endI = len + endI",
		"	if endI < 0 then endI = 0",
		"	for i in range(start, endI-1, 1)",
		"		if i >= len then break",
		"		self[i] = value",
		"	end for",
		"	return self",
		"end function",
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
	"String.includes": [
		"string.includes = function(search, pos = 0)",
		"	index = self.indexOf(search)",
		"	if index == null then return 0",
		"	if pos < 0 then pos = 0",
		"	return index >= pos",
		"end function",
	].join("\n"),
	"String.trimStart": [
		"string.trimStart = function()",
		'	return self.replace("^\\s+", "")',
		"end function",
	].join("\n"),
	"String.trimEnd": [
		"string.trimEnd = function()",
		'	return self.replace("\\s+$", "")',
		"end function",
	].join("\n"),
	"Number.toFixed": [
		"number.toFixed = function(digits = 0)",
		"	digits = floor(digits)",
		"	if digits <= 0 then return str(round(self))",
		"	value = self",
		"	value = value * (10 ^ digits)",
		"	value = round(value)",
		"	value = value / (10 ^ digits)",
		"	",
		"	str_value = str(value)",
		"	dot_index = str_value.indexOf(\".\")",
		"	if dot_index == null then",
		'		str_value = str_value + "." + ("0" * digits)',
		"	else if str_value[dot_index + 1:].len < digits then",
		"		repeat_count = digits - str_value[dot_index + 1:].len",
		'		str_value = str_value + ("0" * repeat_count)',
		"	end if",
		"	return str_value",
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

export const globalObjects: Record<string, string> = {
	"MapConstructor": [
		"Map = {}",
		"Map.constructor = function(entries)",
		"	self.data = {}",
		"	if not entries then return self",
		"	for entry in entries",
		"		self.data[entry[0]] = entry[1]",
		"	end for",
		"	return self",
		"end function",
		"Map.clear = function",
		"	for key in self.data.indexes",
		"		self.data.remove(@key)",
		"	end for",
		"end function",
		"Map.delete = function(key)",
		"	return self.data.remove(key)",
		"end function",
		"Map.forEach = function(callback)",
		"	for item in self.data",
		"		callback(@item.value, @item.key, self)",
		"	end for",
		"end function",
		"Map.get = function(key)",
		"	if not self.data.hasIndex(@key) then retun null",
		"	return self.data[@key]",
		"end function",
		"Map.has = function(key)",
		"	return self.data.hasIndex(@key)",
		"end function",
		"Map.set = function(key, value)",
		"	self.data[@key] = @value",
		"	return self",
		"end function",
		"Map.entries = function",
		"	entries = []",
		"	for item in self.data",
		"		entries.push([@item.key, @item.value])",
		"	end for",
		"	return entries",
		"end function",
		"Map.keys = function",
		"	return self.data.indexes",
		"end function",
		"Map.values = function",
		"	return self.data.values",
		"end function",
	].join("\n"),
	"SetConstructor": [
		"Set = {}",
		"Set.constructor = function(values)",
		"	self.data = {}",
		"	if not values then return self",
		"	for v in values",
		"		self.data[@v] = 1",
		"	end for",
		"	return self",
		"end function",
		"Set.add = function(value)",
		"	self.data[@value] = 1",
		"	return self",
		"end function",
		"Set.clear = function",
		"	for key in self.data.indexes",
		"		self.data.remove(@key)",
		"	end for",
		"end function",
		"Set.delete = function(key)",
		"	return self.data.remove(key)",
		"end function",
		"Set.forEach = function(callback)",
		"	for key in self.data.indexes",
		"		callback(@key, self)",
		"	end for",
		"end function",
		"Set.has = function(key)",
		"	return self.data.hasIndex(@key)",
		"end function",
		"Set.values = function",
		"	return self.data.indexes",
		"end function",
	].join("\n")
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
	"is_type": "is_type = function(value, type)\n\treturn typeof(value) == type\nend function",
	"conditional_expr": "conditional_expr = function(cond, when_true, when_false)\n\tif cond then return when_true\n\treturn when_false\nend function",
};

let anonFunctionsCreated = 0;
export function createAnonFunction(body: string, params: string[], insertToUtils = true) {
	const defaultParams = new Array(3).fill(0).map((_, i) => `param${i}`);

	const nextName = `func_${anonFunctionsCreated}`; // A unique name
	const paramString = Object.assign(defaultParams, params).join(",");

	const result = `${nextName} = function(${paramString})\n${body}\nend function`;

	anonFunctionsCreated++;
	if (insertToUtils) utilitiesToInsert.set(nextName, result);

	return { name: nextName, str: result };
}

// type TranspileOptions = {
// 	entryFileRelativePath: string,
// }

function createContext(currentFileName = "file.ts"): TranspileContext {
	return {
		currentFolder: process.cwd(),
		currentFilePath: path.resolve(process.cwd(), currentFileName),
		namedImports: {},
		namespaceImports: {},
		visitedFiles: new Set(),
		output: [],
		extraOutput: new Map(),
	};
}

export function transpileString(typescriptString: string) {
	const ctx = createContext();
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

	NodeHandler.handle(sourceFile);

	if (utilitiesToInsert.size) {
		ctx.output.unshift(...utilitiesToInsert.values());
		utilitiesToInsert.clear();
	}

	return ctx.output.join("\n");
}

export function transpileProgram(entryFileRelativePath: string): string[] {
	const ctx = createContext(entryFileRelativePath);
	NodeHandler.transpileContext = ctx;

	ctx.currentFolder = path.dirname(ctx.currentFilePath);

	if (!fs.existsSync(ctx.currentFilePath)) {
		console.error(`Error: file '${ctx.currentFilePath}' doesn't exist`);
		process.exit(1);
	}

	let start = Date.now();

	const tsconfigPath = `${findProjectRoot(process.cwd(), "tsconfig.json")}/tsconfig.json`;
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

	// TODO: Maybe use worker threads if it takes too long to transpile
	NodeHandler.handle(entry);

	if (utilitiesToInsert.size) {
		ctx.output.unshift(...utilitiesToInsert.values());
		utilitiesToInsert.clear();
	}

	console.log(`Transpiling took ${Date.now() - start} ms`);

	return ctx.output;
}