import ts from "typescript";
import { handleNode, type TranspileContext } from "../transpiler";

function handleForStatement(node: ts.ForStatement, ctx: TranspileContext): string {
	if (!node.condition || !node.initializer || !node.incrementor) {
		throw "Can't transpile this type of for loop.";
	}

	const initializer = handleNode(node.initializer, ctx);
	const condition = handleNode(node.condition, ctx);
	const incrementor = handleNode(node.incrementor, ctx);
	const statement = handleNode(node.statement, ctx);

	function hasContinue(n: ts.Node): boolean {
		if (n.getChildren().some(child => {
			if (ts.isContinueStatement(child))
				return true;

			return hasContinue(child);
		})) {
			return true;
		}
		return false;
	}

	if (!hasContinue(node)) {
		return [
			`${initializer}`,
			`while (${condition})`,
			`	${statement.trimStart()}`,
			`	${incrementor}`,
			`end while`
		].join("\n");
	}

	const incrementedStateVarName = "state_" + (Date.now() * Math.random()).toFixed(0).slice(0, 6);

	const output = [
		`${incrementedStateVarName} = 1`,
		`${initializer}`,
		`while (${condition})`,
		`	if (not ${incrementedStateVarName}) then`,
		`		${incrementor}`,
		`		if (not ${condition}) then break`,
		`	end if`,
		`	${incrementedStateVarName} = 0`,
		`	${statement.trimStart()}`,
		`	${incrementor}`,
		`	${incrementedStateVarName} = 1`,
		`end while`,
	].join("\n");
	
	return output;
}

function handleForOfStatement(node: ts.ForOfStatement, ctx: TranspileContext): string {
	const varName = handleNode((node.initializer as ts.VariableDeclarationList).declarations[0]!.name, ctx);
	const objToLoop = handleNode(node.expression, ctx);

	return `for ${varName} in ${objToLoop}\n${handleNode(node.statement, ctx)}\nend for`;
}

function handleForInStatement(node: ts.ForInStatement, ctx: TranspileContext): string {
	const varName = handleNode((node.initializer as ts.VariableDeclarationList).declarations[0]!.name, ctx);
	const objToLoop = handleNode(node.expression, ctx);

	return `for ${varName} in ${objToLoop}.indexes()\n${handleNode(node.statement, ctx)}\nend for`;
}

function handleIfStatement(node: ts.IfStatement, ctx: TranspileContext): string {
	const condition = handleNode(node.expression, ctx);
	const thenStatement = handleNode(node.thenStatement, ctx);

	if (!ts.isBlock(node.thenStatement) && !ts.isIfStatement(node.thenStatement) && !node.elseStatement && !ts.isIfStatement(node.parent))
		return `if (${condition}) then ${thenStatement}`;

	let output = `if (${condition}) then\n${thenStatement}`;

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

function handleDoStatement(node: ts.DoStatement, ctx: TranspileContext): string {
	const expression = handleNode(node.expression, ctx);

	return `did_once = 0\nwhile not did_once or ${expression}\ndid_once = 1\n${handleNode(node.statement, ctx)}\nend while`;
}

function createStatementHandlers() {
	return {
		[ts.SyntaxKind.ForStatement]: handleForStatement,
		[ts.SyntaxKind.ForOfStatement]: handleForOfStatement,
		[ts.SyntaxKind.ForInStatement]: handleForInStatement,
		[ts.SyntaxKind.IfStatement]: handleIfStatement,
		[ts.SyntaxKind.ContinueStatement]: (_node: ts.ContinueStatement) => "continue",
		[ts.SyntaxKind.BreakStatement]: (_node: ts.BreakStatement) => "break",
		[ts.SyntaxKind.WhileStatement]: handleWhileStatement,
		[ts.SyntaxKind.DoStatement]: handleDoStatement,
		// TODO: switch statement, maybe trycatch and throw somehow
	};
}

export default createStatementHandlers;
