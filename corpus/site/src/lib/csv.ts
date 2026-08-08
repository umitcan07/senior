// CSV export for concordance tables.
//
// The audience opens these in Excel, and every interesting column is IPA, so the
// file is written UTF-8 *with* a BOM — without it Excel decodes as the system
// codepage and the phone symbols arrive as mojibake.

export interface Column<T> {
	header: string;
	value: (row: T) => string | number | null | undefined;
}

function escape(cell: string | number | null | undefined): string {
	if (cell === null || cell === undefined) return "";
	const s = String(cell);
	return /[",\r\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
}

export function toCsv<T>(rows: T[], columns: Column<T>[]): string {
	const lines = [columns.map((c) => escape(c.header)).join(",")];
	for (const row of rows) {
		lines.push(columns.map((c) => escape(c.value(row))).join(","));
	}
	return lines.join("\r\n");
}

const BOM = "﻿";

export function downloadCsv(filename: string, csv: string): void {
	const blob = new Blob([BOM + csv], { type: "text/csv;charset=utf-8" });
	const url = URL.createObjectURL(blob);
	const a = document.createElement("a");
	a.href = url;
	a.download = filename;
	document.body.appendChild(a);
	a.click();
	a.remove();
	URL.revokeObjectURL(url);
}

// Characters Windows rejects in a filename. Unicode is otherwise kept — every
// modern filesystem takes `θ` happily, and folding to ASCII would collapse most
// of the phone inventory onto the same name.
const UNSAFE_IN_FILENAME = new Set(['<', '>', ':', '"', '/', '\\', '|', '?', '*']);

export function slugForFile(s: string): string {
	let out = "";
	for (const ch of s) {
		// `ch <= " "` catches the space and every control character.
		out += UNSAFE_IN_FILENAME.has(ch) || ch <= " " ? "-" : ch;
	}
	return out.replace(/^[-.]+/, "").replace(/[-.]+$/, "") || "export";
}
