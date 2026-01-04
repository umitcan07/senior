import {
	type ColumnDef,
	type ColumnFiltersState,
	flexRender,
	getCoreRowModel,
	getFilteredRowModel,
	getPaginationRowModel,
	getSortedRowModel,
	type SortingState,
	useReactTable,
	type VisibilityState,
} from "@tanstack/react-table";
import { Mic, Trash2 } from "lucide-react";
import * as React from "react";
import {
	AudioPlayerButton,
	AudioPlayerProvider,
} from "@/components/ui/audio-player";
import { Button } from "@/components/ui/button";
import {
	DropdownMenu,
	DropdownMenuCheckboxItem,
	DropdownMenuContent,
	DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import {
	Table,
	TableBody,
	TableCell,
	TableHead,
	TableHeader,
	TableRow,
} from "@/components/ui/table";
import type { ReferenceSpeechWithRelations } from "@/db/reference";
import type { PracticeTextWithReferenceCount } from "@/db/text";
import { formatDuration } from "@/lib/reference";
import { cn } from "@/lib/utils";

interface DataTableProps {
	columns: ColumnDef<PracticeTextWithReferenceCount>[];
	data: PracticeTextWithReferenceCount[];
	onDeleteSelected?: (rows: PracticeTextWithReferenceCount[]) => void;
	expandedRows: Set<string>;
	references: ReferenceSpeechWithRelations[];
	referencesLoading?: boolean;
	onDeleteReference?: (ref: ReferenceSpeechWithRelations) => void;
}

function ReferenceRow({
	reference,
	onDelete,
}: {
	reference: ReferenceSpeechWithRelations;
	onDelete?: (ref: ReferenceSpeechWithRelations) => void;
}) {
	const audioItem = {
		id: reference.id,
		src: `/api/audio/${reference.id}`,
	};

	return (
		<div className="flex items-center justify-between gap-4 rounded-md bg-muted/50 p-3">
			<div className="flex items-center gap-3">
				<div className="flex h-8 w-8 items-center justify-center rounded-full bg-primary/10">
					<Mic className="h-4 w-4 text-primary" />
				</div>
				<div className="flex flex-col gap-0.5">
					<div className="flex items-center gap-2">
						<span className="font-medium text-sm">{reference.author.name}</span>
						{reference.author.accent && (
							<span className="text-muted-foreground text-xs">
								({reference.author.accent})
							</span>
						)}
					</div>
					<div className="flex items-center gap-2 text-muted-foreground text-xs">
						<span
							className={cn(
								"capitalize",
								reference.generationMethod === "native"
									? "text-green-600 dark:text-green-500"
									: "text-blue-600 dark:text-blue-500",
							)}
						>
							{reference.generationMethod}
						</span>
						<span>•</span>
						<span className="tabular-nums">
							{formatDuration(reference.durationMs)}
						</span>
					</div>
				</div>
			</div>
			<div className="flex items-center gap-1">
				<AudioPlayerButton
					item={audioItem}
					variant="ghost"
					size="sm"
					title="Play reference"
				/>
				{onDelete && (
					<Button
						variant="ghost"
						size="sm"
						className="text-destructive hover:text-destructive"
						onClick={() => onDelete(reference)}
						title="Delete reference"
					>
						<Trash2 className="h-4 w-4" />
					</Button>
				)}
			</div>
		</div>
	);
}

function ExpandedContent({
	textId,
	references,
	loading,
	onDeleteReference,
}: {
	textId: string;
	references: ReferenceSpeechWithRelations[];
	loading?: boolean;
	onDeleteReference?: (ref: ReferenceSpeechWithRelations) => void;
}) {
	const textReferences = references.filter((r) => r.textId === textId);

	if (loading) {
		return (
			<div className="space-y-2 p-4">
				<Skeleton className="h-14" />
				<Skeleton className="h-14" />
			</div>
		);
	}

	if (textReferences.length === 0) {
		return (
			<div className="p-4 text-center text-muted-foreground text-sm">
				No reference speeches yet.
			</div>
		);
	}

	return (
		<div className="flex flex-col gap-2 p-4">
			{textReferences.map((ref) => (
				<ReferenceRow
					key={ref.id}
					reference={ref}
					onDelete={onDeleteReference}
				/>
			))}
		</div>
	);
}

export function DataTable({
	columns,
	data,
	onDeleteSelected,
	expandedRows,
	references,
	referencesLoading,
	onDeleteReference,
}: DataTableProps) {
	const [sorting, setSorting] = React.useState<SortingState>([]);
	const [columnFilters, setColumnFilters] = React.useState<ColumnFiltersState>(
		[],
	);
	const [columnVisibility, setColumnVisibility] =
		React.useState<VisibilityState>({});
	const [rowSelection, setRowSelection] = React.useState({});

	const table = useReactTable({
		data,
		columns,
		onSortingChange: setSorting,
		onColumnFiltersChange: setColumnFilters,
		getCoreRowModel: getCoreRowModel(),
		getPaginationRowModel: getPaginationRowModel(),
		getSortedRowModel: getSortedRowModel(),
		getFilteredRowModel: getFilteredRowModel(),
		onColumnVisibilityChange: setColumnVisibility,
		onRowSelectionChange: setRowSelection,
		state: {
			sorting,
			columnFilters,
			columnVisibility,
			rowSelection,
		},
	});

	const selectedRows = table.getFilteredSelectedRowModel().rows;
	const hasSelection = selectedRows.length > 0;

	const handleDeleteSelected = () => {
		if (onDeleteSelected && hasSelection) {
			onDeleteSelected(selectedRows.map((row) => row.original));
			setRowSelection({});
		}
	};

	return (
		<AudioPlayerProvider>
			<div className="flex flex-col gap-4">
				<div className="flex items-center justify-between gap-4">
					<Input
						placeholder="Filter by content..."
						value={
							(table.getColumn("content")?.getFilterValue() as string) ?? ""
						}
						onChange={(event) =>
							table.getColumn("content")?.setFilterValue(event.target.value)
						}
						className="max-w-sm"
					/>
					<div className="flex items-center gap-2">
						{hasSelection && onDeleteSelected && (
							<Button
								variant="destructive"
								size="sm"
								onClick={handleDeleteSelected}
							>
								<Trash2 size={16} />
								Delete {selectedRows.length}
							</Button>
						)}
						<DropdownMenu>
							<DropdownMenuTrigger asChild>
								<Button variant="outline">Columns</Button>
							</DropdownMenuTrigger>
							<DropdownMenuContent align="end">
								{table
									.getAllColumns()
									.filter((column) => column.getCanHide())
									.map((column) => {
										return (
											<DropdownMenuCheckboxItem
												key={column.id}
												className="capitalize"
												checked={column.getIsVisible()}
												onCheckedChange={(value) =>
													column.toggleVisibility(!!value)
												}
											>
												{column.id}
											</DropdownMenuCheckboxItem>
										);
									})}
							</DropdownMenuContent>
						</DropdownMenu>
					</div>
				</div>
				<div className="overflow-hidden rounded-md border">
					<Table className="table-fixed">
						<TableHeader>
							{table.getHeaderGroups().map((headerGroup) => (
								<TableRow key={headerGroup.id}>
									{headerGroup.headers.map((header) => {
										return (
											<TableHead
												key={header.id}
												style={{
													width:
														header.getSize() !== 150
															? header.getSize()
															: undefined,
												}}
											>
												{header.isPlaceholder
													? null
													: flexRender(
															header.column.columnDef.header,
															header.getContext(),
														)}
											</TableHead>
										);
									})}
								</TableRow>
							))}
						</TableHeader>
						<TableBody>
							{table.getRowModel().rows?.length ? (
								table.getRowModel().rows.map((row) => {
									const isExpanded = expandedRows.has(row.original.id);
									return (
										<React.Fragment key={row.id}>
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
											{isExpanded && (
												<TableRow className="hover:bg-transparent">
													<TableCell
														colSpan={columns.length}
														className="bg-muted/30 p-0"
													>
														<ExpandedContent
															textId={row.original.id}
															references={references}
															loading={referencesLoading}
															onDeleteReference={onDeleteReference}
														/>
													</TableCell>
												</TableRow>
											)}
										</React.Fragment>
									);
								})
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
						{table.getFilteredSelectedRowModel().rows.length} of{" "}
						{table.getFilteredRowModel().rows.length} row(s) selected.
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
		</AudioPlayerProvider>
	);
}
