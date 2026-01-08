import path from "node:path";
import ts from "typescript";
import { calledUtilFunctions, checker, handleNode, transpileSourceFile, type TranspileContext } from "../transpiler";
import { asRef, callUtilFunction, getOperatorToken, getSourceFiles, nodeIsFunction, replaceIdentifier, unRef } from "../utils";

function handlePropertyAccessExpression(node: ts.PropertyAccessExpression, ctx: TranspileContext): string {
	const left = handleNode(node.expression, ctx);
	// const right = handleNode(node.name, ctx);

	const leftType = checker.getTypeAtLocation(node.expression);
	const symbol = leftType.getProperty(node.name.text);

	// console.log(node.name.text, symbol);
	let right = replaceIdentifier(handleNode(node.name, ctx), symbol);
	right = unRef(right);

	const isFunction = nodeIsFunction(node.name);
	// console.log(ts.SyntaxKind[node.kind], node.getText(), symbolFullName, right, isFunction);

	// TODO: Remove @ from getters. Or just improve the system

	// We've imported something like this: import * as lib from "mylib"
	// Next when we use lib.func() we omit the lib. so it becomes func()
	if (ctx.namedImports[ctx.currentFilePath]![left])
		return isFunction ? asRef(right) : unRef(right);

	// if (node.questionDotToken) {

	// }

	let getSafely = !!node.questionDotToken;

	const rightType = checker.getTypeAtLocation(node.name);
	if (!ctx.isAssignment && rightType.isUnion()) {
		// TODO: situation if right side is a function call.

		const hasUndefined = rightType.types.some(t => t.flags === ts.TypeFlags.Undefined);
		if (hasUndefined) getSafely = true;
	}

	if (getSafely)
		return callUtilFunction("get_property", left, `"${right}"`);

	// console.log(node.name.text, checker.getTypeAtLocation(node.name))

	const output = `${left}.${right}`;
	if (output === "String.prototype")
		return "string";
	else if (output === "Number.prototype")
		return "number";
	else if (output === "Object.prototype")
		return "map";
	else if (output === "Array.prototype")
		return "list";
	else if (output === "Function.prototype")
		return "funcRef";

	return isFunction ? asRef(output) : unRef(output);
}

function handleElementAccessExpression(node: ts.ElementAccessExpression, ctx: TranspileContext): string {
	const left = handleNode(node.expression, ctx);
	let right: string;

	if (ts.isStringLiteral(node.argumentExpression)) {
		const leftType = checker.getTypeAtLocation(node.expression);
		const symbol = leftType.getProperty(node.argumentExpression.text);

		right = `"${replaceIdentifier(node.argumentExpression.text, symbol)}"`;
	}
	else {
		right = handleNode(node.argumentExpression, ctx);
	}

	if (!ctx.isAssignment) {
		return callUtilFunction("get_property", left, `${right}`);
	}

	return `${left}[${right}]`;
}

/** Modifies the args to fit if there are rest parameters so it puts them in an array. */
function modifyArgs(args: string[], parameters: readonly ts.Symbol[]) {
	for (let i = 0; i < parameters.length || 0; i++) {
		const param = parameters[i]!;
		if (!param.valueDeclaration) continue;

		if (ts.isParameter(param.valueDeclaration) && param.valueDeclaration.dotDotDotToken) {
			if (args.length <= i) args.push(...new Array(i - args.length).fill("null"));

			args[i] = `[${args.splice(i).join(", ")}]`;
			break;
		}
	}

	return args;
}

