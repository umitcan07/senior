import type { AnyFieldApi } from "@tanstack/react-form";
import { useForm } from "@tanstack/react-form";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { createFileRoute, Navigate } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { FileJson, Upload } from "lucide-react";
import { useEffect, useState } from "react";
import { AdminLayout } from "@/components/layout/admin-layout";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import {
	Dialog,
	DialogContent,
	DialogDescription,
	DialogFooter,
	DialogHeader,
	DialogTitle,
} from "@/components/ui/dialog";
import { EmptyState } from "@/components/ui/empty-state";
import { Label } from "@/components/ui/label";
import {
	Select,
	SelectContent,
	SelectItem,
	SelectTrigger,
	SelectValue,
} from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Skeleton } from "@/components/ui/skeleton";
import { Textarea } from "@/components/ui/textarea";
import type { PracticeText } from "@/db/text";
import type { TextDifficulty, TextType } from "@/db/types";
import { useToast } from "@/hooks/use-toast";
import { useRequireAdmin } from "@/lib/auth";
import {
	serverDeletePracticeText,
	serverGetPracticeTexts,
	serverInsertPracticeText,
	serverUpdatePracticeText,
} from "@/lib/text";
import { createColumns, type TextTableActions } from "./text-columns";
import { DataTable } from "./text-data-table";

export const Route = createFileRoute("/admin/text")({
	component: RouteComponent,
	pendingComponent: TextManagementSkeleton,
});

function FieldInfo({ field }: { field: AnyFieldApi }) {
	if (!field.state.meta.isTouched) return null;

	return (
		<div className="mt-1 text-muted-foreground text-xs">
			{!field.state.meta.isValid && field.state.meta.errors.length > 0 ? (
				<span className="text-destructive">
					{field.state.meta.errors.join(", ")}
				</span>
			) : field.state.meta.isValidating ? (
				<span>Validating...</span>
			) : null}
		</div>
	);
}

function EditTextDialog({
	text,
	open,
	onOpenChange,
}: {
	text: PracticeText;
	open: boolean;
	onOpenChange: (open: boolean) => void;
}) {
	const [editContent, setEditContent] = useState(text.content);
	const [editDifficulty, setEditDifficulty] = useState<TextDifficulty>(
		text.difficulty,
	);
	const [editType, setEditType] = useState<TextType>(text.type);
	const [editNote, setEditNote] = useState(text.note || "");
	const updateTextFn = useServerFn(serverUpdatePracticeText);
	const queryClient = useQueryClient();

	// Reset form when dialog opens or text changes
	useEffect(() => {
		if (open) {
			setEditContent(text.content);
			setEditDifficulty(text.difficulty);
			setEditType(text.type);
			setEditNote(text.note || "");
		}
	}, [text.content, text.difficulty, text.type, text.note, open]);

	const { mutate: updateText, isPending: isUpdating } = useMutation({
		mutationFn: async (data: {
			id: string;
			content?: string;
			difficulty?: TextDifficulty;
			type?: TextType;
			note?: string | null;
		}) => {
			return updateTextFn({ data });
		},
		onSuccess: async () => {
			await queryClient.invalidateQueries({ queryKey: ["texts"] });
			onOpenChange(false);
		},
	});

	const handleSave = () => {
		const hasChanges =
			editContent.trim() !== text.content ||
			editDifficulty !== text.difficulty ||
			editType !== text.type ||
			editNote !== (text.note || "");

		if (hasChanges && editContent.trim()) {
			updateText({
				id: text.id,
				content:
					editContent.trim() !== text.content ? editContent.trim() : undefined,
				difficulty:
					editDifficulty !== text.difficulty ? editDifficulty : undefined,
				type: editType !== text.type ? editType : undefined,
				note:
					editNote !== (text.note || "") ? editNote.trim() || null : undefined,
			});
		} else {
			onOpenChange(false);
		}
	};

	const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
		if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) {
			e.preventDefault();
			handleSave();
		}
	};

	return (
		<Dialog open={open} onOpenChange={onOpenChange}>
			<DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
				<DialogHeader>
					<DialogTitle>Edit Practice Text</DialogTitle>
					<DialogDescription>
						Update the content, difficulty, type, and note for this practice
						text.
					</DialogDescription>
				</DialogHeader>
				<div className="space-y-4 py-4">
					<div className="space-y-2">
						<Label htmlFor="edit-content">Content</Label>
						<Textarea
							id="edit-content"
							value={editContent}
							onChange={(e) => setEditContent(e.target.value)}
							onKeyDown={handleKeyDown}
							className="min-h-32 resize-none"
							autoFocus
						/>
					</div>
					<div className="grid gap-4 sm:grid-cols-2">
						<div className="space-y-2">
							<Label htmlFor="edit-difficulty">Difficulty</Label>
							<Select
								value={editDifficulty}
								onValueChange={(value) =>
									setEditDifficulty(value as TextDifficulty)
								}
							>
								<SelectTrigger id="edit-difficulty" className="w-full">
									<SelectValue />
								</SelectTrigger>
								<SelectContent>
									<SelectItem value="beginner">Beginner</SelectItem>
									<SelectItem value="intermediate">Intermediate</SelectItem>
									<SelectItem value="advanced">Advanced</SelectItem>
								</SelectContent>
							</Select>
						</div>
						<div className="space-y-2">
							<Label htmlFor="edit-type">Type</Label>
							<Select
								value={editType}
								onValueChange={(value) => setEditType(value as TextType)}
							>
								<SelectTrigger id="edit-type" className="w-full">
									<SelectValue />
								</SelectTrigger>
								<SelectContent>
									<SelectItem value="daily">Daily</SelectItem>
									<SelectItem value="professional">Professional</SelectItem>
									<SelectItem value="academic">Academic</SelectItem>
									<SelectItem value="phonetic_challenge">
										Phonetic Challenge
									</SelectItem>
									<SelectItem value="common_phrase">Common Phrase</SelectItem>
								</SelectContent>
							</Select>
						</div>
					</div>
					<div className="space-y-2">
						<Label htmlFor="edit-note">Note (optional)</Label>
						<Textarea
							id="edit-note"
							value={editNote}
							onChange={(e) => setEditNote(e.target.value)}
							placeholder="Optional note or description..."
							className="min-h-20 resize-none"
						/>
					</div>
				</div>
				<DialogFooter>
					<Button
						type="button"
						variant="outline"
						onClick={() => onOpenChange(false)}
						disabled={isUpdating}
					>
						Cancel
					</Button>
					<Button
						type="button"
						onClick={handleSave}
						disabled={isUpdating || !editContent.trim()}
					>
						{isUpdating ? "Saving..." : "Save Changes"}
					</Button>
				</DialogFooter>
			</DialogContent>
		</Dialog>
	);
}

