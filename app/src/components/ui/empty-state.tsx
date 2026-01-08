import type { ReactNode } from "react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

interface EmptyStateAction {
	label: string;
	onClick: () => void;
}

interface EmptyStateProps {
	icon?: ReactNode;
	title: string;
	description: ReactNode;
	primaryAction?: EmptyStateAction;
	secondaryAction?: EmptyStateAction;
	className?: string;
	variant?: "default" | "minimal";
}

export function EmptyState({
	icon,
	title,
	description,
	primaryAction,
	secondaryAction,
	className,
	variant = "default",
}: EmptyStateProps) {
	// Minimalist content structure
	const Content = (
		<div className="flex flex-col items-center justify-center gap-3 text-center">
			{icon && (
				<div
					className={cn(
						"flex items-center justify-center rounded-full bg-muted/40 text-muted-foreground/40",
						variant === "minimal"
							? "mb-1 size-10"
							: "size-12 rounded-xl bg-muted/50",
					)}
				>
					{/* Clone icon to enforce size if needed, or rely on parent sizing */}
					<div className={cn(variant === "minimal" ? "scale-90" : "")}>
						{icon}
					</div>
				</div>
			)}

			<div className="flex flex-col gap-1 max-w-md">
				<h3
					className={cn(
						"font-medium",
						variant === "minimal" ? "text-base" : "text-lg",
					)}
				>
					{title}
				</h3>
				<div
					className={cn(
						"text-balanced text-muted-foreground leading-relaxed",
						variant === "minimal" ? "text-xs" : "text-sm",
					)}
				>
					{description}
				</div>
			</div>

			{(primaryAction || secondaryAction) && (
				<div className="mt-2 flex flex-col items-center gap-2 sm:flex-row">
					{primaryAction && (
						<Button
							onClick={primaryAction.onClick}
							size={variant === "minimal" ? "sm" : "default"}
						>
							{primaryAction.label}
						</Button>
					)}
					{secondaryAction && (
						<Button
							variant="outline"
							onClick={secondaryAction.onClick}
							size={variant === "minimal" ? "sm" : "default"}
						>
							{secondaryAction.label}
						</Button>
					)}
				</div>
			)}
		</div>
	);

	if (variant === "minimal") {
		return (
			<div
				className={cn(
					"flex flex-col items-center justify-center py-12 px-4",
					className,
				)}
			>
				{Content}
			</div>
		);
	}

	return (
		<div
			className={cn(
				"rounded-xl border border-border/40 bg-card/50 px-6 py-16",
				className,
			)}
		>
			{Content}
		</div>
	);
}
