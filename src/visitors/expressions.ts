
import ts from "typescript";
import { CallTransformer } from "../call_transformers/callTransformer";
import { NodeHandler } from "../nodeHandler";
import { checker, type TranspileContext } from "../transpiler";
import { asRef, assignmentOperators, callUtilFunction, getOperatorToken, nodeIsFunctionReference, replaceIdentifier, transformString } from "../utils";

/** Check if the last parameter is a rest parameter */
function hasRestParam(params: readonly ts.Symbol[]): boolean {
	if (!params.length) return false;
	const lastParam = params[params.length - 1]!;
	return !!(lastParam.valueDeclaration && ts.isParameter(lastParam.valueDeclaration) && lastParam.valueDeclaration.dotDotDotToken);
}

function handleCallArgs(callNode: ts.CallExpression | ts.NewExpression, ctx: TranspileContext): string[] {
	const args = callNode.arguments;
	if (!args) return [];

	type RestItem = { text: string, fromSpread: boolean; };

	const result: string[] = [];
	const restItems: RestItem[] = [];
	const restArrays: string[] = [];

	const params = checker.getResolvedSignature(callNode)?.parameters || [];
	const hasRestParameter = hasRestParam(params);
	const nonRestParamCount = params.length - Number(hasRestParameter);

	let remainingRequired = nonRestParamCount;

	function pushArgs(fromSpread: boolean, ...items: string[]) {
		for (const item of items) {
			if (remainingRequired > 0) {
				result.push(item);
				remainingRequired--;
				continue;
			}

			restItems.push({ text: item, fromSpread });
		}
	}

	for (const arg of args) {
		// Handle non-spread arguments
		if (!ts.isSpreadElement(arg)) {
			pushArgs(false, NodeHandler.handle(arg));
			continue;
		}

		// Handle spread of array literal: ...[1, 2, 3]
		if (ts.isArrayLiteralExpression(arg.expression)) {
			const arrayItems: string[] = [];
			const outArrs: string[] = [];
			handleArrayLiteralExpression(arg.expression, ctx, arrayItems, outArrs);

			// TODO: Maybe do something smarter? Although why would anyone reach this error :/
			// The argument would be something like this: ...[1,2,3,...[4,5,6]]
			if (outArrs.length > 1)
				throw "The transpiler can't handle it yet if there are nested spread elements as parameters";

			pushArgs(true, ...arrayItems);
			continue;
		}

		// Handle spread of identifier: ...arr

		const arrayName = NodeHandler.handle(arg.expression);

		// Fill remaining params from the spread array
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

		if (restItems.length) {
			restArrays.push(`[${restItems.map(el => el.text).join(",")}]`);
			restItems.length = 0;
		}

		restArrays.push(arrayName);
	}

	if (restItems.length) {
		if (remainingRequired > 0 || !hasRestParameter) {
			result.push(...restItems.map(el => el.text));
		}
		else {
			const processedItems: string[] = [];
			for (const item of restItems) {
				if (!item.fromSpread || !item.text.startsWith("[") || !item.text.endsWith("]")) {
					processedItems.push(item.text);
					continue;
				}

				if (processedItems.length) {
					restArrays.push(`[${processedItems.join(",")}]`);
					processedItems.length = 0;
				}
				restArrays.push(item.text);
			}

			if (processedItems.length)
				restArrays.push(`[${processedItems.join(",")}]`);
		}
	}

	if (restArrays.length) {
		result.push(restArrays.join(" + "));
	}

	if (hasRestParameter && result.length === params.length - 1)
		result.push("[]");

	return result;
}

