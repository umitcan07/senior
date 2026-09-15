// Data access for the frozen corpus. Everything is a static fetch against the
// precomputed tree under `data/` (see corpus/scripts/site_build/emit.py).
// Shards and utterance details are cached in-memory for the session.

import type { Area, AreaStats, Manifest, StressStats, TokenRow, UtteranceDetail } from "./types";
import { filterTask, recordingTasks, tokenStats, type TaskFilter } from "./taskFilter";

// Relative base so the site works under any hosting subpath.
const DATA = `${import.meta.env.BASE_URL}data`.replace(/\/+/g, "/");
// Static hosts and CDNs commonly cache stable JSON paths long after a corpus
// rebuild. Bump this with every published data tree so a new JS bundle never
// mixes its schema with an older manifest, shard, or audio clip.
const DATA_REVISION = "20260907-corptes-targets-v2";

const cache = new Map<string, Promise<unknown>>();

function getJSON<T>(path: string): Promise<T> {
	if (!cache.has(path)) {
		cache.set(
			path,
			fetch(`${path}?v=${DATA_REVISION}`).then((r) => {
				if (!r.ok) throw new Error(`${r.status} ${path}`);
				return r.json();
			}),
		);
	}
	return cache.get(path) as Promise<T>;
}

export function loadManifest(): Promise<Manifest> {
	return getJSON<Manifest>(`${DATA}/manifest.json`);
}

export async function loadAreaStats(area: Area, task: TaskFilter = "all"): Promise<AreaStats> {
	const stats = await getJSON<AreaStats>(`${DATA}/areas/${area}.json`);
	if (task === "all") return stats;
	return {
		...stats,
		phones: await Promise.all(
			stats.phones.map(async (p) =>
				tokenStats(p.phone, await loadPhoneTokens(area, p.phone, task)),
			),
		),
	};
}

export async function loadStressStats(task: TaskFilter = "all"): Promise<StressStats> {
	const stats = await getJSON<StressStats>(`${DATA}/areas/lexical-stress.json`);
	if (task === "all") return stats;
	const rows = await loadPhoneTokens("stress", "all", task);
	const { total, correct, incorrect } = tokenStats("", rows);
	return {
		...stats,
		total,
		correct,
		incorrect,
		byPhone: stats.byPhone.map((p) =>
			tokenStats(
				p.phone,
				rows.filter((row) => row.ph === p.phone),
			),
		),
	};
}

/** The writer stores percent-encoded filenames for portability. Encode the
 * filename again for HTTP so the server decodes to that literal filename. */
export async function loadPhoneTokens(
	area: Area | "stress" | "linking" | "intonation",
	phone: string,
	task: TaskFilter = "all",
): Promise<TokenRow[]> {
	try {
		const rows = await getJSON<TokenRow[]>(
			`${DATA}/tokens/${area}/${encodeURIComponent(encodeURIComponent(phone))}.json`,
		);
		return task === "all"
			? rows
			: filterTask(rows, task, recordingTasks(await loadManifest()));
	} catch {
		return [];
	}
}

export function loadUtterance(id: string): Promise<UtteranceDetail> {
	return getJSON<UtteranceDetail>(`${DATA}/utterances/${id}.json`);
}

export function clipURL(clip: string): string {
	const path = `${DATA}/../${clip}`.replace(/\/+/g, "/");
	return `${path}?v=${DATA_REVISION}`;
}
