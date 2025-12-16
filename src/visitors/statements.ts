import ts from "typescript";
import { handleNode } from "../transpiler.js";

function handleForStatement(node: ts.ForStatement): string {
	if (!node.condition || !node.initializer || !node.incrementor) {
		throw new Error("Can't transpile this type of for loop.");
	}

	return `\
${handleNode(node.initializer).split("\n").map(v => v + " - 1").join("\n")}
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
	// TODO: one liner

	if (node.elseStatement) {
		output += `\nelse\n${handleNode(node.elseStatement)}`;
	}

	output += "\nend if";

	return output;
}

function handleWhileStatement(node: ts.WhileStatement): string {
	const expression = handleNode(node.expression);

	return `while ${expression}\n${handleNode(node.statement)}\nend while`;
}

function createStatementHandlers() {
	return {
		[ts.SyntaxKind.ForStatement]: handleForStatement,
		[ts.SyntaxKind.ForOfStatement]: handleForOfStatement,
		[ts.SyntaxKind.IfStatement]: handleIfStatement,
		[ts.SyntaxKind.ContinueStatement]: (_node: ts.ContinueStatement) => "continue",
		[ts.SyntaxKind.BreakStatement]: (_node: ts.BreakStatement) => "break",
		[ts.SyntaxKind.WhileStatement]: handleWhileStatement,
	};
}

export default createStatementHandlers;
