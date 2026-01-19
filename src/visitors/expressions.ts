import path from "node:path";
import ts from "typescript";
import { calledUtilFunctions, checker, NodeHandler, transpileSourceFile, type TranspileContext } from "../transpiler";
import { asRef, callUtilFunction, getOperatorToken, getSourceFiles, nodeIsFunctionReference, replaceIdentifier, transformString } from "../utils";

/** Calculate the count of required (non-optional, non-default) parameters */
function calculateRequiredParams(params: readonly ts.Symbol[]): number {
	for (let i = params.length - 1; i >= 0; i--) {
		const param = params[i]!;
		if (!param.valueDeclaration || !ts.isParameter(param.valueDeclaration)) continue;
		if (param.valueDeclaration.dotDotDotToken) continue; // rest param doesn't count
		if (param.valueDeclaration.questionToken) continue; // optional
		if (param.valueDeclaration.initializer) continue; // has default

		return i + 1;
	}
	return 0;
}

/** Check if the last parameter is a rest parameter */
function hasRestParam(params: readonly ts.Symbol[]): boolean {
	if (!params.length) return false;
	const lastParam = params[params.length - 1]!;
	return !!(lastParam.valueDeclaration && ts.isParameter(lastParam.valueDeclaration) && lastParam.valueDeclaration.dotDotDotToken);
}

function handleCallArgs(callNode: ts.CallExpression | ts.NewExpression, ctx: TranspileContext): string[] {
	const args = callNode.arguments;
	if (!args) return [];

	const result: string[] = [];
	const acc: string[] = [];
	const restArrays: string[] = [];

	const params = checker.getResolvedSignature(callNode)?.parameters || [];
	const requiredParamCount = calculateRequiredParams(params);
	const hasRestParameter = hasRestParam(params);

	let remainingRequired = requiredParamCount;

	function pushAcc(...items: string[]) {
		for (const item of items) {
			if (remainingRequired > 0) {
				result.push(item);
				remainingRequired--;
				continue;
			}

			acc.push(item);
			remainingRequired--;
		}
	}

	for (const arg of args) {
		if (!ts.isSpreadElement(arg)) {
			pushAcc(NodeHandler.handle(arg));
			continue;
		}

		if (ts.isArrayLiteralExpression(arg.expression)) {
			const arrayItems: string[] = [];
			const outArrs: string[] = [];
			handleArrayLiteralExpression(arg.expression, ctx, arrayItems, outArrs);

			// TODO: Maybe do something smarter? Although why would anyone reach this error :/
			if (outArrs.length > 1)
				throw "The transpiler can't handle it yet if there are nested spread elements as parameters";

			pushAcc(...arrayItems);
			continue;
		}

		const arrayName = NodeHandler.handle(arg.expression);

		// Not perfect. Fails at runtime if the array's length is less than the missing params
		// Although typescript should complain about it so maybe this is not a problem?
		if (remainingRequired > 0) {
			for (let i = 0; i < remainingRequired; i++) {
				result.push(`${arrayName}[${i}]`);
			}

			if (hasRestParameter) restArrays.push(`${arrayName}[${remainingRequired}:]`);
			remainingRequired = 0;
			continue;
		}

		if (acc.length) {
			restArrays.push(`[${acc.join(",")}]`);
			acc.length = 0;
		}

		restArrays.push(arrayName);
		remainingRequired--;
	}

	if (acc.length) {
		if (remainingRequired > 0 || !hasRestParameter) {
			result.push(...acc);
		}
		else {
			const arr: string[] = [];
			for (const item of acc) {
				if (item[0] !== "[") {
					arr.push(item);
					continue;
				}

				if (arr.length) {
					restArrays.push(`[${arr.join(",")}]`);
					arr.length = 0;
				}
				restArrays.push(item);
			}

			if (arr.length) restArrays.push(`[${arr.join(",")}]`);
		}
	}

	if (restArrays.length) {
		result.push(restArrays.join(" + "));
	}

	return result;
}

NodeHandler.register(ts.SyntaxKind.CallExpression, (node: ts.CallExpression, ctx) => {
	const args = handleCallArgs(node, ctx);

	let name = NodeHandler.handle(node.expression);

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
		return callUtilFunction("math_min", `${args.join(",")}`);
	}
	else if (symbolFullName === "Math.max") {
		return callUtilFunction("math_max", `${args.join(",")}`);
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
		return callUtilFunction("assign_objects", args.join(","));
	}
	else if (symbolFullName === "ObjectConstructor.keys") {
		return `${[args[0]]}.indexes`;
	}

	if (name === "is_type" && !calledUtilFunctions.get("is_type")) {
		calledUtilFunctions.set("is_type", true);
	}

	if (!args.length)
		return name;

	return `${name}(${args.join(", ")})`;
});

NodeHandler.register(ts.SyntaxKind.NewExpression, (node: ts.NewExpression, ctx) => {
	const args = handleCallArgs(node, ctx);

	let output = `(new ${NodeHandler.handle(node.expression)}).constructor`;
	if (args.length)
		output += `(${args.join(",")})`;

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

	if (operator === "!") {
		if (ts.isPrefixUnaryExpression(node.parent) && ts.tokenToString(node.parent.operator) === "!") {
			return `(not ${operand})`;
		}

		return `not ${operand}`;
	}

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

	if ((!out.length || itemStrings.length) && !ts.isSpreadElement(node.parent)) {
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