function TextList() {
	const getTextsFn = useServerFn(serverGetPracticeTexts);
	const [editingText, setEditingText] = useState<PracticeText | null>(null);

	const { data, isLoading, isError, error } = useQuery({
		queryKey: ["texts"],
		queryFn: async () => {
			const result = await getTextsFn();
			if (!result.success) {
				throw new Error(result.error.message);
			}
			return result.data;
		},
	});

	const deleteTextFn = useServerFn(serverDeletePracticeText);
	const queryClient = useQueryClient();

	const { mutate: deleteText } = useMutation({
		mutationFn: async (id: string) => {
			return deleteTextFn({ data: { id } });
		},
		onSuccess: async () => {
			await queryClient.invalidateQueries({ queryKey: ["texts"] });
		},
	});

	const { mutate: deleteMultiple } = useMutation({
		mutationFn: async (ids: string[]) => {
			return Promise.all(ids.map((id) => deleteTextFn({ data: { id } })));
		},
		onSuccess: async () => {
			await queryClient.invalidateQueries({ queryKey: ["texts"] });
		},
	});

	const actions: TextTableActions = {
		onEdit: (text) => setEditingText(text),
		onDelete: (text) => deleteText(text.id),
	};

	const handleDeleteSelected = (rows: PracticeText[]) => {
		deleteMultiple(rows.map((row) => row.id));
	};

	const columns = createColumns(actions);

	if (isLoading) {
		return <Skeleton className="h-64" />;
	}

	if (isError) {
		return <div className="text-destructive">Error: {error?.message}</div>;
	}

	if (!data || data.length === 0) {
		return (
			<EmptyState
				title="No practice texts yet"
				description="Create your first practice text using the form below."
			/>
		);
	}

	return (
		<div className="flex flex-col gap-4">
			{editingText && (
				<EditTextDialog
					text={editingText}
					open={!!editingText}
					onOpenChange={(open) => {
						if (!open) {
							setEditingText(null);
						}
					}}
				/>
			)}
			<DataTable
				columns={columns}
				data={data}
				onDeleteSelected={handleDeleteSelected}
			/>
		</div>
	);
}

