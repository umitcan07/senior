import { RiArrowDownSLine, RiVolumeUpLine } from "@remixicon/react";
import { createFileRoute, Link } from "@tanstack/react-router";
import { motion } from "motion/react";
import { useCallback, useEffect, useRef, useState } from "react";
import { MainLayout, PageContainer } from "@/components/layout/main-layout";
import { pageVariants } from "@/components/ui/animations";
import { Button } from "@/components/ui/button";
import { SectionTitle } from "@/components/ui/section-title";
import { Spinner } from "@/components/ui/spinner";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";

import { useToast } from "@/hooks/use-toast";
import { DIALECTS, type Dialect } from "@/lib/dialect";
import { cn } from "@/lib/utils";

// Speaker metadata for /learn word audio (matches data/authors.json)
const SPEAKERS = [
	{ id: "genam_jordan", dialect: "us" as Dialect, name: "Jordan" },
	{ id: "genam_katherine", dialect: "us" as Dialect, name: "Katherine" },
	{ id: "genam_teyanna", dialect: "us" as Dialect, name: "Teyanna" },
	{ id: "rp_jon", dialect: "uk" as Dialect, name: "Jon" },
] as const;

type SpeakerId = (typeof SPEAKERS)[number]["id"];

const DEFAULT_SPEAKER: SpeakerId = "genam_jordan";
const SPEAKER_PREF_KEY = "nounce_learn_speaker";

function getSavedSpeaker(): SpeakerId {
	try {
		const saved = localStorage.getItem(SPEAKER_PREF_KEY);
		if (saved && SPEAKERS.some((s) => s.id === saved))
			return saved as SpeakerId;
	} catch {
		// localStorage unavailable (SSR / private mode)
	}
	return DEFAULT_SPEAKER;
}

function saveSpeaker(id: SpeakerId) {
	try {
		localStorage.setItem(SPEAKER_PREF_KEY, id);
	} catch {
		// ignore
	}
}

export const Route = createFileRoute("/learn")({
	component: LearningPage,
});

// Static R2 audio map for IPA sounds
// Keys are R2 storage paths, values will be fetched via /api/audio/learn/{key}
// Using WAV PCM 16kHz format
const IPA_AUDIO_MAP: Record<
	string,
	{ word: string; wordAudio: string; soundAudio: string }
> = {
	// Vowels
	iː: {
		word: "see",
		wordAudio: "see.wav",
		soundAudio: "ipa/sounds/i.ogg",
	},
	ɪ: {
		word: "sit",
		wordAudio: "sit.wav",
		soundAudio: "ipa/sounds/ɪ.ogg",
	},
	e: {
		word: "bed",
		wordAudio: "bed.wav",
		soundAudio: "ipa/sounds/e.ogg",
	},
	æ: {
		word: "cat",
		wordAudio: "cat.wav",
		soundAudio: "ipa/sounds/æ.ogg",
	},
	ɑː: {
		word: "father",
		wordAudio: "father.wav",
		soundAudio: "ipa/sounds/ɑ.ogg",
	},
	ɒ: {
		word: "hot",
		wordAudio: "hot.wav",
		soundAudio: "ipa/sounds/ɒ.ogg",
	},
	ɔː: {
		word: "saw",
		wordAudio: "saw.wav",
		soundAudio: "ipa/sounds/ɔ.ogg",
	},
	ʊ: {
		word: "put",
		wordAudio: "put.wav",
		soundAudio: "ipa/sounds/ʊ.ogg",
	},
	uː: {
		word: "too",
		wordAudio: "too.wav",
		soundAudio: "ipa/sounds/u.ogg",
	},
	ʌ: {
		word: "cup",
		wordAudio: "cup.wav",
		soundAudio: "ipa/sounds/ʌ.ogg",
	},
	ɜː: {
		word: "bird",
		wordAudio: "bird.wav",
		soundAudio: "ipa/sounds/ɜ.ogg",
	},
	ə: {
		word: "about",
		wordAudio: "about.wav",
		soundAudio: "ipa/sounds/ə.ogg",
	},
	// Diphthongs
	eɪ: {
		word: "day",
		wordAudio: "day.wav",
		soundAudio: "ipa/sounds/ei.wav",
	},
	aɪ: {
		word: "my",
		wordAudio: "my.wav",
		soundAudio: "ipa/sounds/ai.wav",
	},
	ɔɪ: {
		word: "boy",
		wordAudio: "boy.wav",
		soundAudio: "ipa/sounds/oi.wav",
	},
	aʊ: {
		word: "now",
		wordAudio: "now.wav",
		soundAudio: "ipa/sounds/au.wav",
	},
	əʊ: {
		word: "go",
		wordAudio: "go.wav",
		soundAudio: "ipa/sounds/ou.wav",
	},
	ɪə: {
		word: "near",
		wordAudio: "near.wav",
		soundAudio: "ipa/sounds/ia.wav",
	},
	eə: {
		word: "hair",
		wordAudio: "hair.wav",
		soundAudio: "ipa/sounds/ea.wav",
	},
	ʊə: {
		word: "pure",
		wordAudio: "pure.wav",
		soundAudio: "ipa/sounds/ua.wav",
	},
	// Consonants
	p: {
		word: "pet",
		wordAudio: "pet.wav",
		soundAudio: "ipa/sounds/p.ogg",
	},
	b: {
		word: "bed",
		wordAudio: "bed.wav",
		soundAudio: "ipa/sounds/b.ogg",
	},
	t: {
		word: "ten",
		wordAudio: "ten.wav",
		soundAudio: "ipa/sounds/t.ogg",
	},
	d: {
		word: "dog",
		wordAudio: "dog.wav",
		soundAudio: "ipa/sounds/d.ogg",
	},
	k: {
		word: "cat",
		wordAudio: "cat-k.wav",
		soundAudio: "ipa/sounds/k.ogg",
	},
	g: {
		word: "go",
		wordAudio: "go-g.wav",
		soundAudio: "ipa/sounds/g.ogg",
	},
	f: {
		word: "fan",
		wordAudio: "fan.wav",
		soundAudio: "ipa/sounds/f.ogg",
	},
	v: {
		word: "van",
		wordAudio: "van.wav",
		soundAudio: "ipa/sounds/v.ogg",
	},
	θ: {
		word: "think",
		wordAudio: "think.wav",
		soundAudio: "ipa/sounds/θ.ogg",
	},
	ð: {
		word: "this",
		wordAudio: "this.wav",
		soundAudio: "ipa/sounds/ð.ogg",
	},
	s: {
		word: "sit",
		wordAudio: "sit-s.wav",
		soundAudio: "ipa/sounds/s.ogg",
	},
	z: {
		word: "zoo",
		wordAudio: "zoo.wav",
		soundAudio: "ipa/sounds/z.ogg",
	},
	ʃ: {
		word: "ship",
		wordAudio: "ship.wav",
		soundAudio: "ipa/sounds/ʃ.ogg",
	},
	ʒ: {
		word: "measure",
		wordAudio: "measure.wav",
		soundAudio: "ipa/sounds/ʒ.ogg",
	},
	h: {
		word: "hat",
		wordAudio: "hat.wav",
		soundAudio: "ipa/sounds/h.ogg",
	},
	tʃ: {
		word: "church",
		wordAudio: "church.wav",
		soundAudio: "ipa/sounds/ch.ogg",
	},
	dʒ: {
		word: "judge",
		wordAudio: "judge.wav",
		soundAudio: "ipa/sounds/dʒ.ogg",
	},
	m: {
		word: "man",
		wordAudio: "man.wav",
		soundAudio: "ipa/sounds/m.ogg",
	},
	n: {
		word: "no",
		wordAudio: "no.wav",
		soundAudio: "ipa/sounds/n.ogg",
	},
	ŋ: {
		word: "sing",
		wordAudio: "sing.wav",
		soundAudio: "ipa/sounds/ŋ.ogg",
	},
	l: {
		word: "let",
		wordAudio: "let.wav",
		soundAudio: "ipa/sounds/l.ogg",
	},
	r: {
		word: "red",
		wordAudio: "red.wav",
		soundAudio: "ipa/sounds/r.ogg",
	},
	j: {
		word: "yes",
		wordAudio: "yes.wav",
		soundAudio: "ipa/sounds/j.ogg",
	},
	w: {
		word: "wet",
		wordAudio: "wet.wav",
		soundAudio: "ipa/sounds/w.ogg",
	},
};

