import ts from "typescript";
import { declaredFunctions, handleNode } from "../transpiler.js";

function transpileFunctionBody(node: { body?: ts.Block, parameters: ts.NodeArray<ts.ParameterDeclaration> }) {
	const params = node.parameters.map(param => handleNode(param.name)).join(", ");
	const body = node.body ? handleBlock(node.body) : "";

	return `function(${params})\n\t${body}\nend function`;
}

function handleBlock(node: ts.Block): string {
	return node.statements.map(val => handleNode(val)).join("\n\t");
}

function handleConstructor(node: ts.ConstructorDeclaration): string {
	const params = node.parameters.map(param => handleNode(param.name)).join(", ");
	const body = node.body ? handleBlock(node.body) : "";

	return `constructor = function(${params})\n\t${body}\nreturn self\nend function`;
}

function handleMethodDeclaration(node: ts.MethodDeclaration): string {
	return transpileFunctionBody(node);
}

function handleFunctionDeclaration(node: ts.FunctionDeclaration): string {
	const name = node.name ? node.name.text : "anon";
	declaredFunctions[name] = true;

	return `${name} = ${transpileFunctionBody(node)}`;
}

function handleArrowFunction(node: ts.ArrowFunction): string {
	// if (ts.isBinaryExpression(node.parent) && !Object.is(node.parent.right, node)) {
	// 	throw new Error("Inline arrow functions are not supported.");
	// }
	if (ts.isVariableDeclaration(node.parent)) {
		declaredFunctions[handleNode(node.parent.name)] = true
	}
	else if (!ts.isBinaryExpression(node.parent)){
		throw new Error("Inline arrow functions are not supported.");
	}
	
	const params = node.parameters.map(param => handleNode(param.name)).join(", ");
	const body = ts.isBlock(node.body) ? handleNode(node.body) : `return ${handleNode(node.body)}`;

	return `function(${params})\n\t${body}\nend function`;
}

function createFunctionHandlers() {
	return {
		[ts.SyntaxKind.Block]: handleBlock,
		[ts.SyntaxKind.Constructor]: handleConstructor,
		[ts.SyntaxKind.MethodDeclaration]: handleMethodDeclaration,
		[ts.SyntaxKind.FunctionDeclaration]: handleFunctionDeclaration,
		[ts.SyntaxKind.ArrowFunction]: handleArrowFunction
	};
}

export default createFunctionHandlers;
