import ts from "typescript";
import { apiNameMap } from "../replaceKeywords";
import { checker, handleNode, type TranspileContext } from "../transpiler";

function handlePropertyAccessExpression(node: ts.PropertyAccessExpression, ctx: TranspileContext): string {
	const left = handleNode(node.expression, ctx);
	// const right = handleNode(node.name, ctx);

	const leftType = checker.getTypeAtLocation(node.expression);
	const symbol = leftType.getProperty(node.name.text)
	const symbolFullName = symbol ? checker.getFullyQualifiedName(symbol) : "";

	const right = apiNameMap[symbolFullName] ?? node.name.text;
	// console.log(ts.SyntaxKind[node.kind], node.getText(), symbolFullName, right);

	// We've imported something like this: import * as lib from "mylib"
	// Next when we use lib.func() we omit the lib. so it becomes func()
	if (ctx.namedImports[left])
		return right;

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

	

	return output
}

function handleCallExpression(node: ts.CallExpression, ctx: TranspileContext): string {
	// console.log(node);
	const args = node.arguments.map(arg => handleNode(arg, ctx)).join(", ");
	return `${handleNode(node.expression, ctx)}(${args})`;
}

function handleNewExpression(node: ts.NewExpression, ctx: TranspileContext): string {
	const params = node.arguments?.map(arg => handleNode(arg, ctx)) || [];
	const output = `(new ${handleNode(node.expression, ctx)}).constructor(${params.join(",")})`;

	return output;
}

function handleBinaryExpression(node: ts.BinaryExpression, ctx: TranspileContext): string {
	let operatorToken = ts.tokenToString(node.operatorToken.kind) || node.operatorToken.getText();
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

	throw new Error(`Couldn't handle this UnaryExpression: ${node.getText()}`)
}

function handleArrayLiteralExpression(node: ts.ArrayLiteralExpression, ctx: TranspileContext): string {
	return `[${node.elements.map(item => handleNode(item, ctx)).join(",")}]`;
}

function handleObjectLiteralExpression(node: ts.ObjectLiteralExpression, ctx: TranspileContext): string {
	const res = `{${node.properties.map(item => handleNode(item, ctx)).join(",")}}`;
	return res;
}

function handleElementAccessExpression(node: ts.ElementAccessExpression, ctx: TranspileContext): string {
	if (ts.isStringLiteral(node.argumentExpression)) {
		const leftType = checker.getTypeAtLocation(node.expression);
		const symbol = leftType.getProperty(node.argumentExpression.text)
		const symbolFullName = symbol ? checker.getFullyQualifiedName(symbol) : "";

		const right = apiNameMap[symbolFullName] ?? node.argumentExpression.text;

		return `${handleNode(node.expression, ctx)}.${right}`;
	}

	return `${handleNode(node.expression, ctx)}[${handleNode(node.argumentExpression, ctx)}]`;
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

	// TODO: CHECK
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