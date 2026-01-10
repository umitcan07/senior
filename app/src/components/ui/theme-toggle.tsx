import { RiMoonLine, RiSunLine } from "@remixicon/react";
import { useTheme } from "@/components/theme-provider";
import { Button } from "@/components/ui/button";

export function ThemeToggle() {
	const { effectiveTheme, toggleTheme } = useTheme();

	return (
		<Button
			variant="ghost"
			size="icon"
			onClick={toggleTheme}
			aria-label={`Switch to ${effectiveTheme === "dark" ? "light" : "dark"} mode`}
			className="size-9"
		>
			{effectiveTheme === "dark" ? (
				<RiSunLine size={20} />
			) : (
				<RiMoonLine size={20} />
			)}
		</Button>
	);
}
