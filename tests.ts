import { assertEquals } from "@std/assert";
import parseCode from "./src/parser.ts";
import { transpile } from "./src/transpiler.ts";

Deno.test(function variableTest() {
	const source = parseCode("test.ts", "const test = 5")
	const result = transpile(source);
	assertEquals(result, "test = 5");
});
