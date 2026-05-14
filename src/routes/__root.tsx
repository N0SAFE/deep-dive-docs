import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import {
  Outlet,
  createRootRouteWithContext,
  useRouter,
  HeadContent,
  Scripts,
} from "@tanstack/react-router";

import appCss from "../styles.css?url";
import { DocSidebar, DocPagination } from "@/components/doc/DocSidebar";
import { ReadingProgress } from "@/components/doc/ReadingProgress";
import { OnThisPage } from "@/components/doc/OnThisPage";

function NotFoundComponent() {
  return (
    <div className="flex min-h-screen items-center justify-center bg-background px-4">
      <div className="max-w-md text-center">
        <h1 className="font-display text-7xl font-bold gradient-text">404</h1>
        <h2 className="mt-4 font-display text-xl font-semibold">Section not found</h2>
        <p className="mt-2 text-sm text-muted-foreground">
          That page isn't part of this spec.
        </p>
        <a
          href="/"
          className="mt-6 inline-flex items-center justify-center rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90"
        >
          Back to overview
        </a>
      </div>
    </div>
  );
}

function ErrorComponent({ error, reset }: { error: Error; reset: () => void }) {
  console.error(error);
  const router = useRouter();
  return (
    <div className="flex min-h-screen items-center justify-center bg-background px-4">
      <div className="max-w-md text-center">
        <h1 className="font-display text-xl font-semibold">Something broke</h1>
        <p className="mt-2 text-sm text-muted-foreground">{error.message}</p>
        <button
          onClick={() => {
            router.invalidate();
            reset();
          }}
          className="mt-6 inline-flex rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90"
        >
          Try again
        </button>
      </div>
    </div>
  );
}

export const Route = createRootRouteWithContext<{ queryClient: QueryClient }>()({
  head: () => ({
    meta: [
      { charSet: "utf-8" },
      { name: "viewport", content: "width=device-width, initial-scale=1" },
      { title: "Mesh Architecture — Distributed Query & Orchestration" },
      {
        name: "description",
        content:
          "Interactive documentation for the Mesh distributed query, orchestration, peer selection, and bootstrap architecture.",
      },
      { property: "og:title", content: "Mesh Architecture Docs" },
      { property: "og:description", content: "Interactive deep-dive into the Mesh distributed query and orchestration system." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
    links: [{ rel: "stylesheet", href: appCss }],
  }),
  shellComponent: RootShell,
  component: RootComponent,
  notFoundComponent: NotFoundComponent,
  errorComponent: ErrorComponent,
});

function RootShell({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className="dark">
      <head>
        <HeadContent />
      </head>
      <body>
        {children}
        <Scripts />
      </body>
    </html>
  );
}

function RootComponent() {
  const { queryClient } = Route.useRouteContext();
  return (
    <QueryClientProvider client={queryClient}>
      <ReadingProgress />
      <div className="min-h-screen w-full">
        <div className="mx-auto flex w-full max-w-[1600px]">
          <DocSidebar />
          <main className="min-w-0 flex-1 px-6 py-10 md:px-12 md:py-14">
            <div className="mx-auto flex w-full max-w-5xl gap-12">
              <div className="min-w-0 flex-1">
                <Outlet />
                <DocPagination />
              </div>
              <OnThisPage />
            </div>
          </main>
        </div>
      </div>
    </QueryClientProvider>
  );
}
