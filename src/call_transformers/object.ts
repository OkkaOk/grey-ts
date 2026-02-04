import { callUtilFunction } from "../utils";
import { CallTransformer } from "./callTransformer";

CallTransformer.register("ObjectConstructor.hasOwn", (_name, args) => {
	if (args.length < 2) throw "Invalid argument count";

	return `${args[0]}.hasIndex(${args[1]})`;
});

CallTransformer.register("ObjectConstructor.assign", (_name, args) => {
	if (args.length < 2) throw "Invalid argument count";
	return callUtilFunction("assign_objects", args.join(","));
});

CallTransformer.register("ObjectConstructor.keys", (_name, args) => {
	return `${args[0]}.indexes`;
});

CallTransformer.register("ObjectConstructor.values", (_name, args) => {
	return `${args[0]}.values`;
});

CallTransformer.register("ObjectConstructor.sum", (_name, args) => {
	return `${args[0]}.sum`;
});

CallTransformer.register("ObjectConstructor.shuffle", (_name, args) => {
	return `${args[0]}.shuffle`;
});

CallTransformer.register("ObjectConstructor.replace", (_name, args) => {
	return `${args[0]}.replace(${args.slice(1).join(",")})`;
});

CallTransformer.register("ObjectConstructor.remove", (_name, args) => {
	return `${args[0]}.remove(${args[1]})`;
});

CallTransformer.register("ObjectConstructor.shift", (_name, args) => {
	return `${args[0]}.pull`;
});

CallTransformer.register("ObjectConstructor.size", (_name, args) => {
	return `${args[0]}.len`;
});

CallTransformer.register("ObjectConstructor.indexOf", (_name, args) => {
	return `${args[0]}.indexOf(${args[1]})`;
});

CallTransformer.register("Object.toString", (name) => {
	const objectName = name.slice(0, name.lastIndexOf("."));
	return `str(${objectName})`;
});