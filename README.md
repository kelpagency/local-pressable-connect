# Pressable Connect for Local

Pressable Connect is a Local 10 add-on for moving a WordPress site's `wp-content` files, database, or both between Local and Pressable. It maps each Local site to a Pressable site and uses Pressable's API plus SSH/SFTP for transfers.

This is independent software and is not affiliated with Pressable, WP Engine, or Local.

## Requirements

- Local 10 or newer
- A Pressable API application with **Sites Read** and **FTP Read** scopes
- The SSH/SFTP password for a user on the selected Pressable site
- A Local WordPress site that Local can start (database transfers start a stopped site automatically)

Create API credentials in MyPressable under **User Settings → API Applications**. Find SSH/SFTP users and credentials under the Pressable site's **Collaborators** tab.

## Install a release

1. Download the `local-pressable-connect-*.tgz` release archive.
2. In Local, open **Add-ons → Installed**, choose **Install from disk**, and select the archive. Do not extract it.
3. Enable **Pressable Connect** and restart Local if prompted.
4. Open a Local site and choose **Tools → Pressable Connect**.

Connect the Pressable API, choose a Pressable site and SSH/SFTP user, enter that user's password, and save the mapping. Then select files, database, or both and choose **Pull from Pressable** or **Push to Pressable**. Each transfer asks for confirmation.

The add-on is configured in a site's Tools panel. Its Installed Add-ons card has no marketplace detail link because this private add-on has no public marketplace page.

## Develop and package

Edit the TypeScript and JSX source files in `src/`. The TypeScript compiler generates the runnable JavaScript and source maps in `lib/`. Run:

```bash
npm ci
npm run typecheck
npm run build
npm run check
```

For a local macOS development install, link this checkout into Local's add-ons directory:

```bash
mkdir -p "$HOME/Library/Application Support/Local/addons"
ln -s "$PWD" "$HOME/Library/Application Support/Local/addons/local-pressable-connect"
```

Enable the add-on in Local and restart Local. Use `npm run watch` to rebuild source changes during development. To make an installable archive, run `npm pack` after installing dependencies; its prepare step builds the source. The archive is named from the package name and version in `package.json`. Do not commit `node_modules/` or `.tgz` archives; the package bundles its required runtime dependencies when packed.

## Changes in 0.1.11

- SSH/SFTP authentication failures explain which credentials to use, and IPC errors omit the internal wrapper.
- Switching the Pressable site or SSH/SFTP user clears the previous password.
- The Pressable site picker keeps alphabetical sorting.

## Transfer behavior

- Files transfer only `wp-content`; WordPress core and `wp-config.php` are not overwritten.
- Database transfers run serialized-safe `wp search-replace` through WP-CLI and skip the `guid` column.
- Credentials and site mappings use Local's encrypted user-data storage.
- Transfer archives, SQL exports, and extraction logs are removed locally and from Pressable after success or failure. Stale transfer files are also cleared when the add-on opens and before the next transfer.
- Version 0.1 transfers the full `wp-content` directory; it does not implement incremental MagicSync.

## Safety

Create an on-demand Pressable backup before pushing to a production site. Test transfers with a staging site first.

## License

MIT. See [LICENSE](LICENSE).
