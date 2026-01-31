import path from "node:path";
import ts from "typescript";
import { transpileSourceFile, utilFunctions, utilitiesToInsert, type TranspileContext } from "../transpiler";
import { callUtilFunction, getSourceFiles } from "../utils";

type CallHandlerType = (functionName: string, callArgs: string[], node: ts.CallExpression, ctx: TranspileContext) => string;

export class CallTransformer {
	private static handlers = new Map<string, CallHandlerType>();

	static register(symbolFullName: string, handler: CallHandlerType) {
		if (this.handlers.has(symbolFullName))
			throw `Handler for '${symbolFullName}' was already registered`;

		this.handlers.set(symbolFullName, handler);
	}

	static handle(symbolFullName: string, functionName: string, callArgs: string[], node: ts.CallExpression, ctx: TranspileContext): string | null {
		if (symbolFullName in utilFunctions) {
			if (symbolFullName.startsWith("Math"))
				utilitiesToInsert.set("create_math", "Math = {}");
			
			utilitiesToInsert.set(symbolFullName, utilFunctions[symbolFullName as keyof typeof utilFunctions]);

			const params = callArgs.length ? `(${callArgs.join(",")})` : "";
			return `${functionName}${params}`;
		}

		const handler = this.handlers.get(symbolFullName);
		if (!handler) return null;

		return handler(functionName, callArgs, node, ctx);
	}
}

CallTransformer.register("Number.toString", (name) => {
	const number = name.slice(0, name.lastIndexOf("."));
	return `str(${number})`;
});

CallTransformer.register("Function.toString", (name) => {
	const func = name.slice(0, name.lastIndexOf("."));
	return `str(@${func})`;
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

CallTransformer.register("GreyHack.isType", (name, args) => {
	return callUtilFunction("is_type", args.join(","));
});

CallTransformer.register("Boolean", (name, args) => {
	if (!args.length) return "0";
	return `(not (not ${args[0]}))`;
});

CallTransformer.register("Number", (name, args) => {
	if (!args.length) return "0";
	return `str(${args[0]}).val`;
});

CallTransformer.register("String", (name, args) => {
	if (!args.length) return "";
	return `str(${args[0]})`;
});