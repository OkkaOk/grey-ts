import ts from "typescript";
import { checker, handleNode, utilFunctions, type TranspileContext } from "../transpiler";
import { asRef, nodeIsFunction, replaceIdentifier } from "../utils";

function handlePropertyAccessExpression(node: ts.PropertyAccessExpression, ctx: TranspileContext): string {
	const left = handleNode(node.expression, ctx);
	// const right = handleNode(node.name, ctx);

	const leftType = checker.getTypeAtLocation(node.expression);
	const symbol = leftType.getProperty(node.name.text);

	// console.log(node.name.text, symbol);
	const right = replaceIdentifier(handleNode(node.name, ctx), symbol);
	const isFunction = nodeIsFunction(node.name);
	// console.log(ts.SyntaxKind[node.kind], node.getText(), symbolFullName, right, isFunction);

	// We've imported something like this: import * as lib from "mylib"
	// Next when we use lib.func() we omit the lib. so it becomes func()
	if (ctx.namedImports[left])
		return isFunction ? asRef(right) : right;

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

	return isFunction ? asRef(output) : output;
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
	
	const symbol = checker.getSymbolAtLocation(node.expression);
	const symbolFullName = symbol ? checker.getFullyQualifiedName(symbol) : "";

	// TODO: more modular system than this and the Object.assign above
	if (symbolFullName === "Array.concat") {
		const dotI = name.lastIndexOf(".");
		args.unshift(name.slice(0, dotI));
		return args.join(" + ");
	}

	const type = checker.getTypeAtLocation(node.expression);
	const callParams = type.getCallSignatures()[0]?.parameters || [];
	// console.log(ts.SyntaxKind[node.expression.kind], node.expression.getText(), callParams.length, checker.getSymbolAtLocation(node.expression))
	modifyArgs(args, callParams);

	if (name === "is_type" && !utilFunctions.has("is_type")) {
		utilFunctions.set("is_type", "is_type = function(value, type)\nif typeof(value) == type then return 1\nreturn 0\nend function");
	}
	else if (name === "Object.assign") {
		return `(${args.join(" + ")})`;
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
	let operatorToken = ts.tokenToString(node.operatorToken.kind) || node.operatorToken.getText();

	if (ts.isPropertyAccessExpression(node.left)) {
		const leftType = checker.getTypeAtLocation(node.left.expression);
		const symbol = leftType.getProperty(node.left.name.text);
		
		if (symbol?.declarations && ts.isSetAccessor(symbol.declarations[0]!)) {
			if (operatorToken != "=") {
				// TODO: make this work with others
				throw new Error("Set accessor can only work with = operator for now.");
			}

			return `${handleNode(node.left.expression, ctx)}.${node.left.name.text}(${handleNode(node.right, ctx)})`;
		}
	}

	if (operatorToken == "+=" || operatorToken == "-=")
		return `${handleNode(node.left, ctx)} = ${handleNode(node.left, ctx)} ${operatorToken[0]} ${handleNode(node.right, ctx)}`;

	if (operatorToken == "**") operatorToken = "^";
	else if (operatorToken == "||") operatorToken = "or";
	else if (operatorToken == "&&") operatorToken = "and";
	else if (operatorToken == "===") operatorToken = "==";
	else if (operatorToken == "!==") operatorToken = "!=";

	return `${handleNode(node.left, ctx)} ${operatorToken} ${handleNode(node.right, ctx)}`;
}

function handleParenthesizedExpression(node: ts.ParenthesizedExpression, ctx: TranspileContext): string {
	return `(${handleNode(node.expression, ctx)})`;
}

function handleUnaryExpression(node: ts.PrefixUnaryExpression | ts.PostfixUnaryExpression, ctx: TranspileContext): string {
	const operand = handleNode(node.operand, ctx);

	const operator = ts.tokenToString(node.operator);
	if (operator == "++")
		return `${operand} = ${operand} + 1`;

	if (operator == "--")
		return `${operand} = ${operand} - 1`;

	if (operator == "!")
		return `not ${operand}`;

	if (operator == "-")
		return `-${operand}`;

	if (operator == "+")
		return `${operand}.val()`;

	throw new Error(`Couldn't handle this UnaryExpression: ${node.getText()}`);
}

function handleArrayLiteralExpression(node: ts.ArrayLiteralExpression, ctx: TranspileContext): string {
	return `[${node.elements.map(item => handleNode(item, ctx)).join(",")}]`;
}

function handleObjectLiteralExpression(node: ts.ObjectLiteralExpression, ctx: TranspileContext): string {
	const res = `{${node.properties.map(item => handleNode(item, ctx)).join(",")}}`;
	return res;
}

function handleElementAccessExpression(node: ts.ElementAccessExpression, ctx: TranspileContext): string {
	let right: string;

	if (ts.isStringLiteral(node.argumentExpression)) {
		const leftType = checker.getTypeAtLocation(node.expression);
		const symbol = leftType.getProperty(node.argumentExpression.text);

		right = `"${replaceIdentifier(node.argumentExpression.text, symbol)}"`;
	}
	else {
		right = handleNode(node.argumentExpression, ctx);
	}

	return `${handleNode(node.expression, ctx)}[${right}]`;
}

// e.g. `Hello ${name}`
function handleTemplateExpression(node: ts.TemplateExpression, ctx: TranspileContext): string {
	// console.log(node);

	const head = handleNode(node.head, ctx);
	const strings = [
		...(head ? [`\"${head}\"`] : []),
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
	if (node.literal.text) output += ` + \"${node.literal.text}\"`;
	return output;
}

function handleConditionalExpression(node: ts.ConditionalExpression, ctx: TranspileContext): string {
	if (node.parent.kind === ts.SyntaxKind.CallExpression) {
		throw new Error("Conditional expressions are not supported inside call expressions.");
	}

	return `\
if (${handleNode(node.condition, ctx)}) then
	${handleNode(node.whenTrue, ctx)}
else
	${handleNode(node.whenFalse, ctx)}
end if`;
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
		[ts.SyntaxKind.ArrayLiteralExpression]: handleArrayLiteralExpression,
		[ts.SyntaxKind.ObjectLiteralExpression]: handleObjectLiteralExpression,
		[ts.SyntaxKind.ElementAccessExpression]: handleElementAccessExpression,
		[ts.SyntaxKind.TemplateExpression]: handleTemplateExpression,
		[ts.SyntaxKind.TemplateHead]: handleTemplateHead,
		[ts.SyntaxKind.TemplateSpan]: handleTemplateSpan,
		[ts.SyntaxKind.AsExpression]: (node: ts.AsExpression, ctx: TranspileContext) => handleNode(node.expression, ctx),
		[ts.SyntaxKind.ConditionalExpression]: handleConditionalExpression,
	};
}

export default createExpressionHandlers;