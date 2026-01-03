import { createFileRoute, Link } from "@tanstack/react-router";
import { Volume2 } from "lucide-react";
import { useCallback, useRef, useState } from "react";
import {
	MainLayout,
	PageContainer,
	PageHeader,
} from "@/components/layout/main-layout";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Spinner } from "@/components/ui/spinner";
import { Switch } from "@/components/ui/switch";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/learn")({
	component: LearningPage,
});

// Static R2 audio map for IPA sounds
// Keys are R2 storage paths, values will be fetched via /api/audio/learn/{key}
const IPA_AUDIO_MAP: Record<
	string,
	{ word: string; wordAudio: string; soundAudio: string }
> = {
	// Vowels
	iː: {
		word: "see",
		wordAudio: "ipa/words/see.mp3",
		soundAudio: "ipa/sounds/i-long.mp3",
	},
	ɪ: {
		word: "sit",
		wordAudio: "ipa/words/sit.mp3",
		soundAudio: "ipa/sounds/i-short.mp3",
	},
	e: {
		word: "bed",
		wordAudio: "ipa/words/bed.mp3",
		soundAudio: "ipa/sounds/e.mp3",
	},
	æ: {
		word: "cat",
		wordAudio: "ipa/words/cat.mp3",
		soundAudio: "ipa/sounds/ae.mp3",
	},
	ɑː: {
		word: "father",
		wordAudio: "ipa/words/father.mp3",
		soundAudio: "ipa/sounds/a-long.mp3",
	},
	ɒ: {
		word: "hot",
		wordAudio: "ipa/words/hot.mp3",
		soundAudio: "ipa/sounds/o-short.mp3",
	},
	ɔː: {
		word: "saw",
		wordAudio: "ipa/words/saw.mp3",
		soundAudio: "ipa/sounds/o-long.mp3",
	},
	ʊ: {
		word: "put",
		wordAudio: "ipa/words/put.mp3",
		soundAudio: "ipa/sounds/u-short.mp3",
	},
	uː: {
		word: "too",
		wordAudio: "ipa/words/too.mp3",
		soundAudio: "ipa/sounds/u-long.mp3",
	},
	ʌ: {
		word: "cup",
		wordAudio: "ipa/words/cup.mp3",
		soundAudio: "ipa/sounds/uh.mp3",
	},
	ɜː: {
		word: "bird",
		wordAudio: "ipa/words/bird.mp3",
		soundAudio: "ipa/sounds/er.mp3",
	},
	ə: {
		word: "about",
		wordAudio: "ipa/words/about.mp3",
		soundAudio: "ipa/sounds/schwa.mp3",
	},
	// Diphthongs
	eɪ: {
		word: "day",
		wordAudio: "ipa/words/day.mp3",
		soundAudio: "ipa/sounds/ei.mp3",
	},
	aɪ: {
		word: "my",
		wordAudio: "ipa/words/my.mp3",
		soundAudio: "ipa/sounds/ai.mp3",
	},
	ɔɪ: {
		word: "boy",
		wordAudio: "ipa/words/boy.mp3",
		soundAudio: "ipa/sounds/oi.mp3",
	},
	aʊ: {
		word: "now",
		wordAudio: "ipa/words/now.mp3",
		soundAudio: "ipa/sounds/au.mp3",
	},
	əʊ: {
		word: "go",
		wordAudio: "ipa/words/go.mp3",
		soundAudio: "ipa/sounds/ou.mp3",
	},
	ɪə: {
		word: "near",
		wordAudio: "ipa/words/near.mp3",
		soundAudio: "ipa/sounds/ia.mp3",
	},
	eə: {
		word: "hair",
		wordAudio: "ipa/words/hair.mp3",
		soundAudio: "ipa/sounds/ea.mp3",
	},
	ʊə: {
		word: "pure",
		wordAudio: "ipa/words/pure.mp3",
		soundAudio: "ipa/sounds/ua.mp3",
	},
	// Consonants
	p: {
		word: "pet",
		wordAudio: "ipa/words/pet.mp3",
		soundAudio: "ipa/sounds/p.mp3",
	},
	b: {
		word: "bed",
		wordAudio: "ipa/words/bed.mp3",
		soundAudio: "ipa/sounds/b.mp3",
	},
	t: {
		word: "ten",
		wordAudio: "ipa/words/ten.mp3",
		soundAudio: "ipa/sounds/t.mp3",
	},
	d: {
		word: "dog",
		wordAudio: "ipa/words/dog.mp3",
		soundAudio: "ipa/sounds/d.mp3",
	},
	k: {
		word: "cat",
		wordAudio: "ipa/words/cat-k.mp3",
		soundAudio: "ipa/sounds/k.mp3",
	},
	g: {
		word: "go",
		wordAudio: "ipa/words/go-g.mp3",
		soundAudio: "ipa/sounds/g.mp3",
	},
	f: {
		word: "fan",
		wordAudio: "ipa/words/fan.mp3",
		soundAudio: "ipa/sounds/f.mp3",
	},
	v: {
		word: "van",
		wordAudio: "ipa/words/van.mp3",
		soundAudio: "ipa/sounds/v.mp3",
	},
	θ: {
		word: "think",
		wordAudio: "ipa/words/think.mp3",
		soundAudio: "ipa/sounds/th-voiceless.mp3",
	},
	ð: {
		word: "this",
		wordAudio: "ipa/words/this.mp3",
		soundAudio: "ipa/sounds/th-voiced.mp3",
	},
	s: {
		word: "sit",
		wordAudio: "ipa/words/sit-s.mp3",
		soundAudio: "ipa/sounds/s.mp3",
	},
	z: {
		word: "zoo",
		wordAudio: "ipa/words/zoo.mp3",
		soundAudio: "ipa/sounds/z.mp3",
	},
	ʃ: {
		word: "ship",
		wordAudio: "ipa/words/ship.mp3",
		soundAudio: "ipa/sounds/sh.mp3",
	},
	ʒ: {
		word: "measure",
		wordAudio: "ipa/words/measure.mp3",
		soundAudio: "ipa/sounds/zh.mp3",
	},
	h: {
		word: "hat",
		wordAudio: "ipa/words/hat.mp3",
		soundAudio: "ipa/sounds/h.mp3",
	},
	tʃ: {
		word: "church",
		wordAudio: "ipa/words/church.mp3",
		soundAudio: "ipa/sounds/ch.mp3",
	},
	dʒ: {
		word: "judge",
		wordAudio: "ipa/words/judge.mp3",
		soundAudio: "ipa/sounds/j.mp3",
	},
	m: {
		word: "man",
		wordAudio: "ipa/words/man.mp3",
		soundAudio: "ipa/sounds/m.mp3",
	},
	n: {
		word: "no",
		wordAudio: "ipa/words/no.mp3",
		soundAudio: "ipa/sounds/n.mp3",
	},
	ŋ: {
		word: "sing",
		wordAudio: "ipa/words/sing.mp3",
		soundAudio: "ipa/sounds/ng.mp3",
	},
	l: {
		word: "let",
		wordAudio: "ipa/words/let.mp3",
		soundAudio: "ipa/sounds/l.mp3",
	},
	r: {
		word: "red",
		wordAudio: "ipa/words/red.mp3",
		soundAudio: "ipa/sounds/r.mp3",
	},
	j: {
		word: "yes",
		wordAudio: "ipa/words/yes.mp3",
		soundAudio: "ipa/sounds/y.mp3",
	},
	w: {
		word: "wet",
		wordAudio: "ipa/words/wet.mp3",
		soundAudio: "ipa/sounds/w.mp3",
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
				"group relative flex flex-col overflow-hidden rounded-lg text-center transition-colors",
				"bg-muted/20 hover:bg-muted/40",
				"focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2",
				isPlaying && "bg-primary/10 ring-2 ring-primary/30",
			)}
		>
			{/* Listen icon - absolute top right */}
			<div className="absolute top-2 right-2 z-10">
				{isLoading ? (
					<Spinner className="size-3.5" />
				) : (
					<Volume2
						className={cn(
							"size-3.5 text-muted-foreground transition-opacity",
							"opacity-0 group-hover:opacity-100",
							isPlaying && "text-primary opacity-100",
						)}
					/>
				)}
			</div>

			{/* Top section - IPA symbol */}
			<div className="flex flex-1 items-center justify-center px-3 py-4">
				<span className="font-mono text-xl tracking-wide">{item.symbol}</span>
			</div>

			{/* Bottom section - word with darker background */}
			<div className="w-full bg-muted/40 px-3 py-2.5">
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
		<section className="flex flex-col gap-4">
			<div className="flex flex-col gap-1">
				<h3 className="font-medium">{title}</h3>
				{description && (
					<p className="text-muted-foreground text-sm">{description}</p>
				)}
			</div>
			<div className="grid grid-cols-3 gap-3 sm:grid-cols-4 md:grid-cols-6 lg:grid-cols-8">
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

