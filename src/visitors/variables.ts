import ts from "typescript";
import { handleNode } from "../transpiler";

function transpileVariableDeclaration(node: ts.VariableDeclaration): string {
	const name = handleNode(node.name);
	const init = node.initializer ? handleNode(node.initializer) : "null";
	return `${name} = ${init}`;
}

function handleVariableStatement(node: ts.VariableStatement): string {
	return node.declarationList.declarations.map(decl => transpileVariableDeclaration(decl)).join("\n");
}

function handlePropertyDeclaration(node: ts.PropertyDeclaration): string {
	const name = handleNode(node.name);
	const init = node.initializer ? handleNode(node.initializer) : "null";
	return `${name} = ${init}`;
}

export function createVariableHandlers() {
	return {
		[ts.SyntaxKind.VariableStatement]: handleVariableStatement,
		[ts.SyntaxKind.PropertyDeclaration]: handlePropertyDeclaration,
	};
}

export default createVariableHandlers;
