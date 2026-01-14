import ts from "typescript";
import { handleNode, type TranspileContext } from "../transpiler";
import { asRef, nodeIsFunctionReference } from "../utils";

function handleVariableDeclaration(
	node: ts.VariableDeclaration | ts.PropertyDeclaration,
	ctx: TranspileContext
): string {
	let right = node.initializer ? (handleNode(node.initializer, ctx) || "null") : "null";
	if (right != "null" && nodeIsFunctionReference(node.initializer!)) {
		right = asRef(right);
	}

	const left = handleNode(node.name, ctx);
	return `${left} = ${right}`;
}

function handleVariableDeclarationList(node: ts.VariableDeclarationList, ctx: TranspileContext): string {
	return node.declarations.map(decl => handleVariableDeclaration(decl, ctx)).join("\n");
}

function handleVariableStatement(node: ts.VariableStatement, ctx: TranspileContext): string {
	return handleVariableDeclarationList(node.declarationList, ctx);
}

function handlePropertyDeclaration(node: ts.PropertyDeclaration, ctx: TranspileContext): string {
	return handleVariableDeclaration(node, ctx);
}

function createVariableHandlers() {
	return {
		[ts.SyntaxKind.VariableDeclaration]: handleVariableDeclaration,
		[ts.SyntaxKind.VariableDeclarationList]: handleVariableDeclarationList,
		[ts.SyntaxKind.VariableStatement]: handleVariableStatement,
		[ts.SyntaxKind.PropertyDeclaration]: handlePropertyDeclaration,
	};
}

export default createVariableHandlers;
