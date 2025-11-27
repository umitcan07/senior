import { createFileRoute, Link } from "@tanstack/react-router";
import HeaderUser from "@/integrations/clerk/header-user";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { serverGetTexts } from "@/lib/text";
import { Button } from "@/components/ui/button";
import {
	Card,
	CardContent,
	CardFooter,
} from "@/components/ui/card";
import { RiLoader4Line, RiErrorWarningLine } from "@remixicon/react";

export const Route = createFileRoute("/")({
	component: App,
	loader: async () => {
		const result = await serverGetTexts();
		if (!result.success) {
			throw new Error(result.error.message);
		}
		return { texts: result.data };
	},
});

function App() {
	const getTextsFn = useServerFn(serverGetTexts);
	const loaderData = Route.useLoaderData();

	const { data: texts, isLoading, isError, error } = useQuery({
		queryKey: ["texts"],
		queryFn: async () => {
			const result = await getTextsFn();
			if (!result.success) {
				throw new Error(result.error.message);
			}
			return result.data;
		},
		initialData: loaderData.texts,
	});

	return (
		<div className="min-h-screen bg-gradient-to-b from-background to-muted/20">
			<HeaderUser />
			<main className="container max-w-6xl mx-auto px-4 py-12 md:py-16">
				<div className="space-y-12">
					<div className="text-center space-y-3 max-w-2xl mx-auto">
						<h1 className="text-4xl md:text-5xl font-bold tracking-tight bg-gradient-to-b from-foreground to-foreground/70 bg-clip-text text-transparent">
							Improve Your Pronunciation
						</h1>
						<p className="text-lg text-muted-foreground">
							Practice speaking English with carefully selected texts and get instant feedback on your pronunciation
						</p>
					</div>

					{isLoading && (
						<div className="flex flex-col items-center justify-center py-16">
							<RiLoader4Line className="animate-spin text-3xl text-muted-foreground mb-3" />
							<p className="text-muted-foreground">Loading practice texts...</p>
						</div>
					)}

					{isError && (
						<Card className="border-destructive/50 bg-destructive/5">
							<CardContent className="pt-6">
								<div className="flex flex-col items-center justify-center py-8 text-center">
									<RiErrorWarningLine className="text-3xl text-destructive mb-3" />
									<p className="text-destructive font-medium">
										Unable to load texts
									</p>
									<p className="text-sm text-muted-foreground mt-1">
										{error?.message || "Please try again later"}
									</p>
								</div>
							</CardContent>
						</Card>
					)}

					{texts && texts.length > 0 && (
						<div className="space-y-6">
							<div className="flex items-center justify-between">
								<div>
									<h2 className="text-2xl font-semibold tracking-tight">
										Practice Texts
									</h2>
							
								</div>
							</div>
							<div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
								{texts.map((text) => (
									<Card
										key={text.id}
										className="group hover:shadow-md transition-all duration-200 hover:border-primary/50"
									>
										<CardContent className="pt-6">
											<p className="text-sm text-foreground line-clamp-5 leading-relaxed">
												{text.text}
											</p>
										</CardContent>
										<CardFooter>
											<Link
												to="/record/$textId"
												params={{ textId: String(text.id) }}
												className="w-full"
											>
												<Button
													variant="default"
													className="w-full"
												>
													Start Practice
												</Button>
											</Link>
										</CardFooter>
									</Card>
								))}
							</div>
						</div>
					)}

					{texts && texts.length === 0 && (
						<Card className="border-dashed">
							<CardContent className="pt-6">
								<div className="flex flex-col items-center justify-center py-12 text-center">
									<div className="rounded-full bg-muted p-4 mb-4">
										<div className="w-8 h-8 border-2 border-muted-foreground/30 border-t-foreground rounded-full animate-spin" />
									</div>
									<h3 className="text-lg font-semibold mb-2">
										No practice texts available
									</h3>
									<p className="text-sm text-muted-foreground max-w-sm">
										Check back soon for new pronunciation practice materials
									</p>
								</div>
							</CardContent>
						</Card>
					)}
				</div>
			</main>
		</div>
	);
}
