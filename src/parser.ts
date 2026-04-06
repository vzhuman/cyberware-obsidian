/**
 * Parses Cyber Pilot cpt-* and @cpt-* identifiers in markdown content
 * and converts them into Obsidian [[wikilinks]].
 *
 * ID format: cpt-{system}-{kind}-{slug}
 * Code markers: @cpt-flow:..., @cpt-begin:..., @cpt-end:...
 *
 * Strategy:
 * 1. Collect all cpt-* IDs found across all files to build an ID→file map.
 * 2. Replace inline `cpt-*` references with [[wikilinks]] pointing to the
 *    file where that ID is defined (or just the ID as display text if unknown).
 * 3. Strip @cpt-begin / @cpt-end code markers but keep the IDs as links.
 */

// Matches standalone cpt identifiers: cpt-{system}-{kind}-{slug}
// Supports nested: cpt-sys-subsys-kind-slug
const CPT_ID_REGEX = /`(cpt-[a-z0-9](?:[a-z0-9-]*[a-z0-9])?)`/g;

// Matches @cpt-* code markers (flow, begin, end) with full colon-separated paths
const CPT_MARKER_REGEX =
	/@cpt-(flow|begin|end):([a-z0-9-]+(?::[a-z0-9-]+)*)/g;

// Matches bare cpt-* IDs not inside backticks (in prose, headings, lists)
const CPT_BARE_REGEX = /(?<![`@\w])(cpt-[a-z0-9](?:[a-z0-9-]*[a-z0-9])?)(?![`\w-])/g;

export interface IdLocation {
	id: string;
	file: string; // vault-relative path
}

/**
 * Scan a single markdown file's content and extract all cpt-* IDs defined in it.
 */
export function extractIds(content: string): string[] {
	const ids = new Set<string>();

	// From backtick-wrapped IDs
	let m: RegExpExecArray | null;
	CPT_ID_REGEX.lastIndex = 0;
	while ((m = CPT_ID_REGEX.exec(content)) !== null) {
		if (m[1]) ids.add(m[1]);
	}

	// From @cpt-* markers — extract the base ID (first colon segment)
	CPT_MARKER_REGEX.lastIndex = 0;
	while ((m = CPT_MARKER_REGEX.exec(content)) !== null) {
		const parts = m[2]?.split(":") ?? [];
		if (parts[0]) ids.add(parts[0]);
	}

	// From bare IDs in prose
	CPT_BARE_REGEX.lastIndex = 0;
	while ((m = CPT_BARE_REGEX.exec(content)) !== null) {
		if (m[1]) ids.add(m[1]);
	}

	return [...ids];
}

/**
 * Build a map of cpt ID → vault-relative file path where it is first defined.
 * Call this after scanning all files.
 */
export function buildIdMap(
	allFiles: { vaultPath: string; content: string }[]
): Map<string, string> {
	const idMap = new Map<string, string>();
	for (const file of allFiles) {
		const ids = extractIds(file.content);
		for (const id of ids) {
			// First occurrence wins (definition file)
			if (!idMap.has(id)) {
				idMap.set(id, file.vaultPath);
			}
		}
	}
	return idMap;
}

/**
 * Transform markdown content: replace cpt-* identifiers with [[wikilinks]].
 *
 * - `cpt-myapp-fr-user-auth` → [[filename|cpt-myapp-fr-user-auth]]
 * - @cpt-begin:id:phase:inst → [[filename|id]] (keeps context)
 * - Bare cpt-id in prose → [[filename|cpt-id]]
 *
 * If the ID isn't in the map, it becomes a plain wikilink [[cpt-id]].
 */
export function transformContent(
	content: string,
	currentFile: string,
	idMap: Map<string, string>
): string {
	let result = content;

	// 1. Replace @cpt-* markers in code comments
	result = result.replace(CPT_MARKER_REGEX, (_match, _type: string, path: string) => {
		const parts = path.split(":");
		const baseId = parts[0] ?? path;
		return makeWikilink(baseId, currentFile, idMap);
	});

	// 2. Replace backtick-wrapped cpt IDs
	result = result.replace(CPT_ID_REGEX, (_match, id: string) => {
		return makeWikilink(id, currentFile, idMap);
	});

	// 3. Replace bare cpt IDs in prose
	result = result.replace(CPT_BARE_REGEX, (_match, id: string) => {
		return makeWikilink(id, currentFile, idMap);
	});

	return result;
}

function makeWikilink(
	id: string,
	currentFile: string,
	idMap: Map<string, string>
): string {
	const targetFile = idMap.get(id);
	if (targetFile && targetFile !== currentFile) {
		// Link to the file where this ID is defined, show ID as display text
		const basename = targetFile.replace(/\.md$/i, "");
		return `[[${basename}|${id}]]`;
	}
	// Self-reference or unknown — just make it a searchable wikilink
	return `[[${id}]]`;
}
