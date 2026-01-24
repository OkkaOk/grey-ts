import { describe, expect, test } from "bun:test";
import { transpileString } from "../src/transpiler";

describe("Identifiers", () => {
	test("hostComputer", () => {
		expect(
			transpileString("const shell = getShell().hostComputer")
		).toEqual("shell = get_shell.host_computer");
	});
});

describe("Shims", () => {
	test("Math.max", () => {
		expect(
			transpileString("const myMax = Math.max(6, 2, 8, 3)")
		).toInclude(`myMax = math_max([6,2,8,3])`);
	});

	test("Math.min", () => {
		expect(
			transpileString("const myMin = Math.min(6, 2, 8, 3)")
		).toInclude(`myMin = math_min([6,2,8,3])`);
	});

	test("Array.concat", () => {
		expect(
			transpileString("const myArr = [1,2,3].concat([4,5,6])")
		).toInclude(`myArr = array_concat([1,2,3], [4,5,6])`);
	});

	test("Math.sqrt", () => {
		expect(
			transpileString("const root = Math.sqrt(16)")
		).toEqual("root = sqrt(16)");
	});

	test("Math.floor", () => {
		expect(
			transpileString("const floored = Math.floor(3.7)")
		).toEqual("floored = floor(3.7)");
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

describe("Spread", () => {
	test("Array spread", () => {
		const input = [
			"const myArr = [1, 2, 3] as const;",
			"const asd = [1,2,3, ...[4,5,6], 7,8,9, ...myArr, ...[10,11,12,...[13,14,15], ...myArr], 16,17];"
		].join("\n");
		const output = [
			"myArr = [1,2,3]",
			"asd = [1,2,3,4,5,6,7,8,9] + myArr + [10,11,12,13,14,15] + myArr + [16,17]",
		].join("\n");
		expect(transpileString(input)).toEqual(output);
	});

	test("Array literal spread in function call", () => {
		expect(
			transpileString("const result = Math.max(...[1, 2, 3, 4, 5])")
		).toContain("result = math_max([1,2,3,4,5])");
	});

	test("Array variable spread in function call", () => {
		expect(
			transpileString([
				"const myArr = [1,2,3]",
				"const result = Math.max(...myArr)",
			].join("\n"))
		).toContain("result = math_max(myArr)");
	});
});