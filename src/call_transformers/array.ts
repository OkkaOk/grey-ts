import { callUtilFunction } from "../utils";
import { CallTransformer } from "./callTransformer";

CallTransformer.register("Array.concat", (name, args) => {
	const dotI = name.lastIndexOf(".");
	const arrayName = name.slice(0, dotI);
	return callUtilFunction("array_concat", arrayName, args.join(","));
});

CallTransformer.register("Array.map", (name, args) => {
	if (!args.length) throw "Invalid argument count";
	return callUtilFunction("array_map", name.slice(0, name.lastIndexOf(".")), args[0]!);
});

CallTransformer.register("Array.filter", (name, args) => {
	if (!args.length) throw "Invalid argument count";
	return callUtilFunction("array_filter", name.slice(0, name.lastIndexOf(".")), args[0]!);
});

CallTransformer.register("Array.find", (name, args) => {
	if (!args.length) throw "Invalid argument count";
	return callUtilFunction("array_find", name.slice(0, name.lastIndexOf(".")), args[0]!);
});

CallTransformer.register("Array.some", (name, args) => {
	if (!args.length) throw "Invalid argument count";
	return callUtilFunction("array_some", name.slice(0, name.lastIndexOf(".")), args[0]!);
});

CallTransformer.register("Array.every", (name, args) => {
	if (!args.length) throw "Invalid argument count";
	return callUtilFunction("array_every", name.slice(0, name.lastIndexOf(".")), args[0]!);
});

CallTransformer.register("Array.slice", (name, args) => {
	return name.slice(0, name.lastIndexOf(".")) + `[${args[0] ?? ""}:${args[1] ?? ""}]`;
});

CallTransformer.register("Array.push", (name, args) => {
	if (!args.length) throw "Invalid argument count";
	return callUtilFunction("array_push", name.slice(0, name.lastIndexOf(".")), args[0]!);
});

CallTransformer.register("Array.unshift", (name, args) => {
	if (!args.length) throw "Invalid argument count";
	return callUtilFunction("array_unshift", name.slice(0, name.lastIndexOf(".")), args[0]!);
});

CallTransformer.register("Array.toString", (name) => {
	const arrayName = name.slice(0, name.lastIndexOf("."));
	return `str(${arrayName})`;
});

CallTransformer.register("Array.reverse", (name) => {
	return callUtilFunction("array_reverse", name.slice(0, name.lastIndexOf(".")));
});