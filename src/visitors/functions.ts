import ts from "typescript";
import { handleNode } from "../transpiler";

function transpileFunctionBody(node: Pick<ts.FunctionDeclaration, "parameters" | "body">) {
	const params = node.parameters.map(param => handleNode(param.name)).join(", ");
	const body = node.body ? node.body.statements.map(val => handleNode(val)).join("\n\t") : "";

	return `function(${params})\n\t${body}\nend function`;
}

function handleConstructor(node: ts.ConstructorDeclaration): string {
	return `constructor = ${transpileFunctionBody(node)}`;
}

function handleMethodDeclaration(node: ts.MethodDeclaration): string {
	return transpileFunctionBody(node);
}

function handleFunctionDeclaration(node: ts.FunctionDeclaration): string {
	const name = node.name ? node.name.text : "anon";
	return `${name} = ${transpileFunctionBody(node)}`;
}

export function createFunctionHandlers() {
	return {
		[ts.SyntaxKind.Constructor]: handleConstructor,
		[ts.SyntaxKind.MethodDeclaration]: handleMethodDeclaration,
		[ts.SyntaxKind.FunctionDeclaration]: handleFunctionDeclaration,
	};
}

export default createFunctionHandlers;
