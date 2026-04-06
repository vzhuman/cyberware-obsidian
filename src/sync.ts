import { Notice, Vault, normalizePath, FileManager } from "obsidian";
import { CyberwareSettings, RepoConfig, SyncState, RepoSyncState } from "./types";
import { parseRepoUrl, fetchRepoTree, fetchFileContent } from "./github";
import { buildIdMap, transformContent } from "./parser";

export type ProgressCallback = (message: string) => void;

export class SyncEngine {
	private vault: Vault;
	private fileManager: FileManager;
	private settings: CyberwareSettings;
	private state: SyncState;
	private loadPluginData: () => Promise<Record<string, unknown> | null>;
	private savePluginData: (data: Record<string, unknown>) => Promise<void>;
	private onProgress: ProgressCallback = () => {};

	constructor(
		vault: Vault,
		fileManager: FileManager,
		settings: CyberwareSettings,
		loadData: () => Promise<Record<string, unknown> | null>,
		saveData: (data: Record<string, unknown>) => Promise<void>
	) {
		this.vault = vault;
		this.fileManager = fileManager;
		this.settings = settings;
		this.state = { repos: {} };
		this.loadPluginData = loadData;
		this.savePluginData = saveData;
	}

	async loadState(): Promise<void> {
		const data = await this.loadPluginData();
		if (data && data["syncState"]) {
			this.state = data["syncState"] as SyncState;
		}
	}

	async saveState(): Promise<void> {
		const data = (await this.loadPluginData()) ?? {};
		data["syncState"] = this.state;
		await this.savePluginData(data);
	}

	updateSettings(settings: CyberwareSettings): void {
		this.settings = settings;
	}

	setProgressCallback(cb: ProgressCallback): void {
		this.onProgress = cb;
	}

	async syncAll(): Promise<void> {
		const enabledRepos = this.settings.repos.filter((r) => r.enabled && r.url.trim());
		if (enabledRepos.length === 0) {
			new Notice("Cyberware: no repositories configured.");
			return;
		}

		const total = enabledRepos.length;
		this.onProgress(`Syncing 0/${total} repos...`);
		new Notice(`Cyberware: syncing ${total} repo(s)...`);

		// Phase 1: Fetch all files from all repos
		const allFiles: { vaultPath: string; content: string; repoKey: string }[] = [];
		const repoMeta: { repo: RepoConfig; key: string; sha: string; filePaths: string[] }[] = [];

		let repoIndex = 0;
		for (const repo of enabledRepos) {
			repoIndex++;
			const parsed = parseRepoUrl(repo.url);
			const label = parsed ? `${parsed.owner}/${parsed.repo}` : repo.url;
			this.onProgress(`Fetching ${label} (${repoIndex}/${total})...`);
			try {
				const files = await this.syncRepo(repo);
				allFiles.push(...files.files);
				repoMeta.push({
					repo,
					key: files.key,
					sha: files.sha,
					filePaths: files.files.map((f) => f.vaultPath),
				});
			} catch (e) {
				const msg = e instanceof Error ? e.message : String(e);
				if (msg.includes("403") || msg.includes("401")) {
					/* eslint-disable obsidianmd/ui/sentence-case -- brand names */
					new Notice(
						"Cyberware: GitHub denied access. Add a personal access token in Settings → Cyberware.",
						8000
					);
					/* eslint-enable obsidianmd/ui/sentence-case */
				} else {
					new Notice(`Cyberware: failed to sync ${repo.url} — ${msg}`);
				}
				console.error("Cyberware sync error:", e);
			}
		}

		if (allFiles.length === 0) {
			new Notice("No Markdown files found.");
			return;
		}

		// Phase 2: Build global ID map across all files
		this.onProgress(`Building links across ${allFiles.length} files...`);
		const idMap = buildIdMap(allFiles);

		// Phase 3: Transform content and write files
		await this.ensureFolder(this.settings.syncFolder);

		for (let i = 0; i < allFiles.length; i++) {
			const file = allFiles[i]!;
			this.onProgress(`Writing file ${i + 1}/${allFiles.length}...`);
			const transformed = transformContent(file.content, file.vaultPath, idMap);
			await this.writeFile(file.vaultPath, transformed);
		}

		// Phase 4: Clean up deleted files and update state
		this.onProgress("Cleaning up...");
		for (const meta of repoMeta) {
			const prevState = this.state.repos[meta.key];
			if (prevState) {
				const newFileSet = new Set(meta.filePaths);
				for (const oldFile of prevState.files) {
					if (!newFileSet.has(oldFile)) {
						await this.deleteFile(oldFile);
					}
				}
			}
			this.state.repos[meta.key] = {
				lastSha: meta.sha,
				lastSync: Date.now(),
				files: meta.filePaths,
			};
		}

		await this.saveState();
		this.onProgress(`Done — ${allFiles.length} file(s) synced`);
		new Notice(`Cyberware: synced ${allFiles.length} file(s) from ${repoMeta.length} repo(s).`);
	}

