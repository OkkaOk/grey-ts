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


let comp: Computer = getShell().hostComputer;
let currPath = currentPath();

let file = comp.file("filePath");