// Data access for the frozen corpus. Everything is a static fetch against the
// precomputed tree under `data/` (see corpus/scripts/site_build/emit.py).
// Shards and utterance details are cached in-memory for the session.

import type {
	Area,
	AreaStats,
	Manifest,
	StressStats,
	TokenRow,
	UtteranceDetail,
} from "./types";

// Relative base so the site works under any hosting subpath.
const DATA = `${import.meta.env.BASE_URL}data`.replace(/\/+/g, "/");
// Static hosts and CDNs commonly cache stable JSON paths long after a corpus
// rebuild. Bump this with every published data tree so a new JS bundle never
// mixes its schema with an older manifest, shard, or audio clip.
const DATA_REVISION = "20260816-corptes-native-v1";

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

export function loadAreaStats(area: Area): Promise<AreaStats> {
	return getJSON<AreaStats>(`${DATA}/areas/${area}.json`);
}

export function loadStressStats(): Promise<StressStats> {
	return getJSON<StressStats>(`${DATA}/areas/lexical-stress.json`);
}

/** Token shard for one target phone within an area folder. Empty on 404. */
export async function loadPhoneTokens(
	area: Area | "stress" | "linking" | "intonation",
	phone: string,
): Promise<TokenRow[]> {
	try {
		return await getJSON<TokenRow[]>(
			`${DATA}/tokens/${area}/${encodeURIComponent(phone)}.json`,
		);
	} catch {
		return [];
	}
}

export function loadUtterance(id: string): Promise<UtteranceDetail> {
	return getJSON<UtteranceDetail>(`${DATA}/utterances/${id}.json`);
}

export function clipURL(clip: string): string {
	return `${DATA}/../${clip}`.replace(/\/+/g, "/") + `?v=${DATA_REVISION}`;
}