function TextForm() {
	const insertTextFn = useServerFn(serverInsertPracticeText);
	const queryClient = useQueryClient();
	const [jsonInput, setJsonInput] = useState("");
	const { toast } = useToast();

	const { mutate } = useMutation({
		mutationFn: async (data: {
			content: string;
			difficulty: TextDifficulty;
			type: TextType;
			note?: string | null;
		}) => {
			return insertTextFn({ data });
		},
		onSuccess: async () => {
			await queryClient.invalidateQueries({ queryKey: ["texts"] });
		},
	});

	const { mutate: bulkInsert, isPending: isBulkInserting } = useMutation({
		mutationFn: async (
			texts: Array<{
				content: string;
				difficulty: TextDifficulty;
				type: TextType;
				note?: string | null;
			}>,
		) => {
			const results = await Promise.all(
				texts.map((text) => insertTextFn({ data: text })),
			);
			return results;
		},
		onSuccess: async (results) => {
			const successCount = results.filter((r) => r.success).length;
			const failCount = results.length - successCount;
			await queryClient.invalidateQueries({ queryKey: ["texts"] });
			setJsonInput("");
			toast({
				title: "Bulk import completed",
				description: `${successCount} texts imported${failCount > 0 ? `, ${failCount} failed` : ""}.`,
			});
		},
	});

	const handleJsonImport = () => {
		try {
			const parsed = JSON.parse(jsonInput);
			const texts = Array.isArray(parsed) ? parsed : [parsed];

			const validatedTexts = texts.map((text: unknown) => {
				const t = text as Record<string, unknown>;
				return {
					content: (t.content || t.text || "") as string,
					difficulty: (t.difficulty || "beginner") as TextDifficulty,
					type: (t.type || "daily") as TextType,
					note: (t.note || null) as string | null,
				};
			});

			if (validatedTexts.some((t) => !t.content.trim())) {
				toast({
					title: "Invalid JSON",
					description: "All texts must have a content field.",
					variant: "destructive",
				});
				return;
			}

			bulkInsert(validatedTexts);
		} catch (error) {
			toast({
				title: "Invalid JSON",
				description:
					error instanceof Error ? error.message : "Failed to parse JSON",
				variant: "destructive",
			});
		}
	};

	const form = useForm({
		defaultValues: {
			content: "",
			difficulty: "beginner" as TextDifficulty,
			type: "daily" as TextType,
			note: "",
		},
		onSubmit: async ({ value }) => {
			mutate(
				{
					content: value.content,
					difficulty: value.difficulty,
					type: value.type,
					note: value.note?.trim() || null,
				},
				{
					onSuccess: () => {
						form.reset();
					},
				},
			);
		},
	});

	return (
		<Card>
			<CardContent className="pt-6">
				<h3 className="mb-4 font-semibold">Add New Text</h3>
				<Tabs defaultValue="form" className="w-full">
					<TabsList className="grid w-full grid-cols-2">
						<TabsTrigger value="form">Form Editor</TabsTrigger>
						<TabsTrigger value="json" className="gap-2">
							<FileJson size={16} />
							JSON Import
						</TabsTrigger>
					</TabsList>
					<TabsContent value="form" className="mt-4">
						<form
							onSubmit={(e) => {
								e.preventDefault();
								e.stopPropagation();
								form.handleSubmit();
							}}
							className="space-y-4"
						>
							<div className="space-y-2">
								<Label htmlFor="content">Content</Label>
								<form.Field
									name="content"
									validators={{
										onChange: ({ value }) =>
											!value
												? "Text is required"
												: value.length < 3
													? "Text must be at least 3 characters"
													: undefined,
									}}
								>
									{(field) => {
										return (
											<>
												<Textarea
													id={field.name}
													name={field.name}
													value={field.state.value}
													onBlur={field.handleBlur}
													onChange={(e) => field.handleChange(e.target.value)}
													placeholder="Enter your practice text here..."
													className="min-h-32 resize-none"
												/>
												<FieldInfo field={field} />
											</>
										);
									}}
								</form.Field>
							</div>
							<div className="grid gap-4 sm:grid-cols-2">
								<div className="space-y-2">
									<Label htmlFor="difficulty">Difficulty</Label>
									<form.Field name="difficulty">
										{(field) => {
											return (
												<>
													<Select
														value={field.state.value}
														onValueChange={(value) =>
															field.handleChange(value as TextDifficulty)
														}
													>
														<SelectTrigger id="difficulty" className="w-full">
															<SelectValue placeholder="Select difficulty" />
														</SelectTrigger>
														<SelectContent>
															<SelectItem value="beginner">Beginner</SelectItem>
															<SelectItem value="intermediate">
																Intermediate
															</SelectItem>
															<SelectItem value="advanced">Advanced</SelectItem>
														</SelectContent>
													</Select>
													<FieldInfo field={field} />
												</>
											);
										}}
									</form.Field>
								</div>
								<div className="space-y-2">
									<Label htmlFor="type">Type</Label>
									<form.Field name="type">
										{(field) => {
											return (
												<>
													<Select
														value={field.state.value}
														onValueChange={(value) =>
															field.handleChange(value as TextType)
														}
													>
														<SelectTrigger id="type" className="w-full">
															<SelectValue placeholder="Select type" />
														</SelectTrigger>
														<SelectContent>
															<SelectItem value="daily">Daily</SelectItem>
															<SelectItem value="professional">
																Professional
															</SelectItem>
															<SelectItem value="academic">Academic</SelectItem>
															<SelectItem value="phonetic_challenge">
																Phonetic Challenge
															</SelectItem>
															<SelectItem value="common_phrase">
																Common Phrase
															</SelectItem>
														</SelectContent>
													</Select>
													<FieldInfo field={field} />
												</>
											);
										}}
									</form.Field>
								</div>
							</div>
							<div className="space-y-2">
								<Label htmlFor="note">Note (optional)</Label>
								<form.Field name="note">
									{(field) => {
										return (
											<>
												<Textarea
													id={field.name}
													name={field.name}
													value={field.state.value}
													onBlur={field.handleBlur}
													onChange={(e) => field.handleChange(e.target.value)}
													placeholder="Optional note or description..."
													className="min-h-20 resize-none"
												/>
												<FieldInfo field={field} />
											</>
										);
									}}
								</form.Field>
							</div>
							<form.Subscribe
								selector={(state) => [state.canSubmit, state.isSubmitting]}
							>
								{([canSubmit, isSubmitting]) => (
									<Button type="submit" disabled={!canSubmit}>
										{isSubmitting ? "Adding..." : "Add Text"}
									</Button>
								)}
							</form.Subscribe>
						</form>
					</TabsContent>
					<TabsContent value="json" className="mt-4">
						<div className="flex flex-col gap-4">
							<div className="space-y-2">
								<Label htmlFor="json-input">JSON Input</Label>
								<Textarea
									id="json-input"
									value={jsonInput}
									onChange={(e) => setJsonInput(e.target.value)}
									placeholder='[{"content": "Hello world", "difficulty": "beginner", "type": "daily", "note": "Optional note"}]'
									className="min-h-48 font-mono text-xs"
								/>
							</div>
							<Button
								type="button"
								onClick={handleJsonImport}
								disabled={!jsonInput.trim() || isBulkInserting}
								className="gap-2"
							>
								<Upload size={16} />
								{isBulkInserting ? "Importing..." : "Import from JSON"}
							</Button>
						</div>
					</TabsContent>
				</Tabs>
			</CardContent>
		</Card>
	);
}

function TextManagementSkeleton() {
	return (
		<AdminLayout
			title="Text Management"
			description="Create, edit, and manage practice texts for pronunciation exercises"
		>
			<div className="flex flex-col gap-8">
				<div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
					{Array.from({ length: 6 }).map((_, i) => (
						<Skeleton key={i} className="h-40" />
					))}
				</div>
				<Skeleton className="h-48" />
			</div>
		</AdminLayout>
	);
}

function RouteComponent() {
	const { isAdmin, isAuthenticated, isLoading } = useRequireAdmin();

	if (isLoading) {
		return null;
	}

	if (!isAuthenticated || !isAdmin) {
		return <Navigate to="/login" />;
	}

	return (
		<AdminLayout
			title="Text Management"
			description="Create, edit, and manage practice texts for pronunciation exercises"
		>
			<div className="flex flex-col gap-8">
				<TextList />
				<TextForm />
			</div>
		</AdminLayout>
	);
}
