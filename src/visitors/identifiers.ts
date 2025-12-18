import ts from "typescript";
import { apiNameMap } from "../replaceKeywords";
import { checker, type TranspileContext } from "../transpiler";
import { asRef, nodeIsFunction } from "../utils";

function handleIdentifier(node: ts.Identifier, ctx: TranspileContext): string {
	const type = checker.getTypeAtLocation(node);
	// const typeStr = checker.typeToString(type);
	const symbol = type.getSymbol();
	const symbolFullName = symbol ? checker.getFullyQualifiedName(symbol) : "";
	// console.log(ts.SyntaxKind[node.kind], node.text, symbolFullName);

	let name = apiNameMap[symbolFullName] ?? node.text;

	// Alternatively could check if the parent is a CallExpression or NewExpression
	if (ctx.inFunctionCall && nodeIsFunction(node)) name = asRef(name);

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
