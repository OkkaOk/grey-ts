import ts from "typescript";
import { handleNode } from "../transpiler.ts";

function handleForStatement(node: ts.ForStatement): string {
	if (!node.condition || !node.initializer || !node.incrementor) {
		console.log(node);
		return "";
	}

	return `\
${handleNode(node.initializer)}
while (${handleNode(node.condition)})
${handleNode(node.incrementor)}
${handleNode(node.statement)}
end while`;
}

function handleForOfStatement(node: ts.ForOfStatement): string {
	const varName = handleNode((node.initializer as ts.VariableDeclarationList).declarations[0].name);
	const objToLoop = handleNode(node.expression);

	return `for ${varName} in ${objToLoop}\n${handleNode(node.statement)}\nend for`;
}

function handleIfStatement(node: ts.IfStatement): string {
	let output = `if (${handleNode(node.expression)}) then\n${handleNode(node.thenStatement)}`;

	if (node.elseStatement) {
		output += `\nelse\n${handleNode(node.elseStatement)}`;
	}

	output += "\nend if";

	return output;
}

// function handleForStatement(node: ts.ForOfStatement): string {
// 	console.log(node);
// 	const body = node.statementstatements.map(val => handleNode(val)).join("\n\t") : "";

// 	return `for ${handleNode(node.initializer)} in ${node.}`;
// }

export function createStatementHandlers() {
	return {
		[ts.SyntaxKind.ForStatement]: handleForStatement,
		[ts.SyntaxKind.ForOfStatement]: handleForOfStatement,
		[ts.SyntaxKind.IfStatement]: handleIfStatement
	};
}

export default createStatementHandlers;
