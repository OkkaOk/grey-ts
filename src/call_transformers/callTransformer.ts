import path from "node:path";
import ts from "typescript";
import { NodeHandler } from "../nodeHandler";
import { checker, extensionFunctions, type TranspileContext, utilitiesToInsert } from "../transpiler";
import { callUtilFunction, getSourceFiles } from "../utils";

type CallHandlerType = (functionName: string, callArgs: string[], node: ts.CallExpression, ctx: TranspileContext) => string;

export class CallTransformer {
	private static handlers = new Map<string, CallHandlerType>();

	static register(symbolFullName: string, handler: CallHandlerType) {
		if (this.handlers.has(symbolFullName))
			throw `Handler for '${symbolFullName}' was already registered`;

		this.handlers.set(symbolFullName, handler);
	}

	static handle(type: ts.Type, functionName: string, callArgs: string[], node: ts.CallExpression, ctx: TranspileContext): string | null {
		let symbolFullName = "";
		if (type.isUnion()) {
			let result: string | null = null
			for (const t of type.types) {
				// This needs to be called so put it into a variable temorarily
				const res = CallTransformer.handle(t, functionName, callArgs, node, ctx);
				result ??= res;
			}
			return result;
		}
		else if (type.symbol) {
			symbolFullName = checker.getFullyQualifiedName(type.symbol);
		}

		// Without this some functions would have "__type" as symbolFullName
		// And with only this it would omit the "GreyHack." from symbolFullName
		if (!symbolFullName || symbolFullName.startsWith("__")) {
			const symbol = checker.getSymbolAtLocation(node.expression);
			symbolFullName = symbol ? checker.getFullyQualifiedName(symbol) : "";
		}

		if (symbolFullName in extensionFunctions) {
			utilitiesToInsert.set(symbolFullName, extensionFunctions[symbolFullName as keyof typeof extensionFunctions]);

			const params = callArgs.length ? `(${callArgs.join(",")})` : "";
			return `${functionName}${params}`;
		}

		const handler = this.handlers.get(symbolFullName);
		if (!handler) return null;

		return handler(functionName, callArgs, node, ctx);
	}
}

CallTransformer.register("Function.toString", (name) => {
	const func = name.slice(0, name.lastIndexOf("."));
	return `str(@${func})`;
});

CallTransformer.register("GreyHack.include", (_name, _args, node, ctx) => {
	if (!node.arguments.length) return "";

	const fileArg = node.arguments[0]!;
	if (!ts.isStringLiteralLike(fileArg))
		throw "You can't include variables";

	const absPath = path.resolve(ctx.currentFolder, fileArg.text);
	const sources = getSourceFiles(absPath);

	for (const source of sources) {
		NodeHandler.handle(source);
	}

	return "";
});

CallTransformer.register("GreyHack.isType", (_name, args) => {
	return callUtilFunction("is_type", args.join(","));
});

CallTransformer.register("Boolean", (_name, args) => {
	if (!args.length) return "0";
	return `(not (not ${args[0]}))`;
});

CallTransformer.register("Number", (_name, args) => {
	if (!args.length) return "0";
	return `str(${args[0]}).val`;
});

CallTransformer.register("String", (_name, args) => {
	if (!args.length) return "";
	return `str(${args[0]})`;
});