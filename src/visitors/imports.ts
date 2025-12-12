import ts from "typescript";
import { transpileModule } from "../transpiler.ts";

function handleImportDeclaration(node: ts.ImportDeclaration): string {
	const moduleSpecifier = (node.moduleSpecifier as ts.StringLiteral).text;
	return transpileModule(moduleSpecifier);
}

export function createImportHandlers() {
	return {
		[ts.SyntaxKind.ImportDeclaration]: handleImportDeclaration
	};
}

export default createImportHandlers;
