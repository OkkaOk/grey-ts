import ts from "typescript";
import { handleNode } from "../transpiler.js";

function handlePropertyAssignment(node: ts.PropertyAssignment): string {
	return `\"${handleNode(node.name)}\": ${handleNode(node.initializer)}`;
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
