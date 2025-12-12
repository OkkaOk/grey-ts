import ts from "typescript";
import { handleNode } from "../transpiler";

function handlePropertyAccessExpression(node: ts.PropertyAccessExpression): string {
	return `${handleNode(node.expression)}.${handleNode(node.name)}`;
}

function handleCallExpression(node: ts.CallExpression): string {
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
	if (operatorToken == "**") operatorToken = "^";
	return `${handleNode(node.left)} ${operatorToken} ${handleNode(node.right)}`;
}

function handleParenthesizedExpression(node: ts.ParenthesizedExpression): string {
	return `(${handleNode(node.expression)})`
}

export function createExpressionHandlers() {
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
		[ts.SyntaxKind.ParenthesizedExpression]: handleParenthesizedExpression
	};
}

export default createExpressionHandlers;
