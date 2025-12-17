interface RegExp { }
interface CallableFunction { }
interface NewableFunction { }
interface IArguments { }
interface Boolean { }

interface String {
	/** Returns the Unicode code of the first character of the string */
	code(): number;
	hasIndex(index: number): boolean;
	indexOf(value: string, offset?: number): number | null;
	indexes(): Array<number>;
	insert(index: number, value: string): string;
	isMatch(pattern: string, regexOptions?: string): number;
	lastIndexOf(value: string): number;
	len(): number;
	lower(): string;
	matches(pattern: string, regexOptions?: string): Record<number, string>;
	remove(value: string): string;
	replace(pattern: string, newValue: string, regexOptions?: string): string;
	split(pattern: string, regexOptions?: string): Array<string>;
	toInt(): string | number;
	trim(): string;
	upper(): string;
	val(): number;
	values(): Array<string>;

	readonly [index: number]: string;
}

interface Number {

}

type PropertyKey = number | string | symbol;
interface Object {
	hasIndex(key: PropertyKey): boolean;
	indexOf(value: any): any;
	indexes<T extends PropertyKey>(): Array<T>;
	/** Returns the number of items inside the object */
	len(): number;
	pop(): any;
	pull(): any;
	push(key: PropertyKey): any;
	remove(key: PropertyKey): boolean;
	replace(oldValue: any, newValue: any, maxCount?: number): any;
	shuffle(): null;
	sum(): number;
	values(): Array<any>;
}

interface Array<T> {
	hasIndex(index: number): boolean;
	indexOf(value: T, offset?: number): number | null;
	indexes(): Array<number>;
	insert(index: number, value: T): Array<T>;
	join(delimiter: string): string;
	len(): number;
	pop(): T;
	pull(): T;
	push(value: T): Array<T>;
	remove(index: number): null;
	replace(oldValue: T, newValue: T, maxCount?: number): Array<T>;
	reverse(): null;
	shuffle(): null;
	sort(key: PropertyKey, ascending?: boolean): Array<T>;
	sum(): number;
	values(): Array<T>;

	[n: number]: T;
}


interface Function {

}

declare var String: { readonly prototype: String; };
declare var Number: { readonly prototype: Number; };
declare var Boolean: { readonly prototype: Number; };
declare var Object: { readonly prototype: Object; };
declare var Array: { readonly prototype: Array<any>; };
declare var Function: { readonly prototype: Function; };

declare var globals: Object | any;
/** The parameters given to this script on launch */
declare var params: Array<string>;

declare namespace GreyHack {
	function abs(value: number): number;
	function acos(value: number): number;
	function activeUser(): string;
	function asin(value: number): number;
	function atan(y: number, x?: number): number;
	function bitAnd(a: number, b: number): number;
	function bitOr(a: number, b: number): number;
	function bitXor(a: number, b: number): number;
	function bitwise(operator: "~" | "&" | "|" | "^" | "<<" | ">>" | ">>>", a: number, b?: number): number;
	function cd(path: string): string;
	function ceil(value: number): number;
	function char(code: number): string;
	function clearScreen(): null;
	function code(char: string): number;
	function commandInfo(commandName: string): string;
	function cos(value: number): number;
	function currentDate(): string;
	function currentPath(): string;
	function exit(message?: string): null;
	function floor(value: number): number;
	function formatColumns(columns: string): string;
	function getAbsPath(path: string, basePath?: string): string;
	function getCtf(user: string, password: string, eventName: string): CtfEvent | string;
	function getCustomObject<T extends any>(): T & Record<string, any>;
	/** Returns by default the {@link Router router} to which the executing computer is connected to. 
	 * 
	 * Optionally an IP address can be provided. In case of failure `null` is returned. 
	 * 
	 * If there is no active internet connection, this method will throw an error, interrupting further script execution.
	 * @example const router = getRouter();
	 * print("Router's essid name is: " + router.essidName);
	 */
	function getRouter(): Router | null;
	/**
	 * Returns the {@link Shell shell} that is executing the current script.
	 * 
	 * Optionally, a username and password can be provided, allowing the use of a shell with other user privileges. 
	 * 
	 * If the username or password does not match an existing user or if the provided values deviate from the defined signature, this method will return `null`.
	 * @example const shell = getShell("root", "test");
	 * print("My public IP is: " + shell.hostComputer.publicIp);
	 */
	function getShell(): Shell;
	function getShell(username?: string, password?: string): Shell | null;
	function getSwitch(ip: string): Router | null;
	function hash(value: any): number;
	function homeDir(): string;
	function importCode(path: string): null;
	function includeLib(path: string): Crypto | Metaxploit | Service | BlockChain | AptClient | SmartAppliance | TrafficNet | null;
	function isValidIp(ip: string): number;
	function launchPath(): string;
	function log(value: number, base?: number): number;
	function mailLogin(user: string, pass: string): MetaMail | string | null;
	function md5(value: string): string;
	function nslookup(webAddress: string): string;
	function parentPath(path: string): string;
	function pi(): number;
	function print(value: any, replaceText?: boolean): null;
	function programPath(): string;
	function range(start: number, end?: number, increment?: number): Array<number>;
	function resetCtfPassword(newPassword: string): true | string;
	function rnd(seed?: number): number;
	function round(value: number, fixed?: number): number;
	function sign(value: number): number;
	function sin(value: number): number;
	function slice<T extends Array<any> | string>(value: T, startIndex?: number, endIndex?: number): T extends string ? string : T;
	function sqrt(value: number): number;
	function str(value: any): string;
	function tan(value: number): number;
	function time(): number;
	function userBankNumber(): string | null;
	function userInput(message?: string, isPassword?: boolean, anyKey?: boolean, addToHistory?: boolean): string;
	function userMailAddress(): string | null;
	function wait(seconds: number): null;
	function whois(ip: string): string;
	function yield(): null;