NodeHandler.register(ts.SyntaxKind.CallExpression, (node: ts.CallExpression, ctx) => {
	const args = handleCallArgs(node, ctx);

	const name = NodeHandler.handle(node.expression);

	const type = checker.getTypeAtLocation(node.expression);
	let symbolFullName = type.symbol ? checker.getFullyQualifiedName(type.symbol) : "";

	// Without this for example Math.max would have "__type" as symbolFullName
	// And with only this it would omit the "GreyHack." from symbolFullName
	if (!symbolFullName || symbolFullName.startsWith("__")) {
		const symbol = checker.getSymbolAtLocation(node.expression);
		symbolFullName = symbol ? checker.getFullyQualifiedName(symbol) : "";
	}

	const transformed = CallTransformer.handle(symbolFullName, name, args, node, ctx);
	if (transformed !== null) return transformed;

	if (!args.length && !ts.isParenthesizedExpression(node.expression))
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

function shouldHaveOuterPrefix(node: ts.BinaryExpression, operator: string): boolean {
	// Only assigning has to be considered, reading is fine even without
	if (!assignmentOperators.has(operator))
		return false;

	// Works for property access as well without the outer prefix. Identifiers are the only problem
	if (!ts.isIdentifier(node.left))
		return false;

	// Check if we're inside a nested function

	const functionAncestor = ts.findAncestor(node.parent, n => ts.isFunctionLike(n));
	// We're not inside a function, so it's safe to assume the identifier doesn't need the prefix
	if (!functionAncestor)
		return false;

	// It's just a single function, not a nested one
	if (!ts.findAncestor(functionAncestor.parent, n => ts.isFunctionLike(n)))
		return false;

	const leftSymbol = checker.getSymbolAtLocation(node.left);

	// The symbol doesn't seem to have a declaration, typescript should complain about it
	if (!leftSymbol?.valueDeclaration)
		return false;

	// Symbols position is outside this function's boundary
	return (leftSymbol.valueDeclaration.end < functionAncestor.pos || leftSymbol.valueDeclaration.pos > functionAncestor.end);
}

function isAssignmentChain(node: ts.BinaryExpression, operator: string): boolean {
	if (!assignmentOperators.has(operator))
		return false;

	if (ts.isBinaryExpression(node.right) && assignmentOperators.has(ts.tokenToString(node.right.operatorToken.kind) || ""))
		return true;

	if (ts.hasOnlyExpressionInitializer(node.parent))
		return true;

	return false;
}

NodeHandler.register(ts.SyntaxKind.BinaryExpression, (node: ts.BinaryExpression) => {
	// console.log(ts.SyntaxKind[node.parent.kind], node.getText())
	let operatorToken = getOperatorToken(node.operatorToken) || node.operatorToken.getText();

	// Chained assignment are not a thing in GreyScript/MiniScript.
	// TODO: Maybe figure out an alternative way or keep as is
	if (isAssignmentChain(node, operatorToken))
		throw `Assignment chaining is not supported`;

	let right = NodeHandler.handle(node.right);
	if (nodeIsFunctionReference(node.right))
		right = asRef(right);

	if (ts.isPropertyAccessExpression(node.left)) {
		const leftType = checker.getTypeAtLocation(node.left.expression);
		const symbol = leftType.getProperty(node.left.name.text);

		if (symbol?.declarations?.some(decl => ts.isSetAccessor(decl))) {
			const objName = NodeHandler.handle(node.left.expression);
			const key = node.left.name.text;

			if (operatorToken !== "=" && symbol.declarations.some(decl => ts.isGetAccessor(decl)))
				throw `Can't handle '${operatorToken}' because '${objName}' doesn't have a getter '${key}'`;

			if (operatorToken === "+=" || operatorToken === "-=") {
				right = `${objName}.${key} ${operatorToken[0]} ${right}`;
			}
			else if (operatorToken !== "=") {
				throw `The transpiler can't handle ${operatorToken} operator for setters yet`;
			}

			return `${objName}.set_${key}(${right})`;
		}
	}

	let left = NodeHandler.handle(node.left);

	if (shouldHaveOuterPrefix(node, operatorToken))
		left = `outer.${left}`;

	if (nodeIsFunctionReference(node.left))
		left = asRef(left);

	if (operatorToken === "or" && ts.hasOnlyExpressionInitializer(node.parent)) {
		return callUtilFunction("or_op", left, right);
	}

	switch (operatorToken) {
		case "instanceof":
			return `${left} isa ${right}`;
		case "??":
			return callUtilFunction("nullish_coalescing_op", left, right);
		case "??=":
			return `${left} = ${callUtilFunction("nullish_coalescing_op", left, right)}`;
		case "in":
			return `${right}.hasIndex(${left})`;
		case "&":
			return `bitwise("&", ${left}, ${right})`;
		case "|":
			return `bitwise("|", ${left}, ${right})`;
		case "^":
			return `bitwise("^", ${left}, ${right})`;
		case "<<":
			return `bitwise("<<", ${left}, ${right})`;
		case ">>":
			return `bitwise(">>", ${left}, ${right})`;
		case ">>>":
			return `bitwise(">>>", ${left}, ${right})`;
		case "+=":
		case "-=":
			return `${left} = ${left} ${operatorToken[0]} ${right}`;
	}

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

	switch (operator) {
		case "++":
		case "--":
			if (ts.hasOnlyExpressionInitializer(node.parent) || ts.isBinaryExpression(node.parent))
				throw `Operator ${operator} is not supported for this kind of expression yet`;
			return `${operand} = ${operand} ${operator[0]} 1`;
		case "!":
			if (ts.isPrefixUnaryExpression(node.parent) && ts.tokenToString(node.parent.operator) === "!") {
				return `(not ${operand})`;
			}

			return `not ${operand}`;
		case "-":
			return `-${operand}`;
		case "+":
			return `str(${operand}).val`;
		case "~":
			return `bitwise("~", ${operand})`;
		default:
			throw `Couldn't handle this UnaryExpression: ${node.getText()}`;
	}
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
	if (ts.isPropertyAccessExpression(node.expression)) {
		const pnode = node.expression;
		const left = NodeHandler.handle(pnode.expression);

		const leftType = checker.getTypeAtLocation(pnode.expression);
		const right = replaceIdentifier(NodeHandler.handle(pnode.name), leftType, pnode.name.text);
		return `${left}.remove("${right}")`;
	}

	if (ts.isElementAccessExpression(node.expression)) {
		const pnode = node.expression;
		const left = NodeHandler.handle(pnode.expression);

		let right: string;
		if (ts.isStringLiteral(pnode.argumentExpression)) {
			const leftType = checker.getTypeAtLocation(pnode.expression);
			right = `"${replaceIdentifier(pnode.argumentExpression.text, leftType, pnode.argumentExpression.text)}"`;
		}
		else {
			right = NodeHandler.handle(pnode.argumentExpression);
		}

		return `${left}.remove(${right})`;
	}

	throw `Cant handle delete expression for ${ts.SyntaxKind[node.expression.kind]}`;
});