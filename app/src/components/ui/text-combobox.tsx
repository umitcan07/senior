import { RiArrowUpDownLine, RiCheckLine } from "@remixicon/react";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import {
	Command,
	CommandEmpty,
	CommandGroup,
	CommandInput,
	CommandItem,
	CommandList,
} from "@/components/ui/command";
import {
	Popover,
	PopoverContent,
	PopoverTrigger,
} from "@/components/ui/popover";
import type { PracticeText } from "@/db/text";
import { cn } from "@/lib/utils";

interface TextComboboxProps {
	texts: PracticeText[];
	value: string | null;
	onValueChange: (value: string | null) => void;
	placeholder?: string;
	emptyMessage?: string;
	className?: string;
	disabled?: boolean;
}

export function TextCombobox({
	texts,
	value,
	onValueChange,
	placeholder = "Select text...",
	emptyMessage = "No texts found.",
	className,
	disabled,
}: TextComboboxProps) {
	const [open, setOpen] = useState(false);

	const selectedText = value ? texts.find((t) => t.id === value) : null;

	return (
		<Popover open={open} onOpenChange={setOpen}>
			<PopoverTrigger asChild>
				<Button
					variant="outline"
					role="combobox"
					aria-expanded={open}
					className={cn("w-full justify-between", className)}
					disabled={disabled}
				>
					<span className="truncate">
						{selectedText
							? selectedText.content.slice(0, 50) +
								(selectedText.content.length > 50 ? "..." : "")
							: placeholder}
					</span>
					<RiArrowUpDownLine className="ml-2 h-4 w-4 shrink-0 opacity-50" />
				</Button>
			</PopoverTrigger>
			<PopoverContent className="w-(--radix-popover-trigger-width) p-0">
				<Command>
					<CommandInput placeholder="Search texts..." />
					<CommandList>
						<CommandEmpty>{emptyMessage}</CommandEmpty>
						<CommandGroup>
							{texts.map((text) => (
								<CommandItem
									key={text.id}
									value={text.content}
									onSelect={() => {
										onValueChange(text.id === value ? null : text.id);
										setOpen(false);
									}}
								>
									<RiCheckLine
										className={cn(
											"mr-2 h-4 w-4",
											value === text.id ? "opacity-100" : "opacity-0",
										)}
									/>
									<div className="flex flex-col gap-0.5 overflow-hidden">
										<span className="truncate text-sm">{text.content}</span>
										<span className="text-muted-foreground text-xs">
											{text.difficulty} • {text.type.replace("_", " ")} •{" "}
											{text.wordCount} words
										</span>
									</div>
								</CommandItem>
							))}
						</CommandGroup>
					</CommandList>
				</Command>
			</PopoverContent>
		</Popover>
	);
}
