import ts from "typescript";
import { checker, handleNode, type TranspileContext } from "../transpiler";

function handleVariableDeclaration(
	node: { name: ts.BindingName | ts.PropertyName, initializer?: ts.Expression; },
	ctx: TranspileContext
): string {
	let right = node.initializer ? (handleNode(node.initializer, ctx) || "null") : "null";

	if (right != "null") {
		const rightType = checker.getTypeAtLocation(node.initializer!);
		const callSignatures = rightType.getCallSignatures();

		if (callSignatures.length && callSignatures[0].parameters)
			right = "@" + right;
	}

	let left = handleNode(node.name, ctx);
	const leftType = checker.getTypeAtLocation(node.initializer!);
	const callSignatures = leftType.getCallSignatures();

	if (callSignatures.length && callSignatures[0].parameters)
		left = "@" + left;

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
