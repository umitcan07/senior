import type { Variants } from "motion/react";

export const pageVariants: Variants = {
	initial: {
		opacity: 0,
		y: 10,
	},
	animate: {
		opacity: 1,
		y: 0,
		transition: {
			duration: 0.4,
			ease: "easeOut",
		},
	},
	exit: {
		opacity: 0,
		y: -10,
		transition: {
			duration: 0.3,
			ease: "easeIn",
		},
	},
};

export const containerVariants: Variants = {
	initial: { opacity: 0 },
	animate: {
		opacity: 1,
		transition: {
			staggerChildren: 0.05,
			delayChildren: 0.05,
		},
	},
};

export const itemVariants: Variants = {
	initial: { opacity: 0, y: 10 },
	animate: {
		opacity: 1,
		y: 0,
		transition: {
			duration: 0.3,
		},
	},
};
