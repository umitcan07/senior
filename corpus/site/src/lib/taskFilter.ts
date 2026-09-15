import type { Manifest, PhoneStat, TokenRow } from "./types";

export type TaskFilter = "all" | "T1" | "T2";

/** Both ordinary and dedicated annotation IDs use {speaker}{task}_….
 * Resolve that recording against explicit manifest metadata, never guess a task. */
export function recordingTasks(manifest: Manifest): Map<string, string | null> {
	return new Map(manifest.utterances.map((u) => [u.id.split("_")[0], u.task]));
}

export function filterTask(
	rows: TokenRow[],
	task: TaskFilter,
	tasks: Map<string, string | null>,
): TokenRow[] {
	return task === "all" ? rows : rows.filter((row) => tasks.get(row.u.split("_")[0]) === task);
}

export function tokenStats(phone: string, rows: TokenRow[]): PhoneStat {
	const total = rows.length;
	const correct = rows.filter((row) => row.e === "correct").length;
	return {
		phone,
		total,
		correct,
		incorrect: total - correct,
		accuracy: total ? correct / total : null,
	};
}
