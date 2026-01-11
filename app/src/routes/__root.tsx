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

function RootDocument({ children }: { children: React.ReactNode }) {
	return (
		<html lang="en" suppressHydrationWarning>
			<head>
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
				<ThemeInitializer />
				<ThemeProvider>
					<ClerkProvider>
						{children}
						<Toaster />
					</ClerkProvider>
				</ThemeProvider>
				<Scripts />
			</body>
		</html>
	);
}
