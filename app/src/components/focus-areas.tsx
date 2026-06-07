import {
	Popover,
	PopoverContent,
	PopoverTrigger,
} from "@/components/ui/popover";
import type { DiffError } from "@/lib/diff-viewer";
import { focusContrasts } from "@/lib/phone-hints";
import { cn } from "@/lib/utils";

/**
 * E7.6 / #57 — a compact, always-visible strip of the critical/major substitution
 * contrasts in this attempt (deduped, critical-first). Each chip is a Popover, so the
 * coaching hint is reachable on touch screens (the per-tile hover tooltip isn't).
 * Renders nothing when there's nothing worth focusing on.
 */
export function FocusAreas({ errors }: { errors: DiffError[] }) {
	const items = focusContrasts(errors);
	if (items.length === 0) return null;

	return (
		<div className="flex flex-wrap items-center gap-2 text-xs">
			<span className="text-muted-foreground/70">Focus areas:</span>
			{items.map((f) => (
				<Popover key={f.contrast}>
					<PopoverTrigger asChild>
						<button
							type="button"
							className={cn(
								"inline-flex items-center rounded-full border px-2 py-0.5 font-ipa outline-hidden transition-colors focus-visible:ring-2 focus-visible:ring-primary/40",
								f.severity === "critical"
									? "border-destructive/40 bg-destructive/10 text-destructive hover:bg-destructive/15"
									: "border-amber-500/40 bg-amber-500/10 text-amber-700 hover:bg-amber-500/15 dark:text-amber-400",
							)}
						>
							{f.contrast}
						</button>
					</PopoverTrigger>
					{f.hint && (
						<PopoverContent
							side="top"
							className="max-w-xs text-xs leading-relaxed"
						>
							{f.hint}
						</PopoverContent>
					)}
				</Popover>
			))}
		</div>
	);
}
