import * as path from "node:path";
import ts from "typescript";
import { program, type TranspileContext } from "./transpiler";

type HandlerType<T extends ts.Node> = (node: T, ctx: TranspileContext, ...extraArgs: any[]) => string;
export class NodeHandler {
	static handlers: Map<ts.SyntaxKind, HandlerType<any>> = new Map();
	static transpileContext: TranspileContext;

	static register<T extends ts.Node>(kind: T["kind"], handler: HandlerType<T>) {
		if (this.handlers.has(kind))
			throw `${ts.SyntaxKind[kind]} (${kind}) is already registered`;

		this.handlers.set(kind, handler);
	}

	static handle(node: ts.Node): string {
		const handler = this.handlers.get(node.kind);
		if (!handler) {
			console.log(`Unsupported syntax ${ts.SyntaxKind[node.kind]} (kind ${node.kind}) was not transpiled: ${node.getText()}`);
			this.printLineAndCol(node);
			return ts.isBlock(node.parent) || ts.isSourceFile(node.parent) ? "" : "null";
		}

		// console.log(ts.SyntaxKind[node.kind], node.kind, node.getText());
		try {
			const result = handler(node, this.transpileContext);

			const extra = this.transpileContext.extraOutput.get(node);
			if (!extra) return result;

			return [
				...(extra.before ? [extra.before] : []),
				result,
				...(extra.after ? [extra.after] : []),
			].join("\n");
		} catch (error) {
			console.error(error);

			this.printLineAndCol(node);
			return ts.isBlock(node.parent) || ts.isSourceFile(node.parent) ? "" : "null";
		}
	}

	static addExtraOutput(node: ts.Node, before: string | null, after: string | null) {
		if (!this.transpileContext.extraOutput.has(node))
			this.transpileContext.extraOutput.set(node, { before: "", after: "" });

		const extra = this.transpileContext.extraOutput.get(node)!;
		if (before) extra.before += before;
		if (after) extra.after += after;
	}

	private static printLineAndCol(node: ts.Node) {
		const source = node.getSourceFile();
		const lineAndChar = source.getLineAndCharacterOfPosition(node.pos);
		console.log(`At ${source.fileName}: line ${lineAndChar.line + 1}, col ${lineAndChar.character + 1}`);
	}
}

NodeHandler.register(ts.SyntaxKind.TypeAliasDeclaration, () => "");
NodeHandler.register(ts.SyntaxKind.InterfaceDeclaration, () => "");
NodeHandler.register(ts.SyntaxKind.ModuleDeclaration, () => "");
NodeHandler.register(ts.SyntaxKind.EndOfFileToken, () => "");
NodeHandler.register(ts.SyntaxKind.EmptyStatement, () => "");

NodeHandler.register<ts.SourceFile>(ts.SyntaxKind.SourceFile, (sourceFile, ctx) => {
	if (ctx.visitedFiles.has(sourceFile.fileName))
		return "";

	ctx.visitedFiles.add(sourceFile.fileName);

	if (sourceFile.isDeclarationFile)
		return "";

	if (program.isSourceFileDefaultLibrary(sourceFile) || program.isSourceFileFromExternalLibrary(sourceFile))
		return "";

	const prevFile = ctx.currentFilePath;

	// printNodeAST(sourceFile);

	ctx.currentFilePath = sourceFile.fileName;
	ctx.currentFolder = path.dirname(sourceFile.fileName);
	ctx.namedImports[sourceFile.fileName] = {};
	ctx.namespaceImports[sourceFile.fileName] = new Set();

	sourceFile.forEachChild((node) => {
		const result = NodeHandler.handle(node);
		if (!result) return;

		ctx.output.push(result);
	});

	ctx.currentFilePath = prevFile;
	ctx.currentFolder = path.dirname(prevFile);

	return "";
});