import ts from "typescript";
import { createAnonFunction, handleNode, type TranspileContext } from "../transpiler";

function transpileFunctionBody(node: { body?: ts.Block, parameters: ts.NodeArray<ts.ParameterDeclaration>; }, ctx: TranspileContext) {
	const params = node.parameters.map(param => handleNode(param, ctx)).join(", ");
	const body = node.body ? handleBlock(node.body, ctx) : "";

	return `function(${params})\n${body}\nend function`;
}

function handleBlock(node: ts.Block, ctx: TranspileContext): string {
	const output = node.statements.map(val => {
		let statement = handleNode(val, ctx);
		statement = statement.split("\n").map(line => "\t" + line).join("\n");

		return statement;
	}).join("\n");

	return output;
}

// Methods inside classes and objects
function handleMethodDeclaration(node: ts.MethodDeclaration, ctx: TranspileContext): string {
	// if (ts.isObjectLiteralExpression(node.parent)) {

	// }
	// console.log(`P: ${ts.SyntaxKind[node.parent.kind]}`, node.name.getText())
	return `${handleNode(node.name, ctx)} = ${transpileFunctionBody(node, ctx)}`;
}

function handleFunctionDeclaration(node: ts.FunctionDeclaration, ctx: TranspileContext): string {
	// TODO: confirm this
	// Is a function overload.
	if (!node.body)
		return "";

	if (node.modifiers?.some(m => m.kind === ts.SyntaxKind.DeclareKeyword))
		return "";

	const name = node.name ? node.name.text : "anon";
	return `${name} = ${transpileFunctionBody(node, ctx)}`;
}

function handleArrowFunction(node: ts.ArrowFunction, ctx: TranspileContext): string {
	// if (ts.isBinaryExpression(node.parent) && !Object.is(node.parent.right, node)) {
	// 	throw "Inline arrow functions are not supported.";
	// }

	const params = node.parameters.map(param => handleNode(param, ctx));
	const body = ts.isBlock(node.body) ? handleNode(node.body, ctx) : `\treturn ${handleNode(node.body, ctx)}`;

	if (ts.isCallExpression(node.parent) || ts.isParenthesizedExpression(node.parent)) {
		return "@" + createAnonFunction(body, params).name;
	}

	if (ts.isPropertyAssignment(node.parent) || ts.isVariableDeclaration(node.parent) || ts.isBinaryExpression(node.parent) || ts.isReturnStatement(node.parent)) {
		return `function(${params.join(", ")})\n${body}\nend function`;
	}

	const kind = ts.SyntaxKind[node.parent.kind];
	throw `This kind of arrow function is not yet supported (parent: ${kind} (${node.parent.kind}))`;
}

function handleFunctionExpression(node: ts.FunctionExpression, ctx: TranspileContext): string {
	return transpileFunctionBody(node, ctx);
}

function createFunctionHandlers() {
	return {
		[ts.SyntaxKind.Block]: handleBlock,
		[ts.SyntaxKind.MethodDeclaration]: handleMethodDeclaration,
		[ts.SyntaxKind.FunctionDeclaration]: handleFunctionDeclaration,
		[ts.SyntaxKind.ArrowFunction]: handleArrowFunction,
		[ts.SyntaxKind.FunctionExpression]: handleFunctionExpression,
	};
}

export default createFunctionHandlers;
