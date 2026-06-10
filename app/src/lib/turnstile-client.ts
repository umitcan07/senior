/**
 * Minimal, dependency-free Cloudflare Turnstile client. Env-gated by
 * `VITE_TURNSTILE_SITE_KEY`: if unset (local/dev/demo), `getTurnstileToken` resolves
 * to `null` and the server skips verification, so the guest flow works without any
 * Cloudflare setup. When the key IS set, it renders an invisible widget on demand and
 * resolves the resulting token. Pairs with `verifyTurnstile` in `lib/guest-auth.ts`.
 */

interface TurnstileApi {
	render(el: HTMLElement, opts: Record<string, unknown>): string;
	remove(id: string): void;
}

const SITE_KEY = import.meta.env.VITE_TURNSTILE_SITE_KEY as string | undefined;
const SCRIPT_SRC =
	"https://challenges.cloudflare.com/turnstile/v0/api.js?render=explicit";

let scriptPromise: Promise<void> | null = null;

function getApi(): TurnstileApi | undefined {
	return (window as unknown as { turnstile?: TurnstileApi }).turnstile;
}

function loadScript(): Promise<void> {
	if (getApi()) return Promise.resolve();
	if (scriptPromise) return scriptPromise;
	scriptPromise = new Promise<void>((resolve, reject) => {
		const s = document.createElement("script");
		s.src = SCRIPT_SRC;
		s.async = true;
		s.defer = true;
		s.onload = () => resolve();
		s.onerror = () => reject(new Error("Failed to load Turnstile"));
		document.head.appendChild(s);
	});
	return scriptPromise;
}

/**
 * Resolve a one-time Turnstile token, or `null` when Turnstile isn't configured or
 * fails (the server treats `null` as "skip" only when no secret is set, otherwise as
 * a failed challenge).
 */
export async function getTurnstileToken(): Promise<string | null> {
	if (!SITE_KEY || typeof window === "undefined") return null;
	try {
		await loadScript();
	} catch {
		return null;
	}
	const api = getApi();
	if (!api) return null;

	return new Promise<string | null>((resolve) => {
		const container = document.createElement("div");
		container.style.display = "none";
		document.body.appendChild(container);

		let settled = false;
		let widgetId: string | undefined;
		const finish = (token: string | null) => {
			if (settled) return;
			settled = true;
			if (widgetId) {
				try {
					api.remove(widgetId);
				} catch {
					// ignore
				}
			}
			container.remove();
			resolve(token);
		};

		try {
			widgetId = api.render(container, {
				sitekey: SITE_KEY,
				size: "invisible",
				callback: (token: string) => finish(token),
				"error-callback": () => finish(null),
				"timeout-callback": () => finish(null),
			});
		} catch {
			finish(null);
		}
		// Safety net so the recording flow never hangs on Turnstile.
		setTimeout(() => finish(null), 15000);
	});
}
