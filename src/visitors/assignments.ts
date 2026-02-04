import ts from "typescript";
import { NodeHandler } from "../nodeHandler";
import { asRef, nodeIsFunctionReference } from "../utils";

NodeHandler.register(ts.SyntaxKind.PropertyAssignment, (node: ts.PropertyAssignment) => {
	let right = NodeHandler.handle(node.initializer);
	if (nodeIsFunctionReference(node.initializer))
		right = asRef(right);

	if (ts.isNumericLiteral(node.name) || ts.isStringLiteral(node.name) || ts.isComputedPropertyName(node.name))
		return `${NodeHandler.handle(node.name)}: ${right}`;

	return `"${NodeHandler.handle(node.name)}": ${right}`;
});

NodeHandler.register(ts.SyntaxKind.ShorthandPropertyAssignment, (node: ts.ShorthandPropertyAssignment) => {
	const name = NodeHandler.handle(node.name);
	return `"${name}": ${nodeIsFunctionReference(node.name) ? asRef(name) : name}`;
});

NodeHandler.register(ts.SyntaxKind.ComputedPropertyName, (node: ts.ComputedPropertyName) => {
	return NodeHandler.handle(node.expression);
});
