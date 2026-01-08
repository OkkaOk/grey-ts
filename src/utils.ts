import fs from "node:fs";
import path from "node:path";
import ts from "typescript";
import parseCode from "./parser";
import { apiNameMap } from "./replaceKeywords";
import { calledUtilFunctions, checker, program, utilFunctions } from "./transpiler";

const knownOperators = [
	"=", "+", "+=", "-", "-=", "++", "--", "**",
	"&&", "==", "===", "!=", "!==", "??", "??=", "in", 
	"||", "<", "<=", ">", ">=", "*", "/", "%",
	"~", "&", "|", "^", "<<", ">>", ">>>"
];

const knownOperatorsMap = new Map(knownOperators.map(op => [op, true] as const));

export function getOperatorToken(node: ts.Node) {
	let operatorToken = ts.tokenToString(node.kind);
	if (!operatorToken) return null;

	if (!knownOperatorsMap.has(operatorToken))
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
			filePaths.push(...fs.readdirSync(absPath).map(name => path.join(absPath, name)));
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

export function replaceIdentifier(defaultValue: string, symbol?: ts.Symbol): string {
	if (!symbol) return defaultValue;

	const symbolFullName = checker.getFullyQualifiedName(symbol);

	// console.log(defaultValue, symbolFullName, symbolFullName === "length" ? symbol : undefined);
	const match: [string, string] | undefined = apiNameMap[symbolFullName];
	if (match && match[0] === defaultValue)
		return match[1];

	return defaultValue;
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