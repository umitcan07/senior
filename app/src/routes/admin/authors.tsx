import { useQuery, useQueryClient } from "@tanstack/react-query";
import { createFileRoute, Navigate } from "@tanstack/react-router";
import { Pencil, Plus, Trash2 } from "lucide-react";
import { useState } from "react";
import { AdminLayout } from "@/components/layout/admin-layout";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
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
import {
	Tooltip,
	TooltipContent,
	TooltipProvider,
	TooltipTrigger,
} from "@/components/ui/tooltip";
import { type Author, getAuthorsWithReferenceCounts } from "@/data/mock";
import { useToast } from "@/hooks/use-toast";
import { useRequireAdmin } from "@/lib/auth";

export const Route = createFileRoute("/admin/authors")({
	component: AuthorsPage,
	pendingComponent: AuthorsSkeleton,
});

// CONSTANTS

const ACCENTS = ["US", "UK", "AU", "CA", "IN", "NZ", "SA", "IE"];
const STYLES = ["Neutral", "Formal", "Casual", "Professional", "Friendly"];
const LANGUAGES = [
	{ code: "en-US", label: "English (US)" },
	{ code: "en-GB", label: "English (UK)" },
	{ code: "en-AU", label: "English (AU)" },
	{ code: "en-CA", label: "English (CA)" },
	{ code: "en-IN", label: "English (IN)" },
];

// AUTHOR FORM MODAL

interface AuthorFormData {
	name: string;
	accent: string;
	style: string;
	languageCode: string;
}

interface AuthorFormModalProps {
	author?: Author & { referenceCount: number };
	onSuccess: () => void;
	trigger?: React.ReactNode;
}

function AuthorFormModal({ author, onSuccess, trigger }: AuthorFormModalProps) {
	const [open, setOpen] = useState(false);
	const [formData, setFormData] = useState<AuthorFormData>({
		name: author?.name ?? "",
		accent: author?.accent ?? "",
		style: author?.style ?? "",
		languageCode: author?.languageCode ?? "en-US",
	});
	const [isSubmitting, setIsSubmitting] = useState(false);
	const { toast } = useToast();

	const isEdit = !!author;

	const handleSubmit = async (e: React.FormEvent) => {
		e.preventDefault();
		if (!formData.name || !formData.accent || !formData.style) return;

		setIsSubmitting(true);
		// Simulate API call
		await new Promise((resolve) => setTimeout(resolve, 500));

		toast({
			title: isEdit ? "Author updated" : "Author created",
			description: `${formData.name} has been ${isEdit ? "updated" : "added"}.`,
		});

		setIsSubmitting(false);
		setOpen(false);
		if (!isEdit) {
			setFormData({
				name: "",
				accent: "",
				style: "",
				languageCode: "en-US",
			});
		}
		onSuccess();
	};

	const handleOpenChange = (newOpen: boolean) => {
		setOpen(newOpen);
		if (newOpen && author) {
			setFormData({
				name: author.name,
				accent: author.accent ?? "",
				style: author.style ?? "",
				languageCode: author.languageCode ?? "en-US",
			});
		}
	};

	return (
		<Dialog open={open} onOpenChange={handleOpenChange}>
			<DialogTrigger asChild>
				{trigger ?? (
					<Button size="sm">
						<Plus size={16} className="mr-1" />
						Add Author
					</Button>
				)}
			</DialogTrigger>
			<DialogContent className="sm:max-w-md">
				<DialogHeader>
					<DialogTitle>{isEdit ? "Edit Author" : "Add Author"}</DialogTitle>
					<DialogDescription>
						{isEdit
							? "Update the author's information."
							: "Add a new voice/author for reference speeches."}
					</DialogDescription>
				</DialogHeader>
				<form onSubmit={handleSubmit} className="space-y-4">
					<div className="space-y-2">
						<Label htmlFor="name">Name</Label>
						<Input
							id="name"
							value={formData.name}
							onChange={(e) =>
								setFormData({ ...formData, name: e.target.value })
							}
							placeholder="e.g., Amy, John"
							required
						/>
					</div>

					<div className="grid grid-cols-2 gap-4">
						<div className="space-y-2">
							<Label htmlFor="accent">Accent</Label>
							<Select
								value={formData.accent}
								onValueChange={(v) => setFormData({ ...formData, accent: v })}
							>
								<SelectTrigger>
									<SelectValue placeholder="Select accent" />
								</SelectTrigger>
								<SelectContent>
									{ACCENTS.map((accent) => (
										<SelectItem key={accent} value={accent}>
											{accent}
										</SelectItem>
									))}
								</SelectContent>
							</Select>
						</div>

						<div className="space-y-2">
							<Label htmlFor="style">Style</Label>
							<Select
								value={formData.style}
								onValueChange={(v) => setFormData({ ...formData, style: v })}
							>
								<SelectTrigger>
									<SelectValue placeholder="Select style" />
								</SelectTrigger>
								<SelectContent>
									{STYLES.map((style) => (
										<SelectItem key={style} value={style}>
											{style}
										</SelectItem>
									))}
								</SelectContent>
							</Select>
						</div>
					</div>

					<div className="space-y-2">
						<Label htmlFor="language">Language</Label>
						<Select
							value={formData.languageCode}
							onValueChange={(v) =>
								setFormData({ ...formData, languageCode: v })
							}
						>
							<SelectTrigger>
								<SelectValue placeholder="Select language" />
							</SelectTrigger>
							<SelectContent>
								{LANGUAGES.map((lang) => (
									<SelectItem key={lang.code} value={lang.code}>
										{lang.label}
									</SelectItem>
								))}
							</SelectContent>
						</Select>
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
							disabled={
								!formData.name ||
								!formData.accent ||
								!formData.style ||
								isSubmitting
							}
						>
							{isSubmitting
								? "Saving..."
								: isEdit
									? "Save Changes"
									: "Create Author"}
						</Button>
					</DialogFooter>
				</form>
			</DialogContent>
		</Dialog>
	);
}

