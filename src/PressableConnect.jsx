import React, {Component} from 'react';
import {ipcRenderer} from 'electron';
import * as LocalRenderer from '@getflywheel/local/renderer';

const colors = {
  accent: '#51bb7b',
  accentDark: '#38945d',
  border: 'rgba(145, 145, 145, 0.34)',
  muted: 'rgba(145, 145, 145, 0.18)',
  panel: 'rgba(145, 145, 145, 0.075)',
};
const pageStyle = {boxSizing: 'border-box', flex: 1, minHeight: '100%', overflowY: 'auto', padding: '28px 34px 64px'};
const introStyle = {margin: '0 0 26px', opacity: 0.72};
const cardStyle = {borderRadius: 6, boxSizing: 'border-box', marginBottom: 18, maxWidth: 760, padding: '22px 24px 24px'};
const headingStyle = {color: 'inherit', fontSize: 16, fontWeight: 600, margin: '0 0 20px'};
const fieldStyle = {background: colors.muted, border: `1px solid ${colors.border}`, borderRadius: 4, boxSizing: 'border-box', color: 'inherit', colorScheme: 'light dark', display: 'block', font: 'inherit', margin: '7px 0 16px', maxWidth: 590, minHeight: 38, padding: '8px 10px', width: '100%'};
const labelStyle = {color: 'inherit', display: 'block', fontSize: 13, fontWeight: 600};
const checkboxLabelStyle = {alignItems: 'center', color: 'inherit', display: 'inline-flex', fontSize: 13, gap: 7, marginRight: 22};
const buttonStyle = {background: colors.accent, border: `1px solid ${colors.accentDark}`, borderRadius: 4, color: '#10291c', cursor: 'pointer', fontSize: 13, fontWeight: 700, lineHeight: 1.2, padding: '9px 15px'};
const buttonDisabledStyle = {...buttonStyle, cursor: 'not-allowed', filter: 'grayscale(35%)', opacity: 0.48};

function readableError(error) {
  const message = error?.message || String(error);
  if (/all configured authentication methods failed|permission denied \(publickey,password\)|authentication failed/i.test(message)) {
    return 'Pressable rejected this SSH/SFTP login. In Pressable, open the selected site’s Collaborators → SFTP | SSH details, then re-enter that user’s SSH/SFTP password here and save the connection. Your Pressable API or WordPress password will not work. If you just reset the SSH/SFTP password, wait a few minutes before retrying.';
  }
  return message.replace(/^The ipcAsync call to channel '[^']+' was rejected with the main thread error:\s*/i, '')
    .replace(/\s*Check out the error props \{channel, channelArgs, messageMain, stackMain\} for more details\.?\s*$/i, '')
    .trim();
}

export default class PressableConnect extends Component {
  state = {clientId: '', clientSecret: '', sites: [], selectedId: '', remoteUrl: '', users: [], sshUsername: '', sshPassword: '', includeFiles: true, includeDatabase: true, busy: false, status: '', error: ''};

  async componentDidMount() {
    ipcRenderer.on('pressable-connect-progress', this.onProgress);
    try {
      if (!this.props.site || !this.props.site.id) throw new Error('Local did not provide an active site to Pressable Connect.');
      const settings = await LocalRenderer.ipcAsync('pressable-connect-settings');
      const mapping = await LocalRenderer.ipcAsync('pressable-connect-mapping', this.props.site.id);
      this.setState({clientId: settings?.clientId || '', selectedId: mapping?.remoteSiteId ? String(mapping.remoteSiteId) : '', remoteUrl: mapping?.remoteUrl || '', sshUsername: mapping?.sshUsername || '', sshPassword: mapping?.sshPassword || ''});
      if (settings?.hasClientSecret) await this.loadSites();
    } catch (error) { this.fail(error); }
  }
  componentWillUnmount() { ipcRenderer.removeListener('pressable-connect-progress', this.onProgress); }
  onProgress = (_event, siteId, status) => { if (siteId === this.props.site.id) this.setState({status}); };
  fail = (error) => this.setState({error: readableError(error), busy: false});
  set = (name) => (event) => this.setState({[name]: event.target.type === 'checkbox' ? event.target.checked : event.target.value, error: ''});
  chooseSshUser = (event) => this.setState({sshUsername: event.target.value, sshPassword: '', error: ''});

  saveCredentials = async () => {
    this.setState({busy: true, status: 'Connecting to Pressable…', error: ''});
    try {
      await LocalRenderer.ipcAsync('pressable-connect-save-credentials', {clientId: this.state.clientId.trim(), clientSecret: this.state.clientSecret.trim()});
      await this.loadSites(); this.setState({busy: false, status: 'Pressable API connected.', clientSecret: ''});
    } catch (error) { this.fail(error); }
  };
  loadSites = async () => {
    const sites = await LocalRenderer.ipcAsync('pressable-connect-sites');
    const sortedSites = Array.isArray(sites) ? [...sites].sort((first, second) => {
      const firstLabel = String(first.displayName || first.url || '');
      const secondLabel = String(second.displayName || second.url || '');
      return firstLabel.localeCompare(secondLabel, undefined, {numeric: true, sensitivity: 'base'});
    }) : [];
    this.setState({sites: sortedSites});
  };
  chooseSite = async (event) => {
    const selectedId = event.target.value;
    const site = this.state.sites.find((item) => String(item.id) === String(selectedId));
    this.setState({selectedId, remoteUrl: site?.url || '', users: [], sshUsername: '', sshPassword: '', error: ''});
    if (selectedId) {
      try {
        const users = await LocalRenderer.ipcAsync('pressable-connect-sftp-users', Number(selectedId));
        this.setState({users, sshUsername: users.find((user) => user.owner)?.username || users[0]?.username || ''});
      } catch (error) { this.fail(error); }
    }
  };
  saveMapping = async () => {
    this.setState({busy: true, error: ''});
    try {
      await LocalRenderer.ipcAsync('pressable-connect-save-mapping', this.props.site.id, {remoteSiteId: Number(this.state.selectedId), remoteUrl: this.state.remoteUrl, sshUsername: this.state.sshUsername, sshPassword: this.state.sshPassword});
      this.setState({busy: false, status: 'Site connection saved securely.'});
    } catch (error) { this.fail(error); }
  };
  transfer = async (direction) => {
    const action = direction === 'push' ? `overwrite the selected data on ${this.state.remoteUrl}` : `overwrite the selected local data for ${this.props.site?.name || 'this site'}`;
    if (!window.confirm(`This will ${action}. Continue?`)) return;
    this.setState({busy: true, error: '', status: `Starting ${direction}…`});
    try {
      await LocalRenderer.ipcAsync('pressable-connect-transfer', this.props.site.id, direction, this.state.includeFiles, this.state.includeDatabase);
      this.setState({busy: false});
    } catch (error) { this.fail(error); }
  };

