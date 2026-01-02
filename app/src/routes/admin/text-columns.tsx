"use client";

import type { ColumnDef } from "@tanstack/react-table";
import { ArrowUpDown, MoreHorizontal, Pencil, Trash2 } from "lucide-react";
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
import { cn } from "@/lib/utils";
import type { PracticeText } from "@/db/text";
import type { TextDifficulty } from "@/db/types";

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
	onEdit: (text: PracticeText) => void;
	onDelete: (text: PracticeText) => void;
}

export function createColumns(
	actions: TextTableActions,
): ColumnDef<PracticeText>[] {
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
			accessorKey: "content",
			header: ({ column }) => {
				return (
					<Button
						variant="ghost"
						onClick={() => column.toggleSorting(column.getIsSorted() === "asc")}
						className="h-8 px-2"
					>
						Content
						<ArrowUpDown className="ml-2 h-4 w-4" />
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
						<ArrowUpDown className="ml-2 h-4 w-4" />
					</Button>
				);
			},
			cell: ({ row }) => {
				const difficulty = row.getValue("difficulty") as TextDifficulty;
				return (
					<span
						className={cn(
							"text-sm capitalize font-medium",
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
						<ArrowUpDown className="ml-2 h-4 w-4" />
					</Button>
				);
			},
			cell: ({ row }) => {
				const type = row.getValue("type") as string;
				return (
					<span className="text-sm capitalize text-muted-foreground">
						{type.replace("_", " ")}
					</span>
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
						<ArrowUpDown className="ml-2 h-4 w-4" />
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
						<ArrowUpDown className="ml-2 h-4 w-4" />
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
								<MoreHorizontal className="h-4 w-4" />
							</Button>
						</DropdownMenuTrigger>
						<DropdownMenuContent align="end">
							<DropdownMenuLabel>Actions</DropdownMenuLabel>
							<DropdownMenuItem onClick={() => actions.onEdit(text)}>
								<Pencil className="mr-2 h-4 w-4" />
								Edit
							</DropdownMenuItem>
							<DropdownMenuSeparator />
							<DropdownMenuItem
								onClick={() => actions.onDelete(text)}
								className="text-destructive"
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
