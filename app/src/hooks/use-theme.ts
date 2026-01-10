import { useEffect, useState } from "react";

import { THEME_STORAGE_KEY } from "@/lib/constants";

type Theme = "light" | "dark" | "system";

function getSystemTheme(): "light" | "dark" {
	if (typeof window === "undefined") return "light";
	return window.matchMedia("(prefers-color-scheme: dark)").matches
		? "dark"
		: "light";
}

function getStoredTheme(): Theme | null {
	if (typeof window === "undefined") return null;
	const stored = localStorage.getItem(THEME_STORAGE_KEY);
	return stored === "light" || stored === "dark" || stored === "system"
		? stored
		: null;
}

function getEffectiveTheme(theme: Theme): "light" | "dark" {
	if (theme === "system") {
		return getSystemTheme();
	}
	return theme;
}

function applyTheme(theme: "light" | "dark") {
	const root = document.documentElement;
	if (theme === "dark") {
		root.classList.add("dark");
	} else {
		root.classList.remove("dark");
	}
}

export function useTheme() {
	const [theme, setThemeState] = useState<Theme>(() => {
		if (typeof window === "undefined") return "system";
		return getStoredTheme() ?? "system";
	});

	const [effectiveTheme, setEffectiveTheme] = useState<"light" | "dark">(() =>
		getEffectiveTheme(theme),
	);

	useEffect(() => {
		const effective = getEffectiveTheme(theme);
		setEffectiveTheme(effective);
		applyTheme(effective);

		if (theme === "system") {
			localStorage.removeItem(THEME_STORAGE_KEY);
		} else {
			localStorage.setItem(THEME_STORAGE_KEY, theme);
		}
	}, [theme]);

	useEffect(() => {
		if (theme !== "system") return;

		const mediaQuery = window.matchMedia("(prefers-color-scheme: dark)");
		const handleChange = () => {
			const newEffective = getSystemTheme();
			setEffectiveTheme(newEffective);
			applyTheme(newEffective);
		};

		mediaQuery.addEventListener("change", handleChange);
		return () => mediaQuery.removeEventListener("change", handleChange);
	}, [theme]);

	const setTheme = (newTheme: Theme) => {
		setThemeState(newTheme);
	};

	const toggleTheme = () => {
		if (theme === "system") {
			const currentEffective = getSystemTheme();
			setTheme(currentEffective === "dark" ? "light" : "dark");
		} else {
			setTheme(theme === "dark" ? "light" : "dark");
		}
	};

	return {
		theme,
		effectiveTheme,
		setTheme,
		toggleTheme,
	};
}
