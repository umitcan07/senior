import { createFileRoute, Outlet } from "@tanstack/react-router";

export const Route = createFileRoute("/practice")({
	component: PracticeLayout,
});

function PracticeLayout() {
	return <Outlet />;
}
