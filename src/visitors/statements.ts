import ts from "typescript";
import { handleNode, type TranspileContext } from "../transpiler";

function handleForStatement(node: ts.ForStatement, ctx: TranspileContext): string {
	if (!node.condition || !node.initializer || !node.incrementor) {
		throw new Error("Can't transpile this type of for loop.");
	}
	// TODO: Ugh
	return `\
${handleNode(node.initializer, ctx).split("\n").map(v => v + " - 1").join("\n")}
while (${handleNode(node.condition, ctx)} - 1)
${handleNode(node.incrementor, ctx)}
${handleNode(node.statement, ctx)}
end while`;
}

function handleForOfStatement(node: ts.ForOfStatement, ctx: TranspileContext): string {
	const varName = handleNode((node.initializer as ts.VariableDeclarationList).declarations[0]!.name, ctx);
	const objToLoop = handleNode(node.expression, ctx);

	return `for ${varName} in ${objToLoop}\n${handleNode(node.statement, ctx)}\nend for`;
}

function handleIfStatement(node: ts.IfStatement, ctx: TranspileContext): string {
	let output = `if (${handleNode(node.expression, ctx)}) then\n${handleNode(node.thenStatement, ctx)}`;
	// TODO: one liner

	if (node.elseStatement) {
		if (ts.isIfStatement(node.elseStatement)) {
			output += `\nelse ${handleIfStatement(node.elseStatement, ctx)}`;
			return output;
		}
		else {
			output += `\nelse\n${handleNode(node.elseStatement, ctx)}`;
		}
	}

	output += "\nend if";

	return output;
}

function handleWhileStatement(node: ts.WhileStatement, ctx: TranspileContext): string {
	const expression = handleNode(node.expression, ctx);

	return `while ${expression}\n${handleNode(node.statement, ctx)}\nend while`;
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
