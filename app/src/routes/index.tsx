import HeaderUser from "@/integrations/clerk/header-user";
import { createFileRoute } from "@tanstack/react-router";

export const Route = createFileRoute("/")({ component: App });

function App() {
  return (
    <div>
      <HeaderUser />
    </div>
  );
}
