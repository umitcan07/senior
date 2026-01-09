import { RiCloudLine, RiMicLine, RiUploadLine } from "@remixicon/react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { Link } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useEffect, useMemo, useRef, useState } from "react";
import {
	AudioPlayerButton,
	AudioPlayerDuration,
	AudioPlayerProgress,
	AudioPlayerProvider,
	AudioPlayerTime,
} from "@/components/ui/audio-player";
import { Button } from "@/components/ui/button";
import {
	Dialog,
	DialogContent,
	DialogDescription,
	DialogFooter,
	DialogHeader,
	DialogTitle,
} from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import {
	Select,
	SelectContent,
	SelectItem,
	SelectTrigger,
	SelectValue,
} from "@/components/ui/select";
import { Slider } from "@/components/ui/slider";
import { Switch } from "@/components/ui/switch";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { TextCombobox } from "@/components/ui/text-combobox";
import type { Author } from "@/db/author";
import type { PracticeText } from "@/db/text";
import { useToast } from "@/hooks/use-toast";
import { serverGenerateSpeech, serverInsertReference } from "@/lib/reference";
import { cn } from "@/lib/utils";

interface AddReferenceDialogProps {
	open: boolean;
	onOpenChange: (open: boolean) => void;
	texts: PracticeText[];
	authors: Author[];
	/** Pre-selected text ID (optional) */
	preSelectedTextId?: string | null;
	/** Called after successful creation */
	onSuccess?: () => void;
}