	function getType(value: any): keyof GameTypeMap;
	function isType<T extends keyof GameTypeMap>(value: any, type: T): value is GameTypeMap[T];

	interface AptClient {
		classID: "aptClientLib";
		addRepo(repositoryAddress: string, port?: number): string | null;
		checkUpgrade(filePath: string): boolean | string | null;
		delRepo(repositoryAddress: string): string | null;
		install(package: string, installPath?: string): true | string | null;
		search(package: string): string | null;
		show(repositoryAddress: string): string | null;
		update(): string | false;
	}

	interface BlockChain {
		classID: "blockchainLib";
		amountMined(coinName: string): number | string | null;
		coinPrice(coinName: string): number | string | null;
		createWallet(user: string, password: string): Wallet | string | null;
		deleteCoin(coinName: string, user: string, password: string): true | string | null;
		getCoin(coinName: string, user: string, password: string): Coin | string | null;
		getCoinName(user: string, password: string): string | null;
		loginWallet(user: string, password: string): Wallet | string | null;
		showHistory(coinName: string): Record<number, [number, string]> | string | null;
	}

	interface Coin {
		classID: "coin";
		createSubWallet(walletID: string, pin: string, subwalletUser: string, subwalletPassword: string): string | true | null;
		getAddress(): string;
		getCycleMining(): number | string;
		getMinedCoins(): number | string;
		getReward(): number | string;
		getSubwallet(subwalletUser: string): SubWallet | string | null;
		getSubwallets(): Array<SubWallet> | string;
		resetPassword(newPassword: string): true | string;
		setAddress(address: string): true | string | null;
		setCycleMining(rateHours: number): true | string | null;
		setReward(coinAmount: number): true | string | null;
		transaction(subwalletFrom: string, subwalletTo: string, amount: number): true | string | null;
	}

	interface Crypto {
		classID: "cryptoLib";
		aircrack(path: string): string | null;
		aireplay(bssid: string, essid: string, maxAcks?: number): string | null;
		airmon(option: "start" | "stop", device: netDevice): boolean | string;
		decipher(hash: string): string | null;
		decrypt(filePath: string, password: string): true | string | null;
		encrypt(filePath: string, password: string): true | string | null;
		isEncrypted(filePath: string): boolean | string | null;
		smtpUserList(ip: string, port: number): Array<string> | string | null;
	}

	interface CtfEvent {
		classID: "ctfEvent";
		getCreatorName(): string;
		getDescription(): string;
		getMailContent(): string;
		getTemplate(): string;
		playerSuccess(): boolean;
	}

	interface DebugLibrary {
		classID: "debugLibrary";
		applyPatch(path: string): string | null;
		payload<T extends string | undefined>(memZone: string, filePath?: T): string | null | (T extends string ? [Partial<Computer>, Partial<File>, MetaLib] : [Partial<Computer>]);
		scan(): string;
		unitTesting(errorLines: Array<number>): string | null;
	}

