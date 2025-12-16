import ts from "typescript";
import { apiNameMap, declaredFunctions } from "../transpiler.js";

function handleIdentifier(node: ts.Identifier): string {
	let name = apiNameMap[node.text] ?? node.text;
	if (declaredFunctions[name]) name = "@" + name;
	return name;
}

function createIdentifierHandlers() {
	return {
		[ts.SyntaxKind.NumericLiteral]: (node: ts.NumericLiteral) => node.text,
		[ts.SyntaxKind.StringLiteral]: (node: ts.StringLiteral) => `"${node.text}"`,
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
