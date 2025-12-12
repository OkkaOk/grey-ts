import { transpile } from "./transpiler";
import * as fs from "fs";

if (process.argv.length < 3) {
	console.error("No entry file specified.");
	process.exit(2);
}

let printOnly = false;
for (let i = process.argv.length - 1; i > 0; i--) {
	if (process.argv[i] === "--print" || process.argv[i] === "-p") {
		printOnly = true;
		process.argv.splice(i, 1);
		continue;
	}
}

const entryFile = process.argv[2];
const output = transpile(entryFile, process.cwd());

if (printOnly) {
	console.log(output);
}
else {
	const outDirPath = `${__dirname}/../out`;
	if (!fs.existsSync(outDirPath))
		fs.mkdirSync(outDirPath);

	// TODO: split to multiple if over 160k characters
	const outFilePath = outDirPath + "/output.gs";
	fs.writeFileSync(outFilePath, output);
}

