import { SignInButton } from "@clerk/tanstack-react-start";
import { RiLockLine } from "@remixicon/react";
import type { ReactNode } from "react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

interface SignInPromptProps {
	title: string;
	description: string;
	className?: string;
	children?: ReactNode;
}

export function SignInPrompt({
	title,
	description,
	className,
	children,
}: SignInPromptProps) {
	return (
		<div
			className={cn(
				"rounded-xl border border-border/40 bg-card/50 px-6 py-12",
				className,
			)}
		>
			<div className="flex flex-col items-center gap-4 text-center">
				<div className="flex size-12 items-center justify-center rounded-xl bg-muted/50 text-muted-foreground/60">
					<RiLockLine size={22} />
				</div>
				<div className="flex max-w-md flex-col gap-1">
					<h2 className="font-medium text-lg">{title}</h2>
					<p className="text-muted-foreground text-sm leading-relaxed">
						{description}
					</p>
				</div>
				{children}
				<Button asChild size="lg" className="mt-2">
					<SignInButton mode="modal">Sign in</SignInButton>
				</Button>
			</div>
		</div>
	);
}
