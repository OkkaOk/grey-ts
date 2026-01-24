import { callUtilFunction } from "../utils";
import { CallTransformer } from "./callTransformer";

CallTransformer.register("String.startsWith", (name, args) => {
	if (!args.length) throw "Invalid argument count";
	return callUtilFunction("str_starts_with", name.slice(0, name.lastIndexOf(".")), ...args);
});

CallTransformer.register("String.endsWith", (name, args) => {
	if (!args.length) throw "Invalid argument count";
	return callUtilFunction("str_ends_with", name.slice(0, name.lastIndexOf(".")), ...args);
});

CallTransformer.register("String.repeat", (name, args) => {
	if (!args.length) throw "Invalid argument count";
	return callUtilFunction("str_repeat", name.slice(0, name.lastIndexOf(".")), ...args);
});

CallTransformer.register("String.slice", (name, args) => {
	return name.slice(0, name.lastIndexOf(".")) + `[${args[0] ?? ""}:${args[1] ?? ""}]`;
});

CallTransformer.register("String.toString", (name) => {
	return name.slice(0, name.lastIndexOf("."));
});