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
	is_binary: () => boolean | null;
	is_folder: () => boolean | null;
	is_symlink: () => boolean | null;
	move: (destFolder: string, newName?: string) => string | boolean | null;
	path: (symLinkOriginalPath?: boolean) => string;
	rename: (name: string) => string | boolean;
}

interface FtpFile extends BaseFile {
	classID: "ftpFile";
	parent: FtpFile | null;
	get_files: () => Array<FtpFile> | null;
	get_folders: () => Array<FtpFile> | null;
}

interface File extends BaseFile {
	classID: "file";
	parent: File | null;
	allow_import: boolean;
	get_files: () => Array<File> | null;
	get_folders: () => Array<File> | null;
	chmod: (perms: string, recursive?: boolean) => string;
	get_content: () => string | null;
	set_content: (content: string) => string | boolean | null;
	set_group: (group: string, recursive?: boolean) => string | null;
	set_owner: (owner: string, recursive?: boolean) => string | null;
	symlink: (path: string, newName?: string) => string | boolean | null;
}

interface Port {
	port_number: number;
	is_closed: () => boolean;
	get_lan_ip: () => string;
}

interface BaseComputer<FileType extends File | FtpFile> {
	classID: "ftpComputer" | "computer";
	get_name: () => string;
	create_folder: (path: string, folderName?: string) => string | boolean;
	File: (path: string) => FileType | null;
}

interface FtpComputer extends BaseComputer<FtpFile> {
	classID: "ftpComputer",
}

interface Computer extends BaseComputer<File> {
	classID: "computer";
	local_ip: string;
	public_ip: string;
	active_net_card: () => string;
	change_password: (username: string, password: string) => boolean | string | null;
	close_program: (pid: number) => boolean | string | null;
	connect_ethernet: (netDevice: netDevice, address: string, gateway: string) => string | null;
	connect_wifi: (netDevice: netDevice, bssid: string, essid: string, password: string) => boolean | string | null;
	create_group: (username: string, group: string) => boolean | string | null;
	create_user: (username: string, password: string) => boolean | string | null;
	delete_group: (username: string, group: string) => boolean | string | null;
	delete_user: (username: string, removeHome?: boolean) => boolean | string | null;
	get_ports: () => Array<Port>;
	groups: (username: string) => string | null;
	is_network_active: () => boolean;
	network_devices: () => string;
	network_gateway: () => string;
	reboot: (safeMode?: boolean) => boolean | string | null;
	show_procs: () => string;
	touch: (destFolder: string, fileName: string) => boolean | string;
	wifi_networks: (netDevice: netDevice) => Array<string> | null;
}

interface FtpShell {
	classID: "ftpShell";
	host_computer: FtpComputer;
	scp: Shell["scp"];
}

interface Shell {
	classID: "shell";
	host_computer: Computer;
	build: (sourcePath: string, binaryPath: string, allowImport?: boolean) => string;
	connect_service: (ip: string, port: number, user: string, password: string, service?: "ssh" | "ftp") => Shell | FtpShell | string | null;
	launch: (program: string, params?: string) => string | boolean;
	ping: (ip: string) => string | boolean;
	scp: (file: string, folder: string, remoteShell: Shell, isUpload?: boolean) => boolean | string | null;
	start_terminal: () => null;
}

type netDevice = "wlan0" | "eth0";

declare global {
	/** Print a message to the terminal. */
	function print(value: any, replaceText?: boolean): null;
	function get_shell(user?: string, pass?: string): Shell | null;
}

export { };