function handleCallExpression(node: ts.CallExpression, ctx: TranspileContext): string {
	ctx.inFunctionCall = true;
	const args = node.arguments.map(arg => handleNode(arg, ctx));
	ctx.inFunctionCall = false;

	let name = handleNode(node.expression, ctx);
	if (name && name[0] === "@") name = name.slice(1); // Don't need it in call expression

	const type = checker.getTypeAtLocation(node.expression);
	const symbolFullName = type.symbol ? checker.getFullyQualifiedName(type.symbol) : "";

	// TODO: more modular system than this...
	if (symbolFullName === "Array.concat") {
		const dotI = name.lastIndexOf(".");
		args.unshift(name.slice(0, dotI));
		return args.join(" + ");
	}
	else if (symbolFullName === "Array.map") {
		if (!args.length) throw "Invalid argument count";
		return callUtilFunction("array_map", name.slice(0, name.lastIndexOf(".") || undefined), args[0]!);
	}
	else if (symbolFullName === "Array.filter") {
		if (!args.length) throw "Invalid argument count";
		return callUtilFunction("array_filter", name.slice(0, name.lastIndexOf(".") || undefined), args[0]!);
	}
	else if (symbolFullName === "Array.find") {
		if (!args.length) throw "Invalid argument count";
		return callUtilFunction("array_find", name.slice(0, name.lastIndexOf(".") || undefined), args[0]!);
	}
	else if (symbolFullName === "Array.some") {
		if (!args.length) throw "Invalid argument count";
		return callUtilFunction("array_some", name.slice(0, name.lastIndexOf(".") || undefined), args[0]!);
	}
	else if (symbolFullName === "Array.every") {
		if (!args.length) throw "Invalid argument count";
		return callUtilFunction("array_every", name.slice(0, name.lastIndexOf(".") || undefined), args[0]!);
	}

	if (symbolFullName === "GreyHack.include") {
		if (!node.arguments.length) return "";
		if (args[0]!.charAt(0) === "\"") {
			args[0] = args[0]!.slice(1, -1);
		}

		const absPath = path.resolve(ctx.currentFolder, args[0]!);
		const sources = getSourceFiles(absPath);

		for (const source of sources) {
			transpileSourceFile(source, ctx);
		}

		return "";
	}

	if (symbolFullName === "ObjectConstructor.hasOwn") {
		if (args.length < 2) throw "Invalid argument count";

		return `${args[0]}.hasIndex(${args[1]})`;
	}
	else if (symbolFullName === "ObjectConstructor.assign") {
		if (args.length < 2) throw "Invalid argument count";
		return callUtilFunction("assign_objects", args[0]!, `[${args.slice(1).join(",")}]`);
	}
	else if (symbolFullName === "ObjectConstructor.keys") {
		return `${[args[0]]}.indexes()`;
	}

	const callParams = type.getCallSignatures()[0]?.parameters || [];
	// console.log(ts.SyntaxKind[node.expression.kind], node.expression.getText(), callParams.length, symbolFullName)
	modifyArgs(args, callParams);

	if (name === "is_type" && !calledUtilFunctions.get("is_type")) {
		calledUtilFunctions.set("is_type", true);
	}

	return `${name}(${args.join(", ")})`;
}

function handleNewExpression(node: ts.NewExpression, ctx: TranspileContext): string {
	ctx.inFunctionCall = true;
	const args = node.arguments?.map(arg => handleNode(arg, ctx)) || [];
	ctx.inFunctionCall = false;

	const type = checker.getTypeAtLocation(node.expression);
	const constructArgs = type.getConstructSignatures()[0]?.parameters || [];
	modifyArgs(args, constructArgs);

	const output = `(new ${handleNode(node.expression, ctx)}).constructor(${args.join(",")})`;
	return output;
}

