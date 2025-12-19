import path from "node:path";
import ts from "typescript";
import { transpileSourceFile, type TranspileContext } from "../transpiler";

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

	const moduleSpecifier = (node.moduleSpecifier as ts.StringLiteral).text;
	let srcPath = path.resolve(ctx.currentFolder, moduleSpecifier);
	if (!path.extname(srcPath)) srcPath += ".ts";
	
	const source = ctx.sources.find(s => s.fileName === srcPath);
	if (!source) {
		console.error(`Failed to find source ${srcPath}`);
		return ""
	}

	return transpileSourceFile(source, ctx);
}

function createImportHandlers() {
	return {
		[ts.SyntaxKind.ImportDeclaration]: handleImportDeclaration
	};
}

export default createImportHandlers;
