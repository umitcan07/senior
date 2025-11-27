import { create } from "zustand";
import type { Text } from "@/db/text";

interface TextStore {
	currentText: Text | null;
	setCurrentText: (text: Text | null) => void;
	clearCurrentText: () => void;
}

export const useTextStore = create<TextStore>((set) => ({
	currentText: null,
	setCurrentText: (text) => set({ currentText: text }),
	clearCurrentText: () => set({ currentText: null }),
}));

