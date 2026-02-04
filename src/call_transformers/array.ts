import { CallTransformer } from "./callTransformer";

CallTransformer.register("Array.slice", (name, args) => {
	const arrayName = name.slice(0, name.lastIndexOf("."));
	return `${arrayName}[${args[0] ?? ""}:${args[1] ?? ""}]`;
});

CallTransformer.register("Array.toString", (name) => {
	const arrayName = name.slice(0, name.lastIndexOf("."));
	return `str(${arrayName})`;
});