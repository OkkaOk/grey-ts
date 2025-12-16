import ts from "typescript";
import { handleNode } from "../transpiler.js";

function handleClassDeclaration(node: ts.ClassDeclaration): string {
	const name = node.name ? node.name.text : "anon";

	const extensions = node.heritageClauses?.filter(h => h.token === ts.SyntaxKind.ExtendsKeyword);
	let output = `${name} = {}`;
	if (extensions && extensions.length && extensions[0].types.length)
		output = `${name} = new ${handleNode(extensions[0].types[0].expression)}`;

	for (const member of node.members) {
		if (ts.isMethodDeclaration(member)) {
			const methodName = handleNode(member.name!);
			output += `\n${name}.${methodName} = ${handleNode(member)}`;
		} else if (ts.isPropertyDeclaration(member)) {
			output += `\n${name}.${handleNode(member)}`;
		} else {
			output += `\n${name}.${handleNode(member)}`;
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
