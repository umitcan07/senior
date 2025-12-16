import { useLayoutEffect } from "react";

const THEME_STORAGE_KEY = "nonce-theme-preference";

function initializeTheme() {
	const theme = localStorage.getItem(THEME_STORAGE_KEY) || "system";
	const isDark =
		theme === "dark" ||
		(theme === "system" &&
			window.matchMedia("(prefers-color-scheme: dark)").matches);

	if (isDark) {
		document.documentElement.classList.add("dark");
	} else {
		document.documentElement.classList.remove("dark");
	}
}

export function ThemeInitializer() {
	useLayoutEffect(() => {
		initializeTheme();
	}, []);

	return null;
}
