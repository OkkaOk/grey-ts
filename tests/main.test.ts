import { expect, test } from "bun:test";
import path from "node:path";
import { describe } from "node:test";
import { transpileString } from "../src/transpiler";

const rootDir = path.resolve(__dirname, "..");

describe("Replace Identifiers", () => {
	test("hostComputer", () => {
		expect(
			transpileString("const shell = getShell().hostComputer")
		).toEqual("shell = get_shell().host_computer");
	});

	test("userInput", () => {
		expect(
			transpileString(`
				const oldUserInput = userInput;
				userInput = (msg = "", isPassword = false, anyKey = false, addToHist = false) => oldUserInput(msg, isPassword, anyKey);
			`).replaceAll("\t", "")
		).toEqual(`\
			oldUserInput = @user_input
			@user_input = function(msg = "", isPassword = 0, anyKey = 0, addToHist = 0)
				return oldUserInput(msg, isPassword, anyKey)
			end function\
		`.replaceAll("\t", ""));
	});
});