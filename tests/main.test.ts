import { describe, expect, test } from "bun:test";
import { transpileString, utilFunctions } from "../src/transpiler";

describe("Identifiers", () => {
	test("hostComputer", () => {
		expect(
			transpileString("const shell = getShell().hostComputer")
		).toEqual("shell = get_shell().host_computer");
	});
});

describe("Shims", () => {
	test("Math.max", () => {
		expect(
			transpileString("const myMax = Math.max(6, 2, 8, 3)")
		).toEqual(`${utilFunctions.math_max}\nmyMax = math_max([6,2,8,3])`);
	});

	test("Math.min", () => {
		expect(
			transpileString("const myMin = Math.min(6, 2, 8, 3)")
		).toEqual(`${utilFunctions.math_min}\nmyMin = math_min([6,2,8,3])`);
	});

	test("Array.concat", () => {
		expect(
			transpileString("const myArr = [1,2,3].concat([4,5,6])")
		).toEqual(`myArr = [1,2,3] + [4,5,6]`);
	});
});

describe("Functions", () => {
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