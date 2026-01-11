import { cva, type VariantProps } from "class-variance-authority";

/**
 * Error background color variants using CVA
 */
export const errorBgVariants = cva("", {
	variants: {
		errorType: {
			substitute: "bg-destructive/20",
			insert: "bg-amber-500/20",
			delete: "bg-amber-500/20", // Orange for deletion
		},
	},
});

/**
 * Error border color variants using CVA
 */
export const errorBorderVariants = cva("", {
	variants: {
		errorType: {
			substitute: "border-destructive/50",
			insert: "border-amber-500/50",
			delete: "border-amber-500/50", // Orange for deletion
		},
	},
});

/**
 * Error text color variants using CVA
 */
export const errorTextVariants = cva("", {
	variants: {
		errorType: {
			substitute: "text-destructive",
			insert: "text-amber-700 dark:text-amber-400",
			delete: "text-amber-700 dark:text-amber-400", // Orange for deletion
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
