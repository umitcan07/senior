import {
	RiAddLine,
	RiArrowDownSLine,
	RiArrowRightSLine,
	RiArrowUpDownLine,
	RiClipboardLine,
	RiDeleteBinLine,
	RiLoader2Line,
	RiMoreLine,
	RiTranslate2,
} from "@remixicon/react";
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
import { Fragment, useState } from "react";
import { AddReferenceDialog } from "@/components/admin/add-reference-dialog";
import { AdminLayout } from "@/components/layout/admin-layout";
import { WaveformPlayer } from "@/components/ui/waveform-player";
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
import {
	Popover,
	PopoverContent,
	PopoverTrigger,
} from "@/components/ui/popover";
import { ShimmeringText } from "@/components/ui/shimmering-text";
import {
	Table,
	TableBody,
	TableCell,
	TableHead,
	TableHeader,
	TableRow,
} from "@/components/ui/table";
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
import { formatIpaClean } from "@/lib/ipa";
import { serverGetPracticeTexts } from "@/lib/text";

export const Route = createFileRoute("/admin/references")({
	component: ReferencesPage,
	pendingComponent: ReferencesSkeleton,
});


// Columns
function createColumns(
	onDelete: (ref: ReferenceSpeechWithRelations) => void,
	onGenerateIpa: (ref: ReferenceSpeechWithRelations) => void,
	ipaGeneratingIds: Set<string>,
	onCopyIpa: () => void,
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
						<RiArrowDownSLine size={14} />
					) : (
						<RiArrowRightSLine size={14} />
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
					<RiArrowUpDownLine className="ml-2 h-4 w-4" />
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
			accessorKey: "durationMs",
			size: 100,
			header: ({ column }) => (
				<Button
					variant="ghost"
					onClick={() => column.toggleSorting(column.getIsSorted() === "asc")}
					className="h-8 px-2"
				>
					Duration
					<RiArrowUpDownLine className="ml-2 h-4 w-4" />
				</Button>
			),
			cell: ({ row }) => (
				<span className="text-muted-foreground text-sm tabular-nums">
					{formatDuration(row.getValue("durationMs"))}
				</span>
			),
		},
		{
			id: "ipa",
			size: 200,
			header: ({ column }) => (
				<Button
					variant="ghost"
					onClick={() => column.toggleSorting(column.getIsSorted() === "asc")}
					className="h-8 px-2"
				>
					IPA
					<RiArrowUpDownLine className="ml-2 h-4 w-4" />
				</Button>
			),
			accessorFn: (row) => {
				// Sort: null/undefined first (non-generated), then by IPA text
				if (!row.ipaTranscription) {
					return ""; // Empty string sorts before any text
				}
				return formatIpaClean(row.ipaTranscription);
			},
			cell: ({ row }) => {
				const ref = row.original;
				const isGenerating = ipaGeneratingIds.has(ref.id);

				if (isGenerating) {
					return (
						<div className="flex items-center gap-1.5 text-blue-600">
							<RiLoader2Line className="h-3 w-3 animate-spin" />
							<span className="text-xs">Generating...</span>
						</div>
					);
				}

				if (!ref.ipaTranscription) {
					return (
						<span className="text-muted-foreground text-xs italic">
							Not generated
						</span>
					);
				}

				const formattedIpa = formatIpaClean(ref.ipaTranscription);

				return (
					<Popover>
						<PopoverTrigger asChild>
							<button
								type="button"
								className="flex flex-col gap-0.5 text-left hover:opacity-80 transition-opacity"
							>
								<span className="max-w-48 truncate font-mono text-xs text-muted-foreground">
									{formattedIpa}
								</span>
							</button>
						</PopoverTrigger>
						<PopoverContent className="w-96" align="start">
							<div className="flex flex-col gap-3">
								<div className="flex items-center justify-between">
									<span className="text-sm font-semibold">IPA Transcription</span>
									<Button
										variant="ghost"
										size="sm"
										className="h-7 px-2"
										onClick={async () => {
											try {
												await navigator.clipboard.writeText(formattedIpa);
												onCopyIpa();
											} catch {
												// Clipboard API not available
											}
										}}
									>
										<RiClipboardLine className="h-3.5 w-3.5" />
										Copy
									</Button>
								</div>
								<div className="rounded-md bg-muted p-3">
									<p className="font-mono text-sm break-all">{formattedIpa}</p>
								</div>
							</div>
						</PopoverContent>
					</Popover>
				);
			},
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
									<RiMoreLine className="h-4 w-4" />
								</Button>
							</DropdownMenuTrigger>
							<DropdownMenuContent align="end">
								<DropdownMenuLabel>Actions</DropdownMenuLabel>
								<DropdownMenuSeparator />
								<DropdownMenuItem
									onClick={() => onGenerateIpa(ref)}
									disabled={ipaGeneratingIds.has(ref.id)}
								>
									<RiTranslate2 className="mr-2 h-4 w-4" />
									{ref.ipaTranscription ? "Regenerate IPA" : "Generate IPA"}
								</DropdownMenuItem>
								<DropdownMenuSeparator />
								<DropdownMenuItem
									onClick={() => onDelete(ref)}
									className="text-destructive"
								>
									<RiDeleteBinLine className="mr-2 h-4 w-4" />
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
	onGenerateIpa: (ref: ReferenceSpeechWithRelations) => void;
	ipaGeneratingIds: Set<string>;
	textFilter: string | null;
	onTextFilterChange: (textId: string | null) => void;
	texts: PracticeText[];
	onCopyIpa: () => void;
}

