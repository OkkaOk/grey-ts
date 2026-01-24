import path from "node:path";
import ts from "typescript";
import { NodeHandler } from "../nodeHandler";
import { program, transpileSourceFile, type TranspileContext } from "../transpiler";

function importFile(filePath: string, ctx: TranspileContext, returnResult?: boolean): string {
	let srcPath = path.resolve(ctx.currentFolder, filePath);
	if (!path.extname(srcPath)) srcPath += ".ts";
	
	const source = program.getSourceFile(srcPath)
	if (!source) {
		console.error(`Failed to find source ${srcPath}`);
		return ""
	}

	return transpileSourceFile(source, ctx, returnResult);
}

// importClause - In case of:
// import d from "mod" => name = d, namedBinding = undefined
// import * as ns from "mod" => name = undefined, namedBinding: NamespaceImport = { name: ns }
// import d, * as ns from "mod" => name = d, namedBinding: NamespaceImport = { name: ns }
// import { a, b as x } from "mod" => name = undefined, namedBinding: NamedImports = { elements: [{ name: a }, { name: x, propertyName: b}]}
// import d, { a, b as x } from "mod" => name = d, namedBinding: NamedImports = { elements: [{ name: a }, { name: x, propertyName: b}]}
NodeHandler.register(ts.SyntaxKind.ImportDeclaration, (node: ts.ImportDeclaration, ctx) => {
	// e.g. import "mod"
	// In normal TypeScript/JavaScript, the module would just be executed so we need to emulate that
	if (!node.importClause) {
		const moduleName = (node.moduleSpecifier as ts.StringLiteral).text;
		const transpiledFile = importFile(moduleName, ctx, true);
		if (!transpiledFile)
			return "";

		const rndName = "func_" + (Date.now() * Math.random()).toString().slice(0, 6);
		return [
			`${rndName} = function`,
			transpiledFile.split("\n").map(line => "\t" + line).join("\n"),
			"end function",
			`${rndName}()`
		].join("\n");
	}

	// Types only
	if (node.importClause.phaseModifier) return "";

	if (node.importClause.name)
		throw `Can't import default exports yet (imported as ${node.importClause.name.text})`; // TODO: implement

	const bindings = node.importClause.namedBindings;

	if (bindings) {
		// e.g. import * as lib from "module"
		if (ts.isNamespaceImport(bindings)) {
			ctx.namespaceImports[ctx.currentFilePath]?.add(bindings.name.text);
		}
		else {
			// e.g. import { func, func as test } from "module"
			bindings.elements.forEach(el => {
				if (!el.propertyName || el.isTypeOnly) return;

				ctx.namedImports[ctx.currentFilePath]![el.name.text] = el.propertyName.text;
			})
		}
	}

	const moduleSpecifier = (node.moduleSpecifier as ts.StringLiteral).text;
	return importFile(moduleSpecifier, ctx);
});