import { ClientOnly } from "@tanstack/react-router";
import { useEffect } from "react";
import { useVoiceVisualizer, VoiceVisualizer } from "react-voice-visualizer";

export const RecordSpeech = () => {
	// Initialize the recorder controls using the hook
	const recorderControls = useVoiceVisualizer({
		onStopRecording: () => {
			console.log("stopped recording");
		},
	});
	const { recordedBlob, error, audioData, isAvailableRecordedAudio } =
		recorderControls;

	useEffect(() => {
		if (!isAvailableRecordedAudio) return;

		console.log(audioData);
	}, [audioData, isAvailableRecordedAudio]);

	useEffect(() => {
		if (!recordedBlob) return;

		console.log(recordedBlob);
	}, [recordedBlob]);

	useEffect(() => {
		if (!error) return;

		console.error(error);
	}, [error]);

	if (error) {
		return <div>An error occurred while recording: {error.message}</div>;
	}

	return (
		<div className="p-4">
			<ClientOnly fallback={<div>Loading...</div>}>
				<VoiceVisualizer
					controls={recorderControls}
					defaultMicrophoneIconColor="#18D1B8"
					defaultAudioWaveIconColor="#18D1B8"
					mainBarColor="#dddddd"
					secondaryBarColor="#18D1B8"
					barWidth={4}
					speed={3}
					backgroundColor="#f0f0f0"
					progressIndicatorTimeClassName="font-mono"
					isProgressIndicatorOnHoverShown={true}
					progressIndicatorTimeOnHoverClassName="font-bold font-mono bg-slate-200"
					audioProcessingTextClassName="text-slate-400"
					gap={4}
					progressIndicatorClassName="bg-slate-400"
					rounded={4}
					onlyRecording={false}
					isControlPanelShown={true}
					isDownloadAudioButtonShown={true}
					isAudioProcessingTextShown={true}
					isDefaultUIShown={false}
					controlButtonsClassName="bg-slate-400"
					animateCurrentPick={false}
					isProgressIndicatorShown={true}
				/>
			</ClientOnly>
		</div>
	);
};
