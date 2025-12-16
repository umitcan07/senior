import { cn } from "@/lib/utils";

export const Pulse = ({
	className,
	...props
}: React.ComponentProps<"span">) => {
	return (
		<span
			data-slot="pulse"
			aria-label="Pulse"
			aria-roledescription="pulse"
			className={cn("inline-block h-4 w-4 text-foreground", className)}
			{...props}
		>
			<svg
				width="100%"
				height="100%"
				viewBox="0 0 24 24"
				xmlns="http://www.w3.org/2000/svg"
				stroke="currentColor"
			>
				<circle cx="12" cy="12" r="0">
					<animate
						id="pulse_lNK6"
						begin="0;pulse_NDtD.begin+0.6s"
						attributeName="r"
						calcMode="spline"
						dur="1.2s"
						values="0;11"
						keySplines=".52,.6,.25,.99"
						fill="freeze"
					/>
					<animate
						begin="0;pulse_NDtD.begin+0.6s"
						attributeName="opacity"
						calcMode="spline"
						dur="1.2s"
						values="1;0"
						keySplines=".52,.6,.25,.99"
						fill="freeze"
					/>
				</circle>
				<circle cx="12" cy="12" r="0">
					<animate
						id="pulse_NDtD"
						begin="pulse_lNK6.begin+0.6s"
						attributeName="r"
						calcMode="spline"
						dur="1.2s"
						values="0;11"
						keySplines=".52,.6,.25,.99"
						fill="freeze"
					/>
					<animate
						begin="pulse_lNK6.begin+0.6s"
						attributeName="opacity"
						calcMode="spline"
						dur="1.2s"
						values="1;0"
						keySplines=".52,.6,.25,.99"
						fill="freeze"
					/>
				</circle>
			</svg>
		</span>
	);
};
