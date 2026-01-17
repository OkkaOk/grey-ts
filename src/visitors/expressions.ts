import path from "node:path";
import ts from "typescript";
import { calledUtilFunctions, checker, NodeHandler, transpileSourceFile, type TranspileContext } from "../transpiler";
import { asRef, callUtilFunction, getOperatorToken, getSourceFiles, nodeIsFunctionReference, replaceIdentifier, transformString } from "../utils";

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

NodeHandler.register(ts.SyntaxKind.CallExpression, (node: ts.CallExpression, ctx) => {
	const args = node.arguments.map(arg => NodeHandler.handle(arg));

	let name = NodeHandler.handle(node.expression);
	// if (name && name[0] === "@") name = name.slice(1); // Don't need it in call expression

	const type = checker.getTypeAtLocation(node.expression);
	let symbolFullName = type.symbol ? checker.getFullyQualifiedName(type.symbol) : "";

	// Without this for example Math.max would have "__type" as symbolFullName
	// And with only this it would omit the "GreyHack." from symbolFullName
	if (!symbolFullName || symbolFullName.startsWith("__")) {
		const symbol = checker.getSymbolAtLocation(node.expression);
		symbolFullName = symbol ? checker.getFullyQualifiedName(symbol) : "";
	}

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
	else if (symbolFullName === "Math.min") {
		return callUtilFunction("math_min", `[${args.join(",")}]`);
	}
	else if (symbolFullName === "Math.max") {
		return callUtilFunction("math_max", `[${args.join(",")}]`);
	}

	if (symbolFullName === "GreyHack.include") {
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
		return `${[args[0]]}.indexes`;
	}

	const callParams = checker.getResolvedSignature(node)?.parameters || [];

	// console.log(ts.SyntaxKind[node.expression.kind], node.expression.getText(), callParams.length, symbolFullName)
	modifyArgs(args, callParams);

	if (name === "is_type" && !calledUtilFunctions.get("is_type")) {
		calledUtilFunctions.set("is_type", true);
	}

	if (!args.length)
		return name;

	return `${name}(${args.join(", ")})`;
});

NodeHandler.register(ts.SyntaxKind.NewExpression, (node: ts.NewExpression) => {
	const args = node.arguments?.map(arg => NodeHandler.handle(arg)) || [];

	const constructArgs = checker.getResolvedSignature(node)?.parameters || [];
	modifyArgs(args, constructArgs);

	const output = `(new ${NodeHandler.handle(node.expression)}).constructor(${args.join(",")})`;
	return output;
});

NodeHandler.register(ts.SyntaxKind.BinaryExpression, (node: ts.BinaryExpression) => {
	// console.log(ts.SyntaxKind[node.parent.kind], node.getText())
	let operatorToken = getOperatorToken(node.operatorToken) || node.operatorToken.getText();

	// Chained assignment are not a thing in GreyScript/MiniScript.
	// TODO: Maybe figure out an alternative way or keep as is
	if (operatorToken === "=" && ts.isBinaryExpression(node.right) && node.right.operatorToken.kind === ts.SyntaxKind.EqualsToken) {
		throw "Assignment chaining is not supported";
	}

	let right = NodeHandler.handle(node.right);
	if (nodeIsFunctionReference(node.right))
		right = asRef(right);

	if (ts.isPropertyAccessExpression(node.left)) {
		const leftType = checker.getTypeAtLocation(node.left.expression);
		const symbol = leftType.getProperty(node.left.name.text);

		if (symbol?.declarations && ts.isSetAccessor(symbol.declarations[0]!)) {
			if (operatorToken != "=") {
				// TODO: make this work with others
				throw "Set accessor can only work with = operator for now.";
			}

			return `${NodeHandler.handle(node.left.expression)}.${node.left.name.text}(${right})`;
		}
	}

	let left = NodeHandler.handle(node.left);
	if (nodeIsFunctionReference(node.left))
		left = asRef(left);

	if (operatorToken === "or" && (ts.isVariableDeclaration(node.parent) || ts.isPropertyAssignment(node.parent))) {
		return callUtilFunction("or_op", left, right);
	}

	if (operatorToken === "??") {
		return callUtilFunction("nullish_coalescing_op", left, right);
	}
	else if (operatorToken === "??=") {
		return `${left} = ${callUtilFunction("nullish_coalescing_op", left, right)}`;
	}
	else if (operatorToken === "in") {
		return `${right}.hasIndex(${left})`;
	}
	else if (operatorToken === "&") {
		return `bitwise("&", ${left}, ${right})`;
	}
	else if (operatorToken === "|") {
		return `bitwise("|", ${left}, ${right})`;
	}
	else if (operatorToken === "^") {
		return `bitwise("^", ${left}, ${right})`;
	}
	else if (operatorToken === "<<") {
		return `bitwise("<<", ${left}, ${right})`;
	}
	else if (operatorToken === ">>") {
		return `bitwise(">>", ${left}, ${right})`;
	}
	else if (operatorToken === ">>>") {
		return `bitwise(">>>", ${left}, ${right})`;
	}

	// console.log(checker.getTypeAtLocation(node.right).flags, ts.TypeFlags.Undefined)
	if (operatorToken == "+=" || operatorToken == "-=")
		return `${left} = ${left} ${operatorToken[0]} ${right}`;

	if (operatorToken === "**")
		operatorToken = "^";

	return `${left} ${operatorToken} ${right}`;
});

