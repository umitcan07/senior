import { RecordSpeech } from "@/components/record-speech";
import { createFileRoute } from "@tanstack/react-router";
import { z } from "zod";
import { useServerFn } from "@tanstack/react-start";
import { serverGetTextById } from "@/lib/text";
import { useTextStore } from "@/stores/text-store";
import { useEffect } from "react";
import type { Text } from "@/db/text";
import type { ApiResponse } from "@/lib/errors";
import HeaderUser from "@/integrations/clerk/header-user";
import { Card, CardContent } from "@/components/ui/card";

export const Route = createFileRoute("/record/$textId")({
	component: RouteComponent,
	validateSearch: z.object({}),
});

function RouteComponent() {
	const { textId } = Route.useParams();
	const getTextByIdFn = useServerFn(serverGetTextById);
	const { setCurrentText, currentText } = useTextStore();

	useEffect(() => {
		const numTextId = Number.parseInt(textId, 10);
		if (Number.isNaN(numTextId) || numTextId <= 0) {
			return;
		}

		let cancelled = false;
		(getTextByIdFn({ data: { id: numTextId } }) as Promise<ApiResponse<Text | null>>)
			.then((result) => {
				if (!cancelled && result.success && result.data) {
					setCurrentText(result.data);
				}
			})
			.catch((error) => {
				if (!cancelled) {
					console.error("Failed to load text:", error);
				}
			});
		return () => {
			cancelled = true;
		};
	}, [textId, getTextByIdFn, setCurrentText]);

	if (!currentText) {
		return (
			<div className="min-h-screen bg-gradient-to-b from-background to-muted/20">
				<HeaderUser />
				<div className="container max-w-4xl mx-auto px-4 py-12">
					<div className="text-center text-muted-foreground">Loading practice text...</div>
				</div>
			</div>
		);
	}

	return (
		<div className="min-h-screen bg-gradient-to-b from-background to-muted/20">
			<HeaderUser />
			<main className="container max-w-4xl mx-auto px-4 py-8 md:py-12">
				<div className="space-y-8">
					<div className="text-center space-y-2">
						<h1 className="text-2xl md:text-3xl font-semibold tracking-tight">
							Practice Your Pronunciation
						</h1>
						<p className="text-sm text-muted-foreground">
							Read the text below and record yourself
						</p>
					</div>

					<Card className="border-2 shadow-lg">
						<CardContent className="p-8 md:p-12">
							<p className="text-lg md:text-xl leading-relaxed text-foreground whitespace-pre-wrap font-medium">
								{currentText.text}
							</p>
						</CardContent>
					</Card>

					<div className="pt-4">
						<RecordSpeech />
					</div>
				</div>
			</main>
		</div>
	);
}

