import {
	RiAddLine,
	RiArrowDownSLine,
	RiArrowRightSLine,
	RiArrowUpDownLine,
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
import { formatIpaClean } from "@/lib/ipa";
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
	onGenerateIpa: (ref: ReferenceSpeechWithRelations) => void,
	ipaGeneratingIds: Set<string>,
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
			accessorKey: "generationMethod",
			size: 100,
			header: ({ column }) => (
				<Button
					variant="ghost"
					onClick={() => column.toggleSorting(column.getIsSorted() === "asc")}
					className="h-8 px-2"
				>
					Method
					<RiArrowUpDownLine className="ml-2 h-4 w-4" />
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
			size: 120,
			header: "IPA",
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

				return (
					<div className="flex flex-col gap-0.5">
						<span
							className={cn(
								"text-xs",
								ref.ipaMethod === "powsm"
									? "text-green-600 dark:text-green-500"
									: "text-blue-600 dark:text-blue-500",
							)}
						>
							{ref.ipaMethod === "powsm" ? "POWSM" : "CMUDict"}
						</span>
						<span
							className="max-w-24 truncate font-mono text-xs text-muted-foreground"
							title={formatIpaClean(ref.ipaTranscription)}
						>
							{formatIpaClean(ref.ipaTranscription).slice(0, 15)}...
						</span>
					</div>
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
}: ReferencesDataTableProps) {
	const [sorting, setSorting] = useState<SortingState>([]);
	const [columnFilters, setColumnFilters] = useState<ColumnFiltersState>([]);
	const [rowSelection, setRowSelection] = useState({});
	const [expanded, setExpanded] = useState<ExpandedState>({});

	const filteredData = textFilter
		? data.filter((r) => r.textId === textFilter)
		: data;

	const columns = createColumns(onDelete, onGenerateIpa, ipaGeneratingIds);

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