// IPA data with highlight indices
interface IPASymbol {
	symbol: string;
	word: string;
	highlightIndices: number[];
}

const vowels: IPASymbol[] = [
	{ symbol: "iː", word: "see", highlightIndices: [1, 2] },
	{ symbol: "ɪ", word: "sit", highlightIndices: [1] },
	{ symbol: "e", word: "bed", highlightIndices: [1] },
	{ symbol: "æ", word: "cat", highlightIndices: [1] },
	{ symbol: "ɑː", word: "father", highlightIndices: [1] },
	{ symbol: "ɒ", word: "hot", highlightIndices: [1] },
	{ symbol: "ɔː", word: "saw", highlightIndices: [1, 2] },
	{ symbol: "ʊ", word: "put", highlightIndices: [1] },
	{ symbol: "uː", word: "too", highlightIndices: [1, 2] },
	{ symbol: "ʌ", word: "cup", highlightIndices: [1] },
	{ symbol: "ɜː", word: "bird", highlightIndices: [1, 2] },
	{ symbol: "ə", word: "about", highlightIndices: [0] },
];

const diphthongs: IPASymbol[] = [
	{ symbol: "eɪ", word: "day", highlightIndices: [1, 2] },
	{ symbol: "aɪ", word: "my", highlightIndices: [1] },
	{ symbol: "ɔɪ", word: "boy", highlightIndices: [1, 2] },
	{ symbol: "aʊ", word: "now", highlightIndices: [1, 2] },
	{ symbol: "əʊ", word: "go", highlightIndices: [1] },
	{ symbol: "ɪə", word: "near", highlightIndices: [1, 2] },
	{ symbol: "eə", word: "hair", highlightIndices: [1, 2] },
	{ symbol: "ʊə", word: "pure", highlightIndices: [1, 2] },
];

const consonants: IPASymbol[] = [
	{ symbol: "p", word: "pet", highlightIndices: [0] },
	{ symbol: "b", word: "bed", highlightIndices: [0] },
	{ symbol: "t", word: "ten", highlightIndices: [0] },
	{ symbol: "d", word: "dog", highlightIndices: [0] },
	{ symbol: "k", word: "cat", highlightIndices: [0] },
	{ symbol: "g", word: "go", highlightIndices: [0] },
	{ symbol: "f", word: "fan", highlightIndices: [0] },
	{ symbol: "v", word: "van", highlightIndices: [0] },
	{ symbol: "θ", word: "think", highlightIndices: [0, 1] },
	{ symbol: "ð", word: "this", highlightIndices: [0, 1] },
	{ symbol: "s", word: "sit", highlightIndices: [0] },
	{ symbol: "z", word: "zoo", highlightIndices: [0] },
	{ symbol: "ʃ", word: "ship", highlightIndices: [0, 1] },
	{ symbol: "ʒ", word: "measure", highlightIndices: [3] },
	{ symbol: "h", word: "hat", highlightIndices: [0] },
	{ symbol: "tʃ", word: "church", highlightIndices: [0, 1] },
	{ symbol: "dʒ", word: "judge", highlightIndices: [0, 1] },
	{ symbol: "m", word: "man", highlightIndices: [0] },
	{ symbol: "n", word: "no", highlightIndices: [0] },
	{ symbol: "ŋ", word: "sing", highlightIndices: [2, 3] },
	{ symbol: "l", word: "let", highlightIndices: [0] },
	{ symbol: "r", word: "red", highlightIndices: [0] },
	{ symbol: "j", word: "yes", highlightIndices: [0] },
	{ symbol: "w", word: "wet", highlightIndices: [0] },
];

