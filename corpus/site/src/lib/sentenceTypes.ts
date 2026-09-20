import type { TokenRow } from "./types.ts";

// Reviewed read-aloud target variants only; never overwrite source annotations.
// These are editorial suggestions, not corpus-compiler labels.
const suggestions: Record<string, string> = {
  "where is the wolf": "Wh Question",
  "have you really seen a wolf": "Yes/No Question",
  "was there a wolf or not": "Alternative Question",
  "you're fooling us again aren't you": "Tag Question",
  "you are f fooling us again are aren't you": "Tag Question",
  "go away and don't bother us again": "Imperative",
  "the wolf had a feast": "Statement",
  "you are fooling us again aren't you": "Tag Question",
  "was there wolf or not": "Alternative Question",
  "you are fooling us again are not you": "Tag Question",
  "go away and do bother us again": "Imperative",
  "go away and do not bother us again": "Imperative",
  "go away and don't [uh] bother us again": "Imperative",
  "the wolf had a": "Statement",
  "have you real seen a wolf": "Yes/No Question",
  "was there a w wolf or not": "Alternative Question",
  "you are for fooling us again aren't you": "Tag Question",
  "go away and don't br bother us again": "Imperative",
  "go away and don't bother don't bother us again": "Imperative"
};

export function sentenceTypeLabel(token: TokenRow): string {
 if (token.sentenceType) return token.sentenceType;
 if (!/^S\d+T1_intonation_/.test(token.id)) return "Not annotated";
 const suggested = suggestions[token.w ?? ""];
 return suggested ? `${suggested} (suggested)` : "Not annotated";
}
