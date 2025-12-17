import ts from "typescript";
import { checker, handleNode, type TranspileContext } from "../transpiler";

function handlePropertyAssignment(node: ts.PropertyAssignment, ctx: TranspileContext): string {
	const rightType = checker.getTypeAtLocation(node.initializer);
	const callSignatures = rightType.getCallSignatures();

	let right = handleNode(node.initializer, ctx);
	if (callSignatures.length && callSignatures[0].parameters) 
		right = "@" + right
	
	if (ts.isNumericLiteral(node.name) || ts.isStringLiteral(node.name))
		return `${handleNode(node.name, ctx)}: ${right}`;

	return `\"${handleNode(node.name, ctx)}\": ${right}`;
}

// function handleSpreadElement(node: ts.SpreadElement): string {
// 	return handleNode(node.expression);
// }

// function handleSpreadAssignment(node: ts.SpreadAssignment): string {
// 	// console.log(node);
// 	return handleNode(node.expression);
// }

function createAssignmentHandlers() {
	return {
		[ts.SyntaxKind.PropertyAssignment]: handlePropertyAssignment,
		// [ts.SyntaxKind.SpreadElement]: handleSpreadElement,
		// [ts.SyntaxKind.SpreadAssignment]: handleSpreadAssignment,
	};
}

export default createAssignmentHandlers;
