import { RiRefreshLine, RiVolumeUpLine } from "@remixicon/react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { createFileRoute, Link } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { motion } from "motion/react";
import { useCallback, useRef, useState } from "react";
import { MainLayout, PageContainer } from "@/components/layout/main-layout";
import { pageVariants } from "@/components/ui/animations";
import { Button } from "@/components/ui/button";
import { SectionTitle } from "@/components/ui/section-title";
import { Spinner } from "@/components/ui/spinner";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";

import { useToast } from "@/hooks/use-toast";
import { useRequireAdmin } from "@/lib/auth";
import {
	serverGenerateIPAAudio,
	serverGetIPAAudioStatus,
} from "@/lib/ipa-audio";
import { cn } from "@/lib/utils";

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
		wordAudio: "ipa/words/see.wav",
		soundAudio: "ipa/sounds/i.ogg",
	},
	ɪ: {
		word: "sit",
		wordAudio: "ipa/words/sit.wav",
		soundAudio: "ipa/sounds/ɪ.ogg",
	},
	e: {
		word: "bed",
		wordAudio: "ipa/words/bed.wav",
		soundAudio: "ipa/sounds/e.ogg",
	},
	æ: {
		word: "cat",
		wordAudio: "ipa/words/cat.wav",
		soundAudio: "ipa/sounds/æ.ogg",
	},
	ɑː: {
		word: "father",
		wordAudio: "ipa/words/father.wav",
		soundAudio: "ipa/sounds/ɑ.ogg",
	},
	ɒ: {
		word: "hot",
		wordAudio: "ipa/words/hot.wav",
		soundAudio: "ipa/sounds/ɒ.ogg",
	},
	ɔː: {
		word: "saw",
		wordAudio: "ipa/words/saw.wav",
		soundAudio: "ipa/sounds/ɔ.ogg",
	},
	ʊ: {
		word: "put",
		wordAudio: "ipa/words/put.wav",
		soundAudio: "ipa/sounds/ʊ.ogg",
	},
	uː: {
		word: "too",
		wordAudio: "ipa/words/too.wav",
		soundAudio: "ipa/sounds/u.ogg",
	},
	ʌ: {
		word: "cup",
		wordAudio: "ipa/words/cup.wav",
		soundAudio: "ipa/sounds/ʌ.ogg",
	},
	ɜː: {
		word: "bird",
		wordAudio: "ipa/words/bird.wav",
		soundAudio: "ipa/sounds/ɜ.ogg",
	},
	ə: {
		word: "about",
		wordAudio: "ipa/words/about.wav",
		soundAudio: "ipa/sounds/ə.ogg",
	},
	// Diphthongs
	eɪ: {
		word: "day",
		wordAudio: "ipa/words/day.wav",
		soundAudio: "ipa/sounds/ei.wav",
	},
	aɪ: {
		word: "my",
		wordAudio: "ipa/words/my.wav",
		soundAudio: "ipa/sounds/ai.wav",
	},
	ɔɪ: {
		word: "boy",
		wordAudio: "ipa/words/boy.wav",
		soundAudio: "ipa/sounds/oi.wav",
	},
	aʊ: {
		word: "now",
		wordAudio: "ipa/words/now.wav",
		soundAudio: "ipa/sounds/au.wav",
	},
	əʊ: {
		word: "go",
		wordAudio: "ipa/words/go.wav",
		soundAudio: "ipa/sounds/ou.wav",
	},
	ɪə: {
		word: "near",
		wordAudio: "ipa/words/near.wav",
		soundAudio: "ipa/sounds/ia.wav",
	},
	eə: {
		word: "hair",
		wordAudio: "ipa/words/hair.wav",
		soundAudio: "ipa/sounds/ea.wav",
	},
	ʊə: {
		word: "pure",
		wordAudio: "ipa/words/pure.wav",
		soundAudio: "ipa/sounds/ua.wav",
	},
	// Consonants
	p: {
		word: "pet",
		wordAudio: "ipa/words/pet.wav",
		soundAudio: "ipa/sounds/p.ogg",
	},
	b: {
		word: "bed",
		wordAudio: "ipa/words/bed.wav",
		soundAudio: "ipa/sounds/b.ogg",
	},
	t: {
		word: "ten",
		wordAudio: "ipa/words/ten.wav",
		soundAudio: "ipa/sounds/t.ogg",
	},
	d: {
		word: "dog",
		wordAudio: "ipa/words/dog.wav",
		soundAudio: "ipa/sounds/d.ogg",
	},
	k: {
		word: "cat",
		wordAudio: "ipa/words/cat-k.wav",
		soundAudio: "ipa/sounds/k.ogg",
	},
	g: {
		word: "go",
		wordAudio: "ipa/words/go-g.wav",
		soundAudio: "ipa/sounds/g.ogg",
	},
	f: {
		word: "fan",
		wordAudio: "ipa/words/fan.wav",
		soundAudio: "ipa/sounds/f.ogg",
	},
	v: {
		word: "van",
		wordAudio: "ipa/words/van.wav",
		soundAudio: "ipa/sounds/v.ogg",
	},
	θ: {
		word: "think",
		wordAudio: "ipa/words/think.wav",
		soundAudio: "ipa/sounds/θ.ogg",
	},
	ð: {
		word: "this",
		wordAudio: "ipa/words/this.wav",
		soundAudio: "ipa/sounds/ð.ogg",
	},
	s: {
		word: "sit",
		wordAudio: "ipa/words/sit-s.wav",
		soundAudio: "ipa/sounds/s.ogg",
	},
	z: {
		word: "zoo",
		wordAudio: "ipa/words/zoo.wav",
		soundAudio: "ipa/sounds/z.ogg",
	},
	ʃ: {
		word: "ship",
		wordAudio: "ipa/words/ship.wav",
		soundAudio: "ipa/sounds/ʃ.ogg",
	},
	ʒ: {
		word: "measure",
		wordAudio: "ipa/words/measure.wav",
		soundAudio: "ipa/sounds/ʒ.ogg",
	},
	h: {
		word: "hat",
		wordAudio: "ipa/words/hat.wav",
		soundAudio: "ipa/sounds/h.ogg",
	},
	tʃ: {
		word: "church",
		wordAudio: "ipa/words/church.wav",
		soundAudio: "ipa/sounds/ch.wav",
	},
	dʒ: {
		word: "judge",
		wordAudio: "ipa/words/judge.wav",
		soundAudio: "ipa/sounds/j.wav",
	},
	m: {
		word: "man",
		wordAudio: "ipa/words/man.wav",
		soundAudio: "ipa/sounds/m.ogg",
	},
	n: {
		word: "no",
		wordAudio: "ipa/words/no.wav",
		soundAudio: "ipa/sounds/n.ogg",
	},
	ŋ: {
		word: "sing",
		wordAudio: "ipa/words/sing.wav",
		soundAudio: "ipa/sounds/ŋ.ogg",
	},
	l: {
		word: "let",
		wordAudio: "ipa/words/let.wav",
		soundAudio: "ipa/sounds/l.ogg",
	},
	r: {
		word: "red",
		wordAudio: "ipa/words/red.wav",
		soundAudio: "ipa/sounds/r.ogg",
	},
	j: {
		word: "yes",
		wordAudio: "ipa/words/yes.wav",
		soundAudio: "ipa/sounds/j.ogg",
	},
	w: {
		word: "wet",
		wordAudio: "ipa/words/wet.wav",
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
				<span className="font-mono text-foreground/80 text-xl tracking-wide transition-colors group-hover:text-foreground">
					{item.symbol}
				</span>
			</div>

			{/* Bottom section - word */}
			<div className="w-full px-4 pb-4 text-sm">
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

// ADMIN SECTION

function AdminAudioSection() {
	const { isAdmin } = useRequireAdmin();
	const queryClient = useQueryClient();
	const getStatusFn = useServerFn(serverGetIPAAudioStatus);
	const generateFn = useServerFn(serverGenerateIPAAudio);

	const { data: status, isLoading: statusLoading } = useQuery({
		queryKey: ["ipa-audio-status"],
		queryFn: async () => {
			const result = await getStatusFn();
			if (!result.success) throw new Error(result.error.message);
			return result.data;
		},
		enabled: isAdmin,
	});

	const { mutate: generateAudio, isPending: isGenerating } = useMutation({
		mutationFn: async () => {
			const result = await generateFn();
			if (!result.success) throw new Error(result.error.message);
			return result.data;
		},
		onSuccess: (data) => {
			queryClient.invalidateQueries({ queryKey: ["ipa-audio-status"] });
			console.log("Generation complete:", data);
		},
	});

	if (!isAdmin) return null;

	return (
		<section className="mt-8 flex flex-col gap-4 border-border/40 border-t pt-8">
			<div className="flex flex-col gap-1">
				<h3 className="font-medium text-muted-foreground text-sm uppercase tracking-wide">
					Admin: IPA Audio Management
				</h3>
			</div>

			{statusLoading ? (
				<div className="flex items-center gap-2 text-muted-foreground text-sm">
					<Spinner className="size-4" />
					Checking audio status...
				</div>
			) : status ? (
				<div className="flex flex-col gap-4">
					<div className="flex gap-8">
						<div className="flex flex-col">
							<span className="text-muted-foreground text-xs uppercase">
								Existing
							</span>
							<span className="font-mono text-xl">
								{status.existing.length}
							</span>
						</div>
						<div className="flex flex-col">
							<span className="text-muted-foreground text-xs uppercase">
								Missing
							</span>
							<span className="font-mono text-destructive text-xl">
								{status.missing.length}
							</span>
						</div>
						<div className="flex flex-col">
							<span className="text-muted-foreground text-xs uppercase">
								Total
							</span>
							<span className="font-mono text-xl">{status.total}</span>
						</div>
					</div>

					<div className="flex items-center gap-2">
						<Button
							onClick={() => generateAudio()}
							disabled={isGenerating || status.missing.length === 0}
							size="sm"
							variant="outline"
						>
							{isGenerating ? (
								<>
									<Spinner className="size-4" />
									Generating...
								</>
							) : (
								<>
									<RiRefreshLine
										className={cn("size-4", isGenerating && "animate-spin")}
									/>
									Generate Missing Audio ({status.missing.length})
								</>
							)}
						</Button>
					</div>

					{status.missing.length > 0 && (
						<details className="text-xs">
							<summary className="cursor-pointer text-muted-foreground">
								Show missing files
							</summary>
							<div className="mt-2 max-h-32 overflow-auto rounded bg-muted/20 p-2 font-mono">
								{status.missing.map((key) => (
									<div key={key}>{key}</div>
								))}
							</div>
						</details>
					)}
				</div>
			) : null}
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

function AccentDifferenceCard({ item }: { item: AccentDifference }) {
	return (
		<div className="flex flex-col gap-3 rounded-lg border border-border/40 bg-card p-4 transition-all hover:bg-muted/10 hover:shadow-sm">
			<div className="flex flex-col gap-1">
				<h4 className="font-semibold text-foreground text-sm">{item.title}</h4>
				{item.subtitle && (
					<span className="text-muted-foreground text-xs">{item.subtitle}</span>
				)}
			</div>

			<div className="grid grid-cols-2 gap-4 pt-2 text-sm">
				<div className="flex flex-col gap-1.5">
					<div className="flex items-center gap-1.5 text-muted-foreground text-xs uppercase tracking-wider">
						<span className="text-base">🇺🇸</span> AmE
					</div>
					<p className="text-muted-foreground text-xs leading-relaxed">
						{item.ame}
					</p>
				</div>

				<div className="flex flex-col gap-1.5">
					<div className="flex items-center gap-1.5 text-muted-foreground text-xs uppercase tracking-wider">
						<span className="text-base">🇬🇧</span> BrE
					</div>
					<p className="text-muted-foreground text-xs leading-relaxed">
						{item.bre}
					</p>
				</div>
			</div>
		</div>
	);
}

function AccentCategorySection({ category }: { category: AccentCategory }) {
	return (
		<div className="flex flex-col gap-4">
			<h3 className="font-medium text-lg text-primary/80 tracking-tight">
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
	const [playingId, setPlayingId] = useState<string | null>(null);
	const [loadingId, setLoadingId] = useState<string | null>(null);
	const audioRef = useRef<HTMLAudioElement | null>(null);

	const handlePlay = useCallback(
		async (symbol: string, mode: PlaybackMode) => {
			const id = `${symbol}-${mode}`;

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
				mode === "word" ? audioData.wordAudio : audioData.soundAudio;
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
					description: "The audio for the selected phoneme is not available. Please check back soon",
				});
			}
		},
		[playingId, toast],
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
									<h2 className="font-semibold text-2xl tracking-tight">
										International Phonetic Alphabet
									</h2>
									<p className="max-w-2xl text-base text-muted-foreground leading-relaxed">
										Click any symbol to hear it pronounced. Highlighted letters
										show which part of the word makes each sound.
									</p>
								</div>

								{/* Playback Mode Toggle */}
								<Tabs
									value={playbackMode}
									onValueChange={(v) => setPlaybackMode(v as PlaybackMode)}
									className="w-full sm:w-auto"
								>
									<TabsList className="w-full sm:w-auto">
										<TabsTrigger value="sound" className="flex-1 sm:flex-initial">
											Sound
										</TabsTrigger>
										<TabsTrigger value="word" className="flex-1 sm:flex-initial">
											Word
										</TabsTrigger>
									</TabsList>
								</Tabs>
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
									<h4 className="font-medium">Improve Pronunciation</h4>
									<p className="text-muted-foreground text-sm leading-relaxed">
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
									<h4 className="font-medium">Use Any Dictionary</h4>
									<p className="text-muted-foreground text-sm leading-relaxed">
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
									<h4 className="font-medium">Reduce Your Accent</h4>
									<p className="text-muted-foreground text-sm leading-relaxed">
										Understanding phonemes helps you identify sounds that don't
										exist in your native language, making it easier to correct
										them.
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
									<h4 className="font-medium">Learn Languages Faster</h4>
									<p className="text-muted-foreground text-sm leading-relaxed">
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
									<h4 className="font-medium transition-colors group-hover:text-primary">
										Official IPA Chart
									</h4>
									<p className="text-muted-foreground text-sm">
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
									<h4 className="font-medium transition-colors group-hover:text-primary">
										Interactive IPA Chart
									</h4>
									<p className="text-muted-foreground text-sm">
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
									<h4 className="font-medium transition-colors group-hover:text-primary">
										IPA Translator
									</h4>
									<p className="text-muted-foreground text-sm">
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
							<h4 className="mb-3 font-medium text-muted-foreground text-sm">
								Sound Clip Attribution
							</h4>
							<p className="text-muted-foreground text-xs leading-relaxed">
								Each audio clip is the work of Peter Isotalo, User:Denelson83,
								UCLA Phonetics Lab Archive 2003, User:Halibutt, User:Pmx or
								User:Octane, and made available under a free and/or copyleft
								licence. For details on the licensing and attribution
								requirements of a particular clip, browse to it from the general
								phonetics page at the Wikimedia Commons. Vowel trapezoid
								background by User:Denelson83; see File:Blank vowel
								trapezoid.png on Wikimedia Commons for details. Example words
								and TTS speeches are generated via ElevenLabs.
							</p>
						</section>

						{/* Admin Section - only visible to admins */}
						<AdminAudioSection />

						<div className="h-px bg-border/40" />

						{/* Quick Start CTA */}
						<section className="py-8 text-center">
							<div className="flex flex-col items-center gap-6">
								<div className="flex flex-col gap-2">
									<h3 className="font-medium text-lg">
										Ready to test your pronunciation?
									</h3>
									<p className="mx-auto max-w-md text-muted-foreground text-sm">
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
