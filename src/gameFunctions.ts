// deno-lint-ignore-file no-explicit-any

export function print(value: any, replaceText: boolean) {
	if (replaceText) console.clear();
	console.log(value);
	return null;
}
