#!/usr/bin/env tsx
/**
 * Script to validate word counts in practice_text.json and show distribution
 */

import { readFileSync, writeFileSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

interface PracticeText {
	content: string;
	difficulty: string;
	type: string;
	phonetic_focus: string[];
	target_challenges: string[];
	word_count: number;
	complexity_notes: string;
}

interface TextData {
	texts: PracticeText[];
}

function calculateWordCount(content: string): number {
	return content
		.trim()
		.split(/\s+/)
		.filter((word) => word.length > 0).length;
}

function determineLengthCategory(
	wordCount: number,
): "short" | "medium" | "long" {
	if (wordCount <= 14) return "short";
	if (wordCount <= 28) return "medium";
	return "long";
}

function main() {
	const projectRoot = process.cwd();
	const filePath = join(__dirname, "..", "doc", "practice_text.json");

	console.log("📊 Practice Texts Word Count Validator\n");
	console.log(`Reading file: ${filePath}\n`);

	let data: TextData;
	try {
		const fileContent = readFileSync(filePath, "utf-8");
		data = JSON.parse(fileContent);
	} catch (error) {
		console.error("❌ Error reading or parsing file:", error);
		if (error instanceof Error) {
			console.error(`   ${error.message}`);
		}
		process.exit(1);
	}

	const texts = data.texts;
	console.log(`Total texts: ${texts.length}\n`);

	// Validate and fix word counts
	const errors: Array<{
		index: number;
		content: string;
		expected: number;
		actual: number;
	}> = [];

	let fixedCount = 0;

	for (let index = 0; index < texts.length; index++) {
		const text = texts[index];
		const actualWordCount = calculateWordCount(text.content);
		if (actualWordCount !== text.word_count) {
			errors.push({
				index: index + 1,
				content: `${text.content.substring(0, 50)}...`,
				expected: text.word_count,
				actual: actualWordCount,
			});
			// Fix the word count
			text.word_count = actualWordCount;
			fixedCount++;
		}
	}

	// Report errors and fixes
	if (errors.length > 0) {
		console.log("❌ Word Count Mismatches Found:\n");
		for (const error of errors) {
			console.log(`  Text #${error.index}:`);
			console.log(`    Was: ${error.expected}, Now: ${error.actual} ✅ Fixed`);
			console.log(`    Content: "${error.content}"`);
			console.log();
		}
		console.log(`📝 Fixed ${fixedCount} word count(s)\n`);
	} else {
		console.log("✅ All word counts are correct!\n");
	}

	// Write corrected data back to file if there were fixes
	if (fixedCount > 0) {
		try {
			const correctedJson = `${JSON.stringify(data, null, "\t")}\n`;
			writeFileSync(filePath, correctedJson, "utf-8");
			console.log(`💾 Saved corrected file: ${filePath}\n`);
		} catch (error) {
			console.error("❌ Error writing file:", error);
			process.exit(1);
		}
	}

	// Distribution analysis
	console.log("=".repeat(60));
	console.log("📈 Word Count Distribution\n");

	// Overall distribution
	const wordCounts = texts.map((t) => t.word_count);
	const min = Math.min(...wordCounts);
	const max = Math.max(...wordCounts);
	const avg = wordCounts.reduce((a, b) => a + b, 0) / wordCounts.length;

	console.log("Overall Statistics:");
	console.log(`  Min: ${min} words`);
	console.log(`  Max: ${max} words`);
	console.log(`  Average: ${avg.toFixed(2)} words`);
	console.log();

	// Distribution by length category
	const lengthCategoryCounts: Record<string, number> = {};
	const lengthCategoryRanges: Record<string, { min: number; max: number }> = {};

	for (const text of texts) {
		const category = determineLengthCategory(text.word_count);
		lengthCategoryCounts[category] = (lengthCategoryCounts[category] || 0) + 1;

		if (!lengthCategoryRanges[category]) {
			lengthCategoryRanges[category] = {
				min: text.word_count,
				max: text.word_count,
			};
		} else {
			lengthCategoryRanges[category].min = Math.min(
				lengthCategoryRanges[category].min,
				text.word_count,
			);
			lengthCategoryRanges[category].max = Math.max(
				lengthCategoryRanges[category].max,
				text.word_count,
			);
		}
	}

	console.log("By Length Category:");
	for (const category of ["short", "medium", "long"] as const) {
		const count = lengthCategoryCounts[category] || 0;
		const range = lengthCategoryRanges[category];
		const percentage = ((count / texts.length) * 100).toFixed(1);
		console.log(
			`  ${category.padEnd(10)}: ${count.toString().padStart(3)} texts (${percentage.padStart(5)}%) - Range: ${range?.min || 0}-${range?.max || 0} words`,
		);
	}
	console.log();

	// Distribution by difficulty
	const difficultyCounts: Record<string, number> = {};
	const difficultyStats: Record<
		string,
		{ min: number; max: number; avg: number; total: number }
	> = {};

	for (const text of texts) {
		const diff = text.difficulty;
		difficultyCounts[diff] = (difficultyCounts[diff] || 0) + 1;

		if (!difficultyStats[diff]) {
			difficultyStats[diff] = {
				min: text.word_count,
				max: text.word_count,
				avg: text.word_count,
				total: text.word_count,
			};
		} else {
			difficultyStats[diff].min = Math.min(
				difficultyStats[diff].min,
				text.word_count,
			);
			difficultyStats[diff].max = Math.max(
				difficultyStats[diff].max,
				text.word_count,
			);
			difficultyStats[diff].total += text.word_count;
		}
	}

	for (const diff of Object.keys(difficultyStats)) {
		difficultyStats[diff].avg =
			difficultyStats[diff].total / difficultyCounts[diff];
	}

	console.log("By Difficulty:");
	for (const diff of ["beginner", "intermediate", "advanced"] as const) {
		const count = difficultyCounts[diff] || 0;
		const stats = difficultyStats[diff];
		const percentage = ((count / texts.length) * 100).toFixed(1);
		if (stats) {
			console.log(
				`  ${diff.padEnd(12)}: ${count.toString().padStart(3)} texts (${percentage.padStart(5)}%) - Avg: ${stats.avg.toFixed(1)}, Range: ${stats.min}-${stats.max} words`,
			);
		}
	}
	console.log();

	// Distribution by type
	const typeCounts: Record<string, number> = {};
	const typeStats: Record<
		string,
		{ min: number; max: number; avg: number; total: number }
	> = {};

	for (const text of texts) {
		const type = text.type;
		typeCounts[type] = (typeCounts[type] || 0) + 1;

		if (!typeStats[type]) {
			typeStats[type] = {
				min: text.word_count,
				max: text.word_count,
				avg: text.word_count,
				total: text.word_count,
			};
		} else {
			typeStats[type].min = Math.min(typeStats[type].min, text.word_count);
			typeStats[type].max = Math.max(typeStats[type].max, text.word_count);
			typeStats[type].total += text.word_count;
		}
	}

	for (const type of Object.keys(typeStats)) {
		typeStats[type].avg = typeStats[type].total / typeCounts[type];
	}

	console.log("By Type:");
	const sortedTypes = Object.keys(typeStats).sort();
	for (const type of sortedTypes) {
		const count = typeCounts[type];
		const stats = typeStats[type];
		const percentage = ((count / texts.length) * 100).toFixed(1);
		console.log(
			`  ${type.padEnd(20)}: ${count.toString().padStart(3)} texts (${percentage.padStart(5)}%) - Avg: ${stats.avg.toFixed(1)}, Range: ${stats.min}-${stats.max} words`,
		);
	}
	console.log();

	// Word count histogram
	console.log("Word Count Histogram:");
	const histogram: Record<number, number> = {};
	for (const count of wordCounts) {
		histogram[count] = (histogram[count] || 0) + 1;
	}

	const sortedCounts = Object.keys(histogram)
		.map(Number)
		.sort((a, b) => a - b);

	const maxHistValue = Math.max(...Object.values(histogram));
	const barLength = 40;

	for (const count of sortedCounts) {
		const frequency = histogram[count];
		const bar = "█".repeat(Math.round((frequency / maxHistValue) * barLength));
		console.log(`  ${count.toString().padStart(2)} words: ${bar} ${frequency}`);
	}

	console.log();
	console.log("=".repeat(60));

	// Summary
	if (fixedCount > 0) {
		console.log(
			`\n✅ Fixed ${fixedCount} word count(s) and saved to file. Validation complete!`,
		);
	} else {
		console.log("\n✅ Validation complete! All word counts are correct.");
	}
}

main();
