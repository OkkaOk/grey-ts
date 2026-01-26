import ts from "typescript";
import { NodeHandler } from "../nodeHandler";
import { createAnonFunction } from "../transpiler";

function transpileFunctionBody(node: { body?: ts.Block, parameters: ts.NodeArray<ts.ParameterDeclaration>; }) {
	const params = node.parameters.map(param => NodeHandler.handle(param)).join(", ");
	const body = node.body ? NodeHandler.handle(node.body) : "";

	return `function(${params})\n${body}\nend function`;
}

NodeHandler.register(ts.SyntaxKind.Block, (node: ts.Block) => {
	const output = node.statements.map(val => {
		let statement = NodeHandler.handle(val);
		statement = statement.split("\n").map(line => "\t" + line).join("\n");

		return statement;
	}).join("\n");

	return output;
});

// Methods inside classes and objects
NodeHandler.register(ts.SyntaxKind.MethodDeclaration, (node: ts.MethodDeclaration) => {
	// if (ts.isObjectLiteralExpression(node.parent)) {

	// }
	return `${NodeHandler.handle(node.name)} = ${transpileFunctionBody(node)}`;
});

NodeHandler.register(ts.SyntaxKind.FunctionDeclaration, (node: ts.FunctionDeclaration,) => {
	// Is a function overload.
	if (!node.body)
		return "";

	if (node.modifiers?.some(m => m.kind === ts.SyntaxKind.DeclareKeyword))
		return "";

	const name = node.name ? node.name.text : "anon";
	return `${name} = ${transpileFunctionBody(node)}`;
});

NodeHandler.register(ts.SyntaxKind.ArrowFunction, (node: ts.ArrowFunction) => {
	const params = node.parameters.map(param => NodeHandler.handle(param));
	const body = ts.isBlock(node.body) ? NodeHandler.handle(node.body) : `\treturn ${NodeHandler.handle(node.body)}`;

	if (ts.isCallOrNewExpression(node.parent) || ts.isParenthesizedExpression(node.parent)) {
		return "@" + createAnonFunction(body, params).name;
	}

	if (ts.isPropertyAssignment(node.parent) || ts.isVariableDeclaration(node.parent) || ts.isBinaryExpression(node.parent) || ts.isReturnStatement(node.parent)) {
		return `function(${params.join(", ")})\n${body}\nend function`;
	}

	const kind = ts.SyntaxKind[node.parent.kind];
	throw `This kind of arrow function is not yet supported (parent: ${kind} (${node.parent.kind}))`;
});

NodeHandler.register(ts.SyntaxKind.FunctionExpression, (node: ts.FunctionExpression) => {
	return transpileFunctionBody(node);
});