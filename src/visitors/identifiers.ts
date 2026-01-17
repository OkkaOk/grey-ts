import ts from "typescript";
import { checker, NodeHandler } from "../transpiler";
import { asRef, nodeIsFunctionReference, replaceIdentifier, transformString } from "../utils";

NodeHandler.register(ts.SyntaxKind.Identifier, (node: ts.Identifier, ctx) => {
	const type = checker.getTypeAtLocation(node);

	let name = node.text;

	if (name === "undefined")
		return "null"; // No undefined in greyscript

	if (type.isUnion()) {
		const original = node.text;
		for (const t of type.types) {
			name = replaceIdentifier(node.text, t);
			if (name != original) break;
		}
	}
	else {
		name = replaceIdentifier(node.text, type);
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
});

NodeHandler.register(ts.SyntaxKind.Parameter, (node: ts.ParameterDeclaration) => {
	const name = NodeHandler.handle(node.name);
	if (!node.initializer) return name;

	return `${name} = ${NodeHandler.handle(node.initializer)}`;
});

NodeHandler.register(ts.SyntaxKind.NumericLiteral, (node: ts.NumericLiteral) => node.text);
NodeHandler.register(ts.SyntaxKind.StringLiteral, (node: ts.StringLiteral) => `"${transformString(node.text)}"`);
NodeHandler.register(ts.SyntaxKind.ThisKeyword, () => "self");
NodeHandler.register(ts.SyntaxKind.NullKeyword, () => "null");
NodeHandler.register(ts.SyntaxKind.UndefinedKeyword, () => "null");
NodeHandler.register(ts.SyntaxKind.FalseKeyword, () => "0");
NodeHandler.register(ts.SyntaxKind.TrueKeyword, () => "1");

NodeHandler.register(ts.SyntaxKind.SuperKeyword, (node: ts.SuperExpression) => {
	if (ts.isPropertyAccessExpression(node.parent)) return "super";
	return "super.constructor";
});

NodeHandler.register(ts.SyntaxKind.RegularExpressionLiteral, (node: ts.RegularExpressionLiteral) => {
	const start = node.text.indexOf("/")! + 1;
	const end = node.text.lastIndexOf("/")!;
	return `"${node.text.slice(start, end)}"`;
});