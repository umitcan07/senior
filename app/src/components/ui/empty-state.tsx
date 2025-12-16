import type { ReactNode } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";

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
}

export function EmptyState({
	icon,
	title,
	description,
	primaryAction,
	secondaryAction,
	className,
}: EmptyStateProps) {
	return (
		<Card className={className}>
			<CardContent className="pt-6">
				<div className="flex flex-col items-center justify-center gap-2 py-4 text-center">
					{icon && (
						<div className="flex size-10 items-center justify-center rounded-md bg-neutral-50 text-neutral-600 dark:bg-neutral-800 dark:text-neutral-400">
							{icon}
						</div>
					)}
					<h3 className="font-semibold text-lg">{title}</h3>
					<div className="max-w-lg text-balanced text-muted-foreground text-sm leading-6">
						{description}
					</div>
					{(primaryAction || secondaryAction) && (
						<div className="flex flex-col items-center gap-2 py-2 sm:flex-row">
							{primaryAction && (
								<Button onClick={primaryAction.onClick}>
									{primaryAction.label}
								</Button>
							)}
							{secondaryAction && (
								<Button variant="outline" onClick={secondaryAction.onClick}>
									{secondaryAction.label}
								</Button>
							)}
						</div>
					)}
				</div>
			</CardContent>
		</Card>
	);
}
