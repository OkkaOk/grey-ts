import ts from "typescript";
import { NodeHandler } from "../nodeHandler";
import { createAnonFunction, type TranspileContext } from "../transpiler";

interface PartialFunctionNode {
	parent: ts.Node;
	body?: ts.Block | ts.ConciseBody;
	parameters: ts.NodeArray<ts.ParameterDeclaration>;
}

export function handleFunctionBodyAndParams(
	node: PartialFunctionNode,
	ctx: TranspileContext,
): { params: string[], body: string, functionOutput: string; } {
	const oldBindingElements = Object.keys(ctx.bindingElements);
	const params = node.parameters.map(param => NodeHandler.handle(param));
	const newBindingElements = Object.keys(ctx.bindingElements).filter(b => !oldBindingElements.includes(b));

	const body = !node.body
		? ""
		: ts.isBlock(node.body)
			? NodeHandler.handle(node.body)
			: `\treturn ${NodeHandler.handle(node.body)}`;

	// Remove the binding elements that we gained for this function
	for (const bindingElement of newBindingElements) {
		delete ctx.bindingElements[bindingElement];
	}

	const functionOutput = [
		`function${params.length ? `(${params.join(", ")})` : ""}`,
		...(body ? [body] : []),
		`end function`
	].join("\n");

	return {
		body,
		params,
		functionOutput
	};
}

NodeHandler.register(ts.SyntaxKind.Block, (node: ts.Block) => {
	const output = node.statements.map(val => {
		let statement = NodeHandler.handle(val);
		statement = statement.split("\n").filter(s => !!s).map(line => `\t${line}`).join("\n");

		return statement;
	}).filter(s => !!s).join("\n");

	return output;
});

// Methods inside classes and objects
NodeHandler.register(ts.SyntaxKind.MethodDeclaration, (node: ts.MethodDeclaration, ctx) => {
	const func = handleFunctionBodyAndParams(node, ctx);
	return `${NodeHandler.handle(node.name)} = ${func.functionOutput}`;
});

NodeHandler.register(ts.SyntaxKind.FunctionDeclaration, (node: ts.FunctionDeclaration, ctx) => {
	// Is a function overload.
	if (!node.body)
		return "";

	if (node.modifiers?.some(m => m.kind === ts.SyntaxKind.DeclareKeyword))
		return "";

	const func = handleFunctionBodyAndParams(node, ctx);
	const name = node.name ? node.name.text : "anon";
	return `${name} = ${func.functionOutput}`;
});

NodeHandler.register(ts.SyntaxKind.ArrowFunction, (node: ts.ArrowFunction, ctx) => {
	const func = handleFunctionBodyAndParams(node, ctx);

	if (ts.isCallOrNewExpression(node.parent) || ts.isParenthesizedExpression(node.parent)) {
		const mainNode = ts.findAncestor(node.parent, n => n.parent && (ts.isBlock(n.parent) || ts.isSourceFile(n.parent)));

		// Shouldn't ever happen because in the case where there wasn't a block ancestor, it should be sourceFile then.
		// But if for some reason it does happen, the function gets put at the top of the output file
		if (!mainNode) {
			return `@${createAnonFunction(func.body, func.params).name}`;
		}

		const anon = createAnonFunction(func.body, func.params, false);
		NodeHandler.addExtraOutput(mainNode, anon.str, null);

		return `@${anon.name}`;
	}

	if (ts.hasOnlyExpressionInitializer(node.parent) || ts.isBinaryExpression(node.parent) || ts.isReturnStatement(node.parent)) {
		return func.functionOutput;
	}

	const kind = ts.SyntaxKind[node.parent.kind];
	throw `This kind of arrow function is not yet supported (parent: ${kind} (${node.parent.kind}))`;
});

NodeHandler.register(ts.SyntaxKind.FunctionExpression, (node: ts.FunctionExpression, ctx) => {
	return handleFunctionBodyAndParams(node, ctx).functionOutput;
});