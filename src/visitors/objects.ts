import ts from "typescript";
import { NodeHandler } from "../nodeHandler";
import { checker, type TranspileContext } from "../transpiler";
import { asRef, callUtilFunction, nodeIsFunctionReference, replaceIdentifier, replacePropertyAccess, valueIsBeingAssignedToNode } from "../utils";

function shouldGetSafely(node: ts.PropertyAccessExpression | ts.ElementAccessExpression, ctx: TranspileContext) {
	if (ts.isNonNullExpression(node.parent))
		return false;

	// Can't get the function calls to work with get_property
	const callParent = ts.findAncestor(node, (n) => n.parent && ts.isCallExpression(n.parent) && n.parent.expression === n);
	if (callParent) return false;

	if (ctx.forceSafeAccess)
		return true;

	if (valueIsBeingAssignedToNode(node))
		return false;

	const type = checker.getTypeAtLocation(node);
	if (!type.isUnion()) return !!node.questionDotToken;

	// Check if the node has a nullish type.
	// If not, return false even if there was a questionDot token.
	const hasNullish = type.types.some(t => t.flags === ts.TypeFlags.Undefined || ts.TypeFlags.Null);
	if (!hasNullish) return false;

	return true;
}

NodeHandler.register(ts.SyntaxKind.PropertyAccessExpression, (node: ts.PropertyAccessExpression, ctx) => {
	const left = NodeHandler.handle(node.expression);

	let right = NodeHandler.handle(node.name);
	right = replaceIdentifier(right, checker.getTypeAtLocation(node.expression), right);
	// right = unRef(right);

	// We've imported something like this: import * as lib from "mylib"
	// Next when we use lib.func() we omit the lib. so it becomes func()
	if (ctx.namespaceImports[ctx.currentFilePath]?.has(left))
		return right;

	if (shouldGetSafely(node, ctx))
		return callUtilFunction("get_property", left, `"${right}"`);

	const nodeSymbol = checker.getSymbolAtLocation(node);
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

	if (shouldGetSafely(node, ctx)) {
		return callUtilFunction("get_property", left, `${right}`);
	}

	return `${left}[${right}]`;
});

function handleObjectLiteralExpression(node: ts.ObjectLiteralExpression, ctx: TranspileContext, currObj?: string[], outObjects?: string[], funcs?: string[]): string {
	currObj ??= [];
	outObjects ??= [];
	funcs ??= [];

	let objectName = "";

	if (ts.hasOnlyExpressionInitializer(node.parent))
		objectName = NodeHandler.handle(node.parent.name);
	else if (ts.isBinaryExpression(node.parent) && node === node.parent.right)
		objectName = NodeHandler.handle(node.parent.left);

	function pushObj() {
		if (!currObj?.length)
			return "";

		const res = currObj.filter(s => s !== "").join(",");
		if (res) {
			outObjects?.push(`{ ${res} }`);
		}

		currObj.length = 0;
		return res;
	}

	for (const item of node.properties) {
		if (ts.isFunctionLike(item)) {
			funcs.push(NodeHandler.handle(item));
			continue;
		}

		if (ts.isPropertyAssignment(item) && ts.isFunctionLike(item.initializer)) {
			funcs.push(`${NodeHandler.handle(item.name)} = ${NodeHandler.handle(item.initializer)}`);
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
		if (ts.isPropertyAssignment(node.parent) || !objectName) {
			throw "You can't have method declarations inside an object that is not being assigned to a variable";
		}

		output += `\n${funcs.map(func => `${objectName}.${func}`).join("\n")}`;
	}

	return output;
}

NodeHandler.register(ts.SyntaxKind.ObjectLiteralExpression, handleObjectLiteralExpression);