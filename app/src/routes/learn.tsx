import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { createFileRoute, Link } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { RefreshCw, Volume2 } from "lucide-react";
import { useCallback, useRef, useState } from "react";
import { MainLayout, PageContainer } from "@/components/layout/main-layout";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Spinner } from "@/components/ui/spinner";
import { Switch } from "@/components/ui/switch";
import {
	Table,
	TableBody,
	TableCell,
	TableHead,
	TableHeader,
	TableRow,
} from "@/components/ui/table";
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
		soundAudio: "ipa/sounds/i-long.wav",
	},
	ɪ: {
		word: "sit",
		wordAudio: "ipa/words/sit.wav",
		soundAudio: "ipa/sounds/i-short.wav",
	},
	e: {
		word: "bed",
		wordAudio: "ipa/words/bed.wav",
		soundAudio: "ipa/sounds/e.wav",
	},
	æ: {
		word: "cat",
		wordAudio: "ipa/words/cat.wav",
		soundAudio: "ipa/sounds/ae.wav",
	},
	ɑː: {
		word: "father",
		wordAudio: "ipa/words/father.wav",
		soundAudio: "ipa/sounds/a-long.wav",
	},
	ɒ: {
		word: "hot",
		wordAudio: "ipa/words/hot.wav",
		soundAudio: "ipa/sounds/o-short.wav",
	},
	ɔː: {
		word: "saw",
		wordAudio: "ipa/words/saw.wav",
		soundAudio: "ipa/sounds/o-long.wav",
	},
	ʊ: {
		word: "put",
		wordAudio: "ipa/words/put.wav",
		soundAudio: "ipa/sounds/u-short.wav",
	},
	uː: {
		word: "too",
		wordAudio: "ipa/words/too.wav",
		soundAudio: "ipa/sounds/u-long.wav",
	},
	ʌ: {
		word: "cup",
		wordAudio: "ipa/words/cup.wav",
		soundAudio: "ipa/sounds/uh.wav",
	},
	ɜː: {
		word: "bird",
		wordAudio: "ipa/words/bird.wav",
		soundAudio: "ipa/sounds/er.wav",
	},
	ə: {
		word: "about",
		wordAudio: "ipa/words/about.wav",
		soundAudio: "ipa/sounds/schwa.wav",
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
		soundAudio: "ipa/sounds/p.wav",
	},
	b: {
		word: "bed",
		wordAudio: "ipa/words/bed.wav",
		soundAudio: "ipa/sounds/b.wav",
	},
	t: {
		word: "ten",
		wordAudio: "ipa/words/ten.wav",
		soundAudio: "ipa/sounds/t.wav",
	},
	d: {
		word: "dog",
		wordAudio: "ipa/words/dog.wav",
		soundAudio: "ipa/sounds/d.wav",
	},
	k: {
		word: "cat",
		wordAudio: "ipa/words/cat-k.wav",
		soundAudio: "ipa/sounds/k.wav",
	},
	g: {
		word: "go",
		wordAudio: "ipa/words/go-g.wav",
		soundAudio: "ipa/sounds/g.wav",
	},
	f: {
		word: "fan",
		wordAudio: "ipa/words/fan.wav",
		soundAudio: "ipa/sounds/f.wav",
	},
	v: {
		word: "van",
		wordAudio: "ipa/words/van.wav",
		soundAudio: "ipa/sounds/v.wav",
	},
	θ: {
		word: "think",
		wordAudio: "ipa/words/think.wav",
		soundAudio: "ipa/sounds/th-voiceless.wav",
	},
	ð: {
		word: "this",
		wordAudio: "ipa/words/this.wav",
		soundAudio: "ipa/sounds/th-voiced.wav",
	},
	s: {
		word: "sit",
		wordAudio: "ipa/words/sit-s.wav",
		soundAudio: "ipa/sounds/s.wav",
	},
	z: {
		word: "zoo",
		wordAudio: "ipa/words/zoo.wav",
		soundAudio: "ipa/sounds/z.wav",
	},
	ʃ: {
		word: "ship",
		wordAudio: "ipa/words/ship.wav",
		soundAudio: "ipa/sounds/sh.wav",
	},
	ʒ: {
		word: "measure",
		wordAudio: "ipa/words/measure.wav",
		soundAudio: "ipa/sounds/zh.wav",
	},
	h: {
		word: "hat",
		wordAudio: "ipa/words/hat.wav",
		soundAudio: "ipa/sounds/h.wav",
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
		soundAudio: "ipa/sounds/m.wav",
	},
	n: {
		word: "no",
		wordAudio: "ipa/words/no.wav",
		soundAudio: "ipa/sounds/n.wav",
	},
	ŋ: {
		word: "sing",
		wordAudio: "ipa/words/sing.wav",
		soundAudio: "ipa/sounds/ng.wav",
	},
	l: {
		word: "let",
		wordAudio: "ipa/words/let.wav",
		soundAudio: "ipa/sounds/l.wav",
	},
	r: {
		word: "red",
		wordAudio: "ipa/words/red.wav",
		soundAudio: "ipa/sounds/r.wav",
	},
	j: {
		word: "yes",
		wordAudio: "ipa/words/yes.wav",
		soundAudio: "ipa/sounds/y.wav",
	},
	w: {
		word: "wet",
		wordAudio: "ipa/words/wet.wav",
		soundAudio: "ipa/sounds/w.wav",
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
			<div className="absolute top-3 right-3 z-10">
				{isLoading ? (
					<Spinner className="size-4" />
				) : (
					<Volume2
						className={cn(
							"size-4 text-muted-foreground transition-opacity",
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
		<section className="flex flex-col gap-4 rounded-lg bg-muted/30 p-6">
			<div className="flex flex-col gap-1">
				<h3 className="font-medium">IPA Audio Management</h3>
			</div>

			{statusLoading ? (
				<div className="flex items-center gap-2 text-muted-foreground text-sm">
					<Spinner className="size-4" />
					Checking audio status...
				</div>
			) : status ? (
				<div className="flex flex-col gap-4">
					<Table>
						<TableHeader>
							<TableRow>
								<TableHead>Status</TableHead>
								<TableHead className="text-right">Count</TableHead>
							</TableRow>
						</TableHeader>
						<TableBody>
							<TableRow>
								<TableCell>Existing</TableCell>
								<TableCell className="text-right tabular-nums">
									{status.existing.length}
								</TableCell>
							</TableRow>
							<TableRow>
								<TableCell>Missing</TableCell>
								<TableCell className="text-right tabular-nums">
									{status.missing.length}
								</TableCell>
							</TableRow>
							<TableRow className="font-medium">
								<TableCell>Total</TableCell>
								<TableCell className="text-right tabular-nums">
									{status.total}
								</TableCell>
							</TableRow>
						</TableBody>
					</Table>

					<div className="flex items-center gap-2">
						<Button
							onClick={() => generateAudio()}
							disabled={isGenerating || status.missing.length === 0}
							size="sm"
						>
							{isGenerating ? (
								<>
									<Spinner className="size-4" />
									Generating...
								</>
							) : (
								<>
									<RefreshCw className="size-4" />
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
							<div className="mt-2 max-h-32 overflow-auto rounded bg-muted/50 p-2 font-mono">
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
				<div className="flex flex-col gap-16">
					{/* IPA Section Header with Controls */}
					<section className="flex flex-col gap-12">
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
					</section>

					{/* Admin Section - only visible to admins */}
					<AdminAudioSection />

					<div className="h-px bg-border/60" />

					{/* Quick Start CTA */}
					<section className="flex flex-col items-center gap-4 rounded-xl bg-muted/30 py-10 text-center sm:flex-row sm:justify-between sm:px-8 sm:text-left">
						<div className="flex flex-col gap-1 px-6 sm:px-0">
							<h3 className="font-medium">Ready to practice?</h3>
							<p className="text-muted-foreground text-sm">
								Put your knowledge to the test with our practice texts.
							</p>
						</div>
						<Button asChild className="mx-6 sm:mx-0">
							<Link to="/practice">Start Practicing</Link>
						</Button>
					</section>
				</div>
			</PageContainer>
		</MainLayout>
	);
}
