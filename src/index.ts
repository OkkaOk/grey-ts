#!/usr/bin/env -S node --no-warnings --no-deprecation

import * as fs from "node:fs";
import path from "node:path";
import { transpileProgram } from "./transpiler";
import { findProjectRoot } from "./utils";

let noMoreFlags = false;
let command = "";
const flags: string[] = [];
const args: string[] = [];

for (let i = 2; i < process.argv.length; i++) {
	const arg = process.argv[i]!;
	if (arg === "--") {
		noMoreFlags = true;
		continue;
	}

	if (!command) {
		command = arg;
		continue;
	}

	if (arg.startsWith("-") && !noMoreFlags)
		flags.push(arg);
	else
		args.push(arg);
}

const root = findProjectRoot(process.cwd());
const outDirPath = `${root}/out`;

if (!command) {
	console.error("No command specified.");
	process.exit(2);
}

function createOutputFile(fileIndex: number, basename: string, content: string) {
	if (fileIndex > 0)
		basename = `${basename}-${fileIndex}`;

	const outFileName = args.length > 1 ? args[1]! : `${basename}.src`;
	const outFilePath = path.join(outDirPath, outFileName);

	fs.writeFileSync(outFilePath, content);
}

if (command === "transpile") {
	if (!args.length) {
		console.error("No entry file specified.");
		process.exit(2);
	}

	const entryFile = args[0]!;
	const basename = path.basename(entryFile, ".ts");

	const transpiledStatements = transpileProgram(entryFile);

	if (flags.includes("--print") || flags.includes("-p")) {
		console.log(transpiledStatements.join("\n"));
		process.exit(0);
	}

	if (!fs.existsSync(outDirPath))
		fs.mkdirSync(outDirPath);

	let content = "";
	const fileContents: string[] = [];

	while (transpiledStatements.length) {
		const statement = transpiledStatements.shift()!;
		if (content.length + statement.length > 155_000 && content.length) {
			fileContents.push(content);
			content = `${statement}\n`;
			continue;
		}

		content += `${statement}\n`;
	}

	if (content.length)
		fileContents.push(content);

	for (let i = 0; i < fileContents.length; i++) {
		if (i + 1 < fileContents.length) {
			const nextFileName = `${basename}-${i + 1}.src`;
			fileContents[i] += `import_code("${nextFileName}")`;
		}

		createOutputFile(i, basename, fileContents[i]!);
	}
}
else {
	console.log(`Invalid command: ${command}`);
	process.exit(127);
}

export { transpileProgram };
