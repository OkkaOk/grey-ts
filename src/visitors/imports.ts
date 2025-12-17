import ts from "typescript";
import { type TranspileContext } from "../transpiler";

function handleImportDeclaration(node: ts.ImportDeclaration, ctx: TranspileContext): string {
	// console.log(node);
	// console.log(node.importClause?.namedBindings);

	const namedImport = node.importClause?.namedBindings;
	if (namedImport && ts.isNamespaceImport(namedImport)) {
		ctx.namedImports[namedImport.name.text] = true;
	}

	// Types only
	if (node.importClause?.phaseModifier) return "";

	// const namedImports = node.importClause?.namedBindings;
	// if (namedImports && ts.isNamedImports(namedImports))
	// 	console.log(namedImports.elements);

	// const moduleSpecifier = (node.moduleSpecifier as ts.StringLiteral).text;
	// return transpileModule(moduleSpecifier, ctx);
	return "";
}

function createImportHandlers() {
	return {
		[ts.SyntaxKind.ImportDeclaration]: handleImportDeclaration
	};
}

export default createImportHandlers;