function ReferencesDataTable({
	data,
	onDelete,
	onDeleteSelected,
	onGenerateIpa,
	ipaGeneratingIds,
	textFilter,
	onTextFilterChange,
	texts,
	onCopyIpa,
}: ReferencesDataTableProps) {
	const [sorting, setSorting] = useState<SortingState>([
		{ id: "ipa", desc: false }, // Default sort by IPA ascending (non-generated first)
	]);
	const [columnFilters, setColumnFilters] = useState<ColumnFiltersState>([]);
	const [rowSelection, setRowSelection] = useState({});
	const [expanded, setExpanded] = useState<ExpandedState>({});
	const [pagination, setPagination] = useState({ pageIndex: 0, pageSize: 10 });

	const filteredData = textFilter
		? data.filter((r) => r.textId === textFilter)
		: data;

	const columns = createColumns(onDelete, onGenerateIpa, ipaGeneratingIds, onCopyIpa);

	const table = useReactTable({
		data: filteredData,
		columns,
		onSortingChange: setSorting,
		onColumnFiltersChange: setColumnFilters,
		onExpandedChange: setExpanded,
		onPaginationChange: setPagination,
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
			pagination,
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
				<div className="flex items-center gap-2">
					{hasSelection && (
						<Button
							variant="destructive"
							size="sm"
							onClick={handleDeleteSelected}
						>
							<RiDeleteBinLine size={16} />
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
												<div className="flex flex-col gap-4">
													<WaveformPlayer
														src={`/api/audio/${row.original.id}`}
														compact
														label={`${row.original.author.name} - ${row.original.text.content.slice(0, 50)}...`}
													/>
													{row.original.ipaTranscription && (
														<div className="flex flex-col gap-2">
															<div className="flex items-center justify-between">
																<span className="text-sm font-semibold">IPA Transcription</span>
																<Button
																	variant="ghost"
																	size="sm"
																	className="h-7 px-2"
																	onClick={async () => {
																		try {
																			const formattedIpa = formatIpaClean(row.original.ipaTranscription!);
																			await navigator.clipboard.writeText(formattedIpa);
																			onCopyIpa();
																		} catch {
																			// Clipboard API not available
																		}
																	}}
																>
																	<RiClipboardLine className="h-3.5 w-3.5" />
																	Copy
																</Button>
															</div>
															<div className="rounded-md bg-background border p-3">
																<p className="font-mono text-sm break-all">
																	{formatIpaClean(row.original.ipaTranscription)}
																</p>
															</div>
														</div>
													)}
												</div>
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
	const [ipaGeneratingIds, setIpaGeneratingIds] = useState<Set<string>>(
		new Set(),
	);
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

	const { mutate: deleteReference } = useMutation<
		{ success: boolean; error?: { message: string } },
		Error,
		string
	>({
		mutationFn: async (id: string) => {
			const result = await deleteReferenceFn({ data: { id } });
			return result as { success: boolean; error?: { message: string } };
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
					description: result.error?.message || "Failed to delete reference",
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

	const handleCopyIpa = () => {
		toast({
			title: "Copied to clipboard",
			description: "IPA transcription has been copied.",
		});
	};

	const handleGenerateIpa = async (ref: ReferenceSpeechWithRelations) => {
		try {
			setIpaGeneratingIds((prev) => new Set(prev).add(ref.id));

			const response = await fetch("/api/admin/ipa-generation", {
				method: "POST",
				headers: { "Content-Type": "application/json" },
				body: JSON.stringify({ referenceSpeechId: ref.id }),
			});

			const result = await response.json();

			if (result.success) {
				toast({
					title: "IPA generation started",
					description: "The IPA transcription is being generated. This may take a moment.",
				});

				// Poll for completion (simple implementation)
				const pollInterval = setInterval(async () => {
					await queryClient.invalidateQueries({ queryKey: ["references"] });
				}, 3000);

				// Stop polling after 30 seconds
				setTimeout(() => {
					clearInterval(pollInterval);
					setIpaGeneratingIds((prev) => {
						const next = new Set(prev);
						next.delete(ref.id);
						return next;
					});
					queryClient.invalidateQueries({ queryKey: ["references"] });
				}, 30000);
			} else {
				setIpaGeneratingIds((prev) => {
					const next = new Set(prev);
					next.delete(ref.id);
					return next;
				});
				toast({
					title: "IPA generation failed",
					description: result.error || "Failed to start IPA generation",
					variant: "destructive",
				});
			}
		} catch {
			setIpaGeneratingIds((prev) => {
				const next = new Set(prev);
				next.delete(ref.id);
				return next;
			});
			toast({
				title: "IPA generation failed",
				description: "An error occurred while starting IPA generation",
				variant: "destructive",
			});
		}
	};

	return (
		<AdminLayout
			title="Reference Speeches"
			description="Manage reference audio for practice texts"
			headerActions={
				<Button size="sm" onClick={() => setIsAddDialogOpen(true)}>
					<RiAddLine size={16} />
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
							onGenerateIpa={handleGenerateIpa}
							ipaGeneratingIds={ipaGeneratingIds}
							textFilter={selectedTextId}
							onTextFilterChange={setSelectedTextId}
							texts={texts}
							onCopyIpa={handleCopyIpa}
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
