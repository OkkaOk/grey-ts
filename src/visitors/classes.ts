import ts from "typescript";
import { handleNode, type TranspileContext } from "../transpiler";

function handleClassDeclaration(node: ts.ClassDeclaration, ctx: TranspileContext): string {
	const name = node.name ? node.name.text : "anon";

	const extensions = node.heritageClauses?.filter(h => h.token === ts.SyntaxKind.ExtendsKeyword);
	let output = `${name} = {}`;
	if (extensions && extensions.length && extensions[0]!.types.length)
		output = `${name} = new ${handleNode(extensions[0]!.types[0]!.expression, ctx)}`;

	for (const member of node.members) {
		if (ts.isMethodDeclaration(member)) {
			output += `\n${name}.${handleNode(member, ctx)}`;
		} else if (ts.isPropertyDeclaration(member)) {
			output += `\n${name}.${handleNode(member, ctx)}`;
		} else {
			output += `\n${name}.${handleNode(member, ctx)}`;
		}
	}

	return output;
}

function handleGetAccessor(node: ts.GetAccessorDeclaration, ctx: TranspileContext): string {
	const name = handleNode(node.name, ctx);
	const body = node.body ? handleNode(node.body, ctx) : "";
	// console.log(node.getText(), name, node.parameters)
	return `${name} = function()\n${body}\nend function`;
}

function handleSetAccessor(node: ts.GetAccessorDeclaration, ctx: TranspileContext): string {
	const body = node.body ? handleNode(node.body, ctx) : "";
	return `${handleNode(node.name, ctx)} = function(${handleNode(node.parameters[0]!, ctx)})\n${body}\nend function`;
}

function createClassHandlers() {
	return {
		[ts.SyntaxKind.ClassDeclaration]: handleClassDeclaration,
		[ts.SyntaxKind.GetAccessor]: handleGetAccessor,
		[ts.SyntaxKind.SetAccessor]: handleSetAccessor,
	};
}

export default createClassHandlers;
