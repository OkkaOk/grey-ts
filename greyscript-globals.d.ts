import { greyscript } from "./src/greyscript.ts";

declare global {
	const getShell: typeof greyscript.getShell
	const print: typeof greyscript.print
	const rnd: typeof greyscript.rnd
	const getType: typeof greyscript.typeof
}


export { };