	private async syncRepo(
		repo: RepoConfig
	): Promise<{
		key: string;
		sha: string;
		files: { vaultPath: string; content: string; repoKey: string }[];
	}> {
		const parsed = parseRepoUrl(repo.url);
		if (!parsed) {
			throw new Error(`Invalid GitHub URL: ${repo.url}`);
		}

		const repoKey = `${parsed.owner}/${parsed.repo}/${parsed.branch}`;
		const { sha, mdFiles } = await fetchRepoTree(parsed, this.settings.githubToken);

		// Check if we already have this exact commit
		const prevState = this.state.repos[repoKey];
		if (prevState && prevState.lastSha === sha) {
			new Notice(`Cyberware: ${parsed.owner}/${parsed.repo} is up to date.`);
			return {
				key: repoKey,
				sha,
				files: await this.readExistingFiles(prevState),
			};
		}

		const files: { vaultPath: string; content: string; repoKey: string }[] = [];
		for (const mdFile of mdFiles) {
			const content = await fetchFileContent(parsed, mdFile.path, this.settings.githubToken);
			const vaultPath = normalizePath(
				`${this.settings.syncFolder}/${parsed.owner}-${parsed.repo}/${mdFile.path}`
			);
			files.push({ vaultPath, content, repoKey });
		}

		return { key: repoKey, sha, files };
	}

	private async readExistingFiles(
		state: RepoSyncState
	): Promise<{ vaultPath: string; content: string; repoKey: string }[]> {
		const files: { vaultPath: string; content: string; repoKey: string }[] = [];
		for (const filePath of state.files) {
			const abstractFile = this.vault.getAbstractFileByPath(filePath);
			if (abstractFile && "path" in abstractFile) {
				try {
					const content = await this.vault.read(abstractFile as import("obsidian").TFile);
					files.push({ vaultPath: filePath, content, repoKey: "" });
				} catch {
					// File might have been deleted manually
				}
			}
		}
		return files;
	}

	private async ensureFolder(path: string): Promise<void> {
		const normalized = normalizePath(path);
		if (!this.vault.getAbstractFileByPath(normalized)) {
			await this.vault.createFolder(normalized);
		}
	}

	private async writeFile(vaultPath: string, content: string): Promise<void> {
		// Ensure parent folders exist
		const parts = vaultPath.split("/");
		for (let i = 1; i < parts.length; i++) {
			const folderPath = normalizePath(parts.slice(0, i).join("/"));
			if (!this.vault.getAbstractFileByPath(folderPath)) {
				try {
					await this.vault.createFolder(folderPath);
				} catch {
					// Folder may already exist
				}
			}
		}

		const existing = this.vault.getAbstractFileByPath(vaultPath);
		if (existing && "path" in existing) {
			await this.vault.modify(existing as import("obsidian").TFile, content);
		} else {
			try {
				await this.vault.create(vaultPath, content);
			} catch {
				// Vault cache may be stale — retry as modify
				const file = this.vault.getAbstractFileByPath(vaultPath);
				if (file && "path" in file) {
					await this.vault.modify(file as import("obsidian").TFile, content);
				}
			}
		}
	}

	private async deleteFile(vaultPath: string): Promise<void> {
		const file = this.vault.getAbstractFileByPath(vaultPath);
		if (file) {
			try {
				await this.fileManager.trashFile(file);
			} catch {
				// Ignore deletion errors
			}
		}
	}
}
