import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { createFileRoute, Navigate } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import type { ColumnDef } from "@tanstack/react-table";
import {
	type ColumnFiltersState,
	type ExpandedState,
	flexRender,
	getCoreRowModel,
	getExpandedRowModel,
	getFilteredRowModel,
	getPaginationRowModel,
	getSortedRowModel,
	type SortingState,
	useReactTable,
} from "@tanstack/react-table";
import {
	ArrowUpDown,
	ChevronDown,
	ChevronRight,
	MoreHorizontal,
	Plus,
	Trash2,
} from "lucide-react";
import { Fragment, useState } from "react";
import { AddReferenceDialog } from "@/components/admin/add-reference-dialog";
import { AdminLayout } from "@/components/layout/admin-layout";
import {
	AudioPlayerButton,
	AudioPlayerDuration,
	AudioPlayerProgress,
	AudioPlayerProvider,
	AudioPlayerTime,
} from "@/components/ui/audio-player";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import {
	DropdownMenu,
	DropdownMenuContent,
	DropdownMenuItem,
	DropdownMenuLabel,
	DropdownMenuSeparator,
	DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { EmptyState } from "@/components/ui/empty-state";
import { ShimmeringText } from "@/components/ui/shimmering-text";
import {
	Table,
	TableBody,
	TableCell,
	TableHead,
	TableHeader,
	TableRow,
} from "@/components/ui/table";
import { TextCombobox } from "@/components/ui/text-combobox";
import type { ReferenceSpeechWithRelations } from "@/db/reference";
import type { PracticeText } from "@/db/text";
import { useToast } from "@/hooks/use-toast";
import { useRequireAdmin } from "@/lib/auth";
import { serverGetAuthors } from "@/lib/author";
import {
	formatDuration,
	serverDeleteReference,
	serverGetReferences,
} from "@/lib/reference";
import { serverGetPracticeTexts } from "@/lib/text";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/admin/references")({
	component: ReferencesPage,
	pendingComponent: ReferencesSkeleton,
});

// Helper
function getMethodColor(method: string) {
	switch (method) {
		case "native":
			return "text-green-600 dark:text-green-500";
		case "tts":
			return "text-blue-600 dark:text-blue-500";
		default:
			return "text-muted-foreground";
	}
}

// Columns
function createColumns(
	onDelete: (ref: ReferenceSpeechWithRelations) => void,
): ColumnDef<ReferenceSpeechWithRelations>[] {
	return [
		{
			id: "expand",
			size: 40,
			header: () => null,
			cell: ({ row }) => (
				<Button
					variant="ghost"
					size="sm"
					className="size-8 p-0"
					onClick={() => row.toggleExpanded()}
					aria-label={row.getIsExpanded() ? "Collapse" : "Expand"}
				>
					{row.getIsExpanded() ? (
						<ChevronDown size={14} />
					) : (
						<ChevronRight size={14} />
					)}
				</Button>
			),
			enableSorting: false,
			enableHiding: false,
		},
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
			id: "author",
			accessorFn: (row) => row.author.name,
			header: ({ column }) => (
				<Button
					variant="ghost"
					onClick={() => column.toggleSorting(column.getIsSorted() === "asc")}
					className="h-8 px-2"
				>
					Author
					<ArrowUpDown className="ml-2 h-4 w-4" />
				</Button>
			),
			cell: ({ row }) => {
				const author = row.original.author;
				return (
					<div className="flex flex-col">
						<span className="font-medium">{author.name}</span>
						{author.accent && (
							<span className="text-muted-foreground text-xs">
								{author.accent}
							</span>
						)}
					</div>
				);
			},
		},
		{
			id: "text",
			accessorFn: (row) => row.text.content,
			header: "Text",
			cell: ({ row }) => {
				const text = row.original.text;
				return (
					<div className="max-w-xs">
						<p className="line-clamp-2 text-muted-foreground text-sm">
							{text.content.slice(0, 60)}...
						</p>
					</div>
				);
			},
		},
		{
			accessorKey: "generationMethod",
			size: 100,
			header: ({ column }) => (
				<Button
					variant="ghost"
					onClick={() => column.toggleSorting(column.getIsSorted() === "asc")}
					className="h-8 px-2"
				>
					Method
					<ArrowUpDown className="ml-2 h-4 w-4" />
				</Button>
			),
			cell: ({ row }) => {
				const method = row.getValue("generationMethod") as string;
				return (
					<span
						className={cn(
							"font-medium text-sm capitalize",
							getMethodColor(method),
						)}
					>
						{method}
					</span>
				);
			},
		},
		{
			accessorKey: "durationMs",
			size: 100,
			header: ({ column }) => (
				<Button
					variant="ghost"
					onClick={() => column.toggleSorting(column.getIsSorted() === "asc")}
					className="h-8 px-2"
				>
					Duration
					<ArrowUpDown className="ml-2 h-4 w-4" />
				</Button>
			),
			cell: ({ row }) => (
				<span className="text-muted-foreground text-sm tabular-nums">
					{formatDuration(row.getValue("durationMs"))}
				</span>
			),
		},
		{
			id: "actions",
			size: 80,
			cell: ({ row }) => {
				const ref = row.original;
				return (
					<div className="flex items-center gap-1">
						<DropdownMenu>
							<DropdownMenuTrigger asChild>
								<Button variant="ghost" className="h-8 w-8 p-0">
									<span className="sr-only">Open menu</span>
									<MoreHorizontal className="h-4 w-4" />
								</Button>
							</DropdownMenuTrigger>
							<DropdownMenuContent align="end">
								<DropdownMenuLabel>Actions</DropdownMenuLabel>
								<DropdownMenuSeparator />
								<DropdownMenuItem
									onClick={() => onDelete(ref)}
									className="text-destructive"
								>
									<Trash2 className="mr-2 h-4 w-4" />
									Delete
								</DropdownMenuItem>
							</DropdownMenuContent>
						</DropdownMenu>
					</div>
				);
			},
		},
	];
}

