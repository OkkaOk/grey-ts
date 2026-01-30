import { CallTransformer } from "./callTransformer";

CallTransformer.register("String.slice", (name, args) => {
	return name.slice(0, name.lastIndexOf(".")) + `[${args[0] ?? ""}:${args[1] ?? ""}]`;
});

CallTransformer.register("String.toString", (name) => {
	return name.slice(0, name.lastIndexOf("."));
});