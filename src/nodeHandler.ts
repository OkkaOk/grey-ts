import ts from "typescript";
import type { TranspileContext } from "./transpiler";

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
			return result;
		} catch (error) {
			console.error(error);

			this.printLineAndCol(node);
			return ts.isBlock(node.parent) || ts.isSourceFile(node.parent) ? "" : "null";
		}
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