NodeHandler.register(ts.SyntaxKind.ParenthesizedExpression, (node: ts.ParenthesizedExpression) => {
	return `(${NodeHandler.handle(node.expression)})`;
});

function handleUnaryExpression(node: ts.PrefixUnaryExpression | ts.PostfixUnaryExpression): string {
	const operand = NodeHandler.handle(node.operand);

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

NodeHandler.register(ts.SyntaxKind.PrefixUnaryExpression, handleUnaryExpression);
NodeHandler.register(ts.SyntaxKind.PostfixUnaryExpression, handleUnaryExpression);

NodeHandler.register(ts.SyntaxKind.SpreadElement, (node: ts.SpreadElement, ctx) => {
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
		// return node.expression.elements.map(item => NodeHandler.handle(item, ctx)).join(", ");
	}

	const params = checker.getResolvedSignature(node.parent)?.parameters || [];
	const missingParamCount = params.length - (node.parent.arguments?.length ?? 0) + 1;

	const spreadCount = node.parent.arguments?.map(p => ts.isSpreadElement(p) ? 1 : 0).reduce<number>((acc, curr) => acc + curr, 0) ?? 1;

	// TODO: This spaghetti doesn't work if there are more than 1 spread element in the parameters so let's throw
	if (spreadCount > 1)
		throw "The transpiler can't currently handle it if there are more than 1 spread operator as a parameter";

	const name = NodeHandler.handle(node.expression);
	return new Array(missingParamCount).fill(0).map((_, i) => `${name}[${i}]`).join(", ");
});

export function handleArrayLiteralExpression(node: ts.ArrayLiteralExpression, ctx: TranspileContext, itemStrings?: string[], out?: string[]): string {
	itemStrings ??= [];
	out ??= [];

	for (const item of node.elements) {
		if (!ts.isSpreadElement(item)) {
			itemStrings.push(NodeHandler.handle(item));
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

		out.push(NodeHandler.handle(item.expression));
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

NodeHandler.register(ts.SyntaxKind.ArrayLiteralExpression, handleArrayLiteralExpression);

// e.g. `Hello ${name}`
NodeHandler.register(ts.SyntaxKind.TemplateExpression, (node: ts.TemplateExpression) => {
	const head = NodeHandler.handle(node.head);
	const strings = [
		...(head ? [`"${head}"`] : []),
		...node.templateSpans.map(span => NodeHandler.handle(span)),
	];
	const output = strings.join(" + ");

	return output;
});

NodeHandler.register(ts.SyntaxKind.TemplateHead, (node: ts.TemplateHead) => {
	return transformString(node.text);
});

NodeHandler.register(ts.SyntaxKind.TemplateSpan, (node: ts.TemplateSpan) => {
	let output = NodeHandler.handle(node.expression);

	// Not sure if necessary
	if (ts.isBinaryExpression(node.expression))
		output = `str(${output})`;

	// The literal is the text after the expression. Is an empty string if a new TemplateSpan is right after like this ${first}${second}
	if (node.literal.text) output += ` + "${transformString(node.literal.text)}"`;
	return output;
});

NodeHandler.register(ts.SyntaxKind.NoSubstitutionTemplateLiteral, (node: ts.NoSubstitutionTemplateLiteral) => {
	return `"${transformString(node.text)}"`;
});

NodeHandler.register(ts.SyntaxKind.ConditionalExpression, (node: ts.ConditionalExpression) => {
	if (ts.isCallExpression(node.whenTrue) || ts.isCallExpression(node.whenFalse)) {
		throw "Call expressions are not supported inside conditional expressions yet"; // TODO: think of a solution for this
	}

	const condition = NodeHandler.handle(node.condition);
	const whenTrue = NodeHandler.handle(node.whenTrue);
	const whenFalse = NodeHandler.handle(node.whenFalse);
	return callUtilFunction("conditional_expr", condition, whenTrue, whenFalse);
});

NodeHandler.register(ts.SyntaxKind.ExpressionStatement, (node: ts.ExpressionStatement) => {
	return NodeHandler.handle(node.expression);
});

NodeHandler.register(ts.SyntaxKind.NonNullExpression, (node: ts.NonNullExpression) => {
	return NodeHandler.handle(node.expression);
});

NodeHandler.register(ts.SyntaxKind.AsExpression, (node: ts.AsExpression) => {
	return NodeHandler.handle(node.expression);
});

NodeHandler.register(ts.SyntaxKind.DeleteExpression, (node: ts.DeleteExpression) => {
	if (!ts.isPropertyAccessExpression(node.expression))
		throw `Cant handle delete expression for ${ts.SyntaxKind[node.expression.kind]}`;

	const pnode = node.expression;
	const left = NodeHandler.handle(pnode.expression);

	const leftType = checker.getTypeAtLocation(pnode.expression);
	const right = replaceIdentifier(NodeHandler.handle(pnode.name), leftType, pnode.name.text);
	return `${left}.remove(${right})`;
});