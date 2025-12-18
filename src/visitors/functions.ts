import ts from "typescript";
import { handleNode, type TranspileContext } from "../transpiler";

function transpileFunctionBody(node: { body?: ts.Block, parameters: ts.NodeArray<ts.ParameterDeclaration>; }, ctx: TranspileContext) {
	const params = node.parameters.map(param => handleNode(param.name, ctx)).join(", ");
	const body = node.body ? handleBlock(node.body, ctx) : "";

	return `function(${params})\n\t${body}\nend function`;
}

function handleBlock(node: ts.Block, ctx: TranspileContext): string {
	return node.statements.map(val => handleNode(val, ctx)).join("\n\t");
}

function handleConstructor(node: ts.ConstructorDeclaration, ctx: TranspileContext): string {
	const params = node.parameters.map(param => handleNode(param.name, ctx)).join(", ");
	const body = node.body ? handleBlock(node.body, ctx) : "";

	return `constructor = function(${params})\n\t${body}\nreturn self\nend function`;
}

function handleMethodDeclaration(node: ts.MethodDeclaration, ctx: TranspileContext): string {
	return transpileFunctionBody(node, ctx);
}

function handleFunctionDeclaration(node: ts.FunctionDeclaration, ctx: TranspileContext): string {
	if (node.modifiers?.some(m => m.kind === ts.SyntaxKind.DeclareKeyword))
		return "";

	const name = node.name ? node.name.text : "anon";
	return `${name} = ${transpileFunctionBody(node, ctx)}`;
}

function handleArrowFunction(node: ts.ArrowFunction, ctx: TranspileContext): string {
	// if (ts.isBinaryExpression(node.parent) && !Object.is(node.parent.right, node)) {
	// 	throw new Error("Inline arrow functions are not supported.");
	// }
	if (!ts.isVariableDeclaration(node.parent) && !ts.isBinaryExpression(node.parent)) {
		throw new Error("Inline anonymous arrow functions are not supported yet.");
	}

	const params = node.parameters.map(param => handleNode(param.name, ctx)).join(", ");
	const body = ts.isBlock(node.body) ? handleNode(node.body, ctx) : `return ${handleNode(node.body, ctx)}`;

	return `function(${params})\n\t${body}\nend function`;
}

function handleFunctionExpression(node: ts.FunctionExpression, ctx: TranspileContext): string {
	return transpileFunctionBody(node, ctx);
}

function createFunctionHandlers() {
	return {
		[ts.SyntaxKind.Block]: handleBlock,
		[ts.SyntaxKind.Constructor]: handleConstructor,
		[ts.SyntaxKind.MethodDeclaration]: handleMethodDeclaration,
		[ts.SyntaxKind.FunctionDeclaration]: handleFunctionDeclaration,
		[ts.SyntaxKind.ArrowFunction]: handleArrowFunction,
		[ts.SyntaxKind.FunctionExpression]: handleFunctionExpression,
	};
}

export default createFunctionHandlers;
