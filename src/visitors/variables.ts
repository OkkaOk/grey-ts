import ts from "typescript";
import { NodeHandler } from "../nodeHandler";
import { checker, type TranspileContext } from "../transpiler";
import { asRef, nodeIsFunctionReference } from "../utils";

function handleVariableDeclaration(
	node: ts.VariableDeclaration | ts.PropertyDeclaration,
	ctx: TranspileContext
): string {
	const left = NodeHandler.handle(node.name);
	const initializerType = node.initializer ? checker.getTypeAtLocation(node.initializer) : undefined;

	if (
		ts.isPropertyDeclaration(node) &&
		initializerType?.flags === ts.TypeFlags.Object &&
		!node.modifiers?.some(mod => mod.kind === ts.SyntaxKind.StaticKeyword) &&
		!ts.isFunctionLike(node.initializer)
	) {
		console.warn(`You shouldn't initialize '${left}' with an Array or an Object because in GreyScript, every instantiation refers to the same '${left}' variable.\nInitialize them in the constructor instead`);
	}

	let right = node.initializer ? (NodeHandler.handle(node.initializer) || "null") : "null";
	if (right != "null" && nodeIsFunctionReference(node.initializer!, initializerType)) {
		right = asRef(right);
	}

	
	return `${left} = ${right}`;
}

NodeHandler.register(ts.SyntaxKind.VariableDeclarationList, (node: ts.VariableDeclarationList, ctx) => {
	return node.declarations.map(decl => handleVariableDeclaration(decl, ctx)).join("\n");
})

NodeHandler.register(ts.SyntaxKind.VariableStatement, (node: ts.VariableStatement, ctx) => {
	if (node.modifiers?.some(modifier => modifier.kind === ts.SyntaxKind.DeclareKeyword))
		return "";

	return NodeHandler.handle(node.declarationList);
});

NodeHandler.register(ts.SyntaxKind.VariableDeclaration, handleVariableDeclaration);
NodeHandler.register(ts.SyntaxKind.PropertyDeclaration, handleVariableDeclaration);

NodeHandler.register<ts.EnumDeclaration>(ts.SyntaxKind.EnumDeclaration, (node) => {
	const members = node.members.map((member, index) => {
		const name = NodeHandler.handle(member.name);
		if (member.initializer) {
			return `${name}: ${NodeHandler.handle(member.initializer)}`;
		}

		const type = checker.getTypeAtLocation(member);
		if ("value" in type) {
			return `${name}: ${type.value}`;
		}

		return `${name}: ${index}`;
	});

	return `${node.name.text} = { ${members.join(", ")} }`;
})