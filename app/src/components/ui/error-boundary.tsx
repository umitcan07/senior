"use client";

import React, { Component, type ReactNode } from "react";
import { Button } from "./button";
import { RiAlertLine } from "@remixicon/react";

interface Props {
	children: ReactNode;
	fallback?: ReactNode;
}

interface State {
	hasError: boolean;
	error: Error | null;
}

export class ErrorBoundary extends Component<Props, State> {
	constructor(props: Props) {
		super(props);
		this.state = { hasError: false, error: null };
	}

	static getDerivedStateFromError(error: Error): State {
		return { hasError: true, error };
	}

	componentDidCatch(error: Error, errorInfo: React.ErrorInfo) {
		console.warn("ErrorBoundary caught an error:", error, errorInfo);
	}

	render() {
		if (this.state.hasError) {
			if (this.props.fallback) {
				return this.props.fallback;
			}

			return (
				<div className="flex flex-col items-center justify-center gap-2 rounded-lg border border-destructive/20 bg-destructive/5 p-4 text-center">
					<div className="flex items-center gap-2 text-destructive">
						<RiAlertLine size={18} />
						<span className="font-semibold text-sm">Something went wrong</span>
					</div>
					<Button
						variant="outline"
						size="sm"
						onClick={() => this.setState({ hasError: false, error: null })}
						className="mt-2 h-8 text-xs"
					>
						Try Again
					</Button>
				</div>
			);
		}

		return this.props.children;
	}
}