function handleBinaryExpression(node: ts.BinaryExpression, ctx: TranspileContext): string {
	// console.log(ts.SyntaxKind[node.parent.kind], node.getText())
	const operatorToken = getOperatorToken(node.operatorToken) || node.operatorToken.getText();

	// Chained assignment are not a thing in GreyScript/MiniScript.
	// TODO: Maybe figure out an alternative way or keep as is
	if (operatorToken === "=" && ts.isBinaryExpression(node.right) && node.right.operatorToken.kind === ts.SyntaxKind.EqualsToken) {
		throw "Assignment chaining is not supported"
	}

	const right = handleNode(node.right, ctx);

	if (ts.isPropertyAccessExpression(node.left)) {
		const leftType = checker.getTypeAtLocation(node.left.expression);
		const symbol = leftType.getProperty(node.left.name.text);

		if (symbol?.declarations && ts.isSetAccessor(symbol.declarations[0]!)) {
			if (operatorToken != "=") {
				// TODO: make this work with others
				throw "Set accessor can only work with = operator for now.";
			}

			return `${handleNode(node.left.expression, ctx)}.${node.left.name.text}(${right})`;
		}
	}

	if (operatorToken === "or" && (ts.isVariableDeclaration(node.parent) || ts.isPropertyAssignment(node.parent))) {
		const left = handleNode(node.left, ctx);
		return callUtilFunction("or_op", left, right);
	}

	if (operatorToken === "??") {
		const left = handleNode(node.left, ctx);
		return callUtilFunction("nullish_coalescing_op", left, right);
	}
	else if (operatorToken === "??=") {
		const left = handleNode(node.left, ctx);
		return `${left} = ${callUtilFunction("nullish_coalescing_op", left, right)}`;
	}
	else if (operatorToken === "in") {
		return `${right}.hasIndex(${handleNode(node.left, ctx)})`;
	}
	else if (operatorToken === "&") {
		return `bitwise("&", ${handleNode(node.left, ctx)}, ${right})`
	}
	else if (operatorToken === "|") {
		return `bitwise("|", ${handleNode(node.left, ctx)}, ${right})`
	}
	else if (operatorToken === "^") {
		return `bitwise("^", ${handleNode(node.left, ctx)}, ${right})`
	}
	else if (operatorToken === "<<") {
		return `bitwise("<<", ${handleNode(node.left, ctx)}, ${right})`
	}
	else if (operatorToken === ">>") {
		return `bitwise(">>", ${handleNode(node.left, ctx)}, ${right})`
	}
	else if (operatorToken === ">>>") {
		return `bitwise(">>>", ${handleNode(node.left, ctx)}, ${right})`
	}

	if (operatorToken === "=") ctx.isAssignment = true;
	const left = handleNode(node.left, ctx);
	if (operatorToken === "=") ctx.isAssignment = false;

	// console.log(checker.getTypeAtLocation(node.right).flags, ts.TypeFlags.Undefined)
	if (operatorToken == "+=" || operatorToken == "-=")
		return `${left} = ${left} ${operatorToken[0]} ${right}`;

	return `${left} ${operatorToken} ${right}`;
}

function handleParenthesizedExpression(node: ts.ParenthesizedExpression, ctx: TranspileContext): string {
	return `(${handleNode(node.expression, ctx)})`;
}

function handleUnaryExpression(node: ts.PrefixUnaryExpression | ts.PostfixUnaryExpression, ctx: TranspileContext): string {
	const operand = handleNode(node.operand, ctx);

	const operator = ts.tokenToString(node.operator);
	if (operator === "++")
		return `${operand} = ${operand} + 1`;

	if (operator === "--")
		return `${operand} = ${operand} - 1`;

	if (operator === "!")
		return `not ${operand}`;

	if (operator === "-")
		return `-${operand}`;

	if (operator === "+")
		return `${operand}.val()`;

	if (operator === "~")
		return `bitwise("~", ${operand})`;

	throw `Couldn't handle this UnaryExpression: ${node.getText()}`;
}

function handleSpreadElement(node: ts.SpreadElement, ctx: TranspileContext): string {
	// Here the parent can't be ArrayLiteralExpression anymore as I handle this node there
	// So the parent can only be either ts.CallExpression or ts.NewExpression
	if (ts.isArrayLiteralExpression(node.parent))
		throw new Error("SpreadElement's parent was ArrayLiteralExpression which shouldn't have been possible");

	if (ts.isArrayLiteralExpression(node.expression)) {
		const items: string[] = [];
		const out: string[] = [];
		handleArrayLiteralExpression(node.expression, ctx, items, out);

		// TODO: do something smarter...
		if (out.length > 1)
			throw "The transpiler can't handle it yet if there are nested spread elements as parameters";

		return items.join(", ");
		// return node.expression.elements.map(item => handleNode(item, ctx)).join(", ");
	}

	const callType = checker.getTypeAtLocation(node.parent.expression);
	const params = (callType.getCallSignatures()[0] ?? callType.getConstructSignatures()[0])?.parameters ?? [];
	const missingParamCount = params.length - (node.parent.arguments?.length ?? 0) + 1;

	const spreadCount = node.parent.arguments?.map(p => ts.isSpreadElement(p) ? 1 : 0).reduce<number>((acc, curr) => acc + curr, 0) ?? 1;

	// TODO: This spaghetti doesn't work if there are more than 1 spread element in the parameters so let's throw
	if (spreadCount > 1)
		throw "The transpiler can't currently handle it if there are more than 1 spread operator as a parameter";

	const name = handleNode(node.expression, ctx);
	return new Array(missingParamCount).fill(0).map((_, i) => `${name}[${i}]`).join(", ");
}

