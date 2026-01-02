import { create } from "zustand";
import type { PracticeText } from "@/db/text";
import type { TextDifficulty, TextType } from "@/db/types";

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

type WordCountCategory = "short" | "medium" | "long" | "all";

function getWordCountCategory(wordCount: number): WordCountCategory {
	if (wordCount < 14) return "short";
	if (wordCount < 28) return "medium";
	return "long";
}

interface TextFilterStore {
	difficultyFilter: TextDifficulty | "all";
	typeFilter: TextType | "all";
	wordCountFilter: WordCountCategory;
	setDifficultyFilter: (filter: TextDifficulty | "all") => void;
	setTypeFilter: (filter: TextType | "all") => void;
	setWordCountFilter: (filter: WordCountCategory) => void;
	resetFilters: () => void;
}

export const useTextFilterStore = create<TextFilterStore>((set) => ({
	difficultyFilter: "all",
	typeFilter: "all",
	wordCountFilter: "all",
	setDifficultyFilter: (filter) => set({ difficultyFilter: filter }),
	setTypeFilter: (filter) => set({ typeFilter: filter }),
	setWordCountFilter: (filter) => set({ wordCountFilter: filter }),
	resetFilters: () =>
		set({ difficultyFilter: "all", typeFilter: "all", wordCountFilter: "all" }),
}));

export { getWordCountCategory };
export type { WordCountCategory };