type PlaybackMode = "word" | "sound";

function HighlightedWord({
	word,
	highlightIndices,
}: {
	word: string;
	highlightIndices: number[];
}) {
	return (
		<span className="font-medium tracking-wide">
			{word.split("").map((char, index) => (
				<span
					key={index}
					className={cn(
						highlightIndices.includes(index)
							? "font-bold text-primary"
							: "text-muted-foreground",
					)}
				>
					{char}
				</span>
			))}
		</span>
	);
}

// IPA MARKER CARD

interface IPAMarkerCardProps {
	icon: string;
	title: string;
	subtitle: string;
	description: string;
	examples: React.ReactNode;
}

function IPAMarkerCard({
	icon,
	title,
	subtitle,
	description,
	examples,
}: IPAMarkerCardProps) {
	return (
		<details className="group overflow-hidden rounded-xl border border-border/40 bg-card transition-colors hover:border-border/60 hover:bg-muted/5">
			<summary className="flex cursor-pointer list-none items-center justify-between p-5 transition-colors hover:bg-muted/10">
				<div className="flex items-center gap-3">
					<div className="flex size-10 items-center justify-center rounded-lg bg-primary/10 font-ipa text-2xl text-primary">
						{icon}
					</div>
					<div className="flex flex-col">
						<h4 className="font-semibold text-base">{title}</h4>
						<span className="font-mono text-base text-muted-foreground">
							{subtitle}
						</span>
					</div>
				</div>
				<RiArrowDownSLine className="size-5 shrink-0 text-muted-foreground transition-transform duration-200 group-open:rotate-180" />
			</summary>
			<div className="flex flex-col gap-3 px-5 pb-5 transition-all duration-200 ease-in-out">
				<p className="text-base text-muted-foreground leading-relaxed">
					{description}
				</p>
				<div className="mt-2 rounded bg-muted/20 p-2">
					<p className="font-mono text-base">{examples}</p>
				</div>
			</div>
		</details>
	);
}

// IPA ITEM

function IPAItem({
	item,
	playbackMode,
	onPlay,
	isPlaying,
	isLoading,
}: {
	item: IPASymbol;
	playbackMode: PlaybackMode;
	onPlay: (symbol: string, mode: PlaybackMode) => void;
	isPlaying: boolean;
	isLoading: boolean;
}) {
	return (
		<button
			type="button"
			onClick={() => onPlay(item.symbol, playbackMode)}
			disabled={isLoading}
			className={cn(
				"group relative flex flex-col items-center justify-center overflow-hidden rounded-xl text-center transition-all duration-200",
				"border border-border/30 hover:border-border/60 hover:bg-muted/20",
				"focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2",
				isPlaying && "bg-primary/5 ring-1 ring-primary/20",
			)}
		>
			{/* Listen icon - absolute top right */}
			<div className="absolute top-2 right-2 z-10">
				{isLoading ? (
					<Spinner className="size-3" />
				) : (
					<RiVolumeUpLine
						className={cn(
							"size-3 text-muted-foreground transition-opacity",
							"opacity-0 group-hover:opacity-100",
							isPlaying && "text-primary opacity-100",
						)}
					/>
				)}
			</div>

			{/* Top section - IPA symbol */}
			<div className="flex flex-1 items-center justify-center px-4 pt-6 pb-3">
				<span className="font-ipa text-2xl text-foreground/80 tracking-wide transition-colors group-hover:text-foreground">
					{item.symbol}
				</span>
			</div>

			{/* Bottom section - word */}
			<div className="w-full px-4 pb-4 text-base">
				<HighlightedWord
					word={item.word}
					highlightIndices={item.highlightIndices}
				/>
			</div>
		</button>
	);
}

function IPASection({
	title,
	description,
	symbols,
	playbackMode,
	onPlay,
	playingId,
	loadingId,
}: {
	title: string;
	description?: string;
	symbols: IPASymbol[];
	playbackMode: PlaybackMode;
	onPlay: (symbol: string, mode: PlaybackMode) => void;
	playingId: string | null;
	loadingId: string | null;
}) {
	return (
		<section className="flex flex-col gap-8">
			<SectionTitle title={title} description={description} variant="default" />
			<div className="grid grid-cols-3 gap-2 sm:grid-cols-4 md:grid-cols-6 lg:grid-cols-8">
				{symbols.map((item) => {
					const id = `${item.symbol}-${playbackMode}`;
					return (
						<IPAItem
							key={item.symbol}
							item={item}
							playbackMode={playbackMode}
							onPlay={onPlay}
							isPlaying={playingId === id}
							isLoading={loadingId === id}
						/>
					);
				})}
			</div>
		</section>
	);
}

// ACCENT DIFFERENCES DATA

interface AccentDifference {
	id: string;
	title: string;
	subtitle?: string;
	ame: string;
	bre: string;
}

interface AccentCategory {
	title: string;
	items: AccentDifference[];
}

