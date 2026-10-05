# Pressable Connect for LocalWP

Pressable Connect is an add-on for [Local (LocalWP)](https://localwp.com/) version 10 or newer for moving a WordPress site's `wp-content` files, database, or both between LocalWP and [Pressable](https://pressable.com/). It maps each LocalWP site to a Pressable site and uses Pressable's API plus SSH/SFTP for transfers.

This is independent software and is not affiliated with Pressable, WP Engine, or LocalWP.

[Download the latest release](https://github.com/kelpagency/local-pressable-connect/releases/latest) · [Report an issue](https://github.com/kelpagency/local-pressable-connect/issues)

## Requirements

- LocalWP 10 or newer
- A Pressable API application with **Sites Read** and **FTP Read** scopes
- The SSH/SFTP password for a user on the selected Pressable site
- A LocalWP WordPress site that LocalWP can start (database transfers start a stopped site automatically)

Create API credentials in MyPressable under **User Settings → API Applications**. Find SSH/SFTP users and credentials under the Pressable site's **Collaborators** tab.

## Helpful links

- [Download LocalWP](https://localwp.com/)
- [LocalWP help documentation](https://localwp.com/help-docs/)
- [Pressable WordPress hosting](https://pressable.com/)
- [Pressable knowledge base](https://pressable.com/knowledgebase/)

## Install a release

1. Open [GitHub Releases](https://github.com/kelpagency/local-pressable-connect/releases/latest) and download the `local-pressable-connect-*.tgz` file under **Assets**. The automatically generated source ZIP and TAR files are not installable add-ons.
2. In LocalWP, open **Add-ons → Installed**, choose **Install from disk**, and select the archive. Do not extract it.
3. Enable **Pressable Connect** and restart LocalWP if prompted.
4. Open a LocalWP site and choose **Tools → Pressable Connect**.

Connect the Pressable API, choose a Pressable site and SSH/SFTP user, enter that user's password, and save the mapping. Then select files, database, or both and choose **Pull from Pressable** or **Push to Pressable**. Each transfer asks for confirmation.

The add-on is configured in a site's Tools panel. Its Installed Add-ons card has no marketplace detail link because this independently distributed add-on has no LocalWP marketplace listing.

## Develop and package

Edit the TypeScript and JSX source files in `src/`. The TypeScript compiler generates the runnable JavaScript and source maps in `lib/`. Run:

```bash
npm ci
npm run typecheck
npm run build
npm run check
```

For a local macOS development install, link this checkout into LocalWP's add-ons directory:

```bash
mkdir -p "$HOME/Library/Application Support/Local/addons"
ln -s "$PWD" "$HOME/Library/Application Support/Local/addons/local-pressable-connect"
```

Enable the add-on in LocalWP and restart LocalWP. Use `npm run watch` to rebuild source changes during development. To make an installable archive, run `npm pack` after installing dependencies; its prepare step builds the source. The archive is named from the package name and version in `package.json`. Do not commit `node_modules/` or `.tgz` archives; the package bundles its required runtime dependencies when packed.

## Changes in 0.1.11

- SSH/SFTP authentication failures explain which credentials to use, and IPC errors omit the internal wrapper.
- Switching the Pressable site or SSH/SFTP user clears the previous password.
- The Pressable site picker keeps alphabetical sorting.

## Transfer behavior

- Files transfer only `wp-content`; WordPress core and `wp-config.php` are not overwritten.
- Database transfers run serialized-safe `wp search-replace` through WP-CLI and skip the `guid` column.
- Credentials and site mappings use LocalWP's encrypted user-data storage.
- Transfer archives, SQL exports, and extraction logs are removed locally and from Pressable after success or failure. Stale transfer files are also cleared when the add-on opens and before the next transfer.
- Version 0.1 transfers the full `wp-content` directory; it does not implement incremental MagicSync.

## Compatibility and limitations

Development and transfer checks have been performed on macOS with LocalWP 10. Windows and Linux have not been verified. This is an early 0.1 release.

Transfers replace the selected data; they do not merge databases, synchronize individual changes, or create backups automatically. A files push overlays the destination files and excludes host-managed files and caches. It is not an exact mirror that deletes every destination-only file.

## Safety

Create an on-demand Pressable backup before pushing to a production site. Test transfers with a staging site first.

## Releases

Maintainers publish version tags such as `v0.1.11`. The GitHub Actions release workflow checks that the tag matches `package.json`, installs locked dependencies, validates and builds the source, and attaches an installable `.tgz` plus SHA-256 checksum to the GitHub Release.

## License

MIT. See [LICENSE](LICENSE).
