import ts from "typescript";
import { handleNode, type TranspileContext } from "../transpiler";
import { asRef, nodeIsFunctionReference } from "../utils";

function handlePropertyAssignment(node: ts.PropertyAssignment, ctx: TranspileContext): string {
	let right = handleNode(node.initializer, ctx);
	if (nodeIsFunctionReference(node.initializer))
		right = asRef(right);

	if (ts.isNumericLiteral(node.name) || ts.isStringLiteral(node.name) || ts.isComputedPropertyName(node.name))
		return `${handleNode(node.name, ctx)}: ${right}`;

	return `\"${handleNode(node.name, ctx)}\": ${right}`;
}

function handleShorthandPropertyAssignment(node: ts.ShorthandPropertyAssignment, ctx: TranspileContext): string {
	const name = handleNode(node.name, ctx);
	return `\"${name}\": ${nodeIsFunctionReference(node.name) ? asRef(name) : name}`;
}

function handleComputedPropertyName(node: ts.ComputedPropertyName, ctx: TranspileContext): string {
	return handleNode(node.expression, ctx);
}

function createAssignmentHandlers() {
	return {
		[ts.SyntaxKind.PropertyAssignment]: handlePropertyAssignment,
		[ts.SyntaxKind.ShorthandPropertyAssignment]: handleShorthandPropertyAssignment,
		[ts.SyntaxKind.ComputedPropertyName]: handleComputedPropertyName,
	};
}

export default createAssignmentHandlers;
