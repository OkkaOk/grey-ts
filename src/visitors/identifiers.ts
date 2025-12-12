import ts from "typescript";

export function createIdentifierHandlers() {
	return {
		[ts.SyntaxKind.NumericLiteral]: (node: ts.NumericLiteral) => node.text,
		[ts.SyntaxKind.StringLiteral]: (node: ts.StringLiteral) => `"${node.text}"`,
		[ts.SyntaxKind.Identifier]: (node: ts.Identifier) => node.text,
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
