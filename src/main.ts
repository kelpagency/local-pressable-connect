import * as Local from '@getflywheel/local';
import * as LocalMain from '@getflywheel/local/main';
import { execFile } from 'child_process';
import { promisify } from 'util';
import * as fs from 'fs-extra';
import * as https from 'https';
import * as os from 'os';
import * as path from 'path';
import { Client as SSHClient } from 'ssh2';
import SftpClient from 'ssh2-sftp-client';

const execFileAsync = promisify(execFile);
const SETTINGS_KEY = 'pressable-connect';
const API_ROOT = 'https://my.pressable.com/v1';
const AUTH_URL = 'https://my.pressable.com/auth/token';
const PRESSABLE_FILE_EXCLUDES = [
	'wp-content/advanced-cache.php',
	'wp-content/object-cache.php',
	'wp-content/cache',
	'wp-content/mysql.sql',
	'wp-content/drop-ins',
	'wp-content/mu-plugins/mu-plugin.php',
	'wp-content/mu-plugins/wpengine-common',
	'wp-content/mu-plugins/wp-cache-memcached',
	'wp-content/mu-plugins/wpe-cache-plugin',
	'wp-content/mu-plugins/wpe-devkit.php',
	'wp-content/mu-plugins/wpe-update-source-selector.php',
	'wp-content/mu-plugins/wpe-update-source-selector',
	'wp-content/mu-plugins/wpe-wp-sign-on-plugin.php',
	'wp-content/mu-plugins/wpe-wp-sign-on-plugin',
	'wp-content/mu-plugins/wpengine-security-auditor.php',
	'wp-content/mu-plugins/slt-force-strong-passwords.php',
	'wp-content/mu-plugins/force-strong-passwords',
	'wp-content/mu-plugins/local-by-flywheel-demo-urls.php',
	'wp-content/mu-plugins/local-by-flywheel-live-link-helper.php',
	'wp-content/mu-plugins/pressable*',
	'wp-content/mu-plugins/wpcomsh*',
	'wp-content/plugins/pressable*',
	'._*',
	'.DS_Store',
];

type Credentials = {clientId: string; clientSecret: string};
type Mapping = {remoteSiteId: number; remoteUrl: string; sshUsername: string; sshPassword: string};
type Settings = {credentials?: Credentials; mappings?: Record<string, Mapping>};
type ApiResponse = {access_token?: string; data?: unknown; errors?: string[]; message?: string};

function requestJson (urlString: string, options: https.RequestOptions, body?: string): Promise<ApiResponse> {
	return new Promise((resolve, reject) => {
		const req = https.request(urlString, options, (res) => {
			let raw = '';
			res.setEncoding('utf8');
			res.on('data', (chunk) => raw += chunk);
			res.on('end', () => {
				let parsed: ApiResponse = {};
				try {
					parsed = raw ? JSON.parse(raw) : null;
				} catch (_) { /* handled below */ }
				if ((res.statusCode || 500) >= 400) {
					reject(new Error(parsed?.errors?.join(', ') || parsed?.message || `Pressable returned HTTP ${res.statusCode}`));
					return;
				}
				resolve(parsed);
			});
		});
		req.on('error', reject);
		if (body) {
			req.write(body);
		}
		req.end();
	});
}

async function accessToken (credentials: Credentials): Promise<string> {
	const body = new URLSearchParams({ grant_type: 'client_credentials', client_id: credentials.clientId, client_secret: credentials.clientSecret }).toString();
	const response = await requestJson(AUTH_URL, { method: 'POST', headers: { 'Content-Type': 'application/x-www-form-urlencoded', 'Content-Length': Buffer.byteLength(body) } }, body);
	if (!response?.access_token) {
		throw new Error('Pressable did not return an access token.');
	}
	return response.access_token;
}

async function api (credentials: Credentials, endpoint: string): Promise<ApiResponse> {
	const token = await accessToken(credentials);
	return requestJson(`${API_ROOT}${endpoint}`, { method: 'GET', headers: { Authorization: `Bearer ${token}`, Accept: 'application/json' } });
}

