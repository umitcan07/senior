import { useCallback, useSyncExternalStore } from "react";

const STORAGE_KEY = "nounce_guest_analyses";
const MAX_FREE = 5;

const listeners = new Set<() => void>();

function getCount(): number {
	if (typeof window === "undefined") return 0;
	return Number(localStorage.getItem(STORAGE_KEY) ?? 0);
}

function subscribe(cb: () => void) {
	listeners.add(cb);
	return () => listeners.delete(cb);
}

function getSnapshot() {
	return getCount();
}

function getServerSnapshot() {
	return 0;
}

export function useGuestTrial() {
	const used = useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot);
	const remaining = Math.max(0, MAX_FREE - used);
	const exhausted = remaining <= 0;

	const increment = useCallback(() => {
		const next = getCount() + 1;
		localStorage.setItem(STORAGE_KEY, String(next));
		for (const cb of listeners) cb();
	}, []);

	return { used, remaining, exhausted, maxFree: MAX_FREE, increment };
}
