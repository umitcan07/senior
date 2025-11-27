import type { QueryClient } from "@tanstack/react-query";
import {
	createRootRouteWithContext,
	HeadContent,
	Scripts,
} from "@tanstack/react-router";
import ClerkProvider from "../integrations/clerk/provider";
import { Toaster } from "@/components/ui/toaster";
import appCss from "../styles.css?url";
import "remixicon/fonts/remixicon.css";

interface MyRouterContext {
	queryClient: QueryClient;
}

const appTitle = "Nonce: Improve Your English Pronunciation";
const appDescription =
	"Nonce is an advanced, free-to-use English pronunciation assessment tool powered by signal processing and machine learning.";

export const Route = createRootRouteWithContext<MyRouterContext>()({
	notFoundComponent: () => <div>Not Found</div>,
	errorComponent: () => <div>Error</div>,
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
				content: "Nonce",
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
				content: "Nonce",
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
		],
	}),

	shellComponent: RootDocument,
});

function RootDocument({ children }: { children: React.ReactNode }) {
	return (
		<html lang="en">
			<head>
				<HeadContent />
			</head>
			<body>
				<ClerkProvider>
					{children}
					<Toaster />
				</ClerkProvider>
				<Scripts />
			</body>
		</html>
	);
}
