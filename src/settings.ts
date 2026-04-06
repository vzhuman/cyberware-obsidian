import { App, PluginSettingTab, Setting } from "obsidian";
import type CyberwarePlugin from "./main";

export class CyberwareSettingTab extends PluginSettingTab {
	plugin: CyberwarePlugin;

	constructor(app: App, plugin: CyberwarePlugin) {
		super(app, plugin);
		this.plugin = plugin;
	}

	display(): void {
		const { containerEl } = this;
		containerEl.empty();

		new Setting(containerEl).setName("Cyberware").setHeading();

		// --- GitHub token ---
		new Setting(containerEl)
			.setName("GitHub personal access token")
			.setDesc(
				"Optional. Required for private repos or to avoid rate limits. " +
				"Create one at GitHub → Settings → Developer settings → Personal access tokens."
			)
			.addText((text) =>
				text
					// eslint-disable-next-line obsidianmd/ui/sentence-case -- token format
					.setPlaceholder("ghp_...")
					.setValue(this.plugin.settings.githubToken)
					.onChange(async (value) => {
						this.plugin.settings.githubToken = value.trim();
						await this.plugin.saveSettings();
					})
			);

		// --- Sync folder ---
		new Setting(containerEl)
			.setName("Sync folder")
			.setDesc("Folder in the vault where synced Markdown files are stored.")
			.addText((text) =>
				text
					// eslint-disable-next-line obsidianmd/ui/sentence-case -- product name
					.setPlaceholder("CyberPilot")
					.setValue(this.plugin.settings.syncFolder)
					.onChange(async (value) => {
						this.plugin.settings.syncFolder = value.trim() || "CyberPilot";
						await this.plugin.saveSettings();
					})
			);

		// --- Auto-sync on start ---
		new Setting(containerEl)
			.setName("Auto-sync on startup")
			.setDesc("Automatically sync all repositories when Obsidian starts.")
			.addToggle((toggle) =>
				toggle
					.setValue(this.plugin.settings.autoSyncOnStart)
					.onChange(async (value) => {
						this.plugin.settings.autoSyncOnStart = value;
						await this.plugin.saveSettings();
					})
			);

		// --- Repository list ---
		new Setting(containerEl).setName("Repositories").setHeading();
		containerEl.createEl("p", {
			text: "Add GitHub repository URLs to monitor. Supports https://github.com/owner/repo or https://github.com/owner/repo/tree/branch.",
			cls: "setting-item-description",
		});

		for (let i = 0; i < this.plugin.settings.repos.length; i++) {
			const repo = this.plugin.settings.repos[i];
			if (!repo) continue;

			const setting = new Setting(containerEl)
				.addText((text) =>
					text
						.setPlaceholder("https://github.com/owner/repo")
						.setValue(repo.url)
						.onChange(async (value) => {
							repo.url = value.trim();
							await this.plugin.saveSettings();
						})
				)
				.addToggle((toggle) =>
					toggle
						.setTooltip("Enable/disable this repository")
						.setValue(repo.enabled)
						.onChange(async (value) => {
							repo.enabled = value;
							await this.plugin.saveSettings();
						})
				)
				.addExtraButton((btn) =>
					btn
						.setIcon("trash")
						.setTooltip("Remove repository")
						.onClick(async () => {
							this.plugin.settings.repos.splice(i, 1);
							await this.plugin.saveSettings();
							this.display();
						})
				);

			setting.nameEl.remove();
		}

		// --- Add repo button ---
		new Setting(containerEl).addButton((btn) =>
			btn
				.setButtonText("Add repository")
				.setCta()
				.onClick(async () => {
					this.plugin.settings.repos.push({ url: "", enabled: true });
					await this.plugin.saveSettings();
					this.display();
				})
		);
	}
}
