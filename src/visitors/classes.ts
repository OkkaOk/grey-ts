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
			const methodName = handleNode(member.name!, ctx);
			// console.log(member)
			output += `\n${name}.${methodName} = ${handleNode(member, ctx)}`;
		} else if (ts.isPropertyDeclaration(member)) {
			output += `\n${name}.${handleNode(member, ctx)}`;
		} else {
			output += `\n${name}.${handleNode(member, ctx)}`;
		}
	}

	return output;
}

function createClassHandlers() {
	return {
		[ts.SyntaxKind.ClassDeclaration]: handleClassDeclaration,
	};
}

export default createClassHandlers;
