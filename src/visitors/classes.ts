import ts from "typescript";
import { NodeHandler } from "../nodeHandler";
import { handleFunctionBodyAndParams } from "./functions";


NodeHandler.register(ts.SyntaxKind.ClassDeclaration, (node: ts.ClassDeclaration) => {
	if (node.modifiers?.some(m => m.kind === ts.SyntaxKind.DeclareKeyword))
		return "";

	const name = node.name ? node.name.text : "anon";

	const extensions = node.heritageClauses?.filter(h => h.token === ts.SyntaxKind.ExtendsKeyword);
	let output = `${name} = {}`;
	if (extensions?.length && extensions[0]!.types.length)
		output = `${name} = new ${NodeHandler.handle(extensions[0]!.types[0]!.expression)}`;

	const declaredNames = new Set<string>();

	let hasConstructor = false;
	for (const member of node.members) {
		if (ts.isFunctionLike(member) && ("body" in member) && !member.body)
			continue;

		if (ts.isSemicolonClassElement(member))
			continue;

		if (member.name) {
			const memberName = NodeHandler.handle(member.name);
			if (declaredNames.has(memberName))
				throw `The transpiled version of class '${name}' has a duplicate member '${memberName}'.\nModifiers such as 'static' are only for TypeScript for now and are not differentiated in the transpiled version from normal declarations for now`;
			declaredNames.add(memberName);
		}

		if (ts.isConstructorDeclaration(member))
			hasConstructor = true;

		output += `\n${name}.${NodeHandler.handle(member)}`;
	}

	if (!hasConstructor && !node.modifiers?.some(m => m.kind === ts.SyntaxKind.AbstractKeyword))
		output += `\n${name}.constructor = function\n\treturn self\nend function`;

	return output;
});

NodeHandler.register(ts.SyntaxKind.Constructor, (node: ts.ConstructorDeclaration, ctx) => {
	if (!node.body)
		return "";

	const func = handleFunctionBodyAndParams(node, ctx);

	if (ctx.parameterProperties.length) {
		const propertiesStr = ctx.parameterProperties.join("\n");
		ctx.parameterProperties.length = 0;

		const lines = func.body.split("\n");
		const superIndex = lines.findIndex(line => line.includes("super.constructor"));

		if (superIndex !== -1) {
			func.body = `${lines.slice(0, superIndex + 1).join("\n")}\n${propertiesStr}\n${lines.slice(superIndex + 1).join("\n")}`;
		}
		else {
			func.body = `${propertiesStr}\n${func.body}`;
		}
	}

	return [
		`constructor = function${func.params.length ? `(${func.params.join(", ")})` : ""}`,
		...(func.body ? [func.body] : []),
		"	return self",
		`end function`
	].join("\n");
});

NodeHandler.register(ts.SyntaxKind.GetAccessor, (node: ts.GetAccessorDeclaration, ctx) => {
	if (!node.body)
		return "";

	const func = handleFunctionBodyAndParams(node, ctx);
	return `${NodeHandler.handle(node.name)} = ${func.functionOutput}`;
});

NodeHandler.register(ts.SyntaxKind.SetAccessor, (node: ts.SetAccessorDeclaration, ctx) => {
	if (!node.body)
		return "";

	const func = handleFunctionBodyAndParams(node, ctx);
	return `set_${NodeHandler.handle(node.name)} = ${func.functionOutput}`;
});