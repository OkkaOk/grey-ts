import ts from "typescript";
import { NodeHandler } from "../nodeHandler";
import { checker, type TranspileContext } from "../transpiler";
import { asRef, callUtilFunction, nodeIsFunctionReference, replaceIdentifier, replacePropertyAccess, valueIsBeingAssignedToNode } from "../utils";

NodeHandler.register(ts.SyntaxKind.PropertyAccessExpression, (node: ts.PropertyAccessExpression, ctx) => {
	const left = NodeHandler.handle(node.expression);

	let right = NodeHandler.handle(node.name);
	right = replaceIdentifier(right, checker.getTypeAtLocation(node.expression), right);
	// right = unRef(right);

	const nodeSymbol = checker.getSymbolAtLocation(node);

	// We've imported something like this: import * as lib from "mylib"
	// Next when we use lib.func() we omit the lib. so it becomes func()
	if (ctx.namespaceImports[ctx.currentFilePath]?.has(left))
		return right;

	let getSafely = !!node.questionDotToken && !ts.isNonNullExpression(node.parent);

	const rightType = checker.getTypeAtLocation(node.name);
	if (rightType.isUnion()) {
		// TODO: situation if right side is a function call.

		const hasUndefined = rightType.types.some(t => t.flags === ts.TypeFlags.Undefined);
		if (hasUndefined) getSafely = true;
	}

	if (!valueIsBeingAssignedToNode(node) && getSafely)
		return callUtilFunction("get_property", left, `"${right}"`);

	// console.log(node.name.text, checker.getTypeAtLocation(node.name))

	// console.log(checker.typeToString(leftType), symbol ? checker.getFullyQualifiedName(symbol) : "")

	let output = `${left}.${right}`;
	output = replacePropertyAccess(output, nodeSymbol);

	if (nodeIsFunctionReference(node))
		output = asRef(output);

	return output;
});

NodeHandler.register(ts.SyntaxKind.ElementAccessExpression, (node: ts.ElementAccessExpression, ctx) => {
	const left = NodeHandler.handle(node.expression);
	let right: string;

	if (ts.isStringLiteral(node.argumentExpression)) {
		const leftType = checker.getTypeAtLocation(node.expression);
		right = `"${replaceIdentifier(node.argumentExpression.text, leftType, node.argumentExpression.text)}"`;
	}
	else {
		right = NodeHandler.handle(node.argumentExpression);
	}

	if (!valueIsBeingAssignedToNode(node) && !ts.isNumericLiteral(node.argumentExpression)) {
		return callUtilFunction("get_property", left, `${right}`);
	}

	return `${left}[${right}]`;
});

function handleObjectLiteralExpression(node: ts.ObjectLiteralExpression, ctx: TranspileContext, currObj?: string[], outObjects?: string[], funcs?: string[]): string {
	currObj ??= [];
	outObjects ??= [];
	funcs ??= [];

	const objectName = ts.hasOnlyExpressionInitializer(node.parent) ? NodeHandler.handle(node.parent.name) :
		ts.isBinaryExpression(node.parent) && node === node.parent.right ? NodeHandler.handle(node.parent.left) : "";

	function pushObj() {
		if (!currObj?.length)
			return "";

		const res = currObj.filter(s => s != "").join(",");
		if (res) {
			outObjects?.push(`{ ${res} }`);
		}

		currObj.length = 0;
		return res;
	}

	for (const item of node.properties) {
		if (ts.isFunctionLike(item)) {
			if (!objectName)
				throw "You can't have method declarations inside an object that is not being assigned to a variable";

			funcs.push(`${objectName}.${NodeHandler.handle(item)}`);
			continue;
		}

		if (ts.isPropertyAssignment(item) && ts.isFunctionLike(item.initializer)) {
			if (!objectName)
				throw "You can't have method declarations inside an object that is not being assigned to a variable";
			funcs.push(`${objectName}.${NodeHandler.handle(item.name)} = ${NodeHandler.handle(item.initializer)}`);
			continue;
		}

		if (ts.isSpreadAssignment(item)) {
			if (ts.isObjectLiteralExpression(item.expression)) {
				handleObjectLiteralExpression(item.expression, ctx, currObj, outObjects);
				continue;
			}

			if (ts.isIdentifier(item.expression)) {
				pushObj();
				outObjects.push(NodeHandler.handle(item.expression));
				continue;
			}

			if (ts.isArrayLiteralExpression(item.expression)) {
				pushObj();
				outObjects.push(NodeHandler.handle(item.expression));
				continue;
			}
			// continue;
		}

		currObj.push(NodeHandler.handle(item));
	}

	pushObj();
	if (!outObjects.length)
		outObjects.push("{}");

	let output = outObjects[0]!;
	if (outObjects.length > 1) {
		output = callUtilFunction("assign_objects", output, `[${outObjects.slice(1).join(",")}]`);
	}

	if (funcs.length) {
		output += "\n" + funcs.join("\n");
	}

	return output;
}

NodeHandler.register(ts.SyntaxKind.ObjectLiteralExpression, handleObjectLiteralExpression);