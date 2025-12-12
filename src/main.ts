import { transpileModule } from "./transpiler.ts";

let printOnly = false;
for (let i = Deno.args.length - 1; i >= 0; i--) {
	if (Deno.args[i] === "--print" || Deno.args[i] === "-p") {
		printOnly = true;
		Deno.args.splice(i, 1);
		continue;
	}
}

if (Deno.args.length < 1) {
	console.error("No entry file specified.");
	Deno.exit(2);
}

const entryFile = Deno.args[0];
const output = transpileModule(entryFile, Deno.cwd());

if (printOnly) {
	console.log(output);
}
else {
	const outDirPath = `${import.meta.dirname}/../out`;
	try {
		Deno.statSync(outDirPath)
	} catch {
		Deno.mkdirSync(outDirPath)
	}

	// TODO: split to multiple if over 160k characters
	const outFilePath = outDirPath + "/output.gs";

	const encoder = new TextEncoder()
	Deno.writeFileSync(outFilePath, encoder.encode(output));
}