import type { AnyFieldApi } from "@tanstack/react-form";
import { useForm } from "@tanstack/react-form";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { createFileRoute } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { Calendar, Pencil, Trash2 } from "lucide-react";
import { useEffect, useState } from "react";
import {
	MainLayout,
	PageContainer,
	PageHeader,
} from "@/components/layout/main-layout";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { EmptyState } from "@/components/ui/empty-state";
import { Label } from "@/components/ui/label";
import { Skeleton } from "@/components/ui/skeleton";
import { Textarea } from "@/components/ui/textarea";
import type { PracticeText } from "@/db/text";
import {
	serverDeletePracticeText,
	serverGetPracticeTexts,
	serverInsertPracticeText,
	serverUpdatePracticeText,
} from "@/lib/text";

export const Route = createFileRoute("/admin/text")({
	component: RouteComponent,
	loader: async () => {
		const result = await serverGetPracticeTexts();
		if (!result.success) {
			throw new Error(result.error.message);
		}
		return { texts: result.data };
	},
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

function formatDate(date: Date) {
	return new Intl.DateTimeFormat("en-US", {
		month: "short",
		day: "numeric",
		year: "numeric",
		hour: "numeric",
		minute: "2-digit",
	}).format(new Date(date));
}

function TextItem({ text }: { text: PracticeText }) {
	const [isEditing, setIsEditing] = useState(false);
	const [editValue, setEditValue] = useState(text.content);
	const updateTextFn = useServerFn(serverUpdatePracticeText);
	const deleteTextFn = useServerFn(serverDeletePracticeText);
	const queryClient = useQueryClient();

	useEffect(() => {
		if (!isEditing) {
			setEditValue(text.content);
		}
	}, [text.content, isEditing]);

	const { mutate: updateText, isPending: isUpdating } = useMutation({
		mutationFn: async (data: { id: string; content: string }) => {
			return updateTextFn({ data });
		},
		onSuccess: async () => {
			await queryClient.invalidateQueries({ queryKey: ["texts"] });
			setIsEditing(false);
		},
	});

	const { mutate: deleteText, isPending: isDeleting } = useMutation({
		mutationFn: async (id: string) => {
			return deleteTextFn({ data: { id } });
		},
		onSuccess: async () => {
			await queryClient.invalidateQueries({ queryKey: ["texts"] });
		},
	});

	const handleSave = () => {
		if (editValue.trim() && editValue !== text.content) {
			updateText({ id: text.id, content: editValue.trim() });
		} else {
			setIsEditing(false);
		}
	};

	const handleCancel = () => {
		setEditValue(text.content);
		setIsEditing(false);
	};

	const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
		if ((e.key === "Enter" && (e.metaKey || e.ctrlKey)) || e.key === "Escape") {
			e.preventDefault();
			if (e.key === "Escape") {
				handleCancel();
			} else {
				handleSave();
			}
		}
	};

	if (isEditing) {
		return (
			<Card className="transition-all duration-200">
				<CardContent className="flex flex-col gap-4 pt-6">
					<Textarea
						value={editValue}
						onChange={(e) => setEditValue(e.target.value)}
						onKeyDown={handleKeyDown}
						className="min-h-32 resize-none"
						autoFocus
					/>
					<div className="flex justify-end gap-2">
						<Button
							type="button"
							variant="outline"
							size="sm"
							onClick={handleCancel}
							disabled={isUpdating}
						>
							Cancel
						</Button>
						<Button
							type="button"
							size="sm"
							onClick={handleSave}
							disabled={isUpdating || !editValue.trim()}
						>
							{isUpdating ? "Saving..." : "Save"}
						</Button>
					</div>
				</CardContent>
			</Card>
		);
	}

	return (
		<Card className="group transition-all duration-200">
			<CardContent className="flex flex-col gap-4 pt-6">
				<p className="line-clamp-5 text-foreground text-sm leading-relaxed">
					{text.content}
				</p>
				<div className="flex items-center justify-between border-t pt-4">
					<div className="flex items-center gap-1.5 text-muted-foreground text-xs">
						<Calendar size={12} />
						<span>{formatDate(text.createdAt)}</span>
						{text.updatedAt > text.createdAt && (
							<span className="text-muted-foreground/60">
								(edited {formatDate(text.updatedAt)})
							</span>
						)}
					</div>
					<div className="flex gap-1 opacity-0 transition-opacity group-hover:opacity-100">
						<Button
							type="button"
							variant="ghost"
							size="icon-sm"
							onClick={() => setIsEditing(true)}
							disabled={isDeleting}
							aria-label="Edit"
						>
							<Pencil size={14} />
						</Button>
						<Button
							type="button"
							variant="ghost"
							size="icon-sm"
							onClick={() => deleteText(text.id)}
							disabled={isDeleting}
							className="text-destructive hover:text-destructive"
							aria-label="Delete"
						>
							<Trash2 size={14} />
						</Button>
					</div>
				</div>
			</CardContent>
		</Card>
	);
}

function TextList() {
	const getTextsFn = useServerFn(serverGetPracticeTexts);
	const loaderData = Route.useLoaderData();

	const { data, isLoading, isError, error } = useQuery({
		queryKey: ["texts"],
		queryFn: async () => {
			const result = await getTextsFn();
			if (!result.success) {
				throw new Error(result.error.message);
			}
			return result.data;
		},
		initialData: loaderData.texts,
	});

	if (isLoading) {
		return (
			<div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
				{Array.from({ length: 6 }).map((_, i) => (
					<Skeleton key={i} className="h-32" />
				))}
			</div>
		);
	}
	if (isError)
		return <div className="text-destructive">Error: {error?.message}</div>;

	if (data && data.length > 0) {
		return (
			<div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
				{data.map((text) => (
					<TextItem key={text.id} text={text} />
				))}
			</div>
		);
	}

	if (data && data.length === 0) {
		return (
			<EmptyState
				title="No practice texts yet"
				description="Create your first practice text using the form below."
			/>
		);
	}

	return null;
}

function TextForm() {
	const insertTextFn = useServerFn(serverInsertPracticeText);
	const queryClient = useQueryClient();

	const { mutate } = useMutation({
		mutationFn: async (data: { content: string }) => {
			return insertTextFn({ data });
		},
		onSuccess: async () => {
			await queryClient.invalidateQueries({ queryKey: ["texts"] });
		},
	});

	const form = useForm({
		defaultValues: {
			content: "",
		},
		onSubmit: async ({ value }) => {
			mutate(value, {
				onSuccess: () => {
					form.reset();
				},
			});
		},
	});

	return (
		<Card>
			<CardContent className="pt-6">
				<form
					onSubmit={(e) => {
						e.preventDefault();
						e.stopPropagation();
						form.handleSubmit();
					}}
					className="space-y-4"
				>
					<div className="space-y-2">
						<Label htmlFor="content">New Practice Text</Label>
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
							children={(field) => {
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
						/>
					</div>
					<form.Subscribe
						selector={(state) => [state.canSubmit, state.isSubmitting]}
						children={([canSubmit, isSubmitting]) => (
							<Button type="submit" disabled={!canSubmit}>
								{isSubmitting ? "Adding..." : "Add Text"}
							</Button>
						)}
					/>
				</form>
			</CardContent>
		</Card>
	);
}

function TextManagementSkeleton() {
	return (
		<MainLayout>
			<PageContainer>
				<div className="space-y-8">
					<div className="space-y-2">
						<Skeleton className="h-8 w-48" />
						<Skeleton className="h-4 w-80" />
					</div>
					<div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
						{Array.from({ length: 6 }).map((_, i) => (
							<Skeleton key={i} className="h-40" />
						))}
					</div>
					<Skeleton className="h-48" />
				</div>
			</PageContainer>
		</MainLayout>
	);
}

function RouteComponent() {
	return (
		<MainLayout>
			<PageContainer>
				<div className="space-y-8">
					<PageHeader
						title="Text Management"
						description="Create, edit, and manage practice texts for pronunciation exercises"
					/>
					<TextList />
					<TextForm />
				</div>
			</PageContainer>
		</MainLayout>
	);
}
