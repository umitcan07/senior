import { RecordSpeech } from "@/components/record-speech";
import { createFileRoute } from "@tanstack/react-router";

export const Route = createFileRoute("/record")({
  component: RouteComponent,
});

function RouteComponent() {
  return (
    <div className="container max-w-6xl mx-auto">
      <RecordSpeech />
    </div>
  );
}
