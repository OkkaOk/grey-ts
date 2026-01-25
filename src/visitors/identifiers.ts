import ts from "typescript";
import { NodeHandler } from "../nodeHandler";
import { checker } from "../transpiler";
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

	const initializer = NodeHandler.handle(node.initializer);

	const initializerType = checker.getTypeAtLocation(node.initializer);
	if (initializerType.flags === ts.TypeFlags.Object) {
		throw `You can't initialize parameter '${name}' with an Array or an Object as that won't work in GreyScript and it would be null`;
	}

	return `${name} = ${initializer}`;
});

NodeHandler.register(ts.SyntaxKind.NumericLiteral, (node: ts.NumericLiteral) => node.text);
NodeHandler.register(ts.SyntaxKind.StringLiteral, (node: ts.StringLiteral) => `"${transformString(node.text)}"`);
NodeHandler.register(ts.SyntaxKind.NullKeyword, () => "null");
NodeHandler.register(ts.SyntaxKind.UndefinedKeyword, () => "null");
NodeHandler.register(ts.SyntaxKind.FalseKeyword, () => "0");
NodeHandler.register(ts.SyntaxKind.TrueKeyword, () => "1");
NodeHandler.register(ts.SyntaxKind.ThisKeyword, (node: ts.ThisExpression) => {
	const propDeclarationAncestor = ts.findAncestor(node.parent, (n) => ts.isPropertyDeclaration(n));

	// For example in a class we declare
	// myValue = 3;
	// myValue2 = this.myValue * 2;
	// We need to change the 'this' of myValue2's initializer to the class' name as we can't access 'self' in greyscript here
	if (propDeclarationAncestor) {
		if (!propDeclarationAncestor.parent.name)
			throw `Can't handle this 'this' keyword becuase the class doesn't have a name and it's needed for this case`;
		return propDeclarationAncestor.parent.name.text;
	}
	
	return "self";
});

NodeHandler.register(ts.SyntaxKind.SuperKeyword, (node: ts.SuperExpression) => {
	if (ts.isPropertyAccessExpression(node.parent) || ts.isElementAccessExpression(node.parent)) return "super";
	return "super.constructor";
});

NodeHandler.register(ts.SyntaxKind.RegularExpressionLiteral, (node: ts.RegularExpressionLiteral) => {
	const start = node.text.indexOf("/")! + 1;
	const end = node.text.lastIndexOf("/")!;

	const flags = node.text.slice(end + 1);
	if (flags)
		throw "Regex flags are not supported yet";

	return `"${node.text.slice(start, end)}"`;
});