function sshExec (mapping: Mapping, command: string): Promise<string> {
	return new Promise((resolve, reject) => {
		const client = new SSHClient();
		let output = '';
		client.on('ready', () => client.exec(command, (error, stream) => {
			if (error) {
				client.end(); reject(error); return;
			}
			stream.on('data', (data: Buffer) => output += data.toString());
			stream.stderr.on('data', (data: Buffer) => output += data.toString());
			stream.on('close', (code: number) => {
				client.end();
				code === 0 ? resolve(output) : reject(new Error(output || `Remote command failed with exit code ${code}.`));
			});
		})).on('error', reject).connect({ host: 'ssh.pressable.com', port: 22, username: mapping.sshUsername, password: mapping.sshPassword, readyTimeout: 30000 });
	});
}

function quote (value: string): string {
	return `'${value.replace(/'/g, `'\\''`)}'`;
}

function remoteTempCleanupCommand(siteId: string): string {
    return `find /tmp -maxdepth 1 -type f \\( -name ${quote(`${siteId}-*.tar.gz`)} -o -name ${quote(`${siteId}-*.sql`)} -o -name ${quote(`${siteId}-*.tar.log`)} \\) -delete`;
}
function remoteExtractCommand(stamp: string): string {
    const archive = `/tmp/${stamp}.tar.gz`;
    const log = `/tmp/${stamp}.tar.log`;
    const allowedErrors = '^(tar: wp-content(/(plugins|themes))?: Cannot change mode to [rwxStTs-]+: Operation not permitted|tar: Exiting with failure status due to previous errors)$';
    return `{ tar --extract --gzip --file=${quote(archive)} --directory=/htdocs --no-overwrite-dir --no-same-owner --no-same-permissions --warning=no-unknown-keyword 2>${quote(log)}; tar_status=$?; if [ "$tar_status" -eq 0 ]; then rm -f ${quote(log)}; true; elif [ -s ${quote(log)} ] && ! grep -Evq ${quote(allowedErrors)} ${quote(log)}; then rm -f ${quote(log)}; true; else cat ${quote(log)} >&2; rm -f ${quote(log)}; false; fi; }`;
}
async function cleanupLocalTempDirectories (): Promise<void> {
	const tempRoot = os.tmpdir();
	for (const name of await fs.readdir(tempRoot)) {
		if (name.startsWith('pressable-connect-')) {
			await fs.remove(path.join(tempRoot, name));
		}
	}
}

function expandHomePath (value: string): string {
	if (value === '~') {
		return os.homedir();
	}
	if (value.startsWith('~/') || value.startsWith('~\\')) {
		return path.join(os.homedir(), value.slice(2));
	}
	return value;
}

async function findBrokenSymlinkExcludes (wpContentPath: string): Promise<string[]> {
	const excludes: string[] = [];
	for (const directory of ['plugins', 'mu-plugins', 'themes']) {
		const directoryPath = path.join(wpContentPath, directory);
		if (!await fs.pathExists(directoryPath)) {
			continue;
		}
		for (const name of await fs.readdir(directoryPath)) {
			const itemPath = path.join(directoryPath, name);
			try {
				if ((await fs.lstat(itemPath)).isSymbolicLink() && !await fs.pathExists(itemPath)) {
					excludes.push(`wp-content/${directory}/${name}`);
				}
			} catch (_) { /* item disappeared while preparing the archive */ }
		}
	}
	return excludes;
}

export default function (): void {
	const { siteData, siteDatabase, importSQLFile, siteProcessManager, wpCli, localLogger } = LocalMain.getServiceContainer().cradle;
	const logger = localLogger.child({ thread: 'main', addon: 'pressable-connect' });
	const load = (): Settings => LocalMain.UserData.get({ name: SETTINGS_KEY, defaults: { mappings: {} }, persistDefaults: true, persistDefaultsEncrypted: true });
	const save = (settings: Settings) => LocalMain.UserData.set({ name: SETTINGS_KEY, data: settings, encrypted: true });
	const progress = (siteId: string, message: string) => LocalMain.sendIPCEvent('pressable-connect-progress', siteId, message);
	const localStartupCleanup = cleanupLocalTempDirectories()
		.catch((error) => logger.warn('Could not complete Pressable Connect local startup cleanup.', error));
	let remoteStartupCleanup: Promise<void> | null = null;
	const cleanupSavedRemoteTempFiles = (settings: Settings): Promise<void> => {
		if (remoteStartupCleanup) {
			return remoteStartupCleanup;
		}
		remoteStartupCleanup = (async () => {
			for (const [siteId, mapping] of Object.entries(settings.mappings || {})) {
				try {
					await sshExec(mapping, remoteTempCleanupCommand(siteId));
				} catch (error) {
					logger.warn(`Could not clean stale Pressable Connect files for Local site ${siteId}.`, error);
				}
			}
		})();
		return remoteStartupCleanup;
	};

	LocalMain.addIpcAsyncListener('pressable-connect-settings', async () => {
		await localStartupCleanup;
		const settings = load();
		cleanupSavedRemoteTempFiles(settings).catch((error) => logger.warn('Could not complete Pressable Connect remote startup cleanup.', error));
		return { clientId: settings.credentials?.clientId || '', hasClientSecret: Boolean(settings.credentials?.clientSecret) };
	});
	LocalMain.addIpcAsyncListener('pressable-connect-save-credentials', async (credentials: Credentials) => {
		await accessToken(credentials);
		const settings = load(); settings.credentials = credentials; save(settings); return true;
	});
	LocalMain.addIpcAsyncListener('pressable-connect-sites', async () => {
		const credentials = load().credentials;
		if (!credentials) {
			throw new Error('Add your Pressable API credentials first.');
		}
		return (await api(credentials, '/sites')).data;
	});
	LocalMain.addIpcAsyncListener('pressable-connect-mapping', async (siteId: string) => load().mappings?.[siteId] || null);
	LocalMain.addIpcAsyncListener('pressable-connect-save-mapping', async (siteId: string, mapping: Mapping) => {
		const settings = load(); settings.mappings = settings.mappings || {}; settings.mappings[siteId] = mapping; save(settings); return true;
	});
	LocalMain.addIpcAsyncListener('pressable-connect-sftp-users', async (remoteSiteId: number) => {
		const credentials = load().credentials;
		if (!credentials) {
			throw new Error('Add your Pressable API credentials first.');
		}
		return (await api(credentials, `/sites/${remoteSiteId}/ftp`)).data;
	});

	LocalMain.addIpcAsyncListener('pressable-connect-transfer', async (siteId: string, direction: 'push'|'pull', includeFiles: boolean, includeDatabase: boolean) => {
		await localStartupCleanup;
		await cleanupSavedRemoteTempFiles(load());
		const siteRecord = siteData.getSite(siteId);
		const site = siteRecord ? new Local.Site(siteRecord as Local.SiteJSON) : null;
		const mapping = load().mappings?.[siteId];
		if (!site || !mapping) {
			throw new Error('Connect this Local site to a Pressable site first.');
		}
		if (!includeFiles && !includeDatabase) {
			throw new Error('Choose files, database, or both.');
		}
		const sitePath = expandHomePath(site.path);
		const publicPath = expandHomePath(site.paths?.webRoot || path.join(sitePath, 'app', 'public'));
		const wpContentPath = path.join(publicPath, 'wp-content');
		if (!await fs.pathExists(wpContentPath)) {
			throw new Error(`Could not find this Local site's wp-content directory at ${wpContentPath}.`);
		}
		if (includeDatabase) {
			if (siteProcessManager.getSiteStatus(site) === 'halted') {
				progress(siteId, 'Starting Local site…');
				await siteProcessManager.start(site);
			}
			progress(siteId, 'Waiting for local database…');
			if (!await siteDatabase.waitForDB(site)) {
				throw new Error(`Could not start the database for ${site.name}. Start the site in Local and try again.`);
			}
		}
		const temp = await fs.mkdtemp(path.join(os.tmpdir(), 'pressable-connect-'));
		const stamp = `${siteId}-${Date.now()}`;
		const archive = path.join(temp, `${stamp}.tar.gz`);
		const database = path.join(temp, `${stamp}.sql`);
		const remoteDomain = mapping.remoteUrl.replace(/^https?:\/\//, '').replace(/\/$/, '');
		const sftp = new SftpClient();
		try {
			progress(siteId, `Preparing ${direction}…`);
			await sshExec(mapping, remoteTempCleanupCommand(siteId));
			await sftp.connect({ host: 'sftp.pressable.com', port: 22, username: mapping.sshUsername, password: mapping.sshPassword, readyTimeout: 30000 });
			if (direction === 'push') {
				if (includeFiles) {
					progress(siteId, 'Packing wp-content…');
					const brokenSymlinkExcludes = await findBrokenSymlinkExcludes(wpContentPath);
					const excludeArgs = [...PRESSABLE_FILE_EXCLUDES, ...brokenSymlinkExcludes].map((exclude) => `--exclude=${exclude}`);
					await execFileAsync('tar', ['--no-xattrs', '-czf', archive, '-C', publicPath, ...excludeArgs, 'wp-content'], {
						env: { ...process.env, COPYFILE_DISABLE: '1' },
					});
					progress(siteId, 'Uploading wp-content…'); await sftp.fastPut(archive, `/tmp/${stamp}.tar.gz`);
				}
				if (includeDatabase) {
					progress(siteId, 'Exporting local database…'); await siteDatabase.dump(site, database);
					progress(siteId, 'Uploading database…'); await sftp.fastPut(database, `/tmp/${stamp}.sql`);
				}
				await sftp.end();
				progress(siteId, 'Installing on Pressable…');
				const commands: string[] = ['cd /htdocs'];
				if (includeFiles) {
					commands.push(remoteExtractCommand(stamp));
				}
				if (includeDatabase) {
					commands.push(`wp db import ${quote(`/tmp/${stamp}.sql`)}`, `wp search-replace ${quote(site.domain)} ${quote(remoteDomain)} --all-tables --skip-columns=guid`);
				}
				commands.push('wp cache flush');
				const cleanup = `rm -f ${quote(`/tmp/${stamp}.tar.gz`)} ${quote(`/tmp/${stamp}.sql`)}`;
				await sshExec(mapping, `${commands.join(' && ')}; status=$?; ${cleanup}; exit $status`);
			} else {
				progress(siteId, 'Preparing archive on Pressable…');
				const commands: string[] = ['cd /htdocs'];
				if (includeFiles) {
					commands.push(`tar -czf ${quote(`/tmp/${stamp}.tar.gz`)} wp-content`);
				}
				if (includeDatabase) {
					commands.push(`wp db export ${quote(`/tmp/${stamp}.sql`)} --add-drop-table`);
				}
				await sshExec(mapping, commands.join(' && '));
				if (includeFiles) {
					progress(siteId, 'Downloading wp-content…'); await sftp.fastGet(`/tmp/${stamp}.tar.gz`, archive);
				}
				if (includeDatabase) {
					progress(siteId, 'Downloading database…'); await sftp.fastGet(`/tmp/${stamp}.sql`, database);
				}
				await sftp.end();
				if (includeFiles) {
					progress(siteId, 'Installing wp-content locally…'); await execFileAsync('tar', ['-xzf', archive, '-C', publicPath]);
				}
				if (includeDatabase) {
					progress(siteId, 'Importing local database…'); await importSQLFile(site, database);
					await wpCli.run(site, ['search-replace', remoteDomain, site.domain, '--all-tables', '--skip-columns=guid']);
				}
				await sshExec(mapping, `rm -f ${quote(`/tmp/${stamp}.tar.gz`)} ${quote(`/tmp/${stamp}.sql`)}`);
			}
			progress(siteId, `${direction === 'push' ? 'Push' : 'Pull'} complete.`);
			logger.info(`${direction} completed for Local site ${siteId} and Pressable site ${mapping.remoteSiteId}.`);
			return true;
		} finally {
			try {
				await sftp.end();
			} catch (_) { /* already closed */ }
			try {
				await sshExec(mapping, remoteTempCleanupCommand(siteId));
			} catch (error) {
				logger.warn(`Could not clean remote Pressable Connect files for Local site ${siteId}.`, error);
			}
			if (site.mysql?.database) {
				await fs.remove(path.join(site.paths.sql, `${site.mysql.database}.sql.tmp`));
			}
			await fs.remove(temp);
		}
	});
}
