import ts from "typescript";
import { NodeHandler } from "../nodeHandler";


NodeHandler.register(ts.SyntaxKind.ClassDeclaration, (node: ts.ClassDeclaration) => {
	if (node.modifiers?.some(m => m.kind === ts.SyntaxKind.DeclareKeyword))
		return "";

	const name = node.name ? node.name.text : "anon";

	const extensions = node.heritageClauses?.filter(h => h.token === ts.SyntaxKind.ExtendsKeyword);
	let output = `${name} = {}`;
	if (extensions && extensions.length && extensions[0]!.types.length)
		output = `${name} = new ${NodeHandler.handle(extensions[0]!.types[0]!.expression)}`;

	for (const member of node.members) {
		if (ts.isMethodDeclaration(member) || ts.isConstructorDeclaration(member)) {
			if (!member.body)
				continue;

			output += `\n${name}.${NodeHandler.handle(member)}`;
		} else if (ts.isPropertyDeclaration(member)) {
			output += `\n${name}.${NodeHandler.handle(member)}`;
		} else {
			output += `\n${name}.${NodeHandler.handle(member)}`;
		}
	}

	return output;
});

NodeHandler.register(ts.SyntaxKind.Constructor, (node: ts.ConstructorDeclaration) => {
	if (!node.body)
		return "";

	const params = node.parameters.map(param => NodeHandler.handle(param)).join(", ");
	const body = NodeHandler.handle(node.body);

	return `constructor = function(${params})\n${body}\n\treturn self\nend function`;
});

NodeHandler.register(ts.SyntaxKind.GetAccessor, (node: ts.GetAccessorDeclaration) => {
	if (!node.body)
		return "";

	const body = NodeHandler.handle(node.body);

	return `${NodeHandler.handle(node.name)} = function\n${body}\nend function`;
});

NodeHandler.register(ts.SyntaxKind.SetAccessor, (node: ts.SetAccessorDeclaration) => {
	if (!node.body)
		return "";

	const body = NodeHandler.handle(node.body);
	const params = node.parameters.map(param => NodeHandler.handle(param)); // Should only be 1 parameter

	return `set_${NodeHandler.handle(node.name)} = function(${params.join(", ")})\n${body}\nend function`;
});