# Cyberware for Obsidian

Sync markdown documents from GitHub repositories into your Obsidian vault with automatic [Cyber Pilot](https://github.com/cyberfabric/cyber-pilot) traceability linking.

## What it does

- **Pulls `.md` files** from one or more GitHub repositories into a local vault folder.
- **Parses Cyber Pilot identifiers** (`cpt-{system}-{kind}-{slug}`) and code markers (`@cpt-flow:...`, `@cpt-begin:...`, `@cpt-end:...`).
- **Converts identifiers to `[[wikilinks]]`** so you can navigate traceability chains visually in Obsidian's graph view and backlinks panel.
- **Tracks sync state** per repository (commit SHA). Re-running sync only fetches when the remote has changed, and cleans up files that were deleted upstream.

## Setup

1. Install the plugin (copy `main.js`, `manifest.json`, `styles.css` into `<Vault>/.obsidian/plugins/cyberware/`).
2. Enable it in **Settings → Community plugins**.
3. Open **Settings → Cyberware** and add one or more GitHub repository URLs.
4. Optionally provide a **GitHub personal access token** (required for private repos, recommended to avoid API rate limits).
5. Click the **refresh icon** in the ribbon or run the command **Sync all repositories** from the command palette.

### Supported URL formats

- `https://github.com/owner/repo`
- `https://github.com/owner/repo/tree/branch`
- `owner/repo` (defaults to `main` branch)

## Configuration

| Setting | Description | Default |
|---|---|---|
| **GitHub personal access token** | Optional token for private repos / rate limits | empty |
| **Sync folder** | Vault folder where synced files are stored | `CyberPilot` |
| **Auto-sync on startup** | Sync all repos when Obsidian launches | off |
| **Repositories** | List of GitHub repo URLs to monitor | empty |

## How traceability linking works

Cyber Pilot uses identifiers like `cpt-myapp-fr-user-auth` in markdown artifacts to create a traceability chain from requirements through design to implementation.

This plugin scans all synced `.md` files, builds a map of which file defines which `cpt-*` ID, then replaces every occurrence with a `[[wikilink]]` pointing to the defining file. For example:

- `` `cpt-myapp-fr-user-auth` `` becomes `[[CyberPilot/owner-repo/path/to/file|cpt-myapp-fr-user-auth]]`
- `@cpt-begin:cpt-myapp-feature-auth-flow-login:p1:inst-validate` becomes a wikilink to the file defining `cpt-myapp-feature-auth-flow-login`

This means Obsidian's **graph view** and **backlinks** panel will show you the full traceability web across all your artifacts.

## Development

```bash
npm install
npm run dev    # watch mode
npm run build  # production build
```

## License

[0-BSD](LICENSE)
