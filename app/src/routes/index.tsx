import { SignedIn, SignedOut } from "@clerk/clerk-react";
import { createFileRoute, Link } from "@tanstack/react-router";
import { MainLayout, PageContainer } from "@/components/layout/main-layout";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import {
	type CommonError,
	MOCK_COMMON_ERRORS,
	MOCK_USER_STATS,
	type UserStats,
} from "@/data/mock";

export const Route = createFileRoute("/")({
	component: HomePage,
});

// ============================================================================
// FEATURE CARDS
// ============================================================================

const features = [
	{
		title: "Practice Texts",
		description:
			"Browse curated texts designed to help you master common pronunciation challenges in English.",
		href: "/practice",
		gradient: "from-blue-500/10 to-cyan-500/10",
		borderColor: "hover:border-blue-500/30",
	},
	{
		title: "Get Insights",
		description:
			"Track your progress over time and identify patterns in your pronunciation to focus your practice.",
		href: "/feed",
		gradient: "from-violet-500/10 to-purple-500/10",
		borderColor: "hover:border-violet-500/30",
	},
	{
		title: "IPA Knowledge",
		description:
			"Learn the International Phonetic Alphabet and understand the sounds of English at a deeper level.",
		href: "/learn",
		gradient: "from-amber-500/10 to-orange-500/10",
		borderColor: "hover:border-amber-500/30",
	},
];

function FeatureCard({
	title,
	description,
	href,
	gradient,
	borderColor,
}: (typeof features)[0]) {
	return (
		<Link to={href} className="group">
			<Card
				className={`h-full transition-all duration-200 ${borderColor} hover:shadow-md`}
			>
				<CardContent className="p-6">
					<div
						className={`mb-4 h-1 w-12 rounded-full bg-linear-to-r ${gradient}`}
					/>
					<h3 className="mb-2 font-semibold text-lg">{title}</h3>
					<p className="text-muted-foreground text-sm leading-relaxed">
						{description}
					</p>
				</CardContent>
			</Card>
		</Link>
	);
}

// ============================================================================
// USER SUMMARY
// ============================================================================

function StatCard({
	label,
	value,
	suffix,
}: {
	label: string;
	value: number;
	suffix?: string;
}) {
	return (
		<div className="text-center">
			<div className="font-semibold text-2xl tabular-nums md:text-3xl">
				{value}
				{suffix}
			</div>
			<div className="text-muted-foreground text-xs uppercase tracking-wide">
				{label}
			</div>
		</div>
	);
}

function UserSummary({ stats }: { stats: UserStats }) {
	return (
		<Card>
			<CardContent className="p-6">
				<div className="mb-6 flex items-center justify-between">
					<h2 className="font-semibold">Your Progress</h2>
					<Link
						to="/feed"
						className="text-muted-foreground text-sm hover:text-foreground"
					>
						View details →
					</Link>
				</div>
				<div className="grid grid-cols-3 gap-4">
					<StatCard label="Total Practice" value={stats.totalAttempts} />
					<StatCard label="This Week" value={stats.weeklyAttempts} />
					<StatCard label="Avg Score" value={stats.averageScore} suffix="%" />
				</div>
			</CardContent>
		</Card>
	);
}

function GuestSummary() {
	return (
		<Card className="border-dashed">
			<CardContent className="flex flex-col items-center gap-4 p-8 text-center">
				<h2 className="font-semibold text-lg">Start Your Journey</h2>
				<p className="max-w-md text-muted-foreground text-sm">
					Sign in to track your progress, see personalized insights, and
					identify your pronunciation patterns over time.
				</p>
				<Button asChild>
					<Link to="/practice">Try a Practice Text</Link>
				</Button>
			</CardContent>
		</Card>
	);
}

// ============================================================================
// COMMON ERRORS SECTION
// ============================================================================

function CommonErrorsSection({ errors }: { errors: CommonError[] }) {
	return (
		<Card>
			<CardContent className="p-6">
				<div className="mb-4 flex items-center justify-between">
					<h2 className="font-semibold">Focus Areas</h2>
					<span className="text-muted-foreground text-xs">
						Most challenging sounds
					</span>
				</div>
				<div className="flex flex-wrap gap-2">
					{errors.slice(0, 5).map((error) => (
						<div
							key={error.phoneme}
							className="flex items-center gap-2 rounded-md bg-muted px-3 py-1.5"
						>
							<span className="font-mono text-sm">{error.phoneme}</span>
							<span className="text-muted-foreground text-xs">
								{error.count}×
							</span>
						</div>
					))}
				</div>
			</CardContent>
		</Card>
	);
}

// ============================================================================
// HERO SECTION
// ============================================================================

function HeroSection() {
	return (
		<div className="space-y-6 text-center">
			<h1 className="bg-linear-to-b from-foreground to-foreground/70 bg-clip-text font-display font-semibold text-3xl text-transparent tracking-tight sm:text-4xl md:text-5xl">
				Improve Your English
				<br />
				Pronunciation
			</h1>
			<p className="mx-auto max-w-2xl text-lg text-muted-foreground leading-relaxed">
				Practice speaking with curated texts, get instant AI-powered feedback,
				and track your progress over time with detailed insights.
			</p>
			<div className="flex flex-col justify-center gap-3 sm:flex-row">
				<Button size="lg" asChild>
					<Link to="/practice">Start Practicing</Link>
				</Button>
				<Button variant="outline" size="lg" asChild>
					<Link to="/learn">Learn More</Link>
				</Button>
			</div>
		</div>
	);
}

// ============================================================================
// MAIN PAGE
// ============================================================================

function HomePage() {
	// In production, this would be fetched from the server
	const stats = MOCK_USER_STATS;
	const commonErrors = MOCK_COMMON_ERRORS;

	return (
		<MainLayout>
			<PageContainer>
				<div className="space-y-12">
					{/* Hero Section */}
					<section className="py-8 md:py-12">
						<HeroSection />
					</section>

					{/* Feature Cards */}
					<section>
						<div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
							{features.map((feature) => (
								<FeatureCard key={feature.title} {...feature} />
							))}
						</div>
					</section>

					{/* User Summary / Guest CTA */}
					<section className="grid gap-6 lg:grid-cols-2">
						<SignedIn>
							<UserSummary stats={stats} />
							<CommonErrorsSection errors={commonErrors} />
						</SignedIn>
						<SignedOut>
							<div className="lg:col-span-2">
								<GuestSummary />
							</div>
						</SignedOut>
					</section>

					{/* CTA Section */}
					<section>
						<Card className="border-primary/20 bg-primary/5">
							<CardContent className="flex flex-col items-center gap-4 p-8 text-center">
								<h2 className="font-semibold text-xl">Ready to improve?</h2>
								<p className="max-w-md text-muted-foreground text-sm">
									Browse our curated practice texts and start improving your
									pronunciation today. Real-time feedback helps you learn
									faster.
								</p>
								<Button asChild>
									<Link to="/practice">Browse Practice Texts</Link>
								</Button>
							</CardContent>
						</Card>
					</section>
				</div>
			</PageContainer>
		</MainLayout>
	);
}
