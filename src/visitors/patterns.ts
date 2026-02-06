import ts from "typescript";
import { NodeHandler } from "../nodeHandler";

NodeHandler.register<ts.ArrayBindingPattern>(ts.SyntaxKind.ArrayBindingPattern, (node, ctx) => {
	if (!ts.isParameter(node.parent))
		throw `This kind of ArrayBindingPattern is not yet supported (parent: ${ts.SyntaxKind[node.parent.kind]})`;

	const index = Object.entries(ctx.bindingElements).length;
	const paramName = `arr${index || ""}`;

	for (let i = 0; i < node.elements.length; i++) {
		const element = node.elements[i]!;
		if (ts.isOmittedExpression(element)) continue;

		const name = NodeHandler.handle(element);
		if (!name || name === "null") continue;

		ctx.bindingElements[name] = `${paramName}[${i}]`;
	}

	return paramName;
});

NodeHandler.register<ts.BindingElement>(ts.SyntaxKind.BindingElement, (node) => {
	// if (node.propertyName) throw "BindingElement renaming is not yet supported";
	if (node.initializer) throw "Initializers in BindingElement are not yet supported";
	if (!ts.isIdentifier(node.name)) throw "Nested binding patterns are not supported";

	return NodeHandler.handle(node.name);
})