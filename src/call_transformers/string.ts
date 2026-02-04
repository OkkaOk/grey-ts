import { CallTransformer } from "./callTransformer";

CallTransformer.register("String.slice", (name, args) => {
	const str = name.slice(0, name.lastIndexOf("."));
	return `${str}[${args[0] ?? ""}:${args[1] ?? ""}]`;
});

CallTransformer.register("String.toString", (name) => {
	return name.slice(0, name.lastIndexOf("."));
});