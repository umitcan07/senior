import type { QueryClient } from "@tanstack/react-query";
import {
	createRootRouteWithContext,
	HeadContent,
	Scripts,
} from "@tanstack/react-router";
import { GlobalError } from "@/components/error-boundary";
import { NotFound } from "@/components/not-found";
import { ThemeInitializer } from "@/components/theme-initializer";
import { ThemeProvider } from "@/components/theme-provider";
import { Toaster } from "@/components/ui/toaster";
import { THEME_STORAGE_KEY } from "@/lib/constants";
import ClerkProvider from "../integrations/clerk/provider";
import appCss from "../styles.css?url";
import "flag-icons/css/flag-icons.min.css";
import "remixicon/fonts/remixicon.css";

interface MyRouterContext {
	queryClient: QueryClient;
}

const appTitle = "Nounce: Improve Your English Pronunciation";
const appDescription =
	"Nounce is an advanced, free-to-use phonetic-analysis & pronunciation assessment platform developed for English language learners.";

export const Route = createRootRouteWithContext<MyRouterContext>()({
	notFoundComponent: NotFound,
	errorComponent: GlobalError,
	head: () => ({
		meta: [
			{
				charSet: "utf-8",
			},
			{
				name: "viewport",
				content: "width=device-width, initial-scale=1",
			},
			{
				title: appTitle,
			},
			// Open Graph meta tags
			{
				property: "og:title",
				content: appTitle,
			},
			{
				property: "og:description",
				content: appDescription,
			},
			{
				property: "og:image",
				content: "/og-image.png",
			},
			{
				property: "og:url",
				content: "http://localhost:3000/",
			},
			{
				property: "og:type",
				content: "website",
			},
			{
				property: "og:site_name",
				content: "Nounce",
			},
			// Twitter Card meta tags
			{
				name: "twitter:card",
				content: "summary",
			},
			{
				name: "twitter:title",
				content: appTitle,
			},
			{
				name: "twitter:description",
				content: appDescription,
			},
			{
				name: "twitter:image",
				content: "/og-image.png",
			},
			{
				name: "twitter:url",
				content: "http://localhost:3000/",
			},
			{
				name: "description",
				content: appDescription,
			},
			{
				name: "keywords",
				content:
					"pronunciation, assessment, AI, language learning, speech recognition",
			},
			{
				name: "author",
				content: "Nounce",
			},
		],
		links: [
			{
				rel: "stylesheet",
				href: appCss,
			},
			{
				rel: "icon",
				href: "/favicon.svg",
				type: "image/svg+xml",
			},
			{
				rel: "manifest",
				href: "/manifest.json",
			},
			{
				rel: "preconnect",
				href: "https://fonts.googleapis.com",
			},
			{
				rel: "preconnect",
				href: "https://fonts.gstatic.com",
				crossOrigin: "anonymous",
			},
			{
				rel: "stylesheet",
				href: "https://fonts.googleapis.com/css2?family=Geist:wght@100..900&display=swap",
			},
			{
				rel: "preconnect",
				href: "https://rsms.me/",
			},
			{
				rel: "preconnect",
				href: "https://rsms.me/inter/inter.css",
			},
		],
	}),

	shellComponent: RootDocument,
});

const CRITICAL_CSS = `
:root {
  --background: oklch(1 0 0);
  --foreground: oklch(0.1450 0 0);
  --card: oklch(1 0 0);
  --card-foreground: oklch(0.1450 0 0);
  --popover: oklch(1 0 0);
  --popover-foreground: oklch(0.1450 0 0);
  --primary: oklch(0.2050 0 0);
  --primary-foreground: oklch(0.9850 0 0);
  --secondary: oklch(0.9700 0 0);
  --secondary-foreground: oklch(0.2050 0 0);
  --muted: oklch(0.9700 0 0);
  --muted-foreground: oklch(0.5560 0 0);
  --accent: oklch(0.9700 0 0);
  --accent-foreground: oklch(0.2050 0 0);
  --destructive: oklch(0.5770 0.2450 27.3250);
  --border: oklch(0.9220 0 0);
  --input: oklch(0.9220 0 0);
  --ring: oklch(0.7080 0 0);
  --radius: 0.625rem;
}
.dark {
  --background: oklch(0.1450 0 0);
  --foreground: oklch(0.9850 0 0);
  --card: oklch(0.2050 0 0);
  --card-foreground: oklch(0.9850 0 0);
  --popover: oklch(0.2690 0 0);
  --popover-foreground: oklch(0.9850 0 0);
  --primary: oklch(0.9220 0 0);
  --primary-foreground: oklch(0.2050 0 0);
  --secondary: oklch(0.2690 0 0);
  --secondary-foreground: oklch(0.9850 0 0);
  --muted: oklch(0.2690 0 0);
  --muted-foreground: oklch(0.7080 0 0);
  --accent: oklch(0.3710 0 0);
  --accent-foreground: oklch(0.9850 0 0);
  --destructive: oklch(0.7040 0.1910 22.2160);
  --border: oklch(0.2750 0 0);
  --input: oklch(0.3250 0 0);
  --ring: oklch(0.5560 0 0);
}
html { scrollbar-gutter: stable; }
body {
  margin: 0;
  background-color: var(--background);
  color: var(--foreground);
  -webkit-font-smoothing: antialiased;
  -moz-osx-font-smoothing: grayscale;
}
`;

function RootDocument({ children }: { children: React.ReactNode }) {
	return (
		<html lang="en" suppressHydrationWarning>
			<head>
				{/* biome-ignore lint/security/noDangerouslySetInnerHtml: Critical CSS inlined to prevent FOUC before external stylesheet loads */}
				<style dangerouslySetInnerHTML={{ __html: CRITICAL_CSS }} />
				<HeadContent />
				<script
					// biome-ignore lint/security/noDangerouslySetInnerHtml: Theme initialization script is safe and necessary for SSR
					dangerouslySetInnerHTML={{
						__html: `
						(function() {
							const theme = localStorage.getItem('${THEME_STORAGE_KEY}') || 'system';
							const isDark = theme === 'dark' ||
								(theme === 'system' && window.matchMedia('(prefers-color-scheme: dark)').matches);
							if (isDark) {
								document.documentElement.classList.add('dark');
							}
						})();
					`,
					}}
				/>
			</head>
			<body>
				<ClerkProvider>
					<ThemeInitializer />
					<ThemeProvider>
						{children}
						<Toaster />
					</ThemeProvider>
				</ClerkProvider>
				<Scripts />
			</body>
		</html>
	);
}