export function AddReferenceDialog({
	open,
	onOpenChange,
	texts,
	authors,
	preSelectedTextId,
	onSuccess,
}: AddReferenceDialogProps) {
	const [textId, setTextId] = useState<string | null>(
		preSelectedTextId ?? null,
	);
	const [authorId, setAuthorId] = useState("");
	const [file, setFile] = useState<File | null>(null);
	const [activeTab, setActiveTab] = useState("upload");
	const [stability, setStability] = useState(0.5);
	const [similarityBoost, setSimilarityBoost] = useState(0.75);
	const [voiceStyle, setVoiceStyle] = useState(0.0);
	const [useSpeakerBoost, setUseSpeakerBoost] = useState(true);
	const fileInputRef = useRef<HTMLInputElement>(null);
	const queryClient = useQueryClient();
	const insertReferenceFn = useServerFn(serverInsertReference);
	const generateSpeechFn = useServerFn(serverGenerateSpeech);
	const { toast } = useToast();

	const selectedAuthor = authorId
		? authors.find((a) => a.id === authorId)
		: null;
	const canUseElevenLabs =
		selectedAuthor?.elevenlabsVoiceId !== null &&
		selectedAuthor?.elevenlabsVoiceId !== undefined &&
		selectedAuthor.elevenlabsVoiceId.trim() !== "";

	// Reset form when dialog opens
	useEffect(() => {
		if (open) {
			setTextId(preSelectedTextId ?? null);
			setAuthorId("");
			setFile(null);
			setActiveTab("upload");
			setStability(0.5);
			setSimilarityBoost(0.75);
			setVoiceStyle(0.0);
			setUseSpeakerBoost(true);
		}
	}, [open, preSelectedTextId]);

	const { mutate: createReference, isPending } = useMutation({
		mutationFn: async () => {
			if (!textId) throw new Error("Text is required");
			if (!authorId) throw new Error("Author is required");

			// If using ElevenLabs, generate speech
			if (activeTab === "eleven_labs") {
				return generateSpeechFn({
					data: {
						textId,
						authorId,
						voiceSettings: {
							stability,
							similarityBoost,
							style: voiceStyle,
							useSpeakerBoost,
						},
					},
				});
			}

			// Otherwise, upload file (native)
			const storageKey = `references/${textId}/${authorId}/${Date.now()}.wav`;
			return insertReferenceFn({
				data: {
					storageKey,
					authorId,
					textId,
					generationMethod: "native",
					durationMs: null,
					fileSizeBytes: file?.size ?? null,
				},
			});
		},
		onSuccess: async (result) => {
			if (result.success) {
				await queryClient.invalidateQueries({ queryKey: ["references"] });
				await queryClient.invalidateQueries({
					queryKey: ["texts-with-references"],
				});
				onOpenChange(false);
				toast({
					title: "Reference added",
					description: "The reference speech has been created.",
				});
				onSuccess?.();
			} else {
				toast({
					title: "Error",
					description: result.error.message,
					variant: "destructive",
				});
			}
		},
	});

	const handleSubmit = (e: React.FormEvent) => {
		e.preventDefault();
		if (!textId || !authorId) return;
		if (activeTab === "upload" && !file) return;
		createReference();
	};

	const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
		const selectedFile = e.target.files?.[0];
		if (selectedFile) {
			// Validate file type and size
			const validTypes = [
				"audio/wav",
				"audio/mpeg",
				"audio/mp3",
				"audio/mp4",
				"audio/x-m4a",
				"audio/ogg",
			];
			if (!validTypes.includes(selectedFile.type)) {
				toast({
					title: "Invalid file type",
					description: "Please upload a WAV, MP3, M4A, or OGG file.",
					variant: "destructive",
				});
				return;
			}
			if (selectedFile.size > 10 * 1024 * 1024) {
				toast({
					title: "File too large",
					description: "Maximum file size is 10MB.",
					variant: "destructive",
				});
				return;
			}
			setFile(selectedFile);
		}
	};

	// Create object URL for audio preview
	const audioPreviewUrl = useMemo(() => {
		if (!file) return null;
		return URL.createObjectURL(file);
	}, [file]);

	// Cleanup object URL on unmount or file change
	useEffect(() => {
		return () => {
			if (audioPreviewUrl) {
				URL.revokeObjectURL(audioPreviewUrl);
			}
		};
	}, [audioPreviewUrl]);

	const canSubmit =
		textId &&
		authorId &&
		(activeTab === "eleven_labs"
			? canUseElevenLabs
			: activeTab === "upload" && file);

	const selectedText = textId ? texts.find((t) => t.id === textId) : null;

	return (
		<Dialog open={open} onOpenChange={onOpenChange}>
			<DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-lg">
				<DialogHeader>
					<DialogTitle>Add Reference Speech</DialogTitle>
					<DialogDescription>
						{selectedText ? (
							<span className="line-clamp-2">
								For: "{selectedText.content.slice(0, 80)}..."
							</span>
						) : (
							"Upload an audio file or generate with ElevenLabs."
						)}
					</DialogDescription>
				</DialogHeader>
				<form onSubmit={handleSubmit} className="space-y-4">
					{/* Text Selection - Only show if no preselected text */}
					{!preSelectedTextId && (
						<div className="space-y-2">
							<Label>Practice Text</Label>
							{texts.length === 0 ? (
								<div className="rounded-md border border-dashed p-4 text-center text-muted-foreground text-sm">
									No texts available.{" "}
									<Link to="/admin/text" className="text-primary underline">
										Create one first
									</Link>
								</div>
							) : (
								<TextCombobox
									texts={texts}
									value={textId}
									onValueChange={setTextId}
									placeholder="Search and select a text..."
								/>
							)}
						</div>
					)}

					{/* Author Selection */}
					<div className="space-y-2">
						<Label htmlFor="author">Author / Voice</Label>
						<Select value={authorId} onValueChange={setAuthorId}>
							<SelectTrigger>
								<SelectValue placeholder="Select an author" />
							</SelectTrigger>
							<SelectContent>
								{authors.length === 0 ? (
									<div className="p-2 text-muted-foreground text-sm">
										No authors available.{" "}
										<Link
											to="/admin/authors"
											className="text-primary underline"
										>
											Create one first
										</Link>
									</div>
								) : (
									authors.map((author) => (
										<SelectItem key={author.id} value={author.id}>
											{author.name} {author.accent && `(${author.accent})`}
										</SelectItem>
									))
								)}
							</SelectContent>
						</Select>
					</div>

					{/* Upload Method Tabs */}
					<Tabs
						value={activeTab}
						onValueChange={setActiveTab}
						className="w-full"
					>
						<TabsList className="grid w-full grid-cols-2">
							<TabsTrigger value="upload" className="gap-2">
								<RiUploadLine size={16} />
								File Upload
							</TabsTrigger>
							<TabsTrigger
								value="eleven_labs"
								className="gap-2"
								disabled={!canUseElevenLabs && !!authorId}
							>
								<RiCloudLine size={16} />
								ElevenLabs
							</TabsTrigger>
						</TabsList>
						<TabsContent value="upload" className="mt-4 space-y-4">
							<div
								className={cn(
									"flex flex-col items-center justify-center rounded-lg border-2 border-dashed p-6 transition-colors",
									file
										? "border-primary/50 bg-primary/5"
										: "border-muted-foreground/25",
								)}
							>
								{file && audioPreviewUrl ? (
									<div className="flex w-full flex-col gap-4">
										<div className="flex items-center gap-3">
											<RiMicLine className="h-6 w-6 shrink-0 text-primary" />
											<div className="min-w-0 flex-1">
												<p className="truncate font-medium text-sm">
													{file.name}
												</p>
												<p className="text-muted-foreground text-xs">
													{(file.size / 1024 / 1024).toFixed(2)} MB
												</p>
											</div>
											<Button
												type="button"
												variant="outline"
												size="sm"
												onClick={() => {
													setFile(null);
													if (fileInputRef.current) {
														fileInputRef.current.value = "";
													}
												}}
											>
												Remove
											</Button>
										</div>
										<AudioPlayerProvider>
											<div className="flex items-center gap-3">
												<AudioPlayerButton
													item={{
														id: "preview",
														src: audioPreviewUrl,
													}}
													variant="outline"
													size="icon"
												/>
												<AudioPlayerProgress className="flex-1" />
												<div className="flex items-center gap-1 text-muted-foreground text-xs">
													<AudioPlayerTime />
													<span>/</span>
													<AudioPlayerDuration />
												</div>
											</div>
										</AudioPlayerProvider>
									</div>
								) : (
									<div className="flex flex-col items-center gap-2 text-center">
										<RiUploadLine className="h-8 w-8 text-muted-foreground" />
										<div>
											<p className="font-medium">Drop audio file here</p>
											<p className="text-muted-foreground text-sm">
												WAV, MP3, M4A, OGG (max 10MB)
											</p>
										</div>
										<Button
											type="button"
											variant="outline"
											size="sm"
											onClick={() => fileInputRef.current?.click()}
										>
											Browse Files
										</Button>
									</div>
								)}
								<input
									ref={fileInputRef}
									type="file"
									accept=".wav,.mp3,.m4a,.ogg,audio/*"
									onChange={handleFileChange}
									className="hidden"
								/>
							</div>
						</TabsContent>
						<TabsContent value="eleven_labs" className="mt-4">
							{canUseElevenLabs ? (
								<div className="flex flex-col gap-6">
									<div className="flex flex-col items-center justify-center gap-4 rounded-lg bg-muted/30 p-6 text-center">
										<RiCloudLine className="h-12 w-12 text-primary" />
										<div>
											<p className="font-medium">ElevenLabs TTS Generation</p>
											<p className="text-muted-foreground text-sm">
												Generate speech using{" "}
												{selectedAuthor?.name || "selected author"}'s voice
											</p>
											{selectedText && (
												<p className="mt-2 text-muted-foreground text-xs">
													Text: "{selectedText.content.slice(0, 60)}
													{selectedText.content.length > 60 ? "..." : ""}"
												</p>
											)}
										</div>
									</div>

									<div className="border-t pt-4">
										<h3 className="mb-4 font-semibold text-sm">
											Voice Settings
										</h3>
										<div className="flex flex-col gap-6">
											<div className="space-y-2">
												<div className="flex items-center justify-between">
													<Label htmlFor="stability">Stability</Label>
													<span className="text-muted-foreground text-sm">
														{(stability * 100).toFixed(0)}%
													</span>
												</div>
												<Slider
													id="stability"
													min={0}
													max={1}
													step={0.01}
													value={[stability]}
													onValueChange={(value) => setStability(value[0])}
												/>
												<p className="text-muted-foreground text-xs">
													Controls voice consistency. Higher values produce more
													stable speech.
												</p>
											</div>

											<div className="space-y-2">
												<div className="flex items-center justify-between">
													<Label htmlFor="similarityBoost">
														Similarity Boost
													</Label>
													<span className="text-muted-foreground text-sm">
														{(similarityBoost * 100).toFixed(0)}%
													</span>
												</div>
												<Slider
													id="similarityBoost"
													min={0}
													max={1}
													step={0.01}
													value={[similarityBoost]}
													onValueChange={(value) =>
														setSimilarityBoost(value[0])
													}
												/>
												<p className="text-muted-foreground text-xs">
													How closely the AI adheres to the original voice.
												</p>
											</div>

											<div className="space-y-2">
												<div className="flex items-center justify-between">
													<Label htmlFor="voiceStyle">Style</Label>
													<span className="text-muted-foreground text-sm">
														{(voiceStyle * 100).toFixed(0)}%
													</span>
												</div>
												<Slider
													id="voiceStyle"
													min={0}
													max={1}
													step={0.01}
													value={[voiceStyle]}
													onValueChange={(value) => setVoiceStyle(value[0])}
												/>
												<p className="text-muted-foreground text-xs">
													Adjusts voice expressiveness and emotional variation.
												</p>
											</div>

											<div className="flex items-center justify-between">
												<div className="space-y-0.5">
													<Label htmlFor="useSpeakerBoost">Speaker Boost</Label>
													<p className="text-muted-foreground text-xs">
														Enhances voice clarity and quality.
													</p>
												</div>
												<Switch
													id="useSpeakerBoost"
													checked={useSpeakerBoost}
													onCheckedChange={setUseSpeakerBoost}
												/>
											</div>
										</div>
									</div>
								</div>
							) : (
								<div className="flex flex-col items-center justify-center gap-4 rounded-lg bg-muted/30 p-6 text-center">
									<RiCloudLine className="h-12 w-12 text-muted-foreground/50" />
									<div>
										<p className="font-medium">ElevenLabs Not Available</p>
										<p className="text-muted-foreground text-sm">
											{selectedAuthor
												? "Selected author does not have an ElevenLabs voice ID configured."
												: "Select an author with an ElevenLabs voice ID to generate speech."}
										</p>
									</div>
									<Link
										to="/admin/authors"
										className="text-primary text-sm underline"
									>
										Configure author voice ID
									</Link>
								</div>
							)}
						</TabsContent>
					</Tabs>

					<DialogFooter>
						<Button
							type="button"
							variant="outline"
							onClick={() => onOpenChange(false)}
						>
							Cancel
						</Button>
						<Button type="submit" disabled={!canSubmit || isPending}>
							{isPending ? "Creating..." : "Create Reference"}
						</Button>
					</DialogFooter>
				</form>
			</DialogContent>
		</Dialog>
	);
}
