import { CallTransformer } from "./callTransformer";

CallTransformer.register("Array.slice", (name, args) => {
	return name.slice(0, name.lastIndexOf(".")) + `[${args[0] ?? ""}:${args[1] ?? ""}]`;
});

CallTransformer.register("Array.toString", (name) => {
	const arrayName = name.slice(0, name.lastIndexOf("."));
	return `str(${arrayName})`;
});