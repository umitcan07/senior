import {
	Popover,
	PopoverContent,
	PopoverTrigger,
} from "@/components/ui/popover";
import type {
	PronunciationProfile as Profile,
	ProfileItem,
} from "@/lib/phone-profile";
import { cn } from "@/lib/utils";

/**
 * E7.6 / #57 — the summary page's "Pronunciation Profile". Replaces the old flat
 * "Most Challenging Sounds" chip cloud, which grouped by target phone and hid
 * insertions, so it could never tell apart sounds you under-produce from sounds you
 * add. This splits the same data along the two axes a learner cares about and reuses
 * the diff page's severity colors + coaching hints (via phone-hints, upstream).
 */

/** Mode/severity → chip color. Substitutions use the severity ramp (critical = strong
 * red ring, like the diff tiles); deletions are amber, insertions emerald — matching the
 * diff legend. */
function chipTone(item: ProfileItem): string {
	if (item.mode === "insert") {
		return "border-emerald-500/40 bg-emerald-500/10 text-emerald-700 hover:bg-emerald-500/15 dark:text-emerald-400";
	}
	if (item.mode === "delete") {
		return "border-amber-500/40 bg-amber-500/10 text-amber-700 hover:bg-amber-500/15 dark:text-amber-400";
	}
	// substitution — emphasis grows with severity (additive, never recolors).
	if (item.severity === "critical") {
		return "border-destructive/50 bg-destructive/10 text-destructive ring-1 ring-destructive/40 font-semibold hover:bg-destructive/15";
	}
	if (item.severity === "major") {
		return "border-destructive/40 bg-destructive/5 text-destructive hover:bg-destructive/10";
	}
	return "border-border/50 bg-muted/30 text-foreground/80 hover:bg-muted/50";
}

function ProfileChip({ item }: { item: ProfileItem }) {
	return (
		<Popover>
			<PopoverTrigger asChild>
				<button
					type="button"
					className={cn(
						"inline-flex items-center gap-1.5 rounded-full border px-3 py-1 outline-hidden transition-colors focus-visible:ring-2 focus-visible:ring-primary/40",
						chipTone(item),
					)}
				>
					<span className="font-ipa text-sm">{item.label}</span>
					<span className="text-[10px] tabular-nums opacity-60">
						{item.count}
					</span>
				</button>
			</PopoverTrigger>
			{item.hint && (
				<PopoverContent
					side="top"
					className="max-w-xs space-y-1.5 text-xs leading-relaxed"
				>
					{item.categories.length > 0 && (
						<p className="font-medium text-muted-foreground">
							Differs in {item.categories.join(", ")}
						</p>
					)}
					<p>{item.hint}</p>
				</PopoverContent>
			)}
		</Popover>
	);
}

function Section({
	title,
	description,
	items,
	remaining,
}: {
	title: string;
	description: string;
	items: ProfileItem[];
	remaining: number;
}) {
	if (items.length === 0) return null;
	return (
		<div className="flex flex-col gap-3">
			<div className="space-y-0.5">
				<h3 className="font-medium text-foreground text-sm">{title}</h3>
				<p className="text-muted-foreground text-xs">{description}</p>
			</div>
			<div className="flex flex-wrap items-center gap-2">
				{items.map((item) => (
					<ProfileChip key={item.key} item={item} />
				))}
				{remaining > 0 && (
					<span className="text-muted-foreground/70 text-xs">
						+{remaining} more
					</span>
				)}
			</div>
		</div>
	);
}

export function PronunciationProfile({ profile }: { profile: Profile }) {
	const { toMaster, added, categories, totals } = profile;
	if (toMaster.length === 0 && added.length === 0) return null;

	return (
		<div className="flex flex-col gap-8">
			{categories.length > 0 && (
				<p className="text-muted-foreground text-sm">
					Most of your differences are in{" "}
					<span className="font-medium text-foreground">
						{categories
							.slice(0, 3)
							.map((c) => c.category)
							.join(", ")}
					</span>
					.
				</p>
			)}

			<Section
				title="Sounds to work on"
				description="Target sounds you replace or drop. Tap a chip for a tip."
				items={toMaster}
				remaining={totals.toMaster - toMaster.length}
			/>

			<Section
				title="Extra sounds you add"
				description="Sounds you insert that aren't in the word — often an extra vowel between consonants."
				items={added}
				remaining={totals.added - added.length}
			/>
		</div>
	);
}
