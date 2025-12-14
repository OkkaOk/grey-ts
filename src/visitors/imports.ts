import ts from "typescript";
import { transpileModule } from "../transpiler.ts";

function handleImportDeclaration(node: ts.ImportDeclaration): string {
	// console.log(node.importClause);

	// Types only
	if (node.importClause?.phaseModifier) return ""

	// const namedImports = node.importClause?.namedBindings;
	// if (namedImports && ts.isNamedImports(namedImports))
	// 	console.log(namedImports.elements);

	const moduleSpecifier = (node.moduleSpecifier as ts.StringLiteral).text;
	return transpileModule(moduleSpecifier);
}

export function createImportHandlers() {
	return {
		[ts.SyntaxKind.ImportDeclaration]: handleImportDeclaration
	};
}

export default createImportHandlers;
