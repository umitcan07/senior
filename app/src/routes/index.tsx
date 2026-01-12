import { RiBarChartLine, RiBookLine, RiBookOpenLine } from "@remixicon/react";
import { createFileRoute, Link } from "@tanstack/react-router";
import { motion } from "motion/react";
import { MainLayout, PageContainer } from "@/components/layout/main-layout";
import { pageVariants } from "@/components/ui/animations";
import { Button } from "@/components/ui/button";
import { Squares } from "@/components/ui/squares-background";

export const Route = createFileRoute("/")({
	component: HomePage,
});

// FEATURE CARDS

const features = [
	{
		title: "Practice Texts",
		description:
			"Master English pronunciation with curated texts targeting challenging sounds and patterns.",
		href: "/practice",
		icon: <RiBookLine size={20} />,
	},
	{
		title: "Get Insights",
		description:
			"Visualize your improvements with detailed analytics and track your progress over time.",
		href: "/summary",
		icon: <RiBarChartLine size={20} />,
	},
	{
		title: "IPA & English Sounds",
		description:
			"Deepen your understanding of English phonetics with our interactive IPA guide.",
		href: "/learn",
		icon: <RiBookOpenLine size={20} />,
	},
];

function FeatureCard({ title, description, icon, href }: (typeof features)[0]) {
	return (
		<Link
			to={href}
			className="group flex flex-col gap-4 rounded-2xl bg-transparent p-6 transition-colors hover:bg-muted/30"
		>
			<div className="flex size-12 items-center justify-center rounded-xl bg-primary/5 text-primary ring-1 ring-primary/10 transition-colors group-hover:bg-primary/10 group-hover:ring-primary/20">
				{icon}
			</div>
			<div className="flex flex-col items-start gap-2">
				<h3 className="font-medium text-lg leading-tight transition-colors group-hover:text-primary">
					{title}
				</h3>
				<p className="text-balance text-muted-foreground text-sm leading-relaxed">
					{description}
				</p>
			</div>
		</Link>
	);
}

function HeroSection() {
	return (
		<div className="relative isolate flex flex-col items-center gap-6 text-center">
			<Squares
				className="-z-10 absolute inset-0 h-full w-full opacity-10 [mask-image:radial-gradient(ellipse_at_center,white,transparent_75%)]"
				borderColor="var(--primary)"
				hoverFillColor="var(--primary)"
				speed={0.2}
				squareSize={50}
			/>
			<div className="flex flex-col items-center gap-4 py-12 md:py-20">
				<span className="flex items-center gap-2 text-primary text-xs uppercase tracking-widest">
					<span className="h-[1px] w-3 bg-primary/20"></span> Detailed Phonetic Analysis{" "}
					<span className="h-[1px] w-3 bg-primary/20"></span>
				</span>
				<h1 className="max-w-2xl text-balance bg-linear-to-b from-foreground to-foreground/70 bg-clip-text font-display font-semibold text-3xl text-transparent tracking-tight sm:text-5xl md:text-6xl">
					Practice Pronunciation with Confidence
				</h1>
				<p className="max-w-2xl text-lg text-muted-foreground leading-relaxed">
					Learn the English pronunciation with our curated texts, get
					personalized feedback, and track your progress over time with detailed
					insights.
				</p>
				<div className="flex w-full flex-col justify-center gap-3 py-6 sm:w-auto sm:flex-row">
					<Button size="lg" className="w-full sm:w-auto" asChild>
						<Link to="/practice">Start Practicing</Link>
					</Button>
					<Button variant="outline" size="lg" className="w-full sm:w-auto" asChild>
						<a href="https://github.com/umitcan07/senior" target="_blank" rel="noopener noreferrer">Learn More</a>
					</Button>
				</div>
				<p className="mt-6 rounded-sm px-2 py-1 text-balance text-center text-muted-foreground text-xs sm:ring-1 sm:ring-muted">
					Powered by{" "}
					<a
						href="https://huggingface.co/espnet/powsm"
						target="_blank"
						rel="noopener noreferrer"
						className="font-medium decoration-primary/50 underline-offset-4 hover:underline"
					>
						POWSM
					</a>
					: A Phonetic Open Whisper-Style Speech Foundation Model
				</p>
			</div>
		</div>
	);
}

function HomePage() {
	return (
		<MainLayout>
			<motion.div
				variants={pageVariants}
				initial="initial"
				animate="animate"
				exit="exit"
			>
				<PageContainer>
					<div className="flex flex-col gap-16">
						<section className="py-4 md:py-12">
							<HeroSection />
						</section>

						<div className="h-px bg-border/60" />

						<section className="flex flex-col gap-6">
							<h2 className="font-semibold text-lg">Features</h2>
							<div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
								{features.map((feature) => (
									<FeatureCard key={feature.title} {...feature} />
								))}
							</div>
						</section>
					</div>
				</PageContainer>
			</motion.div>
		</MainLayout>
	);
}
