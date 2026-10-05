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
Object.defineProperty(exports, "__esModule", { value: true });
const react_1 = __importStar(require("react"));
const electron_1 = require("electron");
const LocalRenderer = __importStar(require("@getflywheel/local/renderer"));
const colors = {
    accent: '#51bb7b',
    accentDark: '#38945d',
    border: 'rgba(145, 145, 145, 0.34)',
    muted: 'rgba(145, 145, 145, 0.18)',
    panel: 'rgba(145, 145, 145, 0.075)',
};
const pageStyle = { boxSizing: 'border-box', flex: 1, minHeight: '100%', overflowY: 'auto', padding: '28px 34px 64px' };
const introStyle = { margin: '0 0 26px', opacity: 0.72 };
const cardStyle = { borderRadius: 6, boxSizing: 'border-box', marginBottom: 18, maxWidth: 760, padding: '22px 24px 24px' };
const headingStyle = { color: 'inherit', fontSize: 16, fontWeight: 600, margin: '0 0 20px' };
const fieldStyle = { background: colors.muted, border: `1px solid ${colors.border}`, borderRadius: 4, boxSizing: 'border-box', color: 'inherit', colorScheme: 'light dark', display: 'block', font: 'inherit', margin: '7px 0 16px', maxWidth: 590, minHeight: 38, padding: '8px 10px', width: '100%' };
const labelStyle = { color: 'inherit', display: 'block', fontSize: 13, fontWeight: 600 };
const checkboxLabelStyle = { alignItems: 'center', color: 'inherit', display: 'inline-flex', fontSize: 13, gap: 7, marginRight: 22 };
const buttonStyle = { background: colors.accent, border: `1px solid ${colors.accentDark}`, borderRadius: 4, color: '#10291c', cursor: 'pointer', fontSize: 13, fontWeight: 700, lineHeight: 1.2, padding: '9px 15px' };
const buttonDisabledStyle = Object.assign(Object.assign({}, buttonStyle), { cursor: 'not-allowed', filter: 'grayscale(35%)', opacity: 0.48 });
function readableError(error) {
    const message = (error === null || error === void 0 ? void 0 : error.message) || String(error);
    if (/all configured authentication methods failed|permission denied \(publickey,password\)|authentication failed/i.test(message)) {
        return 'Pressable rejected this SSH/SFTP login. In Pressable, open the selected site’s Collaborators → SFTP | SSH details, then re-enter that user’s SSH/SFTP password here and save the connection. Your Pressable API or WordPress password will not work. If you just reset the SSH/SFTP password, wait a few minutes before retrying.';
    }
    return message.replace(/^The ipcAsync call to channel '[^']+' was rejected with the main thread error:\s*/i, '')
        .replace(/\s*Check out the error props \{channel, channelArgs, messageMain, stackMain\} for more details\.?\s*$/i, '')
        .trim();
}
class PressableConnect extends react_1.Component {
    constructor() {
        super(...arguments);
        this.state = { clientId: '', clientSecret: '', sites: [], selectedId: '', remoteUrl: '', users: [], sshUsername: '', sshPassword: '', includeFiles: true, includeDatabase: true, busy: false, status: '', error: '' };
        this.onProgress = (_event, siteId, status) => { if (siteId === this.props.site.id)
            this.setState({ status }); };
        this.fail = (error) => this.setState({ error: readableError(error), busy: false });
        this.set = (name) => (event) => this.setState({ [name]: event.target.type === 'checkbox' ? event.target.checked : event.target.value, error: '' });
        this.chooseSshUser = (event) => this.setState({ sshUsername: event.target.value, sshPassword: '', error: '' });
        this.saveCredentials = () => __awaiter(this, void 0, void 0, function* () {
            this.setState({ busy: true, status: 'Connecting to Pressable…', error: '' });
            try {
                yield LocalRenderer.ipcAsync('pressable-connect-save-credentials', { clientId: this.state.clientId.trim(), clientSecret: this.state.clientSecret.trim() });
                yield this.loadSites();
                this.setState({ busy: false, status: 'Pressable API connected.', clientSecret: '' });
            }
            catch (error) {
                this.fail(error);
            }
        });
        this.loadSites = () => __awaiter(this, void 0, void 0, function* () {
            const sites = yield LocalRenderer.ipcAsync('pressable-connect-sites');
            const sortedSites = Array.isArray(sites) ? [...sites].sort((first, second) => {
                const firstLabel = String(first.displayName || first.url || '');
                const secondLabel = String(second.displayName || second.url || '');
                return firstLabel.localeCompare(secondLabel, undefined, { numeric: true, sensitivity: 'base' });
            }) : [];
            this.setState({ sites: sortedSites });
        });
        this.chooseSite = (event) => __awaiter(this, void 0, void 0, function* () {
            var _a, _b;
            const selectedId = event.target.value;
            const site = this.state.sites.find((item) => String(item.id) === String(selectedId));
            this.setState({ selectedId, remoteUrl: (site === null || site === void 0 ? void 0 : site.url) || '', users: [], sshUsername: '', sshPassword: '', error: '' });
            if (selectedId) {
                try {
                    const users = yield LocalRenderer.ipcAsync('pressable-connect-sftp-users', Number(selectedId));
                    this.setState({ users, sshUsername: ((_a = users.find((user) => user.owner)) === null || _a === void 0 ? void 0 : _a.username) || ((_b = users[0]) === null || _b === void 0 ? void 0 : _b.username) || '' });
                }
                catch (error) {
                    this.fail(error);
                }
            }
        });
        this.saveMapping = () => __awaiter(this, void 0, void 0, function* () {
            this.setState({ busy: true, error: '' });
            try {
                yield LocalRenderer.ipcAsync('pressable-connect-save-mapping', this.props.site.id, { remoteSiteId: Number(this.state.selectedId), remoteUrl: this.state.remoteUrl, sshUsername: this.state.sshUsername, sshPassword: this.state.sshPassword });
                this.setState({ busy: false, status: 'Site connection saved securely.' });
            }
            catch (error) {
                this.fail(error);
            }
        });
        this.transfer = (direction) => __awaiter(this, void 0, void 0, function* () {
            var _c;
            const action = direction === 'push' ? `overwrite the selected data on ${this.state.remoteUrl}` : `overwrite the selected local data for ${((_c = this.props.site) === null || _c === void 0 ? void 0 : _c.name) || 'this site'}`;
            if (!window.confirm(`This will ${action}. Continue?`))
                return;
            this.setState({ busy: true, error: '', status: `Starting ${direction}…` });
            try {
                yield LocalRenderer.ipcAsync('pressable-connect-transfer', this.props.site.id, direction, this.state.includeFiles, this.state.includeDatabase);
                this.setState({ busy: false });
            }
            catch (error) {
                this.fail(error);
            }
        });
    }
    componentDidMount() {
        return __awaiter(this, void 0, void 0, function* () {
            electron_1.ipcRenderer.on('pressable-connect-progress', this.onProgress);
            try {
                if (!this.props.site || !this.props.site.id)
                    throw new Error('Local did not provide an active site to Pressable Connect.');
                const settings = yield LocalRenderer.ipcAsync('pressable-connect-settings');
                const mapping = yield LocalRenderer.ipcAsync('pressable-connect-mapping', this.props.site.id);
                this.setState({ clientId: (settings === null || settings === void 0 ? void 0 : settings.clientId) || '', selectedId: (mapping === null || mapping === void 0 ? void 0 : mapping.remoteSiteId) ? String(mapping.remoteSiteId) : '', remoteUrl: (mapping === null || mapping === void 0 ? void 0 : mapping.remoteUrl) || '', sshUsername: (mapping === null || mapping === void 0 ? void 0 : mapping.sshUsername) || '', sshPassword: (mapping === null || mapping === void 0 ? void 0 : mapping.sshPassword) || '' });
                if (settings === null || settings === void 0 ? void 0 : settings.hasClientSecret)
                    yield this.loadSites();
            }
            catch (error) {
                this.fail(error);
            }
        });
    }
    componentWillUnmount() { electron_1.ipcRenderer.removeListener('pressable-connect-progress', this.onProgress); }
    render() {
        var _a;
        const connected = this.state.selectedId && this.state.sshUsername && this.state.sshPassword;
        const siteName = ((_a = this.props.site) === null || _a === void 0 ? void 0 : _a.name) || 'this Local site';
        const darkMode = window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches;
        const theme = darkMode ? {
            canvas: '#222222',
            panel: '#2a2a2a',
            field: '#202020',
            border: '#484848',
            text: '#f2f2f2',
            mutedText: '#b8b8b8',
        } : {
            canvas: '#f7f7f7',
            panel: '#ffffff',
            field: '#ffffff',
            border: '#d4d4d4',
            text: '#292929',
            mutedText: '#656565',
        };
        const themedPageStyle = Object.assign(Object.assign({}, pageStyle), { background: theme.canvas, color: theme.text });
        const themedCardStyle = Object.assign(Object.assign({}, cardStyle), { background: theme.panel, border: `1px solid ${theme.border}` });
        const themedFieldStyle = Object.assign(Object.assign({}, fieldStyle), { background: theme.field, border: `1px solid ${theme.border}`, color: theme.text });
        const apiDisabled = this.state.busy || !this.state.clientId || !this.state.clientSecret;
        const mappingDisabled = this.state.busy || !this.state.selectedId || !this.state.sshUsername || !this.state.sshPassword;
        const transferDisabled = this.state.busy || !connected;
        return react_1.default.createElement("div", { style: themedPageStyle, "aria-busy": this.state.busy },
            react_1.default.createElement("h1", { style: { color: 'inherit', fontSize: 24, margin: '0 0 8px' } }, "Pressable Connect"),
            react_1.default.createElement("p", { style: Object.assign(Object.assign({}, introStyle), { color: theme.mutedText }) },
                "Push or pull ",
                react_1.default.createElement("strong", { style: { color: theme.text } }, siteName),
                " using Pressable's API and SSH/SFTP."),
            react_1.default.createElement("div", { style: themedCardStyle },
                react_1.default.createElement("h3", { style: headingStyle }, "1. Pressable API"),
                react_1.default.createElement("label", { style: labelStyle },
                    "Client ID",
                    react_1.default.createElement("input", { style: themedFieldStyle, value: this.state.clientId, onChange: this.set('clientId') })),
                react_1.default.createElement("label", { style: labelStyle },
                    "Client secret",
                    react_1.default.createElement("input", { style: themedFieldStyle, type: "password", value: this.state.clientSecret, onChange: this.set('clientSecret'), placeholder: "Enter to connect or replace saved secret" })),
                react_1.default.createElement("button", { type: "button", style: apiDisabled ? buttonDisabledStyle : buttonStyle, disabled: apiDisabled, onClick: this.saveCredentials }, "Connect API")),
            react_1.default.createElement("div", { style: themedCardStyle },
                react_1.default.createElement("h3", { style: headingStyle }, "2. Map this Local site"),
                react_1.default.createElement("label", { style: labelStyle },
                    "Pressable site",
                    react_1.default.createElement("select", { style: themedFieldStyle, value: this.state.selectedId, onChange: this.chooseSite },
                        react_1.default.createElement("option", { value: "" }, "Choose a site\u2026"),
                        this.state.sites.map((site) => react_1.default.createElement("option", { key: site.id, value: site.id },
                            site.displayName,
                            " \u2014 ",
                            site.url)))),
                react_1.default.createElement("label", { style: labelStyle },
                    "SSH/SFTP user",
                    react_1.default.createElement("select", { style: themedFieldStyle, value: this.state.sshUsername, onChange: this.chooseSshUser },
                        react_1.default.createElement("option", { value: "" }, "Choose a user\u2026"),
                        this.state.users.map((user) => react_1.default.createElement("option", { key: user.username, value: user.username },
                            user.email,
                            " (",
                            user.username,
                            ")")),
                        this.state.sshUsername && !this.state.users.some((user) => user.username === this.state.sshUsername) && react_1.default.createElement("option", { value: this.state.sshUsername }, this.state.sshUsername))),
                react_1.default.createElement("label", { style: labelStyle },
                    "SSH/SFTP password",
                    react_1.default.createElement("input", { style: themedFieldStyle, type: "password", value: this.state.sshPassword, onChange: this.set('sshPassword') })),
                react_1.default.createElement("button", { type: "button", style: mappingDisabled ? buttonDisabledStyle : buttonStyle, disabled: mappingDisabled, onClick: this.saveMapping }, "Save Connection")),
            react_1.default.createElement("div", { style: themedCardStyle },
                react_1.default.createElement("h3", { style: headingStyle }, "3. Push or pull"),
                react_1.default.createElement("label", { style: checkboxLabelStyle },
                    react_1.default.createElement("input", { style: { accentColor: colors.accent }, type: "checkbox", checked: this.state.includeFiles, onChange: this.set('includeFiles') }),
                    " wp-content files"),
                react_1.default.createElement("label", { style: checkboxLabelStyle },
                    react_1.default.createElement("input", { style: { accentColor: colors.accent }, type: "checkbox", checked: this.state.includeDatabase, onChange: this.set('includeDatabase') }),
                    " database"),
                react_1.default.createElement("div", { style: { display: 'flex', gap: 8, marginTop: 20 } },
                    react_1.default.createElement("button", { type: "button", style: transferDisabled ? buttonDisabledStyle : buttonStyle, disabled: transferDisabled, onClick: () => this.transfer('pull') }, "Pull from Pressable"),
                    react_1.default.createElement("button", { type: "button", style: transferDisabled ? buttonDisabledStyle : buttonStyle, disabled: transferDisabled, onClick: () => this.transfer('push') }, "Push to Pressable"))),
            this.state.status && react_1.default.createElement("p", { role: "status", style: { background: 'rgba(81, 187, 123, 0.12)', border: '1px solid rgba(81, 187, 123, 0.35)', borderRadius: 4, color: 'inherit', maxWidth: 710, padding: '10px 12px' } }, this.state.status),
            this.state.error && react_1.default.createElement("p", { role: "alert", style: { background: 'rgba(220, 70, 70, 0.12)', border: '1px solid rgba(220, 70, 70, 0.42)', borderRadius: 4, color: 'inherit', maxWidth: 710, padding: '10px 12px', whiteSpace: 'pre-wrap' } }, this.state.error));
    }
}
exports.default = PressableConnect;
//# sourceMappingURL=PressableConnect.js.map