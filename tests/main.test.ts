import { describe, expect, test } from "bun:test";
import path from "node:path";
import { transpileEntryFile } from "../src/transpiler";

const rootDir = path.resolve(__dirname, "..");

describe("math", async () => {
	const lines = transpileEntryFile(path.join(rootDir, "tests/input.ts")).split("\n")

	test("add", () => {
		expect(lines[0]).toEqual("shell = get_shell()");
	});
});