import { ErrorCode } from "./errors";

export async function convertTo16kHzMonoWav(
	audioBlob: Blob,
): Promise<Blob> {
	try {
		const arrayBuffer = await audioBlob.arrayBuffer();
		const audioContext = new AudioContext({ sampleRate: 16000 });

		const audioBuffer = await audioContext.decodeAudioData(arrayBuffer);

		const monoBuffer = audioContext.createBuffer(
			1,
			audioBuffer.length,
			16000,
		);

		const monoData = monoBuffer.getChannelData(0);
		const numberOfChannels = audioBuffer.numberOfChannels;

		for (let i = 0; i < audioBuffer.length; i++) {
			let sum = 0;
			for (let channel = 0; channel < numberOfChannels; channel++) {
				sum += audioBuffer.getChannelData(channel)[i];
			}
			monoData[i] = sum / numberOfChannels;
		}

		const wavBlob = audioBufferToWav(monoBuffer);

		return new Blob([wavBlob], { type: "audio/wav" });
	} catch (error) {
		console.error("Audio processing error:", error);
		throw new Error(
			`Audio processing failed: ${error instanceof Error ? error.message : "Unknown error"}`,
		);
	}
}

function audioBufferToWav(buffer: AudioBuffer): ArrayBuffer {
	const length = buffer.length;
	const numberOfChannels = buffer.numberOfChannels;
	const sampleRate = buffer.sampleRate;
	const arrayBuffer = new ArrayBuffer(44 + length * numberOfChannels * 2);
	const view = new DataView(arrayBuffer);
	const channels: Float32Array[] = [];

	for (let i = 0; i < numberOfChannels; i++) {
		channels.push(buffer.getChannelData(i));
	}

	const writeString = (offset: number, string: string) => {
		for (let i = 0; i < string.length; i++) {
			view.setUint8(offset + i, string.charCodeAt(i));
		}
	};

	let offset = 0;

	writeString(offset, "RIFF");
	offset += 4;
	view.setUint32(offset, 36 + length * numberOfChannels * 2, true);
	offset += 4;
	writeString(offset, "WAVE");
	offset += 4;
	writeString(offset, "fmt ");
	offset += 4;
	view.setUint32(offset, 16, true);
	offset += 4;
	view.setUint16(offset, 1, true);
	offset += 2;
	view.setUint16(offset, numberOfChannels, true);
	offset += 2;
	view.setUint32(offset, sampleRate, true);
	offset += 4;
	view.setUint32(offset, sampleRate * numberOfChannels * 2, true);
	offset += 4;
	view.setUint16(offset, numberOfChannels * 2, true);
	offset += 2;
	view.setUint16(offset, 16, true);
	offset += 2;
	writeString(offset, "data");
	offset += 4;
	view.setUint32(offset, length * numberOfChannels * 2, true);
	offset += 4;

	for (let i = 0; i < length; i++) {
		for (let channel = 0; channel < numberOfChannels; channel++) {
			let sample = Math.max(-1, Math.min(1, channels[channel][i]));
			sample = sample < 0 ? sample * 0x8000 : sample * 0x7fff;
			view.setInt16(offset, sample, true);
			offset += 2;
		}
	}

	return arrayBuffer;
}

