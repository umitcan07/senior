import { createFileRoute, Link } from "@tanstack/react-router";
import {
	MainLayout,
	PageContainer,
	PageHeader,
} from "@/components/layout/main-layout";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

export const Route = createFileRoute("/learn")({
	component: LearningPage,
});

// ============================================================================
// IPA SECTION
// ============================================================================

interface IPASymbol {
	symbol: string;
	example: string;
	word: string;
}

const vowels: IPASymbol[] = [
	{ symbol: "iː", example: "fleece", word: "see" },
	{ symbol: "ɪ", example: "kit", word: "sit" },
	{ symbol: "e", example: "dress", word: "bed" },
	{ symbol: "æ", example: "trap", word: "cat" },
	{ symbol: "ɑː", example: "palm", word: "father" },
	{ symbol: "ɒ", example: "lot", word: "hot" },
	{ symbol: "ɔː", example: "thought", word: "saw" },
	{ symbol: "ʊ", example: "foot", word: "put" },
	{ symbol: "uː", example: "goose", word: "too" },
	{ symbol: "ʌ", example: "strut", word: "cup" },
	{ symbol: "ɜː", example: "nurse", word: "bird" },
	{ symbol: "ə", example: "comma", word: "about" },
];

const consonants: IPASymbol[] = [
	{ symbol: "p", example: "pea", word: "pet" },
	{ symbol: "b", example: "bee", word: "bed" },
	{ symbol: "t", example: "tea", word: "ten" },
	{ symbol: "d", example: "dee", word: "dog" },
	{ symbol: "k", example: "key", word: "cat" },
	{ symbol: "g", example: "gee", word: "go" },
	{ symbol: "f", example: "fee", word: "fan" },
	{ symbol: "v", example: "vee", word: "van" },
	{ symbol: "θ", example: "thigh", word: "think" },
	{ symbol: "ð", example: "thy", word: "this" },
	{ symbol: "s", example: "sea", word: "sit" },
	{ symbol: "z", example: "zee", word: "zoo" },
	{ symbol: "ʃ", example: "she", word: "ship" },
	{ symbol: "ʒ", example: "genre", word: "measure" },
	{ symbol: "h", example: "he", word: "hat" },
	{ symbol: "m", example: "em", word: "man" },
	{ symbol: "n", example: "en", word: "no" },
	{ symbol: "ŋ", example: "eng", word: "sing" },
	{ symbol: "l", example: "el", word: "let" },
	{ symbol: "r", example: "ar", word: "red" },
	{ symbol: "j", example: "yay", word: "yes" },
	{ symbol: "w", example: "woo", word: "wet" },
];

function IPAChart({ title, symbols }: { title: string; symbols: IPASymbol[] }) {
	return (
		<Card>
			<CardHeader className="pb-3">
				<CardTitle className="text-base">{title}</CardTitle>
			</CardHeader>
			<CardContent>
				<div className="grid grid-cols-3 gap-2 sm:grid-cols-4 md:grid-cols-6">
					{symbols.map((item) => (
						<div
							key={item.symbol}
							className="flex flex-col items-center gap-1 rounded-lg bg-muted/50 p-3 text-center"
						>
							<span className="font-mono text-lg">{item.symbol}</span>
							<span className="text-muted-foreground text-xs">{item.word}</span>
						</div>
					))}
				</div>
			</CardContent>
		</Card>
	);
}

// ============================================================================
// TIPS SECTION
// ============================================================================

const tips = [
	{
		title: "Listen First",
		description:
			"Before speaking, listen to the reference audio several times to understand the rhythm and intonation.",
	},
	{
		title: "Record Yourself",
		description:
			"Recording and listening to your own speech helps you identify areas for improvement.",
	},
	{
		title: "Focus on Problem Sounds",
		description:
			"Identify the sounds that are most challenging for you and practice them in isolation first.",
	},
	{
		title: "Slow Down",
		description:
			"Speed comes with practice. Start slowly to ensure accuracy, then gradually increase speed.",
	},
	{
		title: "Use Minimal Pairs",
		description:
			"Practice words that differ by only one sound (like 'ship' and 'sheep') to train your ear.",
	},
	{
		title: "Practice Daily",
		description:
			"Consistent short practice sessions are more effective than occasional long sessions.",
	},
];

function TipsSection() {
	return (
		<Card>
			<CardHeader className="pb-3">
				<CardTitle className="text-base">Pronunciation Tips</CardTitle>
			</CardHeader>
			<CardContent>
				<div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
					{tips.map((tip) => (
						<div key={tip.title} className="space-y-1">
							<h4 className="font-medium text-sm">{tip.title}</h4>
							<p className="text-muted-foreground text-xs leading-relaxed">
								{tip.description}
							</p>
						</div>
					))}
				</div>
			</CardContent>
		</Card>
	);
}

// ============================================================================
// MAIN PAGE
// ============================================================================

function LearningPage() {
	return (
		<MainLayout>
			<PageContainer>
				<div className="space-y-8">
					<PageHeader
						title="Learning Resources"
						description="Learn about the International Phonetic Alphabet and improve your pronunciation skills"
					/>

					{/* Quick Start CTA */}
					<Card className="border-primary/20 bg-primary/5">
						<CardContent className="flex flex-col items-center gap-4 py-8 text-center sm:flex-row sm:justify-between sm:text-left">
							<div className="space-y-1">
								<h3 className="font-semibold">Ready to practice?</h3>
								<p className="text-muted-foreground text-sm">
									Put your knowledge to the test with our practice texts.
								</p>
							</div>
							<Button asChild>
								<Link to="/practice">Start Practicing</Link>
							</Button>
						</CardContent>
					</Card>

					{/* IPA Charts */}
					<div className="space-y-4">
						<h2 className="font-semibold text-lg">
							International Phonetic Alphabet (IPA)
						</h2>
						<p className="text-muted-foreground text-sm">
							The IPA is a system of phonetic notation used to represent the
							sounds of spoken language. Understanding these symbols will help
							you improve your pronunciation.
						</p>
					</div>

					<IPAChart title="Vowel Sounds" symbols={vowels} />
					<IPAChart title="Consonant Sounds" symbols={consonants} />

					{/* Tips Section */}
					<TipsSection />

					{/* Additional Resources */}
					<Card>
						<CardHeader className="pb-3">
							<CardTitle className="text-base">Additional Resources</CardTitle>
						</CardHeader>
						<CardContent>
							<p className="text-muted-foreground text-sm">
								More learning resources and articulation guides are coming soon.
								In the meantime, practice regularly with our curated texts to
								improve your pronunciation.
							</p>
						</CardContent>
					</Card>
				</div>
			</PageContainer>
		</MainLayout>
	);
}