export function handleArrayLiteralExpression(node: ts.ArrayLiteralExpression, ctx: TranspileContext, itemStrings?: string[], out?: string[]): string {
	itemStrings ??= [];
	out ??= [];

	for (const item of node.elements) {
		if (!ts.isSpreadElement(item)) {
			itemStrings.push(handleNode(item, ctx));
			continue;
		}

		if (ts.isArrayLiteralExpression(item.expression)) {
			handleArrayLiteralExpression(item.expression, ctx, itemStrings, out);
			continue;
		}

		// const type = checker.getTypeAtLocation(item.expression);
		// const resolvedTypes = ("resolvedTypeArguments" in type) ? type.resolvedTypeArguments as ts.Type[] : [];
		// if (resolvedTypes.length && resolvedTypes.every(t => t.isLiteral())) {
		// 	for (const resolved of resolvedTypes) {
		// 		itemStrings.push(resolved.value.toString())
		// 	}
		// 	continue;
		// }

		if (itemStrings.length) {
			out.push(`[${itemStrings.join(",")}]`);
			itemStrings.length = 0;
		}

		out.push(handleNode(item.expression, ctx));
	}

	if (out.length && itemStrings.length) {
		out.push(`[${itemStrings.join(",")}]`);
		itemStrings.length = 0;
	} else if (!out.length) {
		out.push(`[${itemStrings.join(",")}]`);
		itemStrings.length = 0;
	}

	return out.join(" + ");
}

function handleObjectLiteralExpression(node: ts.ObjectLiteralExpression, ctx: TranspileContext, currObj?: string[], outObjects?: string[], funcs?: string[]): string {
	currObj ??= [];
	outObjects ??= [];
	funcs ??= [];

	const objectName = ts.isVariableDeclaration(node.parent) ? handleNode(node.parent.name, ctx) : "";

	function pushObj() {
		if (!currObj?.length)
			return "";

		const res = currObj.filter(s => s != "").join(",");
		if (res) {
			outObjects?.push(`{ ${res} }`);
		}

		currObj.length = 0;
		return res;
	}

	for (const item of node.properties) {
		if (ts.isFunctionLike(item)) {
			if (!objectName)
				throw "You can't have method declarations inside an object that is not being assigned to a variable";

			funcs.push(`${objectName}.${handleNode(item, ctx)}`);
			continue;
		}

		if (ts.isPropertyAssignment(item) && (ts.isFunctionExpression(item.initializer) || ts.isArrowFunction(item.initializer))) {
			if (!objectName)
				throw "You can't have method declarations inside an object that is not being assigned to a variable";
			funcs.push(`${objectName}.${handleNode(item.name, ctx)} = ${handleNode(item.initializer, ctx)}`);
			continue;
		}

		if (ts.isSpreadAssignment(item)) {
			if (ts.isObjectLiteralExpression(item.expression)) {
				handleObjectLiteralExpression(item.expression, ctx, currObj, outObjects);
				continue;
			}

			if (ts.isIdentifier(item.expression)) {
				pushObj();
				outObjects.push(handleNode(item.expression, ctx));
				continue;
			}

			if (ts.isArrayLiteralExpression(item.expression)) {
				pushObj();
				outObjects.push(handleNode(item.expression, ctx));
				continue;
			}
			// continue;
		}

		currObj.push(handleNode(item, ctx));
	}

	pushObj();
	if (!outObjects.length)
		outObjects.push("{}");

	let output = outObjects[0]!;
	if (outObjects.length > 1) {
		output = callUtilFunction("assign_objects", output, `[${outObjects.slice(1).join(",")}]`);
	}

	if (funcs.length) {
		output += "\n" + funcs.join("\n");
	}

	return output;
}

// e.g. `Hello ${name}`
function handleTemplateExpression(node: ts.TemplateExpression, ctx: TranspileContext): string {
	const head = handleNode(node.head, ctx);
	const strings = [
		...(head ? [`"${head}"`] : []),
		...node.templateSpans.map(span => handleNode(span, ctx)),
	];
	const output = strings.join(" + ");

	return output;
}

