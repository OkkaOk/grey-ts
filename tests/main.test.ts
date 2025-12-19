import { expect, test } from "bun:test";
import path from "node:path";
import { describe } from "node:test";
import { transpileProgram } from "../src/transpiler";

const rootDir = path.resolve(__dirname, "..");

describe("Replace Identifiers", () => {
	const lines = transpileProgram(path.join(rootDir, "tests/replaceIdentifiers.ts")).split("\n");

	test("getShell", () => {
		expect(lines[0]).toEqual("shell = get_shell()");
	});

	test("ip", () => {
		expect(lines[1]).toEqual("ip = shell.host_computer.local_ip");
	});

	test("userInput", () => {
		expect(lines[2]).toEqual("@oldUserInput = @user_input");
	});
});