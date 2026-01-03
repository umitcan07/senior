import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { createFileRoute, Navigate } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import type { ColumnDef } from "@tanstack/react-table";
import {
	type ColumnFiltersState,
	flexRender,
	getCoreRowModel,
	getFilteredRowModel,
	getPaginationRowModel,
	getSortedRowModel,
	type SortingState,
	useReactTable,
} from "@tanstack/react-table";
import {
	ArrowUpDown,
	MoreHorizontal,
	Pencil,
	Plus,
	Trash2,
} from "lucide-react";
import { useEffect, useState } from "react";
import { AdminLayout } from "@/components/layout/admin-layout";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import {
	Dialog,
	DialogContent,
	DialogDescription,
	DialogFooter,
	DialogHeader,
	DialogTitle,
} from "@/components/ui/dialog";
import {
	DropdownMenu,
	DropdownMenuContent,
	DropdownMenuItem,
	DropdownMenuLabel,
	DropdownMenuSeparator,
	DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
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
import { ShimmeringText } from "@/components/ui/shimmering-text";
import {
	Table,
	TableBody,
	TableCell,
	TableHead,
	TableHeader,
	TableRow,
} from "@/components/ui/table";
import type { Author } from "@/db/author";
import { useToast } from "@/hooks/use-toast";
import { useRequireAdmin } from "@/lib/auth";
import {
	serverDeleteAuthor,
	serverGetAuthors,
	serverInsertAuthor,
	serverUpdateAuthor,
} from "@/lib/author";

export const Route = createFileRoute("/admin/authors")({
	component: AuthorsPage,
	pendingComponent: AuthorsSkeleton,
});

// Constants
const ACCENTS = ["US", "UK", "AU", "CA", "IN", "NZ", "SA", "IE"];
const STYLES = ["Neutral", "Formal", "Casual", "Professional", "Friendly"];
const LANGUAGES = [
	{ code: "en-US", label: "English (US)" },
	{ code: "en-GB", label: "English (UK)" },
	{ code: "en-AU", label: "English (AU)" },
	{ code: "en-CA", label: "English (CA)" },
	{ code: "en-IN", label: "English (IN)" },
];

type AuthorWithCount = Author & { referenceCount: number };

// Columns
function createColumns(
	onEdit: (author: AuthorWithCount) => void,
	onDelete: (author: AuthorWithCount) => void,
): ColumnDef<AuthorWithCount>[] {
	return [
		{
			id: "select",
			size: 40,
			header: ({ table }) => (
				<Checkbox
					checked={table.getIsAllPageRowsSelected()}
					onCheckedChange={(value) => table.toggleAllPageRowsSelected(!!value)}
					aria-label="Select all"
				/>
			),
			cell: ({ row }) => (
				<Checkbox
					checked={row.getIsSelected()}
					onCheckedChange={(value) => row.toggleSelected(!!value)}
					aria-label="Select row"
				/>
			),
			enableSorting: false,
			enableHiding: false,
		},
		{
			accessorKey: "name",
			header: ({ column }) => (
				<Button
					variant="ghost"
					onClick={() => column.toggleSorting(column.getIsSorted() === "asc")}
					className="h-8 px-2"
				>
					Name
					<ArrowUpDown className="ml-2 h-4 w-4" />
				</Button>
			),
			cell: ({ row }) => (
				<span className="font-medium">{row.getValue("name")}</span>
			),
		},
		{
			accessorKey: "accent",
			size: 100,
			header: ({ column }) => (
				<Button
					variant="ghost"
					onClick={() => column.toggleSorting(column.getIsSorted() === "asc")}
					className="h-8 px-2"
				>
					Accent
					<ArrowUpDown className="ml-2 h-4 w-4" />
				</Button>
			),
			cell: ({ row }) => {
				const accent = row.getValue("accent") as string | null;
				return (
					<span className="text-muted-foreground text-sm">{accent || "—"}</span>
				);
			},
		},
		{
			accessorKey: "style",
			size: 120,
			header: ({ column }) => (
				<Button
					variant="ghost"
					onClick={() => column.toggleSorting(column.getIsSorted() === "asc")}
					className="h-8 px-2"
				>
					Style
					<ArrowUpDown className="ml-2 h-4 w-4" />
				</Button>
			),
			cell: ({ row }) => {
				const style = row.getValue("style") as string | null;
				return (
					<span className="text-muted-foreground text-sm">{style || "—"}</span>
				);
			},
		},
		{
			accessorKey: "languageCode",
			size: 120,
			header: "Language",
			cell: ({ row }) => {
				const code = row.getValue("languageCode") as string | null;
				const lang = LANGUAGES.find((l) => l.code === code);
				return (
					<span className="text-muted-foreground text-sm">
						{lang?.label || code || "—"}
					</span>
				);
			},
		},
		{
			accessorKey: "referenceCount",
			size: 100,
			header: ({ column }) => (
				<Button
					variant="ghost"
					onClick={() => column.toggleSorting(column.getIsSorted() === "asc")}
					className="h-8 px-2"
				>
					References
					<ArrowUpDown className="ml-2 h-4 w-4" />
				</Button>
			),
			cell: ({ row }) => (
				<span className="tabular-nums">{row.getValue("referenceCount")}</span>
			),
		},
		{
			id: "actions",
			size: 50,
			cell: ({ row }) => {
				const author = row.original;
				return (
					<DropdownMenu>
						<DropdownMenuTrigger asChild>
							<Button variant="ghost" className="h-8 w-8 p-0">
								<span className="sr-only">Open menu</span>
								<MoreHorizontal className="h-4 w-4" />
							</Button>
						</DropdownMenuTrigger>
						<DropdownMenuContent align="end">
							<DropdownMenuLabel>Actions</DropdownMenuLabel>
							<DropdownMenuItem onClick={() => onEdit(author)}>
								<Pencil className="mr-2 h-4 w-4" />
								Edit
							</DropdownMenuItem>
							<DropdownMenuSeparator />
							<DropdownMenuItem
								onClick={() => onDelete(author)}
								className="text-destructive"
								disabled={author.referenceCount > 0}
							>
								<Trash2 className="mr-2 h-4 w-4" />
								Delete
							</DropdownMenuItem>
						</DropdownMenuContent>
					</DropdownMenu>
				);
			},
		},
	];
}

// Author Form Dialog
interface AuthorFormDialogProps {
	author?: AuthorWithCount | null;
	open: boolean;
	onOpenChange: (open: boolean) => void;
}

function AuthorFormDialog({
	author,
	open,
	onOpenChange,
}: AuthorFormDialogProps) {
	const [name, setName] = useState("");
	const [accent, setAccent] = useState("");
	const [style, setStyle] = useState("");
	const [languageCode, setLanguageCode] = useState("en-US");
	const [elevenlabsVoiceId, setElevenlabsVoiceId] = useState("");
	const queryClient = useQueryClient();
	const insertAuthorFn = useServerFn(serverInsertAuthor);
	const updateAuthorFn = useServerFn(serverUpdateAuthor);
	const { toast } = useToast();

	const isEdit = !!author;

	useEffect(() => {
		if (open) {
			setName(author?.name ?? "");
			setAccent(author?.accent ?? "");
			setStyle(author?.style ?? "");
			setLanguageCode(author?.languageCode ?? "en-US");
			setElevenlabsVoiceId(author?.elevenlabsVoiceId ?? "");
		}
	}, [open, author]);

	const { mutate: saveAuthor, isPending } = useMutation({
		mutationFn: async () => {
			if (isEdit && author) {
				return updateAuthorFn({
					data: {
						id: author.id,
						name,
						accent: accent || null,
						style: style || null,
						languageCode: languageCode || null,
						elevenlabsVoiceId: elevenlabsVoiceId || null,
					},
				});
			}
			return insertAuthorFn({
				data: {
					name,
					accent: accent || null,
					style: style || null,
					languageCode: languageCode || null,
					elevenlabsVoiceId: elevenlabsVoiceId || null,
				},
			});
		},
		onSuccess: async (result) => {
			if (result.success) {
				await queryClient.invalidateQueries({ queryKey: ["authors"] });
				onOpenChange(false);
				toast({
					title: isEdit ? "Author updated" : "Author created",
					description: `${name} has been ${isEdit ? "updated" : "added"}.`,
				});
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
		if (!name.trim()) return;
		saveAuthor();
	};

	return (
		<Dialog open={open} onOpenChange={onOpenChange}>
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
							value={name}
							onChange={(e) => setName(e.target.value)}
							placeholder="e.g., Amy, John"
							required
						/>
					</div>

					<div className="grid grid-cols-2 gap-4">
						<div className="space-y-2">
							<Label htmlFor="accent">Accent</Label>
							<Select value={accent} onValueChange={setAccent}>
								<SelectTrigger>
									<SelectValue placeholder="Select accent" />
								</SelectTrigger>
								<SelectContent>
									{ACCENTS.map((a) => (
										<SelectItem key={a} value={a}>
											{a}
										</SelectItem>
									))}
								</SelectContent>
							</Select>
						</div>

						<div className="space-y-2">
							<Label htmlFor="style">Style</Label>
							<Select value={style} onValueChange={setStyle}>
								<SelectTrigger>
									<SelectValue placeholder="Select style" />
								</SelectTrigger>
								<SelectContent>
									{STYLES.map((s) => (
										<SelectItem key={s} value={s}>
											{s}
										</SelectItem>
									))}
								</SelectContent>
							</Select>
						</div>
					</div>

					<div className="space-y-2">
						<Label htmlFor="language">Language</Label>
						<Select value={languageCode} onValueChange={setLanguageCode}>
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

					<div className="space-y-2">
						<Label htmlFor="elevenlabsVoiceId">ElevenLabs Voice ID</Label>
						<Input
							id="elevenlabsVoiceId"
							value={elevenlabsVoiceId}
							onChange={(e) => setElevenlabsVoiceId(e.target.value)}
							placeholder="e.g., JBFqnCBsd6RMkjVDRZzb"
						/>
						<p className="text-muted-foreground text-xs">
							Optional. Voice ID from ElevenLabs for TTS generation.
						</p>
					</div>

					<DialogFooter>
						<Button
							type="button"
							variant="outline"
							onClick={() => onOpenChange(false)}
						>
							Cancel
						</Button>
						<Button type="submit" disabled={!name.trim() || isPending}>
							{isPending
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

// Data Table
interface AuthorsDataTableProps {
	data: AuthorWithCount[];
	onEdit: (author: AuthorWithCount) => void;
	onDelete: (author: AuthorWithCount) => void;
	onDeleteSelected: (rows: AuthorWithCount[]) => void;
}

function AuthorsDataTable({
	data,
	onEdit,
	onDelete,
	onDeleteSelected,
}: AuthorsDataTableProps) {
	const [sorting, setSorting] = useState<SortingState>([]);
	const [columnFilters, setColumnFilters] = useState<ColumnFiltersState>([]);
	const [rowSelection, setRowSelection] = useState({});

	const columns = createColumns(onEdit, onDelete);

	const table = useReactTable({
		data,
		columns,
		onSortingChange: setSorting,
		onColumnFiltersChange: setColumnFilters,
		getCoreRowModel: getCoreRowModel(),
		getPaginationRowModel: getPaginationRowModel(),
		getSortedRowModel: getSortedRowModel(),
		getFilteredRowModel: getFilteredRowModel(),
		onRowSelectionChange: setRowSelection,
		state: {
			sorting,
			columnFilters,
			rowSelection,
		},
	});

	const selectedRows = table.getFilteredSelectedRowModel().rows;
	const hasSelection = selectedRows.length > 0;

	const handleDeleteSelected = () => {
		if (hasSelection) {
			const deletableRows = selectedRows
				.map((row) => row.original)
				.filter((author) => author.referenceCount === 0);
			if (deletableRows.length > 0) {
				onDeleteSelected(deletableRows);
				setRowSelection({});
			}
		}
	};

	return (
		<div className="flex flex-col gap-4">
			<div className="flex items-center justify-between gap-4">
				<Input
					placeholder="Filter by name..."
					value={(table.getColumn("name")?.getFilterValue() as string) ?? ""}
					onChange={(event) =>
						table.getColumn("name")?.setFilterValue(event.target.value)
					}
					className="max-w-sm"
				/>
				<div className="flex items-center gap-2">
					{hasSelection && (
						<Button
							variant="destructive"
							size="sm"
							onClick={handleDeleteSelected}
						>
							<Trash2 size={16} />
							Delete{" "}
							{
								selectedRows.filter((r) => r.original.referenceCount === 0)
									.length
							}
						</Button>
					)}
				</div>
			</div>
			<div className="overflow-hidden rounded-md border">
				<Table className="table-fixed">
					<TableHeader>
						{table.getHeaderGroups().map((headerGroup) => (
							<TableRow key={headerGroup.id}>
								{headerGroup.headers.map((header) => (
									<TableHead
										key={header.id}
										style={{
											width:
												header.getSize() !== 150 ? header.getSize() : undefined,
										}}
									>
										{header.isPlaceholder
											? null
											: flexRender(
													header.column.columnDef.header,
													header.getContext(),
												)}
									</TableHead>
								))}
							</TableRow>
						))}
					</TableHeader>
					<TableBody>
						{table.getRowModel().rows?.length ? (
							table.getRowModel().rows.map((row) => (
								<TableRow
									key={row.id}
									data-state={row.getIsSelected() && "selected"}
								>
									{row.getVisibleCells().map((cell) => (
										<TableCell key={cell.id}>
											{flexRender(
												cell.column.columnDef.cell,
												cell.getContext(),
											)}
										</TableCell>
									))}
								</TableRow>
							))
						) : (
							<TableRow>
								<TableCell
									colSpan={columns.length}
									className="h-24 text-center"
								>
									No results.
								</TableCell>
							</TableRow>
						)}
					</TableBody>
				</Table>
			</div>
			<div className="flex items-center justify-between">
				<div className="flex-1 text-muted-foreground text-sm">
					{selectedRows.length} of {table.getFilteredRowModel().rows.length}{" "}
					row(s) selected.
				</div>
				<div className="flex items-center gap-2">
					<Button
						variant="outline"
						size="sm"
						onClick={() => table.previousPage()}
						disabled={!table.getCanPreviousPage()}
					>
						Previous
					</Button>
					<Button
						variant="outline"
						size="sm"
						onClick={() => table.nextPage()}
						disabled={!table.getCanNextPage()}
					>
						Next
					</Button>
				</div>
			</div>
		</div>
	);
}

// Loading state
function AuthorsSkeleton() {
	return (
		<AdminLayout
			title="Authors"
			description="Manage voices for reference speeches"
		>
			<div className="flex min-h-64 flex-col items-center justify-center">
				<ShimmeringText
					text="Loading authors..."
					className="text-lg"
					duration={1.5}
				/>
			</div>
		</AdminLayout>
	);
}

// Main Page
function AuthorsPage() {
	const {
		isAdmin,
		isAuthenticated,
		isLoading: authLoading,
	} = useRequireAdmin();
	const [editingAuthor, setEditingAuthor] = useState<AuthorWithCount | null>(
		null,
	);
	const [isAddDialogOpen, setIsAddDialogOpen] = useState(false);
	const queryClient = useQueryClient();
	const getAuthorsFn = useServerFn(serverGetAuthors);
	const deleteAuthorFn = useServerFn(serverDeleteAuthor);
	const { toast } = useToast();

	const { data, isLoading, isError, error } = useQuery({
		queryKey: ["authors"],
		queryFn: async () => {
			const result = await getAuthorsFn();
			if (!result.success) {
				throw new Error(result.error.message);
			}
			return result.data;
		},
	});

	const { mutate: deleteAuthor } = useMutation({
		mutationFn: async (id: string) => {
			return deleteAuthorFn({ data: { id } });
		},
		onSuccess: async (result) => {
			if (result.success) {
				await queryClient.invalidateQueries({ queryKey: ["authors"] });
				toast({
					title: "Author deleted",
					description: "The author has been removed.",
				});
			} else {
				toast({
					title: "Error",
					description: result.error.message,
					variant: "destructive",
				});
			}
		},
	});

	const { mutate: deleteMultiple } = useMutation({
		mutationFn: async (ids: string[]) => {
			return Promise.all(ids.map((id) => deleteAuthorFn({ data: { id } })));
		},
		onSuccess: async () => {
			await queryClient.invalidateQueries({ queryKey: ["authors"] });
			toast({
				title: "Authors deleted",
				description: "Selected authors have been removed.",
			});
		},
	});

	if (authLoading) {
		return null;
	}

	if (!isAuthenticated || !isAdmin) {
		return <Navigate to="/login" />;
	}

	if (isLoading) {
		return <AuthorsSkeleton />;
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

	const handleDelete = (author: AuthorWithCount) => {
		if (author.referenceCount > 0) {
			toast({
				title: "Cannot delete author",
				description: "Remove all references using this author first.",
				variant: "destructive",
			});
			return;
		}
		deleteAuthor(author.id);
	};

	const handleDeleteSelected = (authors: AuthorWithCount[]) => {
		deleteMultiple(authors.map((a) => a.id));
	};

	return (
		<AdminLayout
			title="Authors"
			description="Manage voices for reference speeches"
			headerActions={
				<Button size="sm" onClick={() => setIsAddDialogOpen(true)}>
					<Plus size={16} />
					Add Author
				</Button>
			}
		>
			<Card>
				<CardContent className="p-4">
					{!data || data.length === 0 ? (
						<EmptyState
							title="No authors yet"
							description="Add authors to manage reference voices for pronunciation practice."
						/>
					) : (
						<AuthorsDataTable
							data={data}
							onEdit={setEditingAuthor}
							onDelete={handleDelete}
							onDeleteSelected={handleDeleteSelected}
						/>
					)}
				</CardContent>
			</Card>

			<AuthorFormDialog
				author={null}
				open={isAddDialogOpen}
				onOpenChange={setIsAddDialogOpen}
			/>

			<AuthorFormDialog
				author={editingAuthor}
				open={!!editingAuthor}
				onOpenChange={(open) => {
					if (!open) setEditingAuthor(null);
				}}
			/>
		</AdminLayout>
	);
}