	interface MetaLib {
		classID: "MetaLib";
		libName: string;
		version: string;
		debugTools(user: string, password: string): string | DebugLibrary | null;
		isPatched(getDate?: boolean): boolean | string | null;
		overflow(memoryAddress: string, unsecZone: string, optArgs?: string): Shell | Computer | File | string | boolean | null;
	}

	interface MetaMail {
		classID: "MetaMail";
		delete(mailId: string): true | string | null;
		fetch(): Array<string> | string;
		read(mailId: string): string | null;
		send(emailAddress: string, subject: string, message: string): string | true | null;
	}

	interface Metaxploit {
		classID: "MetaxploitLib";
		load(path: string): MetaLib | null;
		netUse(ip: string, port: number): NetSession | null;
		rshellClient(ip: string, port: number, processName?: string): true | string;
		rshellServer(): Array<Shell> | string;
		scan(metaLib: MetaLib): Array<string> | null;
		scanAddresS(metaLib: MetaLib, memoryAddress: string): string | null;
		sniffer(saveEncSource?: boolean): string | null;
	}

	interface NetSession {
		classID: "NetSession";
		dumpLib(): MetaLib;
		floodConnection(): null;
		getNumConnGateway(): number;
		getNumPortforward(): number;
		getNumUsers(): number;
		isAnyActiveUser(): boolean;
		isRootActiveUser(): boolean;
	}

	interface Port {
		classID: "port";
		port_number: number;
		isClosed: () => boolean;
		getLanIp: () => string;
	}

	interface Router {
		classID: "router";
		bssidName: string;
		essidName: string;
		kernelVersion: string;
		localIp: string;
		publicIp: string;
		devicePorts(ip: string): Array<Port> | string | null;
		devicesLanIp(): Array<string>;
		firewallRules(): Array<string>;
		pingPort(portNumber: number): Port | null;
		portInfo(port: Port): string | null;
		usedPorts(): Array<Port>;
	}

	interface Service {
		classID: "service";
		installService(): true | string;
		startService(): true | string;
		stopService(): true | string;
	}

	interface SmartAppliance {
		classID: "SmartAppliance";
		model(): string;
		overrideSettings(power: number, temperature: number): true | string | null;
		setAlarm(enable: boolean): true | string | null;
	}

	interface SubWallet {
		classID: "subwallet";
		walletUsername(): string;
		checkPassword(password: string): true | string;
		delete(): boolean | string;
		getBalance(): number | string;
		getInfo(): string;
		getUser(): string;
		lastTransaction(): [string, number, 0 | 1, string] | false | string;
		mining(): true | string;
		setInfo(info: string): true | string;

	}

	interface TrafficNet {
		classID: "TrafficNet";
		cameraLinkSystem(): true | string;
		getCredentialsInfo(): string;
		locateVehicle(licensePlate: string, password: string): true | string | null;
	}

	interface Wallet {
		classID: "wallet";
		buyCoin(coinName: string, coinAmount: number, unitPrice: number, subwalletUser: string): true | string;
		cancelPendingTrade(coinName: string): string | null;
		getBalance(coinName: string): number | string | null;
		getGlobalOffers(coinName: string): string | Record<string, [string, number, number]> | null;
		getPendingTrade(coinName: string): string | Record<string, [string, number, number]> | null;
		getPin(): string;
		listCoins(): Array<string> | string;
		listGlobalCoins(): Array<string> | string;
		resetPassword(newPassword: string): true | string | null;
		sellCoin(coinName: string, coinAmount: number, unitPrice: number, subwalletUser: string): true | string;
		showNodes(coinName: string): string | number | null;
	}

	interface FtpShell {
		classID: "ftpShell";
		hostComputer: FtpComputer;
		scp: Shell["scp"];
	}

	interface Shell {
		classID: "shell";
		hostComputer: Computer;
		build: (sourcePath: string, binaryPath: string, allowImport?: boolean) => string;
		connectService: (ip: string, port: number, user: string, password: string, service?: "ssh" | "ftp") => Shell | FtpShell | string | null;
		launch: (program: string, params?: string) => string | boolean;
		ping: (ip: string) => string | boolean;
		scp: (file: string, folder: string, remoteShell: Shell, isUpload?: boolean) => boolean | string | null;
		startTerminal: () => null;
	}

	interface FtpFile extends BaseFile {
		classID: "ftpFile";
		parent: FtpFile | null;
		getFiles: () => Array<FtpFile> | null;
		getFolders: () => Array<FtpFile> | null;
	}

