"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || function (mod) {
    if (mod && mod.__esModule) return mod;
    var result = {};
    if (mod != null) for (var k in mod) if (k !== "default" && Object.prototype.hasOwnProperty.call(mod, k)) __createBinding(result, mod, k);
    __setModuleDefault(result, mod);
    return result;
};
var __awaiter = (this && this.__awaiter) || function (thisArg, _arguments, P, generator) {
    function adopt(value) { return value instanceof P ? value : new P(function (resolve) { resolve(value); }); }
    return new (P || (P = Promise))(function (resolve, reject) {
        function fulfilled(value) { try { step(generator.next(value)); } catch (e) { reject(e); } }
        function rejected(value) { try { step(generator["throw"](value)); } catch (e) { reject(e); } }
        function step(result) { result.done ? resolve(result.value) : adopt(result.value).then(fulfilled, rejected); }
        step((generator = generator.apply(thisArg, _arguments || [])).next());
    });
};
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const Local = __importStar(require("@getflywheel/local"));
const LocalMain = __importStar(require("@getflywheel/local/main"));
const child_process_1 = require("child_process");
const util_1 = require("util");
const fs = __importStar(require("fs-extra"));
const https = __importStar(require("https"));
const os = __importStar(require("os"));
const path = __importStar(require("path"));
const ssh2_1 = require("ssh2");
const ssh2_sftp_client_1 = __importDefault(require("ssh2-sftp-client"));
const execFileAsync = (0, util_1.promisify)(child_process_1.execFile);
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
function requestJson(urlString, options, body) {
    return new Promise((resolve, reject) => {
        const req = https.request(urlString, options, (res) => {
            let raw = '';
            res.setEncoding('utf8');
            res.on('data', (chunk) => raw += chunk);
            res.on('end', () => {
                var _a;
                let parsed = {};
                try {
                    parsed = raw ? JSON.parse(raw) : null;
                }
                catch (_) { /* handled below */ }
                if ((res.statusCode || 500) >= 400) {
                    reject(new Error(((_a = parsed === null || parsed === void 0 ? void 0 : parsed.errors) === null || _a === void 0 ? void 0 : _a.join(', ')) || (parsed === null || parsed === void 0 ? void 0 : parsed.message) || `Pressable returned HTTP ${res.statusCode}`));
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
function accessToken(credentials) {
    return __awaiter(this, void 0, void 0, function* () {
        const body = new URLSearchParams({ grant_type: 'client_credentials', client_id: credentials.clientId, client_secret: credentials.clientSecret }).toString();
        const response = yield requestJson(AUTH_URL, { method: 'POST', headers: { 'Content-Type': 'application/x-www-form-urlencoded', 'Content-Length': Buffer.byteLength(body) } }, body);
        if (!(response === null || response === void 0 ? void 0 : response.access_token)) {
            throw new Error('Pressable did not return an access token.');
        }
        return response.access_token;
    });
}
function api(credentials, endpoint) {
    return __awaiter(this, void 0, void 0, function* () {
        const token = yield accessToken(credentials);
        return requestJson(`${API_ROOT}${endpoint}`, { method: 'GET', headers: { Authorization: `Bearer ${token}`, Accept: 'application/json' } });
    });
}
function sshExec(mapping, command) {
    return new Promise((resolve, reject) => {
        const client = new ssh2_1.Client();
        let output = '';
        client.on('ready', () => client.exec(command, (error, stream) => {
            if (error) {
                client.end();
                reject(error);
                return;
            }
            stream.on('data', (data) => output += data.toString());
            stream.stderr.on('data', (data) => output += data.toString());
            stream.on('close', (code) => {
                client.end();
                code === 0 ? resolve(output) : reject(new Error(output || `Remote command failed with exit code ${code}.`));
            });
        })).on('error', reject).connect({ host: 'ssh.pressable.com', port: 22, username: mapping.sshUsername, password: mapping.sshPassword, readyTimeout: 30000 });
    });
}
function quote(value) {
    return `'${value.replace(/'/g, `'\\''`)}'`;
}
function remoteTempCleanupCommand(siteId) {
    return `find /tmp -maxdepth 1 -type f \\( -name ${quote(`${siteId}-*.tar.gz`)} -o -name ${quote(`${siteId}-*.sql`)} -o -name ${quote(`${siteId}-*.tar.log`)} \\) -delete`;
}
function remoteExtractCommand(stamp) {
    const archive = `/tmp/${stamp}.tar.gz`;
    const log = `/tmp/${stamp}.tar.log`;
    const allowedErrors = '^(tar: wp-content(/(plugins|themes))?: Cannot change mode to [rwxStTs-]+: Operation not permitted|tar: Exiting with failure status due to previous errors)$';
    return `{ tar --extract --gzip --file=${quote(archive)} --directory=/htdocs --no-overwrite-dir --no-same-owner --no-same-permissions --warning=no-unknown-keyword 2>${quote(log)}; tar_status=$?; if [ "$tar_status" -eq 0 ]; then rm -f ${quote(log)}; true; elif [ -s ${quote(log)} ] && ! grep -Evq ${quote(allowedErrors)} ${quote(log)}; then rm -f ${quote(log)}; true; else cat ${quote(log)} >&2; rm -f ${quote(log)}; false; fi; }`;
}
function cleanupLocalTempDirectories() {
    return __awaiter(this, void 0, void 0, function* () {
        const tempRoot = os.tmpdir();
        for (const name of yield fs.readdir(tempRoot)) {
            if (name.startsWith('pressable-connect-')) {
                yield fs.remove(path.join(tempRoot, name));
            }
        }
    });
}
function expandHomePath(value) {
    if (value === '~') {
        return os.homedir();
    }
    if (value.startsWith('~/') || value.startsWith('~\\')) {
        return path.join(os.homedir(), value.slice(2));
    }
    return value;
}
function findBrokenSymlinkExcludes(wpContentPath) {
    return __awaiter(this, void 0, void 0, function* () {
        const excludes = [];
        for (const directory of ['plugins', 'mu-plugins', 'themes']) {
            const directoryPath = path.join(wpContentPath, directory);
            if (!(yield fs.pathExists(directoryPath))) {
                continue;
            }
            for (const name of yield fs.readdir(directoryPath)) {
                const itemPath = path.join(directoryPath, name);
                try {
                    if ((yield fs.lstat(itemPath)).isSymbolicLink() && !(yield fs.pathExists(itemPath))) {
                        excludes.push(`wp-content/${directory}/${name}`);
                    }
                }
                catch (_) { /* item disappeared while preparing the archive */ }
            }
        }
        return excludes;
    });
}
function default_1() {
    const { siteData, siteDatabase, importSQLFile, siteProcessManager, wpCli, localLogger } = LocalMain.getServiceContainer().cradle;
    const logger = localLogger.child({ thread: 'main', addon: 'pressable-connect' });
    const load = () => LocalMain.UserData.get({ name: SETTINGS_KEY, defaults: { mappings: {} }, persistDefaults: true, persistDefaultsEncrypted: true });
    const save = (settings) => LocalMain.UserData.set({ name: SETTINGS_KEY, data: settings, encrypted: true });
    const progress = (siteId, message) => LocalMain.sendIPCEvent('pressable-connect-progress', siteId, message);
    const localStartupCleanup = cleanupLocalTempDirectories()
        .catch((error) => logger.warn('Could not complete Pressable Connect local startup cleanup.', error));
    let remoteStartupCleanup = null;
    const cleanupSavedRemoteTempFiles = (settings) => {
        if (remoteStartupCleanup) {
            return remoteStartupCleanup;
        }
        remoteStartupCleanup = (() => __awaiter(this, void 0, void 0, function* () {
            for (const [siteId, mapping] of Object.entries(settings.mappings || {})) {
                try {
                    yield sshExec(mapping, remoteTempCleanupCommand(siteId));
                }
                catch (error) {
                    logger.warn(`Could not clean stale Pressable Connect files for Local site ${siteId}.`, error);
                }
            }
        }))();
        return remoteStartupCleanup;
    };
    LocalMain.addIpcAsyncListener('pressable-connect-settings', () => __awaiter(this, void 0, void 0, function* () {
        var _a, _b;
        yield localStartupCleanup;
        const settings = load();
        cleanupSavedRemoteTempFiles(settings).catch((error) => logger.warn('Could not complete Pressable Connect remote startup cleanup.', error));
        return { clientId: ((_a = settings.credentials) === null || _a === void 0 ? void 0 : _a.clientId) || '', hasClientSecret: Boolean((_b = settings.credentials) === null || _b === void 0 ? void 0 : _b.clientSecret) };
    }));
    LocalMain.addIpcAsyncListener('pressable-connect-save-credentials', (credentials) => __awaiter(this, void 0, void 0, function* () {
        yield accessToken(credentials);
        const settings = load();
        settings.credentials = credentials;
        save(settings);
        return true;
    }));
    LocalMain.addIpcAsyncListener('pressable-connect-sites', () => __awaiter(this, void 0, void 0, function* () {
        const credentials = load().credentials;
        if (!credentials) {
            throw new Error('Add your Pressable API credentials first.');
        }
        return (yield api(credentials, '/sites')).data;
    }));
    LocalMain.addIpcAsyncListener('pressable-connect-mapping', (siteId) => __awaiter(this, void 0, void 0, function* () { var _c; return ((_c = load().mappings) === null || _c === void 0 ? void 0 : _c[siteId]) || null; }));
    LocalMain.addIpcAsyncListener('pressable-connect-save-mapping', (siteId, mapping) => __awaiter(this, void 0, void 0, function* () {
        const settings = load();
        settings.mappings = settings.mappings || {};
        settings.mappings[siteId] = mapping;
        save(settings);
        return true;
    }));
    LocalMain.addIpcAsyncListener('pressable-connect-sftp-users', (remoteSiteId) => __awaiter(this, void 0, void 0, function* () {
        const credentials = load().credentials;
        if (!credentials) {
            throw new Error('Add your Pressable API credentials first.');
        }
        return (yield api(credentials, `/sites/${remoteSiteId}/ftp`)).data;
    }));
    LocalMain.addIpcAsyncListener('pressable-connect-transfer', (siteId, direction, includeFiles, includeDatabase) => __awaiter(this, void 0, void 0, function* () {
        var _d, _e, _f;
        yield localStartupCleanup;
        yield cleanupSavedRemoteTempFiles(load());
        const siteRecord = siteData.getSite(siteId);
        const site = siteRecord ? new Local.Site(siteRecord) : null;
        const mapping = (_d = load().mappings) === null || _d === void 0 ? void 0 : _d[siteId];
        if (!site || !mapping) {
            throw new Error('Connect this Local site to a Pressable site first.');
        }
        if (!includeFiles && !includeDatabase) {
            throw new Error('Choose files, database, or both.');
        }
        const sitePath = expandHomePath(site.path);
        const publicPath = expandHomePath(((_e = site.paths) === null || _e === void 0 ? void 0 : _e.webRoot) || path.join(sitePath, 'app', 'public'));
        const wpContentPath = path.join(publicPath, 'wp-content');
        if (!(yield fs.pathExists(wpContentPath))) {
            throw new Error(`Could not find this Local site's wp-content directory at ${wpContentPath}.`);
        }
        if (includeDatabase) {
            if (siteProcessManager.getSiteStatus(site) === 'halted') {
                progress(siteId, 'Starting Local site…');
                yield siteProcessManager.start(site);
            }
            progress(siteId, 'Waiting for local database…');
            if (!(yield siteDatabase.waitForDB(site))) {
                throw new Error(`Could not start the database for ${site.name}. Start the site in Local and try again.`);
            }
        }
        const temp = yield fs.mkdtemp(path.join(os.tmpdir(), 'pressable-connect-'));
        const stamp = `${siteId}-${Date.now()}`;
        const archive = path.join(temp, `${stamp}.tar.gz`);
        const database = path.join(temp, `${stamp}.sql`);
        const remoteDomain = mapping.remoteUrl.replace(/^https?:\/\//, '').replace(/\/$/, '');
        const sftp = new ssh2_sftp_client_1.default();
        try {
            progress(siteId, `Preparing ${direction}…`);
            yield sshExec(mapping, remoteTempCleanupCommand(siteId));
            yield sftp.connect({ host: 'sftp.pressable.com', port: 22, username: mapping.sshUsername, password: mapping.sshPassword, readyTimeout: 30000 });
            if (direction === 'push') {
                if (includeFiles) {
                    progress(siteId, 'Packing wp-content…');
                    const brokenSymlinkExcludes = yield findBrokenSymlinkExcludes(wpContentPath);
                    const excludeArgs = [...PRESSABLE_FILE_EXCLUDES, ...brokenSymlinkExcludes].map((exclude) => `--exclude=${exclude}`);
                    yield execFileAsync('tar', ['--no-xattrs', '-czf', archive, '-C', publicPath, ...excludeArgs, 'wp-content'], {
                        env: Object.assign(Object.assign({}, process.env), { COPYFILE_DISABLE: '1' }),
                    });
                    progress(siteId, 'Uploading wp-content…');
                    yield sftp.fastPut(archive, `/tmp/${stamp}.tar.gz`);
                }
                if (includeDatabase) {
                    progress(siteId, 'Exporting local database…');
                    yield siteDatabase.dump(site, database);
                    progress(siteId, 'Uploading database…');
                    yield sftp.fastPut(database, `/tmp/${stamp}.sql`);
                }
                yield sftp.end();
                progress(siteId, 'Installing on Pressable…');
                const commands = ['cd /htdocs'];
                if (includeFiles) {
                    commands.push(remoteExtractCommand(stamp));
                }
                if (includeDatabase) {
                    commands.push(`wp db import ${quote(`/tmp/${stamp}.sql`)}`, `wp search-replace ${quote(site.domain)} ${quote(remoteDomain)} --all-tables --skip-columns=guid`);
                }
                commands.push('wp cache flush');
                const cleanup = `rm -f ${quote(`/tmp/${stamp}.tar.gz`)} ${quote(`/tmp/${stamp}.sql`)}`;
                yield sshExec(mapping, `${commands.join(' && ')}; status=$?; ${cleanup}; exit $status`);
            }
            else {
                progress(siteId, 'Preparing archive on Pressable…');
                const commands = ['cd /htdocs'];
                if (includeFiles) {
                    commands.push(`tar -czf ${quote(`/tmp/${stamp}.tar.gz`)} wp-content`);
                }
                if (includeDatabase) {
                    commands.push(`wp db export ${quote(`/tmp/${stamp}.sql`)} --add-drop-table`);
                }
                yield sshExec(mapping, commands.join(' && '));
                if (includeFiles) {
                    progress(siteId, 'Downloading wp-content…');
                    yield sftp.fastGet(`/tmp/${stamp}.tar.gz`, archive);
                }
                if (includeDatabase) {
                    progress(siteId, 'Downloading database…');
                    yield sftp.fastGet(`/tmp/${stamp}.sql`, database);
                }
                yield sftp.end();
                if (includeFiles) {
                    progress(siteId, 'Installing wp-content locally…');
                    yield execFileAsync('tar', ['-xzf', archive, '-C', publicPath]);
                }
                if (includeDatabase) {
                    progress(siteId, 'Importing local database…');
                    yield importSQLFile(site, database);
                    yield wpCli.run(site, ['search-replace', remoteDomain, site.domain, '--all-tables', '--skip-columns=guid']);
                }
                yield sshExec(mapping, `rm -f ${quote(`/tmp/${stamp}.tar.gz`)} ${quote(`/tmp/${stamp}.sql`)}`);
            }
            progress(siteId, `${direction === 'push' ? 'Push' : 'Pull'} complete.`);
            logger.info(`${direction} completed for Local site ${siteId} and Pressable site ${mapping.remoteSiteId}.`);
            return true;
        }
        finally {
            try {
                yield sftp.end();
            }
            catch (_) { /* already closed */ }
            try {
                yield sshExec(mapping, remoteTempCleanupCommand(siteId));
            }
            catch (error) {
                logger.warn(`Could not clean remote Pressable Connect files for Local site ${siteId}.`, error);
            }
            if ((_f = site.mysql) === null || _f === void 0 ? void 0 : _f.database) {
                yield fs.remove(path.join(site.paths.sql, `${site.mysql.database}.sql.tmp`));
            }
            yield fs.remove(temp);
        }
    }));
}
exports.default = default_1;
//# sourceMappingURL=main.js.map