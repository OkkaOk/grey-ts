import ts from "typescript";
import { apiNameMap, handleNode } from "../transpiler.js";

function handlePropertyAccessExpression(node: ts.PropertyAccessExpression): string {
	const output = `${handleNode(node.expression)}.${handleNode(node.name)}`;
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

function handleCallExpression(node: ts.CallExpression): string {
	// console.log(node);
	const args = node.arguments.map(arg => handleNode(arg)).join(", ");
	return `${handleNode(node.expression)}(${args})`;
}

function handleNewExpression(node: ts.CallExpression): string {
	const newVariableName = ts.isVariableDeclaration(node.parent) ? handleNode(node.parent.name) : "";
	let output = `new ${handleNode(node.expression)}`;
	if (newVariableName) {
		const params = node.arguments?.map(arg => handleNode(arg)) || [];
		output += `\n${newVariableName}.constructor(${params.join(",")})`;
	}
	return output;
}

function handleBinaryExpression(node: ts.BinaryExpression): string {
	let operatorToken = ts.tokenToString(node.operatorToken.kind) || node.operatorToken.getText();
	if (operatorToken == "+=" || operatorToken == "-=")
		return `${handleNode(node.left)} = ${handleNode(node.left)} ${operatorToken[0]} ${handleNode(node.right)}`;

	if (operatorToken == "**") operatorToken = "^";
	else if (operatorToken == "||") operatorToken = "or";
	else if (operatorToken == "&&") operatorToken = "and";
	else if (operatorToken == "===") operatorToken = "==";

	return `${handleNode(node.left)} ${operatorToken} ${handleNode(node.right)}`;
}

function handleParenthesizedExpression(node: ts.ParenthesizedExpression): string {
	return `(${handleNode(node.expression)})`;
}

function handleUnaryExpression(node: ts.PrefixUnaryExpression | ts.PostfixUnaryExpression): string {
	const operand = handleNode(node.operand);

	const operator = ts.tokenToString(node.operator);
	if (operator == "!")
		return `not ${operand}`;

	if (operator == "++")
		return `${operand} = ${operand} + 1`;

	return `${operand} = ${operand} - 1`;
}

function handleArrayLiteralExpression(node: ts.ArrayLiteralExpression): string {
	return `[${node.elements.map(item => handleNode(item)).join(",")}]`;
}

function handleObjectLiteralExpression(node: ts.ObjectLiteralExpression): string {
	const res = `{${node.properties.map(item => handleNode(item)).join(",")}}`;
	return res;
}

function handleElementAccessExpression(node: ts.ElementAccessExpression): string {
	if (ts.isStringLiteral(node.argumentExpression)) {
		const key = node.argumentExpression.text;
		return `${handleNode(node.expression)}.${apiNameMap[key] ?? key}`;
	}

	return `${handleNode(node.expression)}[${handleNode(node.argumentExpression)}]`;
}

// e.g. `Hello ${name}`
function handleTemplateExpression(node: ts.TemplateExpression): string {
	// console.log(node);

	const head = handleNode(node.head);
	const strings = [
		...(head ? [`\"${head}\"`] : []),
		...node.templateSpans.map(span => handleNode(span)),
	];
	const output = strings.join(" + ");

	// TODO: CHECK
	return output;
}

function handleTemplateHead(node: ts.TemplateHead): string {
	return node.text;
}

function handleTemplateSpan(node: ts.TemplateSpan): string {
	let output = handleNode(node.expression);
	if (node.literal.text) output += ` + \"${node.literal.text}\"`;
	return output;
}

function handleConditionalExpression(node: ts.ConditionalExpression): string {
	if (node.parent.kind === ts.SyntaxKind.CallExpression) {
		throw new Error("Conditional expressions are not supported inside call expressions.");
	}

	return `\
if (${handleNode(node.condition)}) then
	${handleNode(node.whenTrue)}
else
	${handleNode(node.whenFalse)}
end if`;
}

function createExpressionHandlers() {
	return {
		[ts.SyntaxKind.PropertyAccessExpression]: handlePropertyAccessExpression,
		[ts.SyntaxKind.CallExpression]: handleCallExpression,
		[ts.SyntaxKind.NewExpression]: handleNewExpression,
		[ts.SyntaxKind.BinaryExpression]: handleBinaryExpression,
		[ts.SyntaxKind.ExpressionStatement]: (node: ts.ExpressionStatement) => handleNode(node.expression),
		[ts.SyntaxKind.NonNullExpression]: (node: ts.NonNullExpression) => handleNode(node.expression),
		[ts.SyntaxKind.ReturnStatement]: (node: ts.ReturnStatement) => {
			if (!node.expression) return "return";
			return `return ${handleNode(node.expression)}`;
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
		[ts.SyntaxKind.AsExpression]: (node: ts.AsExpression) => handleNode(node.expression),
		[ts.SyntaxKind.ConditionalExpression]: handleConditionalExpression,
	};
}

export default createExpressionHandlers;