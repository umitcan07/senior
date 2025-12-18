import { createFileRoute, Link } from "@tanstack/react-router";
import { ArrowRight } from "lucide-react";
import {
	MainLayout,
	PageContainer,
	PageHeader,
} from "@/components/layout/main-layout";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardFooter } from "@/components/ui/card";
import { EmptyState } from "@/components/ui/empty-state";
import { InlineLink } from "@/components/ui/inline-link";
import { Skeleton } from "@/components/ui/skeleton";
import { getTextsWithReferenceCounts, type PracticeText } from "@/data/mock";
import { serverGetPracticeTexts } from "@/lib/text";

export const Route = createFileRoute("/practice/")({
	component: PracticePage,
	loader: async () => {
		// Try to load from database first
		const result = await serverGetPracticeTexts();
		if (result.success && result.data.length > 0) {
			// Add mock reference counts since we don't have that data yet
			return {
				texts: result.data.map((text) => ({
					...text,
					referenceCount: Math.floor(Math.random() * 3) + 1,
					wordCount: text.content.split(/\s+/).length,
				})),
				source: "database" as const,
			};
		}

		// Fall back to mock data
		return {
			texts: getTextsWithReferenceCounts(),
			source: "mock" as const,
		};
	},
	pendingComponent: PracticePageSkeleton,
});

// ============================================================================
// TEXT CARD
// ============================================================================

interface TextCardProps {
	text: PracticeText & { referenceCount: number; wordCount: number };
}

function TextCard({ text }: TextCardProps) {
	return (
		<Card className="group h-full flex flex-col transition-all duration-200">
			<CardContent className="flex-1 p-6">
				<p className="line-clamp-5 text-foreground text-sm leading-relaxed">
					{text.content}
				</p>
			</CardContent>
			<CardFooter className="flex items-center justify-between border-t px-6 py-3">
				<Badge variant="secondary" className="text-xs">
					{text.referenceCount} {text.referenceCount === 1 ? "voice" : "voices"}
				</Badge>
				<Button variant="default" size="sm" asChild>
					<Link to="/practice/$textId" params={{ textId: text.id }}>
						Practice
						<ArrowRight size={16} />
					</Link>
				</Button>
			</CardFooter>
		</Card>
	);
}

// ============================================================================
// SKELETON LOADING
// ============================================================================

function TextCardSkeleton() {
	return (
		<Card className="h-full">
			<CardContent className="p-6">
				<div className="flex flex-col gap-2">
					<Skeleton className="h-4 w-full" />
					<Skeleton className="h-4 w-full" />
					<Skeleton className="h-4 w-full" />
					<Skeleton className="h-4 w-3/4" />
				</div>
			</CardContent>
			<CardFooter className="flex items-center justify-between border-t px-6 py-3">
				<Skeleton className="h-3 w-16" />
				<Skeleton className="h-5 w-14 rounded-full" />
			</CardFooter>
		</Card>
	);
}

function PracticePageSkeleton() {
	return (
		<MainLayout>
			<PageContainer>
				<div className="flex flex-col gap-8">
					<div className="flex flex-col gap-2">
						<Skeleton className="h-8 w-48" />
						<Skeleton className="h-4 w-96" />
					</div>
					<div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
						{Array.from({ length: 6 }).map((_, i) => (
							<TextCardSkeleton key={i} />
						))}
					</div>
				</div>
			</PageContainer>
		</MainLayout>
	);
}

// ============================================================================
// MAIN PAGE
// ============================================================================

function PracticePage() {
	const { texts, source } = Route.useLoaderData();

	return (
		<MainLayout>
			<PageContainer>
				<div className="flex flex-col gap-8">
					<PageHeader
						title="Practice Texts"
						description="Choose a text to practice your pronunciation. Each text comes with reference audio to help guide you."
					/>

					{texts.length > 0 ? (
						<div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
							{texts.map((text) => (
								<TextCard key={text.id} text={text} />
							))}
						</div>
					) : (
						<EmptyState
							title="No practice texts available"
							description={
								<>
									The application is still in early development.
									<br />
									Feel free to contact us at{" "}
									<InlineLink href="mailto:umit.evleksiz@std.bogazici.edu.tr">
										umit.evleksiz@std.bogazici.edu.tr
									</InlineLink>
								</>
							}
						/>
					)}

					{source === "mock" && texts.length > 0 && (
						<p className="text-center text-muted-foreground text-xs">
							Showing demo content. Connect to database for real data.
						</p>
					)}
				</div>
			</PageContainer>
		</MainLayout>
	);
}
