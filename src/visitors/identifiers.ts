import ts from "typescript";
import { checker, handleNode, type TranspileContext } from "../transpiler";
import { asRef, nodeIsFunctionReference, replaceIdentifier } from "../utils";

function handleIdentifier(node: ts.Identifier, ctx: TranspileContext): string {
	const type = checker.getTypeAtLocation(node);
	if (type.flags === ts.TypeFlags.Undefined)
		return "null"; // No undefined in greyscript

	const original = node.text;
	let name = node.text;

	if (type.isUnion()) {
		for (const t of type.types) {
			name = replaceIdentifier(node.text, t)
			if (name != original) break
		}
	}
	else {
		name = replaceIdentifier(node.text, type)
	}

	if (ctx.namedImports[ctx.currentFilePath]?.[name]) {
		name = ctx.namedImports[ctx.currentFilePath]![name]!;
	}

	if (ts.isCallOrNewExpression(node.parent) && node != node.parent.expression) {
		// Is inside a call expression and is a function reference
		if (nodeIsFunctionReference(node, type))
			name = asRef(name);
	}

	return name;
}

function handleParameter(node: ts.ParameterDeclaration, ctx: TranspileContext): string {
	const name = handleNode(node.name, ctx);
	if (!node.initializer) return name;

	return `${name} = ${handleNode(node.initializer, ctx)}`;
}

function createIdentifierHandlers() {
	return {
		[ts.SyntaxKind.NumericLiteral]: (node: ts.NumericLiteral) => node.text,
		[ts.SyntaxKind.StringLiteral]: (node: ts.StringLiteral) => `"${node.text.replaceAll('"', '\"\"')}"`,
		[ts.SyntaxKind.Parameter]: handleParameter,
		[ts.SyntaxKind.Identifier]: handleIdentifier,
		[ts.SyntaxKind.SuperKeyword]: (node: ts.SuperExpression) => {
			if (ts.isPropertyAccessExpression(node.parent)) return "super";
			return "super.constructor";
		},
		[ts.SyntaxKind.ThisKeyword]: () => "self",
		[ts.SyntaxKind.NullKeyword]: () => "null",
		[ts.SyntaxKind.FalseKeyword]: () => "0",
		[ts.SyntaxKind.TrueKeyword]: () => "1",
	};
}

export default createIdentifierHandlers;