function handleTemplateHead(node: ts.TemplateHead): string {
	return node.text;
}

function handleTemplateSpan(node: ts.TemplateSpan, ctx: TranspileContext): string {
	let output = handleNode(node.expression, ctx);

	// Not sure if necessary
	if (ts.isBinaryExpression(node.expression))
		output = `str(${output})`;

	// The literal is the text after the expression. Is an empty string if a new TemplateSpan is right after like this ${first}${second}
	if (node.literal.text) output += ` + "${node.literal.text}"`;
	return output;
}

function handleConditionalExpression(node: ts.ConditionalExpression, ctx: TranspileContext): string {
	if (ts.isCallExpression(node.whenTrue) || ts.isCallExpression(node.whenFalse)) {
		throw "Call expressions are not supported inside conditional expressions yet"; // TODO: think of a solution for this
	}

	const condition = handleNode(node.condition, ctx);
	const whenTrue = handleNode(node.whenTrue, ctx);
	const whenFalse = handleNode(node.whenFalse, ctx);
	return callUtilFunction("conditional_expr", condition, whenTrue, whenFalse);
}

function createExpressionHandlers() {
	return {
		[ts.SyntaxKind.PropertyAccessExpression]: handlePropertyAccessExpression,
		[ts.SyntaxKind.CallExpression]: handleCallExpression,
		[ts.SyntaxKind.NewExpression]: handleNewExpression,
		[ts.SyntaxKind.BinaryExpression]: handleBinaryExpression,
		[ts.SyntaxKind.ExpressionStatement]: (node: ts.ExpressionStatement, ctx: TranspileContext) => handleNode(node.expression, ctx),
		[ts.SyntaxKind.NonNullExpression]: (node: ts.NonNullExpression, ctx: TranspileContext) => handleNode(node.expression, ctx),
		[ts.SyntaxKind.ReturnStatement]: (node: ts.ReturnStatement, ctx: TranspileContext) => {
			if (!node.expression) {
				// We're inside a constructor
				if (ts.findAncestor(node, (n) => ts.isConstructorDeclaration(n)))
					return "return self";

				return "return";
			}

			return `return ${handleNode(node.expression, ctx)}`;
		},
		[ts.SyntaxKind.ParenthesizedExpression]: handleParenthesizedExpression,
		[ts.SyntaxKind.PostfixUnaryExpression]: handleUnaryExpression,
		[ts.SyntaxKind.PrefixUnaryExpression]: handleUnaryExpression,
		[ts.SyntaxKind.SpreadElement]: handleSpreadElement,
		[ts.SyntaxKind.ArrayLiteralExpression]: handleArrayLiteralExpression,
		[ts.SyntaxKind.ObjectLiteralExpression]: handleObjectLiteralExpression,
		[ts.SyntaxKind.ElementAccessExpression]: handleElementAccessExpression,
		[ts.SyntaxKind.TemplateExpression]: handleTemplateExpression,
		[ts.SyntaxKind.TemplateHead]: handleTemplateHead,
		[ts.SyntaxKind.TemplateSpan]: handleTemplateSpan,
		[ts.SyntaxKind.FirstTemplateToken]: (node: ts.Identifier) => `"${node.text}"`,
		[ts.SyntaxKind.AsExpression]: (node: ts.AsExpression, ctx: TranspileContext) => handleNode(node.expression, ctx),
		[ts.SyntaxKind.ConditionalExpression]: handleConditionalExpression,
		[ts.SyntaxKind.DeleteExpression]: (node: ts.DeleteExpression, ctx: TranspileContext) => {
			if (!ts.isPropertyAccessExpression(node.expression))
				throw `Cant handle delete expression for ${ts.SyntaxKind[node.expression.kind]}`;

			const pnode = node.expression;
			const left = handleNode(pnode.expression, ctx);

			const leftType = checker.getTypeAtLocation(pnode.expression);
			const symbol = leftType.getProperty(pnode.name.text);

			const right = replaceIdentifier(handleNode(pnode.name, ctx), symbol);
			return `${left}.remove(${right})`;
		}
	};
}

export default createExpressionHandlers;