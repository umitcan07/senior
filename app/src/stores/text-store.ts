import { create } from "zustand";
import type { PracticeText } from "@/db/text";

interface TextStore {
	currentText: PracticeText | null;
	setCurrentText: (text: PracticeText | null) => void;
	clearCurrentText: () => void;
}

export const useTextStore = create<TextStore>((set) => ({
	currentText: null,
	setCurrentText: (text) => set({ currentText: text }),
	clearCurrentText: () => set({ currentText: null }),
}));
