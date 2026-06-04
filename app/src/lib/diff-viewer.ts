import { cva, type VariantProps } from "class-variance-authority";

import type { PhonemeError, WordError } from "@/db/types";

export type DiffError = PhonemeError | WordError;

/**
 * Single source of truth for diff color semantics, shared by the diff viewer
 * (split + unified) and the error-detail list. Git-style:
 *   - substitute → red (changed)
 *   - insert     → green (added / extra in your speech)
 *   - delete     → amber (removed / missing from your speech)
 */
export const errorBgVariants = cva("", {
	variants: {
		errorType: {
			substitute: "bg-destructive/15",
			insert: "bg-emerald-500/15",
			delete: "bg-amber-500/15",
		},
	},
});

export const errorBorderVariants = cva("", {
	variants: {
		errorType: {
			substitute: "border-destructive/40",
			insert: "border-emerald-500/40",
			delete: "border-amber-500/40",
		},
	},
});

export const errorTextVariants = cva("", {
	variants: {
		errorType: {
			substitute: "text-destructive",
			insert: "text-emerald-700 dark:text-emerald-400",
			delete: "text-amber-700 dark:text-amber-400",
		},
	},
});

export type ErrorVariantProps = VariantProps<typeof errorBgVariants>;

/**
 * Get error for a specific position
 */
export function getErrorForPosition<T extends { position: number }>(
	errors: T[],
	position: number,
): T | undefined {
	return errors.find((e) => e.position === position);
}

/**
 * Get all errors for a position range (for handling errors that span multiple segments)
 */
export function getErrorsForPositionRange<T extends { position: number }>(
	errors: T[],
	position: number,
): T[] {
	return errors.filter((e) => e.position === position);
}

/**
 * A single cell in the unified (merged-line) view, in alignment order.
 */
export type DiffCell =
	| { kind: "equal"; segment: string }
	| { kind: "insert"; segment: string; error: DiffError }
	| { kind: "delete"; segment: string; error: DiffError }
	| { kind: "substitute"; expected: string; actual: string; error: DiffError };

export interface DiffResult {
	/** Error at each target-sequence position (substitutes + deletes) — split view. */
	targetErrorMap: Map<number, DiffError>;
	/** Error at each recognized-sequence position (substitutes + inserts) — split view. */
	recognizedErrorMap: Map<number, DiffError>;
	/** Merged alignment, in reading order — unified view. */
	cells: DiffCell[];
}

/**
 * Reconstruct the alignment between the target and recognized sequences from
 * the recorded edit operations, producing both the per-line error maps (split
 * view) and a merged cell list (unified view).
 *
 * Edit-distance position conventions:
 *   - delete: position in the TARGET sequence (target element missing from recognized)
 *   - insert: position in the RECOGNIZED sequence (extra element in recognized)
 *   - substitute: position in the RECOGNIZED sequence (changed element)
 *
 * Substitute positions are in the recognized sequence, so we walk both
 * sequences simultaneously — skipping deleted target positions and inserted
 * recognized positions — to recover the target position each substitute maps to.
 */
export function buildDiff(
	targetSegments: string[],
	recognizedSegments: string[],
	errors: DiffError[],
): DiffResult {
	const targetErrorMap = new Map<number, DiffError>();
	const recognizedErrorMap = new Map<number, DiffError>();

	const byPosition = (a: DiffError, b: DiffError) => a.position - b.position;
	const deletes = errors
		.filter((e) => e.errorType === "delete")
		.sort(byPosition);
	const inserts = errors
		.filter((e) => e.errorType === "insert")
		.sort(byPosition);
	const substitutes = errors
		.filter((e) => e.errorType === "substitute")
		.sort(byPosition);

	for (const error of deletes) {
		if (error.position < targetSegments.length) {
			targetErrorMap.set(error.position, error);
		}
	}
	for (const error of inserts) {
		if (error.position < recognizedSegments.length) {
			recognizedErrorMap.set(error.position, error);
		}
	}
	for (const error of substitutes) {
		if (error.position < recognizedSegments.length) {
			recognizedErrorMap.set(error.position, error);
		}
	}

	const deleteByPos = new Map(deletes.map((e) => [e.position, e] as const));
	const insertByPos = new Map(inserts.map((e) => [e.position, e] as const));
	const substituteByPos = new Map(
		substitutes.map((e) => [e.position, e] as const),
	);

	const cells: DiffCell[] = [];
	let targetIdx = 0;
	let recognizedIdx = 0;

	while (
		targetIdx < targetSegments.length ||
		recognizedIdx < recognizedSegments.length
	) {
		// Deleted target position: present in target, missing from recognized.
		if (targetIdx < targetSegments.length && deleteByPos.has(targetIdx)) {
			const error = deleteByPos.get(targetIdx);
			if (error) {
				cells.push({
					kind: "delete",
					segment: targetSegments[targetIdx],
					error,
				});
			}
			targetIdx++;
			continue;
		}

		// Inserted recognized position: extra element in recognized.
		if (
			recognizedIdx < recognizedSegments.length &&
			insertByPos.has(recognizedIdx)
		) {
			const error = insertByPos.get(recognizedIdx);
			if (error) {
				cells.push({
					kind: "insert",
					segment: recognizedSegments[recognizedIdx],
					error,
				});
			}
			recognizedIdx++;
			continue;
		}

		// Aligned position: either a substitution or an equal match.
		const substitute = substituteByPos.get(recognizedIdx);
		if (
			substitute &&
			targetIdx < targetSegments.length &&
			recognizedIdx < recognizedSegments.length
		) {
			targetErrorMap.set(targetIdx, substitute);
			cells.push({
				kind: "substitute",
				expected: targetSegments[targetIdx],
				actual: recognizedSegments[recognizedIdx],
				error: substitute,
			});
		} else if (recognizedIdx < recognizedSegments.length) {
			cells.push({ kind: "equal", segment: recognizedSegments[recognizedIdx] });
		} else if (targetIdx < targetSegments.length) {
			cells.push({ kind: "equal", segment: targetSegments[targetIdx] });
		}

		if (targetIdx < targetSegments.length) targetIdx++;
		if (recognizedIdx < recognizedSegments.length) recognizedIdx++;
	}

	return { targetErrorMap, recognizedErrorMap, cells };
}