const ACCENT_DATA: AccentCategory[] = [
	{
		title: "1. Major Vowel System Differences",
		items: [
			{
				id: "lot-palm",
				title: "LOT–PALM relation",
				subtitle: "'bother' vs 'father'",
				ame: "LOT close to PALM. 'bother' ≈ 'father' in vowel quality for many speakers.",
				bre: "LOT (/ɒ/) distinct from PALM (/ɑː/). 'bother' (/ˈbɒðə/) vs 'father' (/ˈfɑːðə/).",
			},
			{
				id: "cot-caught",
				title: "Cot–caught merger",
				subtitle: "LOT–THOUGHT",
				ame: "Many regions merge cot and caught (same vowel).",
				bre: "Usually distinct /ɒ/ vs /ɔː/ in many accents.",
			},
			{
				id: "bath-trap",
				title: "BATH/TRAP split",
				subtitle: "bath, dance, ask",
				ame: "Commonly keeps /æ/. (bath, dance, ask)",
				bre: "Many words take /ɑː/. (bath, dance, ask, laugh, after)",
			},
			{
				id: "short-a",
				title: "Short 'a' behavior",
				subtitle: "/æ/ tensing",
				ame: "Often has /æ/ tensing in specific environments (man, can't → [eə]).",
				bre: "Generally more stable /æ/ (no big tensing system).",
			},
			{
				id: "weak-vowel",
				title: "Weak vowel /ə/ vs /ɪ/",
				subtitle: "In unstressed syllables",
				ame: "More often uses schwa /ə/ (Rosa's vs roses). Final happy vowel often [i].",
				bre: "Often uses /ɪ/ (boxes, wanted). Final happy vowel tenser [i].",
			},
		],
	},
	{
		title: "2. Diphthongs: GOAT and FACE",
		items: [
			{
				id: "goat",
				title: "GOAT",
				ame: "/oʊ/ with a back rounded start.",
				bre: "/əʊ/ often more central start (RP-ish).",
			},
			{
				id: "face",
				title: "FACE",
				ame: "/eɪ/ (often fairly 'pure' starting vowel).",
				bre: "/eɪ/ too, but typical realizations can be narrower/tenser.",
			},
		],
	},
	{
		title: "3. Yod (/j/) differences after consonants",
		items: [
			{
				id: "yod-dropping",
				title: "Yod dropping",
				subtitle: "After /t d n s z l/",
				ame: "tune /tuːn/, new /nuː/, duty /ˈduːti/",
				bre: "tune /tjuːn/, new /njuː/, duty /ˈdjuːti/",
			},
			{
				id: "yod-coalescence",
				title: "Yod coalescence",
				subtitle: "In casual speech",
				ame: "Tends to keep /t/+/j/ more separate, or drop /j/.",
				bre: "Tuesday ≈ /ˈtʃuːzdeɪ/, during ≈ /ˈdʒʊərɪŋ/.",
			},
		],
	},
	{
		title: "4. T quality and placement",
		items: [
			{
				id: "glottal-t",
				title: "Glottal /t/",
				subtitle: "bottle, football",
				ame: "Far less typical in mainstream AmE.",
				bre: "Common in many accents (bottle [ˈbɒʔl]).",
			},
			{
				id: "aspiration",
				title: "Aspiration",
				ame: "Transitions differ due to rhoticity.",
				bre: "Timing/strength of aspiration can differ.",
			},
		],
	},
	{
		title: "5. R-linking phenomena",
		items: [
			{
				id: "linking-r",
				title: "Linking & Intrusive R",
				ame: "Generally doesn't have intrusive R (pronounces /r/ when present).",
				bre: "Non-rhotic accents use Linking R (far away → /fɑːr əˈweɪ/) and Intrusive R (idea-r-of).",
			},
		],
	},
	{
		title: "6. L ('dark l') distribution",
		items: [
			{
				id: "dark-l",
				title: "Dark L placement",
				ame: "Often has very 'dark' [ɫ] in positions, even onset.",
				bre: "RP has clear [l] in onset, dark in coda. Some accents vocalize (milk ≈ [mɪʊk]).",
			},
		],
	},
	{
		title: "7. Tapping of /r/ & Coloring",
		items: [
			{
				id: "r-coloring",
				title: "R-coloring",
				ame: "Strong rhotic coloring (bird, nurse).",
				bre: "Non-rhotic: vowel quality/length carries contrast; /r/ disappears in coda.",
			},
		],
	},
	{
		title: "8. Stress",
		items: [
			{
				id: "stress",
				title: "Word Stress",
				subtitle: "garage, advertisement, laboratory",
				ame: "Stress placement differs by variety.",
				bre: "Stress placement differs by variety.",
			},
		],
	},
];

// Helper function to wrap IPA symbols in font-ipa spans
function renderTextWithIPA(text: string) {
	// Match IPA symbols in slashes /.../ or brackets [...]
	const ipaRegex = /(\/[^/]+\/|\[[^\]]+\])/g;
	const parts: string[] = [];
	let lastIndex = 0;

	// Reset regex
	ipaRegex.lastIndex = 0;

	let match = ipaRegex.exec(text);
	while (match !== null) {
		// Add text before the match
		if (match.index > lastIndex) {
			parts.push(text.slice(lastIndex, match.index));
		}
		// Add the IPA match
		parts.push(match[0]);
		lastIndex = ipaRegex.lastIndex;
		match = ipaRegex.exec(text);
	}

	// Add remaining text
	if (lastIndex < text.length) {
		parts.push(text.slice(lastIndex));
	}

	return parts.map((part, index) => {
		// Check if this part is an IPA symbol (starts with / or [)
		if (part.startsWith("/") || part.startsWith("[")) {
			return (
				<span key={index} className="font-ipa text-xl">
					{part}
				</span>
			);
		}
		return <span key={index}>{part}</span>;
	});
}

