import { parse } from "smol-toml";
import { GitHubTreeItem } from "./types";

interface ArtifactEntry {
	kind: string;
	path: string;
	name: string;
	traceability?: string;
}

interface SystemEntry {
	name: string;
	slug: string;
	artifacts?: ArtifactEntry[];
}

interface ArtifactsConfig {
	systems: SystemEntry[];
}

/**
 * Find the artifacts.toml file in a repo tree.
 *
 * Strategy (minimizes API calls — uses the tree we already fetched):
 * 1. Look at cypilot/config/artifacts.toml (canonical path)
 * 2. If not found, search for any artifacts.toml elsewhere in the tree
 * 3. Returns the tree item or null
 */
export function findArtifactsToml(tree: GitHubTreeItem[]): GitHubTreeItem | null {
	// 1. Canonical path
	const canonical = tree.find(
		(item) => item.type === "blob" && item.path === "cypilot/config/artifacts.toml"
	);
	if (canonical) return canonical;

	// 2. Fallback — any artifacts.toml in the repo
	const fallback = tree.find(
		(item) =>
			item.type === "blob" &&
			(item.path.endsWith("/artifacts.toml") || item.path === "artifacts.toml")
	);
	return fallback ?? null;
}

/**
 * Parse artifacts.toml content and extract the list of artifact file paths.
 * Returns an array of relative file paths (e.g. "docs/architecture/PRD.md").
 */
export function parseArtifactPaths(tomlContent: string): string[] {
	const config = parse(tomlContent) as unknown as ArtifactsConfig;
	const paths: string[] = [];

	if (!config.systems || !Array.isArray(config.systems)) {
		return paths;
	}

	for (const system of config.systems) {
		if (!system.artifacts || !Array.isArray(system.artifacts)) {
			continue;
		}
		for (const artifact of system.artifacts) {
			if (artifact.path && typeof artifact.path === "string") {
				paths.push(artifact.path);
			}
		}
	}

	return paths;
}

/**
 * Filter the full tree to only include files listed in artifacts.toml.
 * Returns the matching GitHubTreeItems.
 */
export function filterTreeByArtifacts(
	tree: GitHubTreeItem[],
	artifactPaths: string[]
): GitHubTreeItem[] {
	const pathSet = new Set(artifactPaths);
	return tree.filter(
		(item) => item.type === "blob" && pathSet.has(item.path)
	);
}
