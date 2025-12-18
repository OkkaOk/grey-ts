#!/usr/bin/env -S node --no-warnings --no-deprecation

import * as fs from "node:fs";
import path from "node:path";
import { transpileProgram } from "./transpiler.js";

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

function findProjectRoot(dir: string): string {
	while (!fs.existsSync(path.join(dir, "package.json"))) {
		const parent = path.dirname(dir);
		if (parent === dir) throw new Error("No package.json found");
		dir = parent;
	}
	return dir;
}

const root = findProjectRoot(process.cwd());

if (!command) {
	console.error("No command specified.");
	process.exit(2);
}

if (command === "transpile") {
	if (!args.length) {
		console.error("No entry file specified.");
		process.exit(2);
	}

	const entryFile = args[0]!;
	const output = transpileProgram(entryFile);
	
	if (flags.includes("--print") || flags.includes("-p")) {
		console.log(output);
	}
	else {
		const outDirPath = `${root}/out`;
		if (!fs.existsSync(outDirPath))
			fs.mkdirSync(outDirPath);

		const outFileName = args.length > 1 ? args[1]! : "output.gs"
	
		// TODO: split to multiple if over 160k characters. Or let greybel handle it?
		const outFilePath = path.join(outDirPath, outFileName);
	
		fs.writeFileSync(outFilePath, output);
	}
}
else {
	console.log(`Invalid command: ${command}`)
	process.exit(127);
}
