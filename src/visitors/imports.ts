import ts from "typescript";
import { transpile } from "../transpiler";

function handleImportDeclaration(node: ts.ImportDeclaration): string {
	const moduleSpecifier = (node.moduleSpecifier as ts.StringLiteral).text;
	return transpile(moduleSpecifier)
}

export function createImportHandlers() {
	return {
		[ts.SyntaxKind.ImportDeclaration]: handleImportDeclaration
	};
}

export default createImportHandlers;
