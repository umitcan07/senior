import { createFileRoute } from "@tanstack/react-router";

export const Route = createFileRoute("/error")({
	component: ErrorTestPage,
});

function ErrorTestPage(): never {
	// This will trigger the error boundary
	throw new Error(
		"This is a test error to demonstrate the error boundary. In production, errors are caught and displayed gracefully.",
	);
}
