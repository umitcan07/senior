import { createContext, useContext, useEffect, useState } from "react";
import { withoutTransition } from "@/lib/without-transition";

type Theme = "light" | "dark" | "system";

const THEME_STORAGE_KEY = "nonce-theme-preference";

interface ThemeContextValue {
	theme: Theme;
	effectiveTheme: "light" | "dark";
	setTheme: (theme: Theme) => void;
	toggleTheme: () => void;
}

const ThemeContext = createContext<ThemeContextValue | undefined>(undefined);

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
	withoutTransition(() => {
		const root = document.documentElement;
		if (theme === "dark") {
			root.classList.add("dark");
		} else {
			root.classList.remove("dark");
		}
	});
}

export function ThemeProvider({ children }: { children: React.ReactNode }) {
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

		const handleChange = (e: MediaQueryListEvent) => {
			const newEffective = e.matches ? "dark" : "light";
			setEffectiveTheme(newEffective);
			applyTheme(newEffective);
		};

		mediaQuery.addEventListener("change", handleChange);

		return () => {
			mediaQuery.removeEventListener("change", handleChange);
		};
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

	return (
		<ThemeContext.Provider
			value={{
				theme,
				effectiveTheme,
				setTheme,
				toggleTheme,
			}}
		>
			{children}
		</ThemeContext.Provider>
	);
}

export function useTheme() {
	const context = useContext(ThemeContext);
	if (context === undefined) {
		throw new Error("useTheme must be used within a ThemeProvider");
	}
	return context;
}