function AccentDifferenceCard({ item }: { item: AccentDifference }) {
	return (
		<div className="flex flex-col gap-3 rounded-lg border border-border/40 bg-card p-4 transition-all hover:bg-muted/10 hover:shadow-sm">
			<div className="flex flex-col gap-1">
				<h4 className="font-semibold text-base text-foreground">
					{item.title}
				</h4>
				{item.subtitle && (
					<span className="text-muted-foreground text-sm">{item.subtitle}</span>
				)}
			</div>

			<div className="grid grid-cols-2 gap-4 pt-2 text-base">
				<div className="flex flex-col gap-1.5">
					<div className="flex items-center gap-1.5 text-muted-foreground text-sm uppercase tracking-wider">
						<span className="text-lg">{DIALECTS.us.flag}</span>{" "}
						{DIALECTS.us.short}
					</div>
					<p className="text-muted-foreground text-sm leading-relaxed">
						{renderTextWithIPA(item.ame)}
					</p>
				</div>

				<div className="flex flex-col gap-1.5">
					<div className="flex items-center gap-1.5 text-muted-foreground text-sm uppercase tracking-wider">
						<span className="text-lg">{DIALECTS.uk.flag}</span>{" "}
						{DIALECTS.uk.short}
					</div>
					<p className="text-muted-foreground text-sm leading-relaxed">
						{renderTextWithIPA(item.bre)}
					</p>
				</div>
			</div>
		</div>
	);
}

function AccentCategorySection({ category }: { category: AccentCategory }) {
	return (
		<div className="flex flex-col gap-4">
			<h3 className="font-medium text-primary/80 text-xl tracking-tight">
				{category.title}
			</h3>
			<div className="grid gap-4 md:grid-cols-2">
				{category.items.map((item) => (
					<AccentDifferenceCard key={item.id} item={item} />
				))}
			</div>
		</div>
	);
}

function AccentDifferencesSection() {
	return (
		<section className="flex flex-col gap-16">
			<SectionTitle
				title="American vs British English"
				variant="playful"
				description="Major pronunciation differences beyond just the 'R' and 'T' sounds. Understanding these helps you target your preferred accent."
			/>

			<div className="flex flex-col gap-10">
				{ACCENT_DATA.map((category) => (
					<AccentCategorySection key={category.title} category={category} />
				))}
			</div>
		</section>
	);
}

// MAIN PAGE

