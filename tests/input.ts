// if (globals.hasIndex("IS_GREYBEL")) {
// 	const oldUserInput = userInput;
// 	userInput = (message = "", isPassword = false, anyKey = false, _addToHistory = false) => {
// 		return oldUserInput(message, isPassword, anyKey);
// 	};
// }

// const rawPrint = print;
// print = (value: any, replaceText = false) => {
// 	return null;
// };

// class TestClass {
// 	constructor(msg: string, ...args: string[]) {
// 		print(msg);
// 	}

// 	static printRest(msg: string, ...num: number[]): void;
// 	static printRest(msg: string, ...str: string[]): void;
// 	static printRest(msg: string, ...arg: string[] | number[]): void {
// 		print(`${msg}: ${arg}`);
// 	}
// }

function test(msg: string, ...myfuncs: ((val: string) => void)[]) {
	for (const func of myfuncs) {
		func("12345");
	}
}

function testest(val: string) {
	// print(val)
}

function myfunctest() {
	return 5
}

class TestClass {
	constructor(msg: string, ...args: ((val: string) => void)[]) {

	}

	static haha() {
		function hohoho() {
			return 3;
		}

		return {
			hohoho
		}
	}
}

test("msss", testest, testest)
const asd = "aaa"
const aa = new TestClass(asd, testest, testest, TestClass.haha().hohoho, TestClass.haha)
print(TestClass.haha().hohoho)
print(TestClass.haha().hohoho())
const aaa = "1234";
const bbb = { [aaa]: 5 }

print(aaa ?? bbb)
// const myfile = getShell().hostComputer.file("aa");
// if (isType(myfile, "file")) {
// 	print(myfile.name);
// }

// const asd = new TestClass("hello", "hi", "ho", "he");

// TestClass.printRest("look at these", 1, 2, 3);