  render() {
    const connected = this.state.selectedId && this.state.sshUsername && this.state.sshPassword;
    const siteName = this.props.site?.name || 'this Local site';
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
    const themedPageStyle = {...pageStyle, background: theme.canvas, color: theme.text};
    const themedCardStyle = {...cardStyle, background: theme.panel, border: `1px solid ${theme.border}`};
    const themedFieldStyle = {...fieldStyle, background: theme.field, border: `1px solid ${theme.border}`, color: theme.text};
    const apiDisabled = this.state.busy || !this.state.clientId || !this.state.clientSecret;
    const mappingDisabled = this.state.busy || !this.state.selectedId || !this.state.sshUsername || !this.state.sshPassword;
    const transferDisabled = this.state.busy || !connected;
    return <div style={themedPageStyle} aria-busy={this.state.busy}>
      <h1 style={{color: 'inherit', fontSize: 24, margin: '0 0 8px'}}>Pressable Connect</h1>
      <p style={{...introStyle, color: theme.mutedText}}>Push or pull <strong style={{color: theme.text}}>{siteName}</strong> using Pressable's API and SSH/SFTP.</p>
      <div style={themedCardStyle}>
        <h3 style={headingStyle}>1. Pressable API</h3>
        <label style={labelStyle}>Client ID<input style={themedFieldStyle} value={this.state.clientId} onChange={this.set('clientId')} /></label>
        <label style={labelStyle}>Client secret<input style={themedFieldStyle} type="password" value={this.state.clientSecret} onChange={this.set('clientSecret')} placeholder="Enter to connect or replace saved secret" /></label>
        <button type="button" style={apiDisabled ? buttonDisabledStyle : buttonStyle} disabled={apiDisabled} onClick={this.saveCredentials}>Connect API</button>
      </div>
      <div style={themedCardStyle}>
        <h3 style={headingStyle}>2. Map this Local site</h3>
        <label style={labelStyle}>Pressable site<select style={themedFieldStyle} value={this.state.selectedId} onChange={this.chooseSite}><option value="">Choose a site…</option>{this.state.sites.map((site) => <option key={site.id} value={site.id}>{site.displayName} — {site.url}</option>)}</select></label>
        <label style={labelStyle}>SSH/SFTP user<select style={themedFieldStyle} value={this.state.sshUsername} onChange={this.chooseSshUser}><option value="">Choose a user…</option>{this.state.users.map((user) => <option key={user.username} value={user.username}>{user.email} ({user.username})</option>)}{this.state.sshUsername && !this.state.users.some((user) => user.username === this.state.sshUsername) && <option value={this.state.sshUsername}>{this.state.sshUsername}</option>}</select></label>
        <label style={labelStyle}>SSH/SFTP password<input style={themedFieldStyle} type="password" value={this.state.sshPassword} onChange={this.set('sshPassword')} /></label>
        <button type="button" style={mappingDisabled ? buttonDisabledStyle : buttonStyle} disabled={mappingDisabled} onClick={this.saveMapping}>Save Connection</button>
      </div>
      <div style={themedCardStyle}>
        <h3 style={headingStyle}>3. Push or pull</h3>
        <label style={checkboxLabelStyle}><input style={{accentColor: colors.accent}} type="checkbox" checked={this.state.includeFiles} onChange={this.set('includeFiles')} /> wp-content files</label>
        <label style={checkboxLabelStyle}><input style={{accentColor: colors.accent}} type="checkbox" checked={this.state.includeDatabase} onChange={this.set('includeDatabase')} /> database</label>
        <div style={{display: 'flex', gap: 8, marginTop: 20}}><button type="button" style={transferDisabled ? buttonDisabledStyle : buttonStyle} disabled={transferDisabled} onClick={() => this.transfer('pull')}>Pull from Pressable</button><button type="button" style={transferDisabled ? buttonDisabledStyle : buttonStyle} disabled={transferDisabled} onClick={() => this.transfer('push')}>Push to Pressable</button></div>
      </div>
      {this.state.status && <p role="status" style={{background: 'rgba(81, 187, 123, 0.12)', border: '1px solid rgba(81, 187, 123, 0.35)', borderRadius: 4, color: 'inherit', maxWidth: 710, padding: '10px 12px'}}>{this.state.status}</p>}
      {this.state.error && <p role="alert" style={{background: 'rgba(220, 70, 70, 0.12)', border: '1px solid rgba(220, 70, 70, 0.42)', borderRadius: 4, color: 'inherit', maxWidth: 710, padding: '10px 12px', whiteSpace: 'pre-wrap'}}>{this.state.error}</p>}
    </div>;
  }
}
