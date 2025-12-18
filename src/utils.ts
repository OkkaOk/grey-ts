import ts from "typescript";
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