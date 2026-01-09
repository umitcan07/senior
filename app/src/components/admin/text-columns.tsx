"use client";

import {
	RiAddLine,
	RiArrowDownSLine,
	RiArrowRightSLine,
	RiArrowUpDownLine,
	RiDeleteBinLine,
	RiEditLine,
	RiMoreLine,
} from "@remixicon/react";
import type { ColumnDef } from "@tanstack/react-table";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import {
	DropdownMenu,
	DropdownMenuContent,
	DropdownMenuItem,
	DropdownMenuLabel,
	DropdownMenuSeparator,
	DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import type { PracticeTextWithReferenceCount } from "@/db/text";
import type { TextDifficulty } from "@/db/types";
import { cn } from "@/lib/utils";

export function formatDate(date: Date) {
	return new Intl.DateTimeFormat("en-US", {
		month: "short",
		day: "numeric",
		year: "numeric",
		hour: "numeric",
		minute: "2-digit",
	}).format(new Date(date));
}

function getDifficultyColor(difficulty: TextDifficulty) {
	switch (difficulty) {
		case "beginner":
			return "text-green-600 dark:text-green-500";
		case "intermediate":
			return "text-yellow-600 dark:text-yellow-500";
		case "advanced":
			return "text-red-600 dark:text-red-500";
		default:
			return "text-muted-foreground";
	}
}

export interface TextTableActions {
	onEdit: (text: PracticeTextWithReferenceCount) => void;
	onDelete: (text: PracticeTextWithReferenceCount) => void;
	onAddReference: (text: PracticeTextWithReferenceCount) => void;
	onToggleExpand: (textId: string) => void;
	expandedRows: Set<string>;
}

export function createColumns(
	actions: TextTableActions,
): ColumnDef<PracticeTextWithReferenceCount>[] {
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
			id: "expand",
			size: 40,
			header: () => null,
			cell: ({ row }) => {
				const text = row.original;
				const isExpanded = actions.expandedRows.has(text.id);
				const hasReferences = text.referenceCount > 0;

				if (!hasReferences) {
					return <div className="w-8" />;
				}

				return (
					<Button
						variant="ghost"
						size="sm"
						className="h-8 w-8 p-0"
						onClick={() => actions.onToggleExpand(text.id)}
					>
						{isExpanded ? (
							<RiArrowDownSLine className="h-4 w-4" />
						) : (
							<RiArrowRightSLine className="h-4 w-4" />
						)}
					</Button>
				);
			},
			enableSorting: false,
			enableHiding: false,
		},
		{
			accessorKey: "content",
			header: ({ column }) => {
				return (
					<Button
						variant="ghost"
						onClick={() => column.toggleSorting(column.getIsSorted() === "asc")}
						className="h-8 px-2"
					>
						Content
						<RiArrowUpDownLine className="ml-2 h-4 w-4" />
					</Button>
				);
			},
			cell: ({ row }) => {
				const content = row.getValue("content") as string;
				return (
					<div className="max-w-md">
						<p className="line-clamp-2 text-sm">{content}</p>
					</div>
				);
			},
		},
		{
			accessorKey: "difficulty",
			size: 120,
			header: ({ column }) => {
				return (
					<Button
						variant="ghost"
						onClick={() => column.toggleSorting(column.getIsSorted() === "asc")}
						className="h-8 px-2"
					>
						Difficulty
						<RiArrowUpDownLine className="ml-2 h-4 w-4" />
					</Button>
				);
			},
			cell: ({ row }) => {
				const difficulty = row.getValue("difficulty") as TextDifficulty;
				return (
					<span
						className={cn(
							"font-medium text-sm capitalize",
							getDifficultyColor(difficulty),
						)}
					>
						{difficulty}
					</span>
				);
			},
		},
		{
			accessorKey: "type",
			size: 140,
			header: ({ column }) => {
				return (
					<Button
						variant="ghost"
						onClick={() => column.toggleSorting(column.getIsSorted() === "asc")}
						className="h-8 px-2"
					>
						Type
						<RiArrowUpDownLine className="ml-2 h-4 w-4" />
					</Button>
				);
			},
			cell: ({ row }) => {
				const type = row.getValue("type") as string;
				return (
					<span className="text-muted-foreground text-sm capitalize">
						{type.replace("_", " ")}
					</span>
				);
			},
		},
		{
			accessorKey: "referenceCount",
			size: 120,
			header: ({ column }) => {
				return (
					<Button
						variant="ghost"
						onClick={() => column.toggleSorting(column.getIsSorted() === "asc")}
						className="h-8 px-2"
					>
						References
						<RiArrowUpDownLine className="ml-2 h-4 w-4" />
					</Button>
				);
			},
			cell: ({ row }) => {
				const count = row.original.referenceCount;
				return (
					<div className="flex items-center gap-2">
						<span
							className={cn(
								"text-sm tabular-nums",
								count === 0 ? "text-muted-foreground" : "text-foreground",
							)}
						>
							{count}
						</span>
						<Button
							variant="ghost"
							size="sm"
							className="h-6 w-6 p-0"
							onClick={() => actions.onAddReference(row.original)}
							title="Add reference"
						>
							<RiAddLine className="h-3 w-3" />
						</Button>
					</div>
				);
			},
		},
		{
			accessorKey: "wordCount",
			size: 100,
			header: ({ column }) => {
				return (
					<Button
						variant="ghost"
						onClick={() => column.toggleSorting(column.getIsSorted() === "asc")}
						className="h-8 px-2"
					>
						Words
						<RiArrowUpDownLine className="ml-2 h-4 w-4" />
					</Button>
				);
			},
			cell: ({ row }) => {
				const wordCount = row.getValue("wordCount") as number;
				return (
					<div className="text-sm tabular-nums">
						{wordCount} {wordCount === 1 ? "word" : "words"}
					</div>
				);
			},
		},
		{
			accessorKey: "createdAt",
			size: 160,
			header: ({ column }) => {
				return (
					<Button
						variant="ghost"
						onClick={() => column.toggleSorting(column.getIsSorted() === "asc")}
						className="h-8 px-2"
					>
						Created
						<RiArrowUpDownLine className="ml-2 h-4 w-4" />
					</Button>
				);
			},
			cell: ({ row }) => {
				const date = row.getValue("createdAt") as Date;
				return (
					<div className="text-muted-foreground text-xs">
						{formatDate(date)}
					</div>
				);
			},
		},
		{
			id: "actions",
			size: 50,
			cell: ({ row }) => {
				const text = row.original;

				return (
					<DropdownMenu>
						<DropdownMenuTrigger asChild>
							<Button variant="ghost" className="h-8 w-8 p-0">
								<span className="sr-only">Open menu</span>
								<RiMoreLine className="h-4 w-4" />
							</Button>
						</DropdownMenuTrigger>
						<DropdownMenuContent align="end">
							<DropdownMenuLabel>Actions</DropdownMenuLabel>
							<DropdownMenuItem onClick={() => actions.onAddReference(text)}>
								<RiAddLine className="mr-2 h-4 w-4" />
								Add Reference
							</DropdownMenuItem>
							<DropdownMenuItem onClick={() => actions.onEdit(text)}>
								<RiEditLine className="mr-2 h-4 w-4" />
								Edit
							</DropdownMenuItem>
							<DropdownMenuSeparator />
							<DropdownMenuItem
								onClick={() => actions.onDelete(text)}
								className="text-destructive"
							>
								<RiDeleteBinLine className="mr-2 h-4 w-4" />
								Delete
							</DropdownMenuItem>
						</DropdownMenuContent>
					</DropdownMenu>
				);
			},
		},
	];
}
