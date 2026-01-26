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

	let hasConstructor = false;
	for (const member of node.members) {
		if (ts.isFunctionLike(member) && ("body" in member) && !member.body)
			continue;

		if (ts.isConstructorDeclaration(member))
			hasConstructor = true;

		output += `\n${name}.${NodeHandler.handle(member)}`;
	}

	if (!hasConstructor && !node.modifiers?.some(m => m.kind === ts.SyntaxKind.AbstractKeyword))
		output += `\n${name}.constructor = function\n\treturn self\nend function`;

	return output;
});

NodeHandler.register(ts.SyntaxKind.Constructor, (node: ts.ConstructorDeclaration) => {
	if (!node.body)
		return "";

	const declaredProperties: string[] = [];

	const params = node.parameters.map(param => {
		const res = NodeHandler.handle(param);

		if (param.modifiers) {
			const paramName = NodeHandler.handle(param.name);
			const declaration = `\tself.${paramName} = ${paramName}`;
			declaredProperties.push(declaration);
		}

		return res;
	}).join(", ");

	let body = NodeHandler.handle(node.body);
	if (declaredProperties.length) {
		const propertiesStr = declaredProperties.join("\n");

		const lines = body.split("\n");
		const superIndex = lines.findIndex(line => line.includes("super.constructor"));

		if (superIndex !== -1) {
			body = `${lines.slice(0, superIndex + 1).join("\n")}\n${propertiesStr}\n${lines.slice(superIndex + 1).join("\n")}`;
		}
		else {
			body = `${propertiesStr}\n${body}`;
		}
	}

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