# Cyberware Repos for Obsidian

This plugin syncs specifications from GitHub repositories with [Cyber Pilot](https://github.com/cyberfabric/cyber-pilot) enabled to Obsidian and automatically creates links between related specs.

Cyber Pilot is part of the [Cyberware](https://github.com/cyberfabric) open-source technology stack, designed to complement agentic AI code generators and AI IDEs. It helps teams develop production-ready software faster 

## Setup

1. Install **Cyberware Repos** from **Settings → Community plugins → Browse**.
2. Enable the plugin.
3. Open **Settings → Cyberware Repos**, add a GitHub repository URL and click **Sync Cyberware repos** in the left ribbon.

## Advanced configuration

### GitHub personal access token

A personal access token is required for private repositories and recommended for public ones to avoid GitHub API rate limits. Create one at **GitHub → Settings → Developer settings → Personal access tokens** and paste it into the token field.

### Sync folder

The vault folder where synced files are stored. Defaults to `Cyberware repos`. Change this if you prefer a different location. Inside this folder the plugin creates:

- A subfolder per repository (e.g. `cyberfabric-insight/`) with the synced Markdown files.
- An **Artifacts** subfolder with a page for each defined Cyber Pilot identifier, tagged `artifact`.
- An **Undefined** subfolder with a page for each identifier that is referenced but never defined, tagged `undefined`.

### Auto-sync on startup

When enabled, the plugin automatically syncs all repositories a few seconds after Obsidian launches. Disabled by default.

### Repositories

Add up to 10 GitHub repository URLs. Supported formats:

- `https://github.com/owner/repo` — syncs the `main` branch.
- `https://github.com/owner/repo/tree/branch` — syncs the specified branch.
- `owner/repo` — shorthand, defaults to the `main` branch.

Each entry has a toggle to enable or disable syncing for that repository individually.

### Recommended graph view setup

To quickly spot defined and undefined artifacts in Obsidian's graph view, add colour groups:

1. Open **Graph view** and click the settings icon.
2. Under **Groups**, add a group with the query `tag:#artifact` and set its colour to **green**.
3. Add another group with the query `tag:#undefined` and set its colour to **red**.

Defined artifacts will appear as green nodes and undefined ones as red, making it easy to find broken or missing links.

## Development

```bash
npm install
npm run dev    # watch mode
npm run build  # production build
```

## License

[0-BSD](LICENSE)