// TIPS SECTION

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
		<section className="flex flex-col gap-4">
			<h3 className="font-medium">Pronunciation Tips</h3>
			<div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
				{tips.map((tip) => (
					<div key={tip.title} className="flex flex-col gap-1">
						<h4 className="font-medium text-muted-foreground text-sm">
							{tip.title}
						</h4>
						<p className="text-muted-foreground text-xs leading-relaxed">
							{tip.description}
						</p>
					</div>
				))}
			</div>
		</section>
	);
}

// MAIN PAGE

function LearningPage() {
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
				return;
			}

			const audioKey =
				mode === "word" ? audioData.wordAudio : audioData.soundAudio;
			const audioUrl = `/api/audio/learn/${encodeURIComponent(audioKey)}`;

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
			}
		},
		[playingId],
	);

	return (
		<MainLayout>
			<PageContainer>
				<div className="flex flex-col gap-10">
					<PageHeader
						title="Learning Resources"
						description="Learn about the International Phonetic Alphabet and improve your pronunciation skills"
					/>

					{/* IPA Section Header with Controls */}
					<div className="flex flex-col gap-6">
						<div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
							<div className="flex flex-col gap-1">
								<h2 className="font-semibold text-lg">
									International Phonetic Alphabet
								</h2>
								<p className="text-muted-foreground text-sm">
									Click any symbol to hear it pronounced. Highlighted letters
									show which part of the word makes each sound.
								</p>
							</div>

							{/* Playback Mode Toggle */}
							<div className="flex items-center gap-3 rounded-lg bg-muted/40 px-4 py-2.5">
								<Label
									htmlFor="playback-mode"
									className={cn(
										"cursor-pointer text-sm transition-colors",
										playbackMode === "sound"
											? "font-medium text-foreground"
											: "text-muted-foreground",
									)}
								>
									Sound
								</Label>
								<Switch
									id="playback-mode"
									checked={playbackMode === "word"}
									onCheckedChange={(checked) =>
										setPlaybackMode(checked ? "word" : "sound")
									}
								/>
								<Label
									htmlFor="playback-mode"
									className={cn(
										"cursor-pointer text-sm transition-colors",
										playbackMode === "word"
											? "font-medium text-foreground"
											: "text-muted-foreground",
									)}
								>
									Word
								</Label>
							</div>
						</div>

						{/* IPA Charts */}
						<div className="flex flex-col gap-8">
							<IPASection
								title="Vowels"
								description="Pure vowel sounds (monophthongs)"
								symbols={vowels}
								playbackMode={playbackMode}
								onPlay={handlePlay}
								playingId={playingId}
								loadingId={loadingId}
							/>

							<IPASection
								title="Diphthongs"
								description="Gliding vowel sounds that transition between two positions"
								symbols={diphthongs}
								playbackMode={playbackMode}
								onPlay={handlePlay}
								playingId={playingId}
								loadingId={loadingId}
							/>

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
					</div>

					{/* Tips Section */}
					<TipsSection />

					{/* Quick Start CTA */}
					<div className="flex flex-col items-center gap-4 rounded-xl bg-muted/30 py-10 text-center sm:flex-row sm:justify-between sm:px-8 sm:text-left">
						<div className="flex flex-col gap-1 px-6 sm:px-0">
							<h3 className="font-medium">Ready to practice?</h3>
							<p className="text-muted-foreground text-sm">
								Put your knowledge to the test with our practice texts.
							</p>
						</div>
						<Button asChild className="mx-6 sm:mx-0">
							<Link to="/practice">Start Practicing</Link>
						</Button>
					</div>
				</div>
			</PageContainer>
		</MainLayout>
	);
}
