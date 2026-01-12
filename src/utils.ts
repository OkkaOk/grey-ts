import fs from "node:fs";
import path from "node:path";
import ts from "typescript";
import parseCode from "./parser";
import { apiNameMap, propertyAccessReplacements } from "./replaceKeywords";
import { calledUtilFunctions, checker, program, utilFunctions } from "./transpiler";

const knownOperators = new Set([
	"=", "+", "+=", "-", "-=", "++", "--", "**",
	"&&", "==", "===", "!=", "!==", "??", "??=", "in", 
	"||", "<", "<=", ">", ">=", "*", "/", "%",
	"~", "&", "|", "^", "<<", ">>", ">>>"
]);

export function getOperatorToken(node: ts.Node) {
	let operatorToken = ts.tokenToString(node.kind);
	if (!operatorToken) return null;

	if (!knownOperators.has(operatorToken))
		throw `Can't handle operator '${operatorToken}' yet`;

	if (operatorToken == "**") operatorToken = "^";
	else if (operatorToken == "||") operatorToken = "or";
	else if (operatorToken == "&&") operatorToken = "and";
	else if (operatorToken == "===") operatorToken = "==";
	else if (operatorToken == "!==") operatorToken = "!=";

	return operatorToken;
}

export function nodeIsFunction(node: ts.Node) {
	const type = checker.getTypeAtLocation(node);

	if (type.getCallSignatures()[0]?.parameters)
		return true;

	if (type.getConstructSignatures()[0]?.parameters)
		return true;

	return false;
}

export function asRef(value: string): string {
	if (value[0] === "@") return value;
	return "@" + value;
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

	// console.log(original, symbolFullName);
	const replaceValue: string | undefined = apiNameMap[symbolFullName];
	if (!replaceValue)
		return original;

	// Without this for example this happens: "const oldUserInput = userInput" would turn into "@user_input = @user_input"
	const dotIndex = symbolFullName.lastIndexOf(".");
	const strToReplace = dotIndex !== null ? symbolFullName.slice(dotIndex + 1) : symbolFullName;
	if (strToReplace != original)
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
	calledUtilFunctions.set(functionName, true);
	return `${functionName}(${params.join(", ")})`;
}