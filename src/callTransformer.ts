import path from "node:path";
import ts from "typescript";
import { transpileSourceFile, type TranspileContext } from "./transpiler";
import { callUtilFunction, getSourceFiles } from "./utils";

type CallHandlerType = (functionName: string, callArgs: string[], node: ts.CallExpression, ctx: TranspileContext) => string;

export class CallTransformer {
	private static handlers = new Map<string, CallHandlerType>();

	static register(symbolFullName: string, handler: CallHandlerType) {
		if (this.handlers.has(symbolFullName))
			throw `Handler for '${symbolFullName}' was already registered`;

		this.handlers.set(symbolFullName, handler);
	}

	static handle(symbolFullName: string, functionName: string, callArgs: string[], node: ts.CallExpression, ctx: TranspileContext): string | null {
		const handler = this.handlers.get(symbolFullName);
		if (!handler) return null;

		return handler(functionName, callArgs, node, ctx);
	}
}

CallTransformer.register("Array.concat", (name, args) => {
	const dotI = name.lastIndexOf(".");
	const arrayName = name.slice(0, dotI);
	return callUtilFunction("array_concat", arrayName, args.join(","));
});

CallTransformer.register("Array.map", (name, args) => {
	if (!args.length) throw "Invalid argument count";
	return callUtilFunction("array_map", name.slice(0, name.lastIndexOf(".")), args[0]!);
});

CallTransformer.register("Array.filter", (name, args) => {
	if (!args.length) throw "Invalid argument count";
	return callUtilFunction("array_filter", name.slice(0, name.lastIndexOf(".")), args[0]!);
});

CallTransformer.register("Array.find", (name, args) => {
	if (!args.length) throw "Invalid argument count";
	return callUtilFunction("array_find", name.slice(0, name.lastIndexOf(".")), args[0]!);
});

CallTransformer.register("Array.some", (name, args) => {
	if (!args.length) throw "Invalid argument count";
	return callUtilFunction("array_some", name.slice(0, name.lastIndexOf(".")), args[0]!);
});

CallTransformer.register("Array.every", (name, args) => {
	if (!args.length) throw "Invalid argument count";
	return callUtilFunction("array_every", name.slice(0, name.lastIndexOf(".")), args[0]!);
});

CallTransformer.register("Math.min", (name, args) => {
	return callUtilFunction("math_min", `${args.join(",")}`);
});

CallTransformer.register("Math.max", (name, args) => {
	return callUtilFunction("math_max", `${args.join(",")}`);
});

CallTransformer.register("ObjectConstructor.hasOwn", (name, args) => {
	if (args.length < 2) throw "Invalid argument count";

	return `${args[0]}.hasIndex(${args[1]})`;
});

CallTransformer.register("ObjectConstructor.assign", (name, args) => {
	if (args.length < 2) throw "Invalid argument count";
	return callUtilFunction("assign_objects", args.join(","));
});

CallTransformer.register("ObjectConstructor.keys", (name, args) => {
	return `${args[0]}.indexes`;
});

CallTransformer.register("GreyHack.include", (name, args, node, ctx) => {
	if (!node.arguments.length) return "";

	const fileArg = node.arguments[0]!;
	if (!ts.isStringLiteralLike(fileArg))
		throw "You can't include variables";

	const absPath = path.resolve(ctx.currentFolder, fileArg.text);
	const sources = getSourceFiles(absPath);

	for (const source of sources) {
		transpileSourceFile(source, ctx);
	}

	return "";
});