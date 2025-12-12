import * as ts from "typescript";
import * as fs from "fs";
import * as path from "path";

const transpiledModules = new Map<string, string>();
let mode: "ts" | "js" = "ts";

export function parseCode(fileName: string, code: string): ts.SourceFile {
	return ts.createSourceFile(
		fileName,
		code,
		ts.ScriptTarget.Latest,
		true,
		ts.ScriptKind.TS
	);
}

export function transpile(relativePath: string, basePath = __dirname): string {
	let filePath = path.resolve(basePath, relativePath);

	const extname = path.extname(filePath);
	if (extname == "js") mode = "js";
	if (!extname) filePath = filePath + "." + mode;

	if (transpiledModules.has(filePath))
		return transpiledModules.get(filePath)!;

	// const isEntryFile = transpiledModules.size === 0;

	const fileName = path.basename(filePath);

	const code = fs.readFileSync(filePath, { encoding: "utf-8" });

	const sourceFile = parseCode(fileName, code);
	let result = sourceFile.statements.map(value => transpileNode(value)).join("\n");

	transpiledModules.set(filePath, result);

	// if (isEntryFile)
	// 	result += `\nMODULES[${filePath}]`

	return result;
}

function transpileIdentifier(node: ts.Identifier): string {
	return node.text;
}

function transpilePropertyAccessExpression(node: ts.PropertyAccessExpression): string {
	// console.log(node);
	return `${transpileNode(node.expression)}.${transpileNode(node.name)}`;
}

function transpileCallExpression(node: ts.CallExpression): string {
	// console.log(node)

	const args = node.arguments.map(arg => transpileNode(arg)).join(", ");
	return `${transpileNode(node.expression)}(${args})`;
}

function transpileNewExpression(node: ts.NewExpression): string {
	// console.log(node);
	const newVariableName = ts.isVariableDeclaration(node.parent) ? transpileNode(node.parent.name) : "";

	let output = `new ${transpileNode(node.expression)}`;
	if (newVariableName && node.arguments?.length) {
		output += `\n${newVariableName}.constructor(${node.arguments.map(arg => transpileNode(arg))})`;
	}

	return output;
}

function transpileBinaryExpression(node: ts.BinaryExpression): string {
	let operatorToken = node.operatorToken.getText();
	if (operatorToken == "**") operatorToken = "^";

	return `${transpileNode(node.left)} ${operatorToken} ${transpileNode(node.right)}`;
}

function transpileVariableDeclaration(node: ts.VariableDeclaration): string {
	const name = transpileNode(node.name);
	const init = node.initializer ? transpileNode(node.initializer) : "null";
	return `${name} = ${init}`;
}

function transpileVariableStatement(node: ts.VariableStatement): string {
	return node.declarationList.declarations
		.map(decl => transpileVariableDeclaration(decl))
		.join("\n");
}

function transpileExpressionStatement(node: ts.ExpressionStatement): string {
	return `${transpileNode(node.expression)}`;
}

function transpileReturnStatement(node: ts.ReturnStatement): string {
	if (!node.expression) return "return";

	return `return ${transpileNode(node.expression)}`;
}

function transpileFunctionDeclaration(node: Pick<ts.FunctionDeclaration, "name" | "parameters" | "body">): string {
	const name = node.name ? node.name.text : "anon";
	const params = node.parameters.map(param => transpileNode(param.name)).join(", ");
	const body = node.body ? node.body.statements.map(val => transpileNode(val)).join("\n	") : "";

	return `${name} = function(${params})\n	${body}\nend function`;
}

function transpileClassDeclaration(node: ts.ClassDeclaration): string {
	// console.log(node);
	const name = node.name ? node.name.text : "anon";

	let output = `${name} = {}`;
	for (const member of node.members) {
		if (ts.isConstructorDeclaration(member)) {

			const params = member.parameters.map(param => transpileNode(param.name)).join(", ");
			const body = member.body ? member.body.statements.map(val => transpileNode(val)).join("\n	") : "";
			
			output += `\n${name}.constructor = function(${params})\n	${body}\nend function`;
		} else if (ts.isMethodDeclaration(member)) {
			const methodName = transpileNode(member.name);
			const params = member.parameters.map(param => transpileNode(param.name)).join(", ");
			const body = member.body ? member.body.statements.map(val => transpileNode(val)).join("\n	") : "";

			output += `\n${name}.${methodName} = function(${params})\n	${body}\nend function`;
		} else if (ts.isPropertyDeclaration(member)) {
			output += `\n${name}.${transpileVariableDeclaration(member as any)}`;
		} else {
			output += `\n${name}.${transpileNode(member)}`;
		}
	}

	return output;
}

function transpileImportDeclaration(node: ts.ImportDeclaration): string {
	const moduleSpecifier = (node.moduleSpecifier as ts.StringLiteral).text;

	return transpile(moduleSpecifier);
}

function transpileNode(node: ts.Node): string {
	switch (node.kind) {
		case ts.SyntaxKind.NumericLiteral:
			return (node as ts.NumericLiteral).text;
		case ts.SyntaxKind.StringLiteral:
			return `\"${(node as ts.StringLiteral).text}\"`;
		case ts.SyntaxKind.Identifier:
			return transpileIdentifier(node as ts.Identifier);
		case ts.SyntaxKind.ThisKeyword:
			return "self";
		case ts.SyntaxKind.PropertyAccessExpression:
			return transpilePropertyAccessExpression(node as ts.PropertyAccessExpression);
		case ts.SyntaxKind.CallExpression:
			return transpileCallExpression(node as ts.CallExpression);
		case ts.SyntaxKind.NewExpression:
			return transpileNewExpression(node as ts.NewExpression);
		case ts.SyntaxKind.BinaryExpression:
			return transpileBinaryExpression(node as ts.BinaryExpression);
		case ts.SyntaxKind.VariableStatement:
			return transpileVariableStatement(node as ts.VariableStatement);
		case ts.SyntaxKind.ExpressionStatement:
			return transpileExpressionStatement(node as ts.ExpressionStatement);
		case ts.SyntaxKind.ReturnStatement:
			return transpileReturnStatement(node as ts.ReturnStatement);
		case ts.SyntaxKind.FunctionDeclaration:
			return transpileFunctionDeclaration(node as ts.FunctionDeclaration);
		case ts.SyntaxKind.ClassDeclaration:
			return transpileClassDeclaration(node as ts.ClassDeclaration);
		case ts.SyntaxKind.ImportDeclaration:
			return transpileImportDeclaration(node as ts.ImportDeclaration);
		default:
			console.log(`Found syntax kind ${node.kind} that was not transpiled: ${node.getText()}`);
			return ""; // Or throw error
	}
}
