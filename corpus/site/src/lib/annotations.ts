// User annotation categories, EXAKT-style — a free-text note the reader can
// attach to any token.
//
// The site is static by design (see doc/corpus_site.md), so there is nowhere to
// persist these server-side. They live in localStorage, which means they are
// private to one browser on one machine and vanish if its storage is cleared.
// That limitation is stated in the UI; the CSV export carries the notes out so
// a reader's coding survives as a file.

const KEY = "corptes:annotations:v1";

type Store = Record<string, string>;

function read(): Store {
	try {
		const raw = localStorage.getItem(KEY);
		if (!raw) return {};
		const parsed: unknown = JSON.parse(raw);
		if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) return {};
		const out: Store = {};
		for (const [k, v] of Object.entries(parsed as Record<string, unknown>)) {
			if (typeof v === "string") out[k] = v;
		}
		return out;
	} catch {
		// Private browsing, disabled storage, or corrupt JSON — degrade to
		// in-session-only rather than taking the page down.
		return {};
	}
}

function write(store: Store): void {
	try {
		localStorage.setItem(KEY, JSON.stringify(store));
	} catch {
		// Quota or disabled storage: the value stays in React state for this
		// session, it just will not survive a reload.
	}
}

export function loadAnnotations(): Store {
	return read();
}

/** Set or clear one token's note, returning the updated store. */
export function setAnnotation(tokenId: string, note: string): Store {
	const store = read();
	const trimmed = note.trim();
	if (trimmed === "") {
		delete store[tokenId];
	} else {
		store[tokenId] = trimmed;
	}
	write(store);
	return store;
}

export function clearAnnotations(): Store {
	try {
		localStorage.removeItem(KEY);
	} catch {
		// Nothing to do — read() will just keep returning what it can.
	}
	return {};
}