	interface File extends BaseFile {
		classID: "file";
		parent: File | null;
		allow_import: boolean;
		getFiles: () => Array<File> | null;
		getFolders: () => Array<File> | null;
		chmod: (perms: string, recursive?: boolean) => string;
		getContent: () => string | null;
		setContent: (content: string) => string | boolean | null;
		setGroup: (group: string, recursive?: boolean) => string | null;
		setOwner: (owner: string, recursive?: boolean) => string | null;
		symlink: (path: string, newName?: string) => string | boolean | null;
	}

	interface FtpComputer extends BaseComputer<FtpFile> {
		classID: "ftpComputer",
	}

	type netDevice = "wlan0" | "eth0";
	interface Computer extends BaseComputer<File> {
		classID: "computer";
		localIp: string;
		publicIp: string;
		activeNetCard: () => string;
		changePassword: (username: string, password: string) => boolean | string | null;
		closeProgram: (pid: number) => boolean | string | null;
		connectEthernet: (netDevice: netDevice, address: string, gateway: string) => string | null;
		connectWifi: (netDevice: netDevice, bssid: string, essid: string, password: string) => boolean | string | null;
		createGroup: (username: string, group: string) => boolean | string | null;
		createUser: (username: string, password: string) => boolean | string | null;
		deleteGroup: (username: string, group: string) => boolean | string | null;
		deleteUser: (username: string, removeHome?: boolean) => boolean | string | null;
		getPorts: () => Array<Port>;
		groups: (username: string) => string | null;
		isNetworkActive: () => boolean;
		networkDevices: () => string;
		networkGateway: () => string;
		reboot: (safeMode?: boolean) => boolean | string | null;
		showProcs: () => string;
		touch: (destFolder: string, fileName: string) => boolean | string;
		wifiNetworks: (netDevice: netDevice) => Array<string> | null;
	}
}

declare var abs: typeof GreyHack.abs;
declare var acos: typeof GreyHack.acos;
declare var activeUser: typeof GreyHack.activeUser;
declare var asin: typeof GreyHack.asin;
declare var atan: typeof GreyHack.atan;
declare var bitAnd: typeof GreyHack.bitAnd;
declare var bitOr: typeof GreyHack.bitOr;
declare var bitXor: typeof GreyHack.bitXor;
declare var bitwise: typeof GreyHack.bitwise;
declare var cd: typeof GreyHack.cd;
declare var ceil: typeof GreyHack.ceil;
declare var char: typeof GreyHack.char;
declare var clearScreen: typeof GreyHack.clearScreen;
declare var code: typeof GreyHack.code;
declare var commandInfo: typeof GreyHack.commandInfo;
declare var cos: typeof GreyHack.cos;
declare var currentDate: typeof GreyHack.currentDate;
declare var currentPath: typeof GreyHack.currentPath;
declare var exit: typeof GreyHack.exit;
declare var floor: typeof GreyHack.floor;
declare var formatColumns: typeof GreyHack.formatColumns;
declare var getAbsPath: typeof GreyHack.getAbsPath;
declare var getCtf: typeof GreyHack.getCtf;
declare var getCustomObject: typeof GreyHack.getCustomObject;
declare var getRouter: typeof GreyHack.getRouter;
declare var getShell: typeof GreyHack.getShell;
declare var getSwitch: typeof GreyHack.getSwitch;
declare var hash: typeof GreyHack.hash;
declare var homeDir: typeof GreyHack.homeDir;
declare var importCode: typeof GreyHack.importCode;
declare var includeLib: typeof GreyHack.includeLib;
declare var isValidIp: typeof GreyHack.isValidIp;
declare var launchPath: typeof GreyHack.launchPath;
declare var log: typeof GreyHack.log;
declare var mailLogin: typeof GreyHack.mailLogin;
declare var md5: typeof GreyHack.md5;
declare var nslookup: typeof GreyHack.nslookup;
declare var parentPath: typeof GreyHack.parentPath;
declare var pi: typeof GreyHack.pi;
declare var print: typeof GreyHack.print;
declare var programPath: typeof GreyHack.programPath;
declare var range: typeof GreyHack.range;
declare var resetCtfPassword: typeof GreyHack.resetCtfPassword;
declare var rnd: typeof GreyHack.rnd;
declare var round: typeof GreyHack.round;
declare var sign: typeof GreyHack.sign;
declare var sin: typeof GreyHack.sin;
declare var slice: typeof GreyHack.slice;
declare var sqrt: typeof GreyHack.sqrt;
declare var str: typeof GreyHack.str;
declare var tan: typeof GreyHack.tan;
declare var time: typeof GreyHack.time;
declare var userBankNumber: typeof GreyHack.userBankNumber;
declare var userInput: typeof GreyHack.userInput;
declare var userMailAddress: typeof GreyHack.userMailAddress;
declare var wait: typeof GreyHack.wait;
declare var whois: typeof GreyHack.whois;
declare var yield: typeof GreyHack.yield;