// AUTHOR TABLE

interface AuthorTableProps {
	authors: (Author & { referenceCount: number })[];
	onDelete: (id: string) => void;
}

function AuthorTable({ authors, onDelete }: AuthorTableProps) {
	const { toast } = useToast();

	if (authors.length === 0) {
		return (
			<EmptyState
				title="No authors found"
				description="Add authors to manage reference voices."
			/>
		);
	}

	const handleDelete = (author: Author & { referenceCount: number }) => {
		if (author.referenceCount > 0) {
			toast({
				title: "Cannot delete author",
				description: "Remove all references using this author first.",
				variant: "destructive",
			});
			return;
		}
		onDelete(author.id);
	};

	return (
		<div className="overflow-x-auto">
			<table className="w-full text-sm">
				<thead>
					<tr className="border-b text-left">
						<th className="pb-3 font-medium">Name</th>
						<th className="pb-3 font-medium">Accent</th>
						<th className="pb-3 font-medium">Style</th>
						<th className="pb-3 font-medium">References</th>
						<th className="pb-3 text-right font-medium">Actions</th>
					</tr>
				</thead>
				<tbody className="divide-y">
					{authors.map((author) => (
						<tr key={author.id} className="group">
							<td className="py-3 font-medium">{author.name}</td>
							<td className="py-3">
								<Badge variant="secondary">{author.accent}</Badge>
							</td>
							<td className="py-3 text-muted-foreground">{author.style}</td>
							<td className="py-3 tabular-nums">{author.referenceCount}</td>
							<td className="py-3">
								<div className="flex justify-end gap-1">
									<AuthorFormModal
										author={author}
										onSuccess={() => {}}
										trigger={
											<Button variant="ghost" size="icon-sm">
												<Pencil size={14} />
											</Button>
										}
									/>
									<TooltipProvider>
										<Tooltip>
											<TooltipTrigger asChild>
												<span>
													<Button
														variant="ghost"
														size="icon-sm"
														className="text-destructive hover:text-destructive"
														onClick={() => handleDelete(author)}
														disabled={author.referenceCount > 0}
													>
														<Trash2 size={14} />
													</Button>
												</span>
											</TooltipTrigger>
											{author.referenceCount > 0 && (
												<TooltipContent>
													<p>Cannot delete author with references</p>
												</TooltipContent>
											)}
										</Tooltip>
									</TooltipProvider>
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

function AuthorsSkeleton() {
	return (
		<AdminLayout
			title="Authors"
			description="Manage voices for reference speeches"
		>
			<div className="flex flex-col gap-6">
				<div className="flex items-center justify-end">
					<Skeleton className="h-9 w-28" />
				</div>
				<Skeleton className="h-64" />
			</div>
		</AdminLayout>
	);
}

// MAIN PAGE

function AuthorsPage() {
	const {
		isAdmin,
		isAuthenticated,
		isLoading: authLoading,
	} = useRequireAdmin();
	const { toast } = useToast();

	const {
		data: authors,
		isLoading: dataLoading,
		isError,
		error,
	} = useQuery({
		queryKey: ["authors"],
		queryFn: async () => {
			// Simulate async operation
			await new Promise((resolve) => setTimeout(resolve, 100));
			return getAuthorsWithReferenceCounts();
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
				title="Authors"
				description="Manage voices for reference speeches"
			>
				<div className="text-destructive">Error: {error?.message}</div>
			</AdminLayout>
		);
	}

	if (!authors) {
		return null;
	}

	const queryClient = useQueryClient();

	const handleDelete = (_id: string) => {
		// In production, call API to delete
		toast({
			title: "Author deleted",
			description: "The author has been removed.",
		});
		// Invalidate and refetch
		queryClient.invalidateQueries({ queryKey: ["authors"] });
	};

	const handleAddSuccess = () => {
		// Invalidate and refetch
		queryClient.invalidateQueries({ queryKey: ["authors"] });
	};

	return (
		<AdminLayout
			title="Authors"
			description="Manage voices for reference speeches"
			headerActions={<AuthorFormModal onSuccess={handleAddSuccess} />}
		>
			<Card>
				<CardContent className="p-4">
					<AuthorTable authors={authors} onDelete={handleDelete} />
				</CardContent>
			</Card>
		</AdminLayout>
	);
}
