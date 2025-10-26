import {
  HeadContent,
  Scripts,
  createRootRouteWithContext,
} from "@tanstack/react-router";
import { TanStackRouterDevtoolsPanel } from "@tanstack/react-router-devtools";
import { TanStackDevtools } from "@tanstack/react-devtools";
import ClerkProvider from "../integrations/clerk/provider";
import TanStackQueryDevtools from "../integrations/tanstack-query/devtools";
import appCss from "../styles.css?url";
import type { QueryClient } from "@tanstack/react-query";

interface MyRouterContext {
  queryClient: QueryClient;
}

const appTitle = "Nonce: Improve Your English Pronunciation";
const appDescription =
  "Nonce is an advanced, free-to-use English pronunciation assessment tool powered by signal processing and machine learning.";

export const Route = createRootRouteWithContext<MyRouterContext>()({
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
          <TanStackDevtools
            config={{
              position: "bottom-right",
            }}
            plugins={[
              {
                name: "Tanstack Router",
                render: <TanStackRouterDevtoolsPanel />,
              },
              TanStackQueryDevtools,
            ]}
          />
        </ClerkProvider>
        <Scripts />
      </body>
    </html>
  );
}
