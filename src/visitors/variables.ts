import ts from "typescript";
import { handleNode } from "../transpiler.ts";

function handleVariableDeclaration(node: ts.VariableDeclaration): string {
	const name = handleNode(node.name);
	const init = node.initializer ? handleNode(node.initializer) : "null";
	return `${name} = ${init || "null"}`;
}

function handleVariableDeclarationList(node: ts.VariableDeclarationList): string {
	return node.declarations.map(decl => handleVariableDeclaration(decl)).join("\n");
}

function handleVariableStatement(node: ts.VariableStatement): string {
	return handleVariableDeclarationList(node.declarationList);
}

function handlePropertyDeclaration(node: ts.PropertyDeclaration): string {
	const name = handleNode(node.name);
	const init = node.initializer ? handleNode(node.initializer) : "null";
	return `${name} = ${init}`;
}

export function createVariableHandlers() {
	return {
		[ts.SyntaxKind.VariableDeclaration]: handleVariableDeclaration,
		[ts.SyntaxKind.VariableDeclarationList]: handleVariableDeclarationList,
		[ts.SyntaxKind.VariableStatement]: handleVariableStatement,
		[ts.SyntaxKind.PropertyDeclaration]: handlePropertyDeclaration,
	};
}

export default createVariableHandlers;
