import ts from "typescript";
import { NodeHandler } from "../nodeHandler";


NodeHandler.register(ts.SyntaxKind.ForStatement, (node: ts.ForStatement) => {
	if (!node.condition || !node.initializer || !node.incrementor) {
		throw "Can't transpile this type of for loop.";
	}

	const initializer = NodeHandler.handle(node.initializer);
	const condition = NodeHandler.handle(node.condition);
	const incrementor = NodeHandler.handle(node.incrementor);
	const statement = NodeHandler.handle(node.statement);

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
			`while ${condition}`,
			`	${statement.trimStart()}`,
			`	${incrementor}`,
			`end while`
		].join("\n");
	}

	const incrementedStateVarName = "state_" + (Date.now() * Math.random()).toFixed(0).slice(0, 6);

	const output = [
		`${incrementedStateVarName} = 1`,
		`${initializer}`,
		`while ${condition}`,
		`	if not ${incrementedStateVarName} then`,
		`		${incrementor}`,
		`		if not ${condition} then break`,
		`	end if`,
		`	${incrementedStateVarName} = 0`,
		`	${statement.trimStart()}`,
		`	${incrementor}`,
		`	${incrementedStateVarName} = 1`,
		`end while`,
	].join("\n");

	return output;
});

NodeHandler.register(ts.SyntaxKind.ForOfStatement, (node: ts.ForOfStatement) => {
	if (!ts.isVariableDeclarationList(node.initializer)) {
		throw `Can't handle this 'for of' statement as '${NodeHandler.handle(node.initializer)}' is not initialized there`
	}

	if (node.initializer.declarations.length > 1) {
		throw "Can't have more than 1 variable declarations in a 'for of' statement"
	}

	const varName = NodeHandler.handle(node.initializer.declarations[0]!.name);
	const objToLoop = NodeHandler.handle(node.expression);

	return `for ${varName} in ${objToLoop}\n${NodeHandler.handle(node.statement)}\nend for`;
});

NodeHandler.register(ts.SyntaxKind.ForInStatement, (node: ts.ForInStatement) => {
	if (!ts.isVariableDeclarationList(node.initializer)) {
		throw `Can't handle this 'for in' statement as '${NodeHandler.handle(node.initializer)}' is not initialized there`;
	}

	if (node.initializer.declarations.length > 1) {
		throw "Can't have more than 1 variable declarations in a 'for in' statement"
	}

	const varName = NodeHandler.handle(node.initializer.declarations[0]!.name);
	const objToLoop = NodeHandler.handle(node.expression);

	return `for ${varName} in ${objToLoop}.indexes\n${NodeHandler.handle(node.statement)}\nend for`;
});

NodeHandler.register(ts.SyntaxKind.IfStatement, (node: ts.IfStatement) => {
	const condition = NodeHandler.handle(node.expression);
	const thenStatement = NodeHandler.handle(node.thenStatement);

	if (!ts.isBlock(node.thenStatement) && !ts.isIfStatement(node.thenStatement) && !ts.isIfStatement(node.parent)) {
		if (!node.elseStatement)
			return `if ${condition} then ${thenStatement}`;
		else if (!ts.isBlock(node.elseStatement) && !ts.isIfStatement(node.elseStatement))
			return `if ${condition} then ${thenStatement} else ${NodeHandler.handle(node.elseStatement)}`;
	}

	let output = `if ${condition} then\n\t${thenStatement.trimStart()}`;

	if (node.elseStatement) {
		if (ts.isIfStatement(node.elseStatement)) {
			output += `\nelse ${NodeHandler.handle(node.elseStatement)}`;
			return output;
		}
		else {
			output += `\nelse\n\t${NodeHandler.handle(node.elseStatement).trimStart()}`;
		}
	}

	output += "\nend if";

	return output;
});

NodeHandler.register(ts.SyntaxKind.WhileStatement, (node: ts.WhileStatement, ctx) => {
	const expression = NodeHandler.handle(node.expression);

	return [
		`while ${expression}`,
		`	${NodeHandler.handle(node.statement).trimStart()}`,
		`end while`
	].join("\n");
});

NodeHandler.register(ts.SyntaxKind.DoStatement, (node: ts.DoStatement, ctx) => {
	const expression = NodeHandler.handle(node.expression);

	return [
		`did_once = 0`,
		`while not did_once or ${expression}`,
		`	did_once = 1`,
		`	${NodeHandler.handle(node.statement).trimStart()}`,
		`end while`
	].join("\n");
});

NodeHandler.register(ts.SyntaxKind.ContinueStatement, (node: ts.ContinueStatement) => {
	return "continue";
});

NodeHandler.register(ts.SyntaxKind.BreakStatement, (node: ts.BreakStatement) => {
	return "break";
});

NodeHandler.register(ts.SyntaxKind.ReturnStatement, (node: ts.ReturnStatement) => {
	if (!node.expression) {
		// We're inside a constructor, but not inside an inner function
		if (ts.findAncestor(node, (n) => ts.isConstructorDeclaration(n)) &&
			!ts.findAncestor(node, n => ts.isFunctionLike(n))
		) {
			return "return self";
		}

		return "return";
	}

	return `return ${NodeHandler.handle(node.expression)}`;
});

// TODO: switch statement, maybe trycatch and throw somehow