import { useAuth } from "@clerk/clerk-react";
import type { ReactNode } from "react";
import { Navbar } from "@/components/navigation/navbar";
import { cn } from "@/lib/utils";

interface MainLayoutProps {
	children: ReactNode;
	className?: string;
}

export function MainLayout({ children, className }: MainLayoutProps) {
	const { has } = useAuth();
	const isAdmin = has?.({ feature: "admin:admin" }) ?? false;

	return (
		<div className="min-h-screen bg-linear-to-b from-background to-muted/20">
			<Navbar isAdmin={isAdmin} />
			<main className={className}>{children}</main>
		</div>
	);
}

interface PageContainerProps {
	children: ReactNode;
	className?: string;
	maxWidth?: "sm" | "md" | "lg" | "xl" | "full";
}

const maxWidthClasses = {
	sm: "max-w-2xl",
	md: "max-w-3xl",
	lg: "max-w-5xl",
	xl: "max-w-7xl",
	full: "",
};

export function PageContainer({
	children,
	className,
	maxWidth = "xl",
}: PageContainerProps) {
	return (
		<div
			className={cn(
				"container mx-auto px-6 py-8 md:px-10 md:py-10",
				maxWidthClasses[maxWidth],
				className,
			)}
		>
			{children}
		</div>
	);
}

interface PageHeaderProps {
	title: string;
	description?: string;
	children?: ReactNode;
}

export function PageHeader({ title, description, children }: PageHeaderProps) {
	return (
		<div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
			<div className="space-y-1">
				<h1 className="bg-linear-to-b from-foreground to-foreground/70 bg-clip-text font-display font-semibold text-2xl text-transparent tracking-tight md:text-3xl">
					{title}
				</h1>
				{description && (
					<p className="text-muted-foreground text-sm">{description}</p>
				)}
			</div>
			{children && <div className="flex items-center gap-2">{children}</div>}
		</div>
	);
}