function LearningPage() {
	const { toast } = useToast();
	const [playbackMode, setPlaybackMode] = useState<PlaybackMode>("word");
	const [speakerId, setSpeakerId] = useState<SpeakerId>(DEFAULT_SPEAKER);

	useEffect(() => {
		try {
			const saved = localStorage.getItem(SPEAKER_PREF_KEY);
			if (saved && SPEAKERS.some((s) => s.id === saved))
				setSpeakerId(saved as SpeakerId);
		} catch {
			// localStorage unavailable (private mode)
		}
	}, []);
	const [playingId, setPlayingId] = useState<string | null>(null);
	const [loadingId, setLoadingId] = useState<string | null>(null);
	const audioRef = useRef<HTMLAudioElement | null>(null);

	const handleSpeakerChange = useCallback((id: SpeakerId) => {
		setSpeakerId(id);
		saveSpeaker(id);
	}, []);

	const handlePlay = useCallback(
		async (symbol: string, mode: PlaybackMode) => {
			const id =
				mode === "word"
					? `${symbol}-${mode}-${speakerId}`
					: `${symbol}-${mode}`;

			// If already playing this item, stop it
			if (playingId === id && audioRef.current) {
				audioRef.current.pause();
				audioRef.current.currentTime = 0;
				setPlayingId(null);
				return;
			}

			// Stop any currently playing audio
			if (audioRef.current) {
				audioRef.current.pause();
				audioRef.current.currentTime = 0;
			}

			// Get the audio key from the static map
			const audioData = IPA_AUDIO_MAP[symbol];
			if (!audioData) {
				console.error(`No audio data found for symbol: ${symbol}`);
				toast({
					variant: "destructive",
					description: "Audio not available for this symbol",
				});
				return;
			}

			const audioKey =
				mode === "word"
					? `ipa/words/${speakerId}/${audioData.wordAudio}`
					: audioData.soundAudio;
			const audioUrl = audioKey.endsWith(".ogg")
				? `/${audioKey}`
				: `/api/audio/learn/${encodeURIComponent(audioKey)}`;

			setLoadingId(id);

			try {
				const audio = new Audio(audioUrl);
				audioRef.current = audio;

				audio.onended = () => {
					setPlayingId(null);
				};

				audio.onerror = () => {
					setPlayingId(null);
					setLoadingId(null);
					console.error("Audio playback error for:", audioKey);
					toast({
						variant: "destructive",
						description: "Audio playback failed",
					});
				};

				audio.oncanplaythrough = () => {
					setLoadingId(null);
				};

				await audio.play();
				setPlayingId(id);
				setLoadingId(null);
			} catch (error) {
				console.error("Audio playback error:", error);
				setLoadingId(null);
				toast({
					variant: "destructive",
					description:
						"The audio for the selected phoneme is not available. Please check back soon",
				});
			}
		},
		[playingId, speakerId, toast],
	);

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
						{/* IPA Section Header with Controls */}
						<section className="flex flex-col gap-12">
							<div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
								<div className="flex flex-col gap-1">
									<h2 className="font-semibold text-3xl tracking-tight">
										International Phonetic Alphabet
									</h2>
									<p className="max-w-2xl text-lg text-muted-foreground leading-relaxed">
										Click any symbol to hear it pronounced. Highlighted letters
										show which part of the word makes each sound.
									</p>
								</div>

								{/* Playback Controls */}
								<div className="flex w-full flex-col items-end gap-2 sm:w-auto">
									{/* Sound / Word toggle */}
									<Tabs
										value={playbackMode}
										onValueChange={(v) => setPlaybackMode(v as PlaybackMode)}
										className="w-full sm:w-auto"
									>
										<TabsList
											aria-label="Playback mode"
											className="w-full sm:w-auto"
										>
											<TabsTrigger
												value="sound"
												className="flex-1 sm:flex-initial"
											>
												Sound
											</TabsTrigger>
											<TabsTrigger
												value="word"
												className="flex-1 sm:flex-initial"
											>
												Word
											</TabsTrigger>
										</TabsList>
									</Tabs>

									{/* Speaker selector — only shown in word mode */}
									{playbackMode === "word" && (
										<Tabs
											value={speakerId}
											onValueChange={(v) => handleSpeakerChange(v as SpeakerId)}
											className="w-full sm:w-auto"
										>
											<TabsList
												aria-label="Word speaker"
												className="h-auto w-full flex-wrap gap-0.5 sm:w-auto"
											>
												{SPEAKERS.map((s) => (
													<TabsTrigger
														key={s.id}
														value={s.id}
														className="flex-1 gap-1 text-xs sm:flex-initial"
													>
														<span>{DIALECTS[s.dialect].flag}</span>
														{s.name}
													</TabsTrigger>
												))}
											</TabsList>
										</Tabs>
									)}
								</div>
							</div>

							{/* IPA Charts */}
							<div className="flex flex-col gap-12">
								<IPASection
									title="Vowels"
									description="Pure vowel sounds (monophthongs)"
									symbols={vowels}
									playbackMode={playbackMode}
									onPlay={handlePlay}
									playingId={playingId}
									loadingId={loadingId}
								/>

								<div className="h-px bg-border/40" />

								<IPASection
									title="Diphthongs"
									description="Gliding vowel sounds that transition between two positions"
									symbols={diphthongs}
									playbackMode={playbackMode}
									onPlay={handlePlay}
									playingId={playingId}
									loadingId={loadingId}
								/>

								<div className="h-px bg-border/40" />

								<IPASection
									title="Consonants"
									description="Sounds made by obstructing airflow"
									symbols={consonants}
									playbackMode={playbackMode}
									onPlay={handlePlay}
									playingId={playingId}
									loadingId={loadingId}
								/>
							</div>
						</section>

						{/* Advanced IPA Markers Section */}
						<section className="flex flex-col gap-8">
							<SectionTitle
								title="IPA Markers & Diacritics"
								variant="default"
								description="Beyond basic phonemes, IPA uses diacritics and additional markers to capture precise pronunciation details. These appear in detailed transcriptions and help you understand subtle sound variations."
							/>

							<div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
								<IPAMarkerCard
									icon="ə˞"
									title="R-coloring"
									subtitle="Rhotic hook (˞)"
									description="Indicates a vowel is pronounced with r-coloring, common in American English. The vowel sound is modified by the presence of /r/."
									examples={
										<>
											Examples:{" "}
											<span className="font-ipa text-2xl text-primary">ə˞</span>{" "}
											(her),
											<span className="font-ipa text-2xl text-primary">
												{" "}
												ɜ˞
											</span>{" "}
											(bird),
											<span className="font-ipa text-2xl text-primary">
												{" "}
												o˞
											</span>{" "}
											(or)
										</>
									}
								/>

								<IPAMarkerCard
									icon="ɪ̃"
									title="Nasalization"
									subtitle="Tilde (̃)"
									description="Shows that air flows through the nose while pronouncing the vowel, often occurring before nasal consonants like /m/, /n/, or /ŋ/."
									examples={
										<>
											Examples:{" "}
											<span className="font-ipa text-2xl text-primary">ɪ̃</span>{" "}
											(in),
											<span className="font-ipa text-2xl text-primary"> ẽ</span>{" "}
											(end),
											<span className="font-ipa text-2xl text-primary"> ɑ̃</span>{" "}
											(on)
										</>
									}
								/>

								<IPAMarkerCard
									icon="pʰ"
									title="Aspiration"
									subtitle="Superscript h (ʰ)"
									description="Indicates a puff of air follows the consonant, especially noticeable in voiceless stops (/p/, /t/, /k/) at the beginning of stressed syllables."
									examples={
										<>
											Examples:{" "}
											<span className="font-ipa text-2xl text-primary">pʰ</span>{" "}
											(pin),
											<span className="font-ipa text-2xl text-primary">
												{" "}
												tʰ
											</span>{" "}
											(tin),
											<span className="font-ipa text-2xl text-primary">
												{" "}
												kʰ
											</span>{" "}
											(kin)
										</>
									}
								/>

								<IPAMarkerCard
									icon="iː"
									title="Length"
									subtitle="Colon (ː)"
									description="Shows a long vowel sound. The colon indicates the vowel is held longer than its short counterpart."
									examples={
										<>
											Examples:{" "}
											<span className="font-ipa text-2xl text-primary">iː</span>{" "}
											(see) vs{" "}
											<span className="font-ipa text-2xl text-primary">ɪ</span>{" "}
											(sit),
											<span className="font-ipa text-2xl text-primary">
												{" "}
												uː
											</span>{" "}
											(too) vs{" "}
											<span className="font-ipa text-2xl text-primary">ʊ</span>{" "}
											(put)
										</>
									}
								/>

								<IPAMarkerCard
									icon="ˈ"
									title="Primary Stress"
									subtitle="High vertical line (ˈ)"
									description="Marks the primary stressed syllable in a word. Placed before the stressed syllable."
									examples={
										<>
											Example:{" "}
											<span className="font-ipa text-2xl text-primary">
												ˈfɑðər
											</span>{" "}
											(father),{" "}
											<span className="font-ipa text-2xl text-primary">
												ˈhæpi
											</span>{" "}
											(happy)
										</>
									}
								/>

								<IPAMarkerCard
									icon="ˌ"
									title="Secondary Stress"
									subtitle="Low vertical line (ˌ)"
									description="Marks a syllable with secondary stress, less prominent than primary stress but more than unstressed syllables."
									examples={
										<>
											Example:{" "}
											<span className="font-ipa text-2xl text-primary">
												ˌɪntərˈnæʃənəl
											</span>{" "}
											(international)
										</>
									}
								/>

								<IPAMarkerCard
									icon="tʃ"
									title="Affricates"
									subtitle="Stop + Fricative"
									description="Consonant sounds that begin as a stop (complete closure) and release as a fricative (partial closure). They function as single phonemes despite being written with two symbols."
									examples={
										<>
											Examples:{" "}
											<span className="font-ipa text-2xl text-primary">tʃ</span>{" "}
											(church, chair),{" "}
											<span className="font-ipa text-2xl text-primary">dʒ</span>{" "}
											(judge, joy)
										</>
									}
								/>
							</div>

							{/* Example Transcription */}
							<div className="mt-4 rounded-xl border border-border/40 bg-muted/10 p-6">
								<h4 className="mb-3 font-semibold text-base">
									Example: Detailed Transcription
								</h4>
								<p className="mb-3 text-base text-muted-foreground leading-relaxed">
									Here's how these markers appear together in a detailed IPA
									transcription:
								</p>
								<div className="rounded bg-background p-4">
									<p className="mb-2 font-mono text-base">
										<span className="text-muted-foreground">Text:</span> She
										regularly exercises at the gym, follows a healthy diet,
										maintains good sleeping habits, and practices meditation
										consistently to improve her overall well-being and mental
										health.
									</p>
									<p className="font-mono text-base leading-relaxed">
										<span className="text-muted-foreground">IPA:</span>{" "}
										<span className="font-ipa text-2xl text-foreground">
											ʃ i ɹ ɛ ɡ j ə˞ l ə˞ l i ɛ k s ə˞ s a ɪ z ə z æ t ð ə t ʃ ɪ̃
											m f ɑ l o ʊ z ə h ɛ l θ i t a ɪ ə t m e ɪ̃ n t e ɪ̃ n z k ʊ
											d s l i p ɪ̃ ŋ h æ b ə t s ə n d pʰ ɹ æ k t ə s ə z m ɛ d ə
											t e ɪ ʃ ə n kʰ ə n s ɪ s t ə n t l i tʰ u ɪ̃ m p ɹ u v h ə˞
											o ʊ v ə˞ ɔ l w ɛ l p i ɪ̃ ŋ ə n d m ɛ̃ n t ə l h ɛ l θ
										</span>
									</p>
									<div className="mt-3 flex flex-wrap gap-2 text-base">
										<span className="rounded bg-primary/10 px-2 py-1 font-ipa text-2xl text-primary">
											ə˞
										</span>
										<span className="text-muted-foreground">
											= r-colored schwa
										</span>
										<span className="rounded bg-primary/10 px-2 py-1 font-ipa text-2xl text-primary">
											ɪ̃
										</span>
										<span className="text-muted-foreground">= nasalized i</span>
										<span className="rounded bg-primary/10 px-2 py-1 font-ipa text-2xl text-primary">
											pʰ
										</span>
										<span className="text-muted-foreground">= aspirated p</span>
									</div>
								</div>
							</div>
						</section>

						<div className="h-px bg-border/40" />

						{/* Why Learn IPA Section */}
						<section className="flex flex-col gap-8">
							<SectionTitle
								title="Why Learn IPA?"
								variant="playful"
								description="The International Phonetic Alphabet is your key to mastering pronunciation in any language."
							/>
							<div className="grid gap-4 sm:grid-cols-2">
								<div className="flex flex-col gap-3 rounded-xl border border-border/40 bg-muted/10 p-5">
									<div className="flex size-10 items-center justify-center rounded-lg bg-primary/10 text-primary">
										<RiVolumeUpLine size={16} />
									</div>
									<h4 className="font-medium text-base">
										Improve Pronunciation
									</h4>
									<p className="text-base text-muted-foreground leading-relaxed">
										IPA shows you exactly how to pronounce words, eliminating
										guesswork from spelling. Each symbol represents one specific
										sound, ensuring precision.
									</p>
								</div>
								<div className="flex flex-col gap-3 rounded-xl border border-border/40 bg-muted/10 p-5">
									<div className="flex size-10 items-center justify-center rounded-lg bg-primary/10 text-primary">
										<svg
											className="size-5"
											fill="none"
											viewBox="0 0 24 24"
											stroke="currentColor"
											strokeWidth={2}
										>
											<title>Common Pronunciation Guide</title>
											<path
												strokeLinecap="round"
												strokeLinejoin="round"
												d="M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.747 0 3.332.477 4.5 1.253v13C19.832 18.477 18.247 18 16.5 18c-1.746 0-3.332.477-4.5 1.253"
											/>
										</svg>
									</div>
									<h4 className="font-medium text-base">Use Any Dictionary</h4>
									<p className="text-base text-muted-foreground leading-relaxed">
										Most dictionaries use IPA for pronunciation guides. Once you
										learn it, you can look up pronunciation anywhere in the
										world.
									</p>
								</div>
								<div className="flex flex-col gap-3 rounded-xl border border-border/40 bg-muted/10 p-5">
									<div className="flex size-10 items-center justify-center rounded-lg bg-primary/10 text-primary">
										<svg
											className="size-5"
											fill="none"
											viewBox="0 0 24 24"
											stroke="currentColor"
											strokeWidth={2}
										>
											<title>Global Recognition</title>
											<path
												strokeLinecap="round"
												strokeLinejoin="round"
												d="M3.055 11H5a2 2 0 012 2v1a2 2 0 002 2 2 2 0 012 2v2.945M8 3.935V5.5A2.5 2.5 0 0010.5 8h.5a2 2 0 012 2 2 2 0 104 0 2 2 0 012-2h1.064M15 20.488V18a2 2 0 012-2h3.064M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
											/>
										</svg>
									</div>
									<h4 className="font-medium text-base">Master New Sounds</h4>
									<p className="text-base text-muted-foreground leading-relaxed">
										IPA helps you identify and practice sounds that may not
										exist in your native language, improving your pronunciation
										clarity and communication skills.
									</p>
								</div>
								<div className="flex flex-col gap-3 rounded-xl border border-border/40 bg-muted/10 p-5">
									<div className="flex size-10 items-center justify-center rounded-lg bg-primary/10 text-primary">
										<svg
											className="size-5"
											fill="none"
											viewBox="0 0 24 24"
											stroke="currentColor"
											strokeWidth={2}
										>
											<title>Fast Learning System</title>
											<path
												strokeLinecap="round"
												strokeLinejoin="round"
												d="M13 10V3L4 14h7v7l9-11h-7z"
											/>
										</svg>
									</div>
									<h4 className="font-medium text-base">
										Learn Languages Faster
									</h4>
									<p className="text-base text-muted-foreground leading-relaxed">
										IPA knowledge transfers to any language. Once you understand
										the system, picking up new languages becomes significantly
										easier.
									</p>
								</div>
							</div>
						</section>

						<div className="h-px bg-border/40" />

						{/* Accent Differences Section */}
						<AccentDifferencesSection />

						<div className="h-px bg-border/40" />

						{/* Additional Resources Section */}
						<section className="flex flex-col gap-8">
							<SectionTitle
								title="Additional Resources"
								variant="default"
								description="Explore these external resources to deepen your understanding of phonetics."
							/>
							<div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
								<a
									href="https://upload.wikimedia.org/wikipedia/commons/8/8f/IPA_chart_2020.svg"
									target="_blank"
									rel="noopener noreferrer"
									className="group flex flex-col gap-3 rounded-xl border border-border/40 p-5 transition-colors hover:border-primary/40 hover:bg-muted/20"
								>
									<h4 className="font-medium text-base transition-colors group-hover:text-primary">
										Official IPA Chart
									</h4>
									<p className="text-base text-muted-foreground">
										The complete 2020 IPA chart from Wikimedia Commons with all
										phonetic symbols.
									</p>
									<span className="text-primary text-xs">
										↗ Wikipedia Commons
									</span>
								</a>
								<a
									href="https://www.ipachart.com/"
									target="_blank"
									rel="noopener noreferrer"
									className="group flex flex-col gap-3 rounded-xl border border-border/40 p-5 transition-colors hover:border-primary/40 hover:bg-muted/20"
								>
									<h4 className="font-medium text-base transition-colors group-hover:text-primary">
										Interactive IPA Chart
									</h4>
									<p className="text-base text-muted-foreground">
										Click any symbol to hear its pronunciation with audio
										samples.
									</p>
									<span className="text-primary text-xs">↗ ipachart.com</span>
								</a>
								<a
									href="https://ipachart.app/ipa-translator"
									target="_blank"
									rel="noopener noreferrer"
									className="group flex flex-col gap-3 rounded-xl border border-border/40 p-5 transition-colors hover:border-primary/40 hover:bg-muted/20"
								>
									<h4 className="font-medium text-base transition-colors group-hover:text-primary">
										IPA Translator
									</h4>
									<p className="text-base text-muted-foreground">
										Convert English text to IPA transcription with support for
										American and British accents.
									</p>
									<span className="text-primary text-xs">↗ ipachart.app</span>
								</a>
							</div>
						</section>

						<div className="h-px bg-border/40" />

						{/* Attribution Section */}
						<section className="rounded-xl bg-muted/20 p-6">
							<h4 className="mb-3 font-medium text-base text-muted-foreground">
								Sound Clip Attribution
							</h4>
							<p className="text-muted-foreground text-sm leading-relaxed">
								Word recordings by Jordan, Katherine, Teyanna (General American)
								and Jon (Received Pronunciation). IPA sound clips are the work
								of Peter Isotalo, User:Denelson83, UCLA Phonetics Lab Archive
								2003, User:Halibutt, User:Pmx or User:Octane, made available
								under a free and/or copyleft licence — see the{" "}
								<a
									href="https://commons.wikimedia.org/wiki/General_phonetics"
									target="_blank"
									rel="noopener noreferrer"
									className="underline hover:text-foreground"
								>
									Wikimedia Commons general phonetics page
								</a>{" "}
								for per-clip licensing details. Vowel trapezoid background by
								User:Denelson83.
							</p>
						</section>

						<div className="h-px bg-border/40" />

						{/* Quick Start CTA */}
						<section className="py-8 text-center">
							<div className="flex flex-col items-center gap-6">
								<div className="flex flex-col gap-2">
									<h3 className="font-medium text-xl">
										Ready to test your pronunciation?
									</h3>
									<p className="mx-auto max-w-md text-base text-muted-foreground">
										Practice with our curated texts and get instant AI feedback
										on your pronunciation accuracy.
									</p>
								</div>
								<Button asChild size="lg" className="rounded-full px-8">
									<Link to="/practice">Start Practicing</Link>
								</Button>
							</div>
						</section>
					</div>
				</PageContainer>
			</motion.div>
		</MainLayout>
	);
}