// Data Table
interface ReferencesDataTableProps {
	data: ReferenceSpeechWithRelations[];
	onDelete: (ref: ReferenceSpeechWithRelations) => void;
	onDeleteSelected: (rows: ReferenceSpeechWithRelations[]) => void;
	textFilter: string | null;
	onTextFilterChange: (textId: string | null) => void;
	texts: PracticeText[];
}

function ReferencesDataTable({
	data,
	onDelete,
	onDeleteSelected,
	textFilter,
	onTextFilterChange,
	texts,
}: ReferencesDataTableProps) {
	const [sorting, setSorting] = useState<SortingState>([]);
	const [columnFilters, setColumnFilters] = useState<ColumnFiltersState>([]);
	const [rowSelection, setRowSelection] = useState({});
	const [expanded, setExpanded] = useState<ExpandedState>({});

	const filteredData = textFilter
		? data.filter((r) => r.textId === textFilter)
		: data;

	const columns = createColumns(onDelete);

	const table = useReactTable({
		data: filteredData,
		columns,
		onSortingChange: setSorting,
		onColumnFiltersChange: setColumnFilters,
		onExpandedChange: setExpanded,
		getCoreRowModel: getCoreRowModel(),
		getPaginationRowModel: getPaginationRowModel(),
		getSortedRowModel: getSortedRowModel(),
		getFilteredRowModel: getFilteredRowModel(),
		getExpandedRowModel: getExpandedRowModel(),
		onRowSelectionChange: setRowSelection,
		state: {
			sorting,
			columnFilters,
			rowSelection,
			expanded,
		},
	});

	const selectedRows = table.getFilteredSelectedRowModel().rows;
	const hasSelection = selectedRows.length > 0;

	const handleDeleteSelected = () => {
		if (hasSelection) {
			onDeleteSelected(selectedRows.map((row) => row.original));
			setRowSelection({});
		}
	};

	return (
		<div className="flex flex-col gap-4">
			<div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
				<div className="w-full sm:w-80">
					<TextCombobox
						texts={texts}
						value={textFilter}
						onValueChange={onTextFilterChange}
						placeholder="Filter by text..."
						emptyMessage="No texts found."
					/>
				</div>
				<div className="flex items-center gap-2">
					{hasSelection && (
						<Button
							variant="destructive"
							size="sm"
							onClick={handleDeleteSelected}
						>
							<Trash2 size={16} />
							Delete {selectedRows.length}
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
								<Fragment key={row.id}>
									<TableRow data-state={row.getIsSelected() && "selected"}>
										{row.getVisibleCells().map((cell) => (
											<TableCell key={cell.id}>
												{flexRender(
													cell.column.columnDef.cell,
													cell.getContext(),
												)}
											</TableCell>
										))}
									</TableRow>
									{row.getIsExpanded() && (
										<TableRow className="bg-muted/30">
											<TableCell colSpan={columns.length} className="p-4">
												<AudioPlayerProvider>
													<div className="flex max-w-md items-center gap-3">
														<AudioPlayerButton
															item={{
																id: row.original.id,
																src: `/api/audio/${row.original.id}`,
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
											</TableCell>
										</TableRow>
									)}
								</Fragment>
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
function ReferencesSkeleton() {
	return (
		<AdminLayout
			title="Reference Speeches"
			description="Manage reference audio for practice texts"
		>
			<div className="flex min-h-64 flex-col items-center justify-center">
				<ShimmeringText
					text="Loading references..."
					className="text-lg"
					duration={1.5}
				/>
			</div>
		</AdminLayout>
	);
}

// Main Page
function ReferencesPage() {
	const {
		isAdmin,
		isAuthenticated,
		isLoading: authLoading,
	} = useRequireAdmin();
	const [selectedTextId, setSelectedTextId] = useState<string | null>(null);
	const [isAddDialogOpen, setIsAddDialogOpen] = useState(false);
	const queryClient = useQueryClient();
	const getReferencesFn = useServerFn(serverGetReferences);
	const getTextsFn = useServerFn(serverGetPracticeTexts);
	const getAuthorsFn = useServerFn(serverGetAuthors);
	const deleteReferenceFn = useServerFn(serverDeleteReference);
	const { toast } = useToast();

	const {
		data: referencesData,
		isLoading: refsLoading,
		isError: refsError,
	} = useQuery({
		queryKey: ["references"],
		queryFn: async () => {
			const result = await getReferencesFn();
			if (!result.success) {
				throw new Error(result.error.message);
			}
			return result.data;
		},
	});

	const { data: textsData, isLoading: textsLoading } = useQuery({
		queryKey: ["texts"],
		queryFn: async () => {
			const result = await getTextsFn();
			if (!result.success) {
				throw new Error(result.error.message);
			}
			return result.data;
		},
	});

	const { data: authorsData, isLoading: authorsLoading } = useQuery({
		queryKey: ["authors"],
		queryFn: async () => {
			const result = await getAuthorsFn();
			if (!result.success) {
				throw new Error(result.error.message);
			}
			return result.data;
		},
	});

	const { mutate: deleteReference } = useMutation({
		mutationFn: async (id: string) => {
			return deleteReferenceFn({ data: { id } });
		},
		onSuccess: async (result) => {
			if (result.success) {
				await queryClient.invalidateQueries({ queryKey: ["references"] });
				toast({
					title: "Reference deleted",
					description: "The reference speech has been removed.",
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
			return Promise.all(ids.map((id) => deleteReferenceFn({ data: { id } })));
		},
		onSuccess: async () => {
			await queryClient.invalidateQueries({ queryKey: ["references"] });
			toast({
				title: "References deleted",
				description: "Selected reference speeches have been removed.",
			});
		},
	});

	const isLoading =
		authLoading || refsLoading || textsLoading || authorsLoading;

	if (authLoading) {
		return null;
	}

	if (!isAuthenticated || !isAdmin) {
		return <Navigate to="/login" />;
	}

	if (isLoading) {
		return <ReferencesSkeleton />;
	}

	if (refsError) {
		return (
			<AdminLayout
				title="Reference Speeches"
				description="Manage reference audio for practice texts"
			>
				<div className="text-destructive">
					Failed to load reference speeches.
				</div>
			</AdminLayout>
		);
	}

	const references = referencesData ?? [];
	const texts = textsData ?? [];
	const authors = authorsData ?? [];

	const handleDelete = (ref: ReferenceSpeechWithRelations) => {
		deleteReference(ref.id);
	};

	const handleDeleteSelected = (refs: ReferenceSpeechWithRelations[]) => {
		deleteMultiple(refs.map((r) => r.id));
	};

	return (
		<AdminLayout
			title="Reference Speeches"
			description="Manage reference audio for practice texts"
			headerActions={
				<Button size="sm" onClick={() => setIsAddDialogOpen(true)}>
					<Plus size={16} />
					Add Reference
				</Button>
			}
		>
			<Card>
				<CardContent className="p-4">
					{references.length === 0 ? (
						<EmptyState
							title="No reference speeches yet"
							description="Add reference audio to help users practice pronunciation."
						/>
					) : (
						<ReferencesDataTable
							data={references}
							onDelete={handleDelete}
							onDeleteSelected={handleDeleteSelected}
							textFilter={selectedTextId}
							onTextFilterChange={setSelectedTextId}
							texts={texts}
						/>
					)}
				</CardContent>
			</Card>

			<AddReferenceDialog
				open={isAddDialogOpen}
				onOpenChange={setIsAddDialogOpen}
				texts={texts}
				authors={authors}
				preSelectedTextId={selectedTextId}
			/>
		</AdminLayout>
	);
}
