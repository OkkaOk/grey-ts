import fs from "node:fs";
import path from "node:path";
import ts from "typescript";
import parseCode from "./parser";
import { apiNameMap, propertyAccessReplacements } from "./replaceKeywords";
import { checker, program, utilFunctions, utilitiesToInsert } from "./transpiler";

const knownOperators = new Set([
	"=", "+", "+=", "-", "-=", "++", "--", "**",
	"&&", "==", "===", "!=", "!==", "??", "??=", "||=", "in", 
	"||", "<", "<=", ">", ">=", "*", "/", "%",
	"~", "&", "|", "^", "<<", ">>", ">>>", "instanceof"
]);

export function getOperatorToken(node: ts.Node) {
	let operatorToken = ts.tokenToString(node.kind);
	if (!operatorToken) return null;

	if (!knownOperators.has(operatorToken))
		throw `Can't handle operator '${operatorToken}' yet`;

	if (operatorToken === "||") operatorToken = "or";
	else if (operatorToken === "&&") operatorToken = "and";
	else if (operatorToken === "===") operatorToken = "==";
	else if (operatorToken === "!==") operatorToken = "!=";

	return operatorToken;
}

export function transformString(value: string): string {
	value = value
		.replaceAll('"', '""')
		.replaceAll("\n", ` \\n`);
	return value;
}

export function nodeIsFunctionReference(node: ts.Node, type?: ts.Type) {
	// Not a reference
	if (ts.isCallOrNewExpression(node) || ts.isCallOrNewExpression(node.parent) && node === node.parent.expression)
		return false;

	// Declaring a function, not referencing
	if (ts.isFunctionLike(node))
		return false;

	type ??= checker.getTypeAtLocation(node);

	// If it doesn't have any call signatures, it's not even a function
	if (!type.getCallSignatures().length)
		return false;

	// console.log(node.getText(), ts.SyntaxKind[node.kind]);

	// if (!type.getConstructSignatures().length)
	// 	return false;

	return true;
}

export function ancestorCount(node: ts.Node, counter: (node: ts.Node) => boolean) {
	let count = 0;
	while (node.parent) {
		node = node.parent;
		if (counter(node))
			count++;
	}

	return count;
}

export function asRef(value: string): string {
	if (value[0] === "@") return value;
	return `@${value}`;
}

export function unRef(value: string): string {
	while (value[0] === "@")
		value = value.slice(1);
	return value;
}

export function getSourceFiles(absPath: string): ts.SourceFile[] {
	if (!fs.existsSync(absPath))
		throw new Error(`File ${absPath} doesn't exist`);

	const output: ts.SourceFile[] = [];

	const filePaths = [absPath];

	while (filePaths.length) {
		const file = filePaths.shift()!;
		const stat = fs.statSync(file);
		if (stat.isDirectory()) {
			filePaths.push(...fs.readdirSync(file).map(name => path.join(file, name)));
			continue;
		}

		const existing = program.getSourceFile(file);
		if (existing) {
			output.push(existing);
			continue;
		}

		const source = parseCode(file, fs.readFileSync(file, { encoding: "utf-8" }));
		output.push(source);
	}

	return output;
}

export function replaceIdentifier(original: string, type: ts.Type, propertyName?: string): string {
	let symbol: ts.Symbol | undefined;
	if (type.isUnion()) {
		if (propertyName) {
			for (const t of type.types) {
				symbol = t.getProperty(propertyName);
				if (symbol) break; 
			}
		}
		else {
			symbol = type.types.find(t => t.flags !== ts.TypeFlags.Undefined && t.symbol)?.symbol;
		}
	}
	else {
		symbol = propertyName ? type.getProperty(propertyName) : type.symbol;
	}

	if (!symbol) return original;

	const symbolFullName = checker.getFullyQualifiedName(symbol);

	const replaceValue: string | undefined = apiNameMap[symbolFullName];
	// console.log(original, symbolFullName, replaceValue);
	if (!replaceValue)
		return original;

	// Without this for example this happens: "const oldUserInput = userInput" would turn into "@user_input = @user_input"
	const dotIndex = symbolFullName.lastIndexOf(".");
	const strToReplace = dotIndex !== null ? symbolFullName.slice(dotIndex + 1) : symbolFullName;
	if (strToReplace !== original)
		return original;

	return replaceValue;
}

export function replacePropertyAccess(original: string, symbol?: ts.Symbol) {
	if (!symbol) return original;

	const symbolFullName = checker.getFullyQualifiedName(symbol);

	const replaceValue: string | undefined = propertyAccessReplacements[symbolFullName];
	// console.log(original, symbolFullName, replaceValue);
	if (!replaceValue || original !== symbolFullName)
		return original;

	return replaceValue;
}

export function findProjectRoot(dir: string, fileToSearch = "package.json"): string {
	while (!fs.existsSync(path.join(dir, fileToSearch))) {
		const parent = path.dirname(dir);
		if (parent === dir) throw new Error(`No ${fileToSearch} found`);
		dir = parent;
	}
	return dir;
}

export function callUtilFunction(functionName: keyof typeof utilFunctions, ...params: string[]) {
	utilitiesToInsert.set(functionName, utilFunctions[functionName]);
	return `${functionName}(${params.join(", ")})`;
}

export function printNodeAST(node: ts.Node, output: string[] = [], depth = 0, isRoot = true) {
	const name = ts.isDeclarationStatement(node) || ts.isExpression(node) ? ts.getNameOfDeclaration(node)?.getText() ?? "" : "";
	output.push(`${"| ".repeat(depth)}${ts.SyntaxKind[node.kind]} (${node.kind}) ${name}`);
	node.forEachChild(child => printNodeAST(child, output, depth + 1, false));

	if (isRoot) console.log(output.join("\n"));
}

export const assignmentOperators = new Set<string>([
	"=", "??=", "||=", "-=", "+="
]);

export function valueIsBeingAssignedToNode(node: ts.Node): boolean {
	if (ts.hasOnlyExpressionInitializer(node.parent) && node === node.parent.name)
		return true;

	const assignAncestor = ts.findAncestor(node, ancestor => {
		if (ancestor.parent && ts.isBinaryExpression(ancestor.parent) && ancestor === ancestor.parent.left) {
			const token = ts.tokenToString(ancestor.parent.operatorToken.kind) || ancestor.parent.operatorToken.getText();
			return assignmentOperators.has(token);
		}

		return false;
	});

	return !!assignAncestor;
}