declare var getType: typeof GreyHack.getType;
declare var isType: typeof GreyHack.isType;

type OtherTypeMap = {
	"null": null,
	"pcomputer": unknown,
	"pfile": unknown,
	"prouter": unknown,
	"number": number,
	"list": Array<any>,
	"map": Record<string, any>,
	"function": Function,
	"string": string,
};

type ClassIDMap = {
	"aptClientLib": GreyHack.AptClient,
	"blockChainLib": GreyHack.BlockChain,
	"ctfEvent": GreyHack.CtfEvent,
	"coin": GreyHack.Coin,
	"computer": GreyHack.Computer,
	"ftpComputer": GreyHack.FtpComputer,
	"cryptoLib": GreyHack.Crypto;
	"debugLibrary": GreyHack.DebugLibrary,
	"file": GreyHack.File,
	"ftpFile": GreyHack.FtpFile,
	"MetaLib": GreyHack.MetaLib,
	"MetaMail": GreyHack.MetaMail,
	"MetaxploitLib": GreyHack.Metaxploit,
	"NetSession": GreyHack.NetSession,
	"port": GreyHack.Port,
	"router": GreyHack.Router,
	"service": GreyHack.Service,
	"shell": GreyHack.Shell,
	"ftpShell": GreyHack.FtpShell,
	"SmartAppliance": GreyHack.SmartAppliance,
	"subwallet": GreyHack.SubWallet,
	"TrafficNet": GreyHack.TrafficNet,
	"wallet": GreyHack.Wallet;
};

type GameTypeMap = ClassIDMap & OtherTypeMap;

interface BaseFile {
	classID: "ftpFile" | "file";
	name: string | null;
	group: string;
	owner: string | null;
	permissions: string | null;
	size: string | null;
	copy: (destFolder?: string, newName?: string) => string | boolean | null;
	delete: () => string;
	has_permission: (perms?: string) => boolean | null;
	isBinary: () => boolean | null;
	isFolder: () => boolean | null;
	isSymlink: () => boolean | null;
	move: (destFolder: string, newName?: string) => string | boolean | null;
	path: (symLinkOriginalPath?: boolean) => string;
	rename: (name: string) => string | boolean;
}

interface BaseComputer<FileType extends GreyHack.File | GreyHack.FtpFile> {
	classID: "ftpComputer" | "computer";
	getName: () => string;
	createFolder: (path: string, folderName?: string) => string | boolean;
	file: (path: string) => FileType | null;
}

/**
 * Make all properties in T optional
 */
type Partial<T> = {
	[P in keyof T]?: T[P];
} & Object;

/**
 * Make all properties in T required
 */
type Required<T> = {
	[P in keyof T]-?: T[P];
} & Object;

/**
 * Make all properties in T readonly
 */
type Readonly<T> = {
	readonly [P in keyof T]: T[P];
} & Object;

/**
 * From T, pick a set of properties whose keys are in the union K
 */
type Pick<T, K extends keyof T> = {
	[P in K]: T[P];
} & Object;

/**
 * Construct a type with a set of properties K of type T
 */
type Record<K extends keyof any, T> = {
	[P in K]: T;
} & Object;

/**
 * Exclude from T those types that are assignable to U
 */
type Exclude<T, U> = (T extends U ? never : T) & Object;

/**
 * Extract from T those types that are assignable to U
 */
type Extract<T, U> = (T extends U ? T : never) & Object;

/**
 * Construct a type with the properties of T except for those in type K.
 */
type Omit<T, K extends keyof any> = Pick<T, Exclude<keyof T, K>>;

/**
 * Obtain the parameters of a function type in a tuple
 */
type Parameters<T extends (...args: any) => any> = T extends (...args: infer P) => any ? P : never;

/**
 * Obtain the parameters of a constructor function type in a tuple
 */
type ConstructorParameters<T extends abstract new (...args: any) => any> = T extends abstract new (...args: infer P) => any ? P : never;

/**
 * Obtain the return type of a function type
 */
type ReturnType<T extends (...args: any) => any> = T extends (...args: any) => infer R ? R : any;