import { createFileRoute } from "@tanstack/react-router";
import HeaderUser from "@/integrations/clerk/header-user";

export const Route = createFileRoute("/")({ component: App });

function App() {
	return (
		<div>
			<HeaderUser />
		</div>
	);
}
