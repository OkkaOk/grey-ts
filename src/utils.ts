import fs from "node:fs";
import path from "node:path";
import ts from "typescript";
import { apiNameMap } from "./replaceKeywords";
import { checker } from "./transpiler";

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

export function replaceIdentifier(defaultValue: string, symbol?: ts.Symbol): string {
	if (!symbol) return defaultValue;

	// TODO: fix a problem if type is an union and they both have a same property
	// For example in union string | string [] - both have length property so the length identifier
	// wont be replaced with greyhacks .len() property. The problem is that for unions the getFullyQualifiedName
	// just returns the identifier, "length" in this case, and we wanted either "String.length" or "Array.length"

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