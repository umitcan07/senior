import { useQuery, useQueryClient } from "@tanstack/react-query";
import { createFileRoute, Link, Navigate } from "@tanstack/react-router";
import { Pause, Play, Plus, Trash2 } from "lucide-react";
import { useState } from "react";
import { AdminLayout } from "@/components/layout/admin-layout";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
	Dialog,
	DialogContent,
	DialogDescription,
	DialogFooter,
	DialogHeader,
	DialogTitle,
	DialogTrigger,
} from "@/components/ui/dialog";
import { EmptyState } from "@/components/ui/empty-state";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
	Select,
	SelectContent,
	SelectItem,
	SelectTrigger,
	SelectValue,
} from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import { Switch } from "@/components/ui/switch";
import {
	Tooltip,
	TooltipContent,
	TooltipProvider,
	TooltipTrigger,
} from "@/components/ui/tooltip";
import {
	type Author,
	formatDuration,
	MOCK_AUTHORS,
	MOCK_REFERENCES,
	MOCK_TEXTS,
	type PracticeText,
	type ReferenceSpeech,
} from "@/data/mock";
import { useToast } from "@/hooks/use-toast";
import { useRequireAdmin } from "@/lib/auth";

export const Route = createFileRoute("/admin/references")({
	component: ReferencesPage,
	pendingComponent: ReferencesSkeleton,
});

// TEXT SELECTOR

interface TextSelectorProps {
	texts: PracticeText[];
	selectedTextId: string | null;
	onSelect: (textId: string | null) => void;
}

function TextSelector({ texts, selectedTextId, onSelect }: TextSelectorProps) {
	return (
		<Select
			value={selectedTextId ?? "all"}
			onValueChange={(v) => onSelect(v === "all" ? null : v)}
		>
			<SelectTrigger className="w-64">
				<SelectValue placeholder="Filter by text" />
			</SelectTrigger>
			<SelectContent>
				<SelectItem value="all">All texts</SelectItem>
				{texts.map((text) => (
					<SelectItem key={text.id} value={text.id}>
						{text.content.slice(0, 40)}...
					</SelectItem>
				))}
			</SelectContent>
		</Select>
	);
}

// AUTO-GENERATE TOGGLE (Disabled)

function AutoGenerateToggle() {
	return (
		<TooltipProvider>
			<Tooltip>
				<TooltipTrigger asChild>
					<div className="flex items-center gap-3 rounded-lg bg-muted/30 p-3 opacity-60">
						<Switch disabled checked={false} />
						<div className="flex flex-col gap-0.5">
							<Label className="text-sm">
								Auto-generate reference recordings
							</Label>
							<p className="text-muted-foreground text-xs">
								Future feature – currently disabled
							</p>
						</div>
					</div>
				</TooltipTrigger>
				<TooltipContent>
					<p>TTS generation will be available in a future update</p>
				</TooltipContent>
			</Tooltip>
		</TooltipProvider>
	);
}

// ADD REFERENCE MODAL

interface AddReferenceModalProps {
	texts: PracticeText[];
	authors: Author[];
	selectedTextId: string | null;
	onSuccess: () => void;
}

function AddReferenceModal({
	texts,
	authors,
	selectedTextId,
	onSuccess,
}: AddReferenceModalProps) {
	const [open, setOpen] = useState(false);
	const [textId, setTextId] = useState(selectedTextId ?? "");
	const [authorId, setAuthorId] = useState("");
	const [file, setFile] = useState<File | null>(null);
	const [isSubmitting, setIsSubmitting] = useState(false);
	const { toast } = useToast();

	const handleSubmit = async (e: React.FormEvent) => {
		e.preventDefault();
		if (!textId || !authorId || !file) return;

		setIsSubmitting(true);
		// Simulate upload
		await new Promise((resolve) => setTimeout(resolve, 1500));

		toast({
			title: "Reference added",
			description: "The reference speech has been uploaded successfully.",
		});

		setIsSubmitting(false);
		setOpen(false);
		setTextId(selectedTextId ?? "");
		setAuthorId("");
		setFile(null);
		onSuccess();
	};

	return (
		<Dialog open={open} onOpenChange={setOpen}>
			<DialogTrigger asChild>
				<Button size="sm">
					<Plus size={16} />
					Add Reference
				</Button>
			</DialogTrigger>
			<DialogContent className="sm:max-w-md">
				<DialogHeader>
					<DialogTitle>Add Reference Speech</DialogTitle>
					<DialogDescription>
						Upload an audio file to use as reference pronunciation.
					</DialogDescription>
				</DialogHeader>
				<form onSubmit={handleSubmit} className="flex flex-col gap-4">
					<div className="flex flex-col gap-2">
						<Label htmlFor="text">Practice Text</Label>
						<Select value={textId} onValueChange={setTextId}>
							<SelectTrigger>
								<SelectValue placeholder="Select a text" />
							</SelectTrigger>
							<SelectContent>
								{texts.map((text) => (
									<SelectItem key={text.id} value={text.id}>
										{text.content.slice(0, 50)}...
									</SelectItem>
								))}
							</SelectContent>
						</Select>
					</div>

					<div className="flex flex-col gap-2">
						<Label htmlFor="author">Author / Voice</Label>
						<Select value={authorId} onValueChange={setAuthorId}>
							<SelectTrigger>
								<SelectValue placeholder="Select an author" />
							</SelectTrigger>
							<SelectContent>
								{authors.map((author) => (
									<SelectItem key={author.id} value={author.id}>
										{author.name} ({author.accent})
									</SelectItem>
								))}
								<div className="border-t p-2">
									<Button
										variant="ghost"
										size="sm"
										className="w-full justify-start"
										asChild
									>
										<Link to="/admin/authors">Add New Author</Link>
									</Button>
								</div>
							</SelectContent>
						</Select>
					</div>

					<div className="flex flex-col gap-2">
						<Label htmlFor="file">Audio File</Label>
						<Input
							id="file"
							type="file"
							accept=".wav,.mp3,.m4a,.ogg"
							onChange={(e) => setFile(e.target.files?.[0] ?? null)}
						/>
						<p className="text-muted-foreground text-xs">
							Supported formats: WAV, MP3, M4A, OGG (max 10MB)
						</p>
					</div>

					<DialogFooter>
						<Button
							type="button"
							variant="outline"
							onClick={() => setOpen(false)}
						>
							Cancel
						</Button>
						<Button
							type="submit"
							disabled={!textId || !authorId || !file || isSubmitting}
						>
							{isSubmitting ? "Upload" : "Upload"}
						</Button>
					</DialogFooter>
				</form>
			</DialogContent>
		</Dialog>
	);
}

// REFERENCE TABLE

interface ReferenceWithRelations extends ReferenceSpeech {
	author: Author;
	text: PracticeText;
}

interface ReferenceTableProps {
	references: ReferenceWithRelations[];
	onDelete: (id: string) => void;
}

function ReferenceTable({ references, onDelete }: ReferenceTableProps) {
	const [playingId, setPlayingId] = useState<string | null>(null);

	const togglePlay = (id: string) => {
		setPlayingId(playingId === id ? null : id);
	};

	if (references.length === 0) {
		return (
			<EmptyState
				title="No references found"
				description="Add reference speeches to help users practice pronunciation."
			/>
		);
	}

	return (
		<div className="overflow-x-auto">
			<table className="w-full text-sm">
				<thead>
					<tr className="border-b text-left">
						<th className="pb-3 font-medium">Author</th>
						<th className="pb-3 font-medium">Text</th>
						<th className="pb-3 font-medium">Method</th>
						<th className="pb-3 font-medium">Duration</th>
						<th className="pb-3 text-right font-medium">Actions</th>
					</tr>
				</thead>
				<tbody className="divide-y">
					{references.map((ref) => (
						<tr key={ref.id} className="group">
							<td className="py-3">
								<div className="flex items-center gap-2">
									<span>{ref.author.name}</span>
									<Badge variant="secondary" className="text-xs">
										{ref.author.accent}
									</Badge>
								</div>
							</td>
							<td className="max-w-xs truncate py-3 text-muted-foreground">
								{ref.text.content.slice(0, 40)}...
							</td>
							<td className="py-3">
								<Badge
									variant={
										ref.generationMethod === "native" ? "default" : "secondary"
									}
								>
									{ref.generationMethod}
								</Badge>
							</td>
							<td className="py-3 text-muted-foreground tabular-nums">
								{formatDuration(ref.durationMs)}
							</td>
							<td className="py-3">
								<div className="flex justify-end gap-1">
									<TooltipProvider>
										<Tooltip>
											<TooltipTrigger asChild>
												<Button
													variant="ghost"
													size="icon-sm"
													onClick={() => togglePlay(ref.id)}
													disabled
												>
													{playingId === ref.id ? (
														<Pause size={14} />
													) : (
														<Play size={14} />
													)}
												</Button>
											</TooltipTrigger>
											<TooltipContent>
												<p>Audio playback requires backend integration</p>
											</TooltipContent>
										</Tooltip>
									</TooltipProvider>
									<Button
										variant="ghost"
										size="icon-sm"
										className="text-destructive hover:text-destructive"
										onClick={() => onDelete(ref.id)}
									>
										<Trash2 size={14} />
									</Button>
								</div>
							</td>
						</tr>
					))}
				</tbody>
			</table>
		</div>
	);
}

