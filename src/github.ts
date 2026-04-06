import { requestUrl } from "obsidian";
import { GitHubTreeItem, ParsedRepo } from "./types";

export function parseRepoUrl(url: string): ParsedRepo | null {
	const trimmed = url.trim().replace(/\/+$/, "");
	// Support formats:
	//   https://github.com/owner/repo
	//   https://github.com/owner/repo/tree/branch
	//   owner/repo
	const fullMatch = trimmed.match(
		/(?:https?:\/\/github\.com\/)?([^/]+)\/([^/]+?)(?:\.git)?(?:\/tree\/([^/]+.*))?$/
	);
	if (!fullMatch) return null;
	const owner = fullMatch[1];
	const repo = fullMatch[2];
	const branch = fullMatch[3] || "main";
	if (!owner || !repo) return null;
	return { owner, repo, branch };
}

function headers(token: string): Record<string, string> {
	const h: Record<string, string> = {
		Accept: "application/vnd.github.v3+json",
		"User-Agent": "Obsidian-Cyberware-Plugin",
	};
	if (token) {
		h["Authorization"] = `Bearer ${token}`;
	}
	return h;
}

interface GitHubRefResponse {
	object: { sha: string };
}

interface GitHubTreeResponse {
	sha: string;
	tree: GitHubTreeItem[];
}

export async function fetchRepoTree(
	parsed: ParsedRepo,
	token: string
): Promise<{ sha: string; tree: GitHubTreeItem[] }> {
	// Get the branch ref to find the tree SHA
	const refUrl = `https://api.github.com/repos/${parsed.owner}/${parsed.repo}/git/ref/heads/${parsed.branch}`;
	const refResp = await requestUrl({ url: refUrl, headers: headers(token) });
	const refData = refResp.json as GitHubRefResponse;
	const commitSha = refData.object.sha;

	// Get the full recursive tree (single API call)
	const treeUrl = `https://api.github.com/repos/${parsed.owner}/${parsed.repo}/git/trees/${commitSha}?recursive=1`;
	const treeResp = await requestUrl({ url: treeUrl, headers: headers(token) });
	const treeData = treeResp.json as GitHubTreeResponse;
	const tree: GitHubTreeItem[] = treeData.tree ?? [];

	return { sha: commitSha, tree };
}

export async function fetchFileContent(
	parsed: ParsedRepo,
	filePath: string,
	token: string
): Promise<string> {
	const url = `https://api.github.com/repos/${parsed.owner}/${parsed.repo}/contents/${filePath}?ref=${parsed.branch}`;
	const resp = await requestUrl({
		url,
		headers: {
			...headers(token),
			Accept: "application/vnd.github.v3.raw",
		},
	});
	return resp.text;
}
