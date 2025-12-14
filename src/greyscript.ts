// deno-lint-ignore-file no-explicit-any no-unused-vars

interface BaseFile {
	classID: "ftpFile" | "file";
	name: string | null;
	group: string;
	owner: string | null;
	permissions: string | null;
	size: string | null;
	copy: (destFolder?: string, newName?: string) => string | boolean | null;
	delete: () => string;
	has_permission: (perms?: string) => string | null;
	isBinary: () => boolean | null;
	isFolder: () => boolean | null;
	isSymlink: () => boolean | null;
	move: (destFolder: string, newName?: string) => string | boolean | null;
	path: (symLinkOriginalPath?: boolean) => string;
	rename: (name: string) => string | boolean;
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

interface Port {
	port_number: number;
	isClosed: () => boolean;
	getLanIp: () => string;
}

interface BaseComputer<FileType extends File | FtpFile> {
	classID: "ftpComputer" | "computer";
	getName: () => string;
	createFolder: (path: string, folderName?: string) => string | boolean;
	file: (path: string) => FileType | null;
}

interface FtpComputer extends BaseComputer<FtpFile> {
	classID: "ftpComputer",
}

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

type netDevice = "wlan0" | "eth0";

export const greyscript = {
	/** Print a message to the terminal. */
	print(value: any, replaceText?: boolean) {
		if (replaceText) console.clear();
		console.log(value);
		return null;
	},

	rnd(seed?: number): number {
		return Math.random();
	},

	getShell(user?: string, pass?: string): Shell | null {
		return null;
	},

	typeof(value: any): string {
		if (Object.hasOwn(value, "classID"))
			return value.classID;

		if (Array.isArray(value))
			return "list";

		if (typeof (value) === "object")
			return "map";

		return "null";
	},
} as const;