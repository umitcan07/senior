import assert from "node:assert/strict";
import { readFileSync, readdirSync } from "node:fs";
import test from "node:test";
import { filterTask, recordingTasks, tokenStats } from "../src/lib/taskFilter.ts";

const data = new URL("../../../app/public/corptes/data/", import.meta.url);
const read = (path) => JSON.parse(readFileSync(new URL(path, data), "utf8"));

test("task lookup agrees with source metadata for every ordinary and dedicated clip", () => {
	const tasks = recordingTasks(read("manifest.json"));
	for (const file of readdirSync(new URL("utterances/", data))) {
		const detail = read(`utterances/${file}`);
		assert.equal(tasks.get(detail.id.split("_")[0]), detail.task, detail.id);
	}
});

test("all five concordance areas partition into tasks without losing annotations or changing totals", () => {
	const tasks = recordingTasks(read("manifest.json"));
	for (const area of ["vowels", "consonants", "stress", "linking", "intonation"]) {
		for (const file of readdirSync(new URL(`tokens/${area}/`, data))) {
			const rows = read(`tokens/${area}/${encodeURIComponent(file)}`);
			const readAloud = filterTask(rows, "T1", tasks);
			const interview = filterTask(rows, "T2", tasks);
			assert.equal(readAloud.length + interview.length, rows.length, `${area}/${file}`);
			const ids = new Set(readAloud.map((row) => row.id));
			assert.ok(interview.every((row) => !ids.has(row.id)));
			const all = tokenStats("", rows);
			const first = tokenStats("", readAloud);
			const second = tokenStats("", interview);
			assert.equal(first.correct + second.correct, all.correct);
			assert.equal(first.incorrect + second.incorrect, all.incorrect);
		}
	}
});

test("unknown task metadata stays in All and empty selections have no accuracy", () => {
	const rows = [{ id: "unknown", u: "unknown_001", e: "incorrect" }];
	assert.equal(filterTask(rows, "all", new Map()).length, 1);
	assert.deepEqual(filterTask(rows, "T1", new Map()), []);
	assert.equal(tokenStats("", []).accuracy, null);
});
