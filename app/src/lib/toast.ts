import {
	RiAlertFill,
	RiCheckboxCircleFill,
	RiErrorWarningFill,
	RiInformationFill,
} from "@remixicon/react";
import * as React from "react";
import type { ToastActionElement } from "@/components/ui/toast";
import { useToast } from "@/hooks/use-toast";

export function useToastHelpers() {
	const { toast } = useToast();

	const createToastTitle = (
		Icon: React.ComponentType<{ className?: string }>,
		message: string,
		iconClassName?: string,
	) => {
		return React.createElement(
			"div",
			{ className: "flex items-center gap-2" },
			React.createElement(Icon, { className: iconClassName }),
			React.createElement("span", null, message),
		);
	};

	return {
		toast: ({
			title,
			description,
			variant = "default",
			action,
		}: {
			title: React.ReactNode;
			description?: React.ReactNode;
			variant?: "default" | "destructive" | "success" | "warning" | "info";
			action?: ToastActionElement;
		}) => {
			return toast({
				title,
				description,
				variant,
				action,
			} as Parameters<typeof toast>[0]);
		},
		showSuccessToast: (message: string, details?: string) => {
			return toast({
				title: createToastTitle(
					RiCheckboxCircleFill,
					message,
					"text-teal-600 dark:text-teal-400",
				),
				description: details,
				variant: "success",
			} as unknown as Parameters<typeof toast>[0]);
		},
		showErrorToast: (message: string, details?: string) => {
			return toast({
				title: createToastTitle(
					RiErrorWarningFill,
					message,
					"text-red-600 dark:text-red-400",
				),
				description: details,
				variant: "destructive",
			} as unknown as Parameters<typeof toast>[0]);
		},
		showWarningToast: (message: string, details?: string) => {
			return toast({
				title: createToastTitle(
					RiAlertFill,
					message,
					"text-yellow-600 dark:text-yellow-400",
				),
				description: details,
				variant: "warning",
			} as unknown as Parameters<typeof toast>[0]);
		},
		showInfoToast: (message: string, details?: string) => {
			return toast({
				title: createToastTitle(
					RiInformationFill,
					message,
					"text-blue-600 dark:text-blue-400",
				),
				description: details,
				variant: "info",
			} as unknown as Parameters<typeof toast>[0]);
		},
	};
}
