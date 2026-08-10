// A deliberately small Markdown renderer.
//
// The only Markdown this site renders is the hand-written corpus description in
// src/content/, so it supports exactly the forms that page needs: ##/### headings,
// paragraphs, bullet and numbered lists, blockquote callouts, rules, and inline
// **bold** / *italic* / `code` / [links](url). Anything else falls through as
// literal text. It returns React nodes and never raw HTML, so there is no
// injection surface and no Markdown dependency to keep current.

import type { ReactNode } from "react";

type Block =
	| { kind: "heading"; level: 2 | 3; text: string }
	| { kind: "para"; text: string }
	| { kind: "list"; ordered: boolean; items: string[] }
	| { kind: "quote"; text: string }
	| { kind: "rule" };

const BULLET = /^[-*]\s+(.*)$/;
const NUMBERED = /^\d+\.\s+(.*)$/;
const HEADING = /^(#{1,6})\s+(.*)$/;
const RULE = /^-{3,}\s*$/;
const QUOTE = /^>\s?/;

function startsBlock(line: string): boolean {
	return (
		HEADING.test(line) ||
		RULE.test(line) ||
		QUOTE.test(line) ||
		BULLET.test(line) ||
		NUMBERED.test(line)
	);
}

function parse(src: string): Block[] {
	const blocks: Block[] = [];
	const lines = src.replace(/\r\n/g, "\n").split("\n");
	let i = 0;

	while (i < lines.length) {
		const line = lines[i] ?? "";

		if (line.trim() === "") {
			i++;
			continue;
		}

		if (RULE.test(line)) {
			blocks.push({ kind: "rule" });
			i++;
			continue;
		}

		const heading = HEADING.exec(line);
		if (heading) {
			blocks.push({
				kind: "heading",
				level: (heading[1] ?? "").length <= 2 ? 2 : 3,
				text: (heading[2] ?? "").trim(),
			});
			i++;
			continue;
		}

		if (QUOTE.test(line)) {
			const buf: string[] = [];
			while (i < lines.length && QUOTE.test(lines[i] ?? "")) {
				buf.push((lines[i] ?? "").replace(QUOTE, ""));
				i++;
			}
			blocks.push({ kind: "quote", text: buf.join(" ").trim() });
			continue;
		}

		if (BULLET.test(line) || NUMBERED.test(line)) {
			const ordered = NUMBERED.test(line);
			const re = ordered ? NUMBERED : BULLET;
			const items: string[] = [];
			while (i < lines.length) {
				const m = re.exec(lines[i] ?? "");
				if (!m) break;
				let text = m[1] ?? "";
				i++;
				// Indented continuation lines belong to the item above.
				while (i < lines.length && /^\s{2,}\S/.test(lines[i] ?? "")) {
					text += ` ${(lines[i] ?? "").trim()}`;
					i++;
				}
				items.push(text);
			}
			blocks.push({ kind: "list", ordered, items });
			continue;
		}

		const buf: string[] = [];
		while (i < lines.length) {
			const l = lines[i] ?? "";
			if (l.trim() === "" || startsBlock(l)) break;
			buf.push(l.trim());
			i++;
		}
		blocks.push({ kind: "para", text: buf.join(" ") });
	}

	return blocks;
}

/** Split a line into plain runs and the inline spans we support. */
function inline(text: string, keyPrefix: string): ReactNode[] {
	const re = /(\*\*[^*]+\*\*|\*[^*\n]+\*|`[^`]+`|\[[^\]]+\]\([^)\s]+\))/g;
	const out: ReactNode[] = [];
	let last = 0;
	let n = 0;
	let m: RegExpExecArray | null = re.exec(text);

	while (m !== null) {
		if (m.index > last) out.push(text.slice(last, m.index));
		const tok = m[0];
		const key = `${keyPrefix}-${n++}`;

		if (tok.startsWith("**")) {
			out.push(
				<strong key={key} className="font-medium text-[var(--color-ink)]">
					{tok.slice(2, -2)}
				</strong>,
			);
		} else if (tok.startsWith("`")) {
			out.push(
				<code
					key={key}
					className="rounded-[2px] bg-[var(--color-paper-deep)] px-1 py-0.5 font-mono text-[0.85em]"
				>
					{tok.slice(1, -1)}
				</code>,
			);
		} else if (tok.startsWith("[")) {
			const link = /^\[([^\]]+)\]\(([^)\s]+)\)$/.exec(tok);
			const href = link?.[2] ?? "#";
			const external = /^https?:/.test(href);
			out.push(
				<a
					key={key}
					href={href}
					{...(external
						? { target: "_blank", rel: "noreferrer noopener" }
						: null)}
					className="text-[var(--color-accent)] underline underline-offset-2 hover:no-underline"
				>
					{link?.[1] ?? tok}
				</a>,
			);
		} else {
			out.push(<em key={key}>{tok.slice(1, -1)}</em>);
		}

		last = m.index + tok.length;
		m = re.exec(text);
	}

	if (last < text.length) out.push(text.slice(last));
	return out;
}

export function Markdown({ source }: { source: string }) {
	const blocks = parse(source);

	return (
		<div className="space-y-4">
			{blocks.map((b, i) => {
				const key = `b${i}`;
				switch (b.kind) {
					case "heading":
						return b.level === 2 ? (
							<h2
								key={key}
								className="mt-8 border-[var(--color-rule)] border-b pb-1.5 font-display text-xl first:mt-0"
							>
								{inline(b.text, key)}
							</h2>
						) : (
							<h3
								key={key}
								className="mt-6 font-display text-[1.05rem] text-[var(--color-ink)]"
							>
								{inline(b.text, key)}
							</h3>
						);
					case "para":
						return (
							<p
								key={key}
								className="font-body text-[0.95rem] text-[var(--color-ink-soft)] leading-relaxed"
							>
								{inline(b.text, key)}
							</p>
						);
					case "list": {
						const cls =
							"ml-5 space-y-1.5 font-body text-[0.95rem] text-[var(--color-ink-soft)] leading-relaxed";
						const items = b.items.map((item, j) => (
							// biome-ignore lint/suspicious/noArrayIndexKey: static document, order is stable
							<li key={j} className="pl-1">
								{inline(item, `${key}-${j}`)}
							</li>
						));
						return b.ordered ? (
							<ol key={key} className={`list-decimal ${cls}`}>
								{items}
							</ol>
						) : (
							<ul key={key} className={`list-disc ${cls}`}>
								{items}
							</ul>
						);
					}
					case "quote":
						return (
							<blockquote
								key={key}
								className="rounded-[var(--radius-card)] border-[var(--color-insert)] border-l-2 bg-[var(--color-insert-wash)] px-4 py-3 font-body text-[0.9rem] text-[var(--color-ink-soft)] leading-relaxed"
							>
								{inline(b.text, key)}
							</blockquote>
						);
					case "rule":
						return (
							<hr
								key={key}
								className="my-8 border-[var(--color-rule)] border-t"
							/>
						);
				}
			})}
		</div>
	);
}
