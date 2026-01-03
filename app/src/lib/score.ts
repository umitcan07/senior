import { cva, type VariantProps } from "class-variance-authority";

/**
 * Score color variants using CVA
 */
export const scoreColorVariants = cva("", {
	variants: {
		level: {
			high: "text-green-600 dark:text-green-400",
			medium: "text-yellow-600 dark:text-yellow-400",
			low: "text-red-600 dark:text-red-400",
		},
	},
});

/**
 * Score background color variants using CVA
 */
export const scoreBgColorVariants = cva("", {
	variants: {
		level: {
			high: "bg-green-100 dark:bg-green-900/30",
			medium: "bg-yellow-100 dark:bg-yellow-900/30",
			low: "bg-red-100 dark:bg-red-900/30",
		},
	},
});

export type ScoreLevel = VariantProps<typeof scoreColorVariants>["level"];

/**
 * Get score level based on value
 */
export function getScoreLevel(score: number): ScoreLevel {
	if (score >= 75) return "high";
	if (score >= 50) return "medium";
	return "low";
}
