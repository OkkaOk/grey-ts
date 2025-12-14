import { assertEquals } from "@std/assert";
import parseCode from "./src/parser.ts";
import { transpile } from "./src/transpiler.ts";

Deno.test(function variableTest() {
	const source = parseCode("test.ts", "const test = 5")
	const result = transpile(source, "test");
	assertEquals(result, "test = 5");
});

Deno.test(function remapTest() {
	const source = parseCode("test.ts", "const comp = getShell().hostComputer")
	const result = transpile(source, "test");
	assertEquals(result, "comp = get_shell().host_computer");
});
