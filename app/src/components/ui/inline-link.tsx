import { cn } from "@/lib/utils";

export const InlineLink = ({
	children,
	className,
	...props
}: React.ComponentProps<"a">) => {
	return (
		<a
			className={cn(
				"inline-flex items-center gap-1 font-medium text-primary underline-offset-4 transition-all duration-100 hover:text-primary/80 hover:underline",
				className,
			)}
			{...props}
		>
			{children}
		</a>
	);
};
