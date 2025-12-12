export function print(value: any, replaceText: boolean) {
	if (replaceText) console.clear();
	console.log(value);
	return null;
}