// SKELETON

function ReferencesSkeleton() {
	return (
		<AdminLayout
			title="Reference Speeches"
			description="Manage reference audio for practice texts"
		>
			<div className="flex flex-col gap-6">
				<div className="flex items-center justify-end">
					<Skeleton className="h-9 w-32" />
				</div>
				<Skeleton className="h-12" />
				<Skeleton className="h-64" />
			</div>
		</AdminLayout>
	);
}

// MAIN PAGE

function ReferencesPage() {
	const {
		isAdmin,
		isAuthenticated,
		isLoading: authLoading,
	} = useRequireAdmin();
	const [selectedTextId, setSelectedTextId] = useState<string | null>(null);
	const { toast } = useToast();

	const {
		data: referencesData,
		isLoading: dataLoading,
		isError,
		error,
	} = useQuery({
		queryKey: ["references"],
		queryFn: async () => {
			// Simulate async operation
			await new Promise((resolve) => setTimeout(resolve, 100));
			return {
				texts: MOCK_TEXTS,
				authors: MOCK_AUTHORS,
				references: MOCK_REFERENCES.map((ref) => ({
					...ref,
					author: MOCK_AUTHORS.find((a) => a.id === ref.authorId)!,
					text: MOCK_TEXTS.find((t) => t.id === ref.textId)!,
				})),
			};
		},
	});

	if (authLoading || dataLoading) {
		return null;
	}

	if (!isAuthenticated || !isAdmin) {
		return <Navigate to="/login" />;
	}

	if (isError) {
		return (
			<AdminLayout
				title="Reference Speeches"
				description="Manage reference audio for practice texts"
			>
				<div className="text-destructive">Error: {error?.message}</div>
			</AdminLayout>
		);
	}

	if (!referencesData) {
		return null;
	}

	const { texts, authors, references } = referencesData;

	const filteredReferences = selectedTextId
		? references.filter((r) => r.textId === selectedTextId)
		: references;

	const queryClient = useQueryClient();

	const handleDelete = (_id: string) => {
		// In production, call API to delete
		toast({
			title: "Reference deleted",
			description: "The reference speech has been removed.",
		});
		// Invalidate and refetch
		queryClient.invalidateQueries({ queryKey: ["references"] });
	};

	const handleAddSuccess = () => {
		// Invalidate and refetch
		queryClient.invalidateQueries({ queryKey: ["references"] });
	};

	return (
		<AdminLayout
			title="Reference Speeches"
			description="Manage reference audio for practice texts"
			headerActions={
				<AddReferenceModal
					texts={texts}
					authors={authors}
					selectedTextId={selectedTextId}
					onSuccess={handleAddSuccess}
				/>
			}
		>
			<div className="flex flex-col gap-6">
				{/* Auto-generate toggle (disabled) */}
				<AutoGenerateToggle />

				{/* Filters */}
				<Card>
					<CardHeader className="pb-3">
						<CardTitle className="text-base">Filter References</CardTitle>
					</CardHeader>
					<CardContent>
						<TextSelector
							texts={texts}
							selectedTextId={selectedTextId}
							onSelect={setSelectedTextId}
						/>
					</CardContent>
				</Card>

				{/* Reference Table */}
				<Card>
					<CardContent className="p-4">
						<ReferenceTable
							references={filteredReferences}
							onDelete={handleDelete}
						/>
					</CardContent>
				</Card>
			</div>
		</AdminLayout>
	);
}
