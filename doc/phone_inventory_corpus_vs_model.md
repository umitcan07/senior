# Phone inventories: fine-tune corpus annotation vs POWSM model output

Reference for re-annotating the **125 test clips** (100 Turkish-L1 learner + 25 native reference) with the Turkish vowel **ı/ɯ** actively marked. Compares what the fine-tune corpus annotation *used* against what POWSM *actually outputs* on the test clips.

**Key gap for annotation:** `ɯ` (U+026F) occurs **0×** in corpus labels and **0×** in model output; `ɨ` 0/0; `ɤ` 0/0. `ı` (U+0131) occurs 49× in corpus labels, 0× in model output. The model is blind to the Turkish back-unrounded vowel — the new annotation must introduce it from audio, not from model output.

**Annotation convention (decided):** mark Turkish **ı/ɯ** from the audio; use **monophthongs**, and write diphthongs as **`eɪ oʊ aɪ aʊ ɔɪ`** (ɪ/ʊ vowel offglide, split into monophthong pairs) — **not** the corpus's `ej ow aj aw` (consonant glide j/w). This matches POWSM's monophthong output and `mod/alignment.py:_tokenize_ipa` (which requires e.g. `['o','ʊ']`, not `oʊ`). Note: the corpus also leans on `ʉː` (1593×) and `ɐ` (2375×) for central vowels and `spn` for spoken-noise — decide explicitly how new `ɯ`/`ı` relate to those.

---
## A. Fine-tune corpus annotation inventory

Source: 60 PRAAT TextGrids under `Corpus Files/` (TASK1 `phones` + TASK2 `REF-phones` tiers), 97444 labeled intervals. One row per distinct annotation label (per-interval granularity; multi-codepoint = diphthong / affricate / diacritic-phone, or a non-phone marker like `sil`/`spn`). **121 distinct labels.**

| # | label | count | codepoints |
|---|---|---|---|
| 1 | `ɪ` | 6957 | U+026A |
| 2 | `n` | 6114 | U+006E |
| 3 | `ə` | 5623 | U+0259 |
| 4 | `s` | 5330 | U+0073 |
| 5 | `t` | 4312 | U+0074 |
| 6 | `ɹ` | 3742 | U+0279 |
| 7 | `z` | 3090 | U+007A |
| 8 | `d` | 2833 | U+0064 |
| 9 | `ej` | 2805 | U+0065 U+006A |
| 10 | `ɛ` | 2637 | U+025B |
| 11 | `æ` | 2437 | U+00E6 |
| 12 | `iː` | 2399 | U+0069 U+02D0 |
| 13 | `w` | 2397 | U+0077 |
| 14 | `ɐ` | 2375 | U+0250 |
| 15 | `m` | 2240 | U+006D |
| 16 | `k` | 1960 | U+006B |
| 17 | `spn` | 1898 | U+0073 U+0070 U+006E |
| 18 | `ð` | 1786 | U+00F0 |
| 19 | `i` | 1782 | U+0069 |
| 20 | `f` | 1707 | U+0066 |
| 21 | `ɑ` | 1595 | U+0251 |
| 22 | `ɫ` | 1595 | U+026B |
| 23 | `ʉː` | 1593 | U+0289 U+02D0 |
| 24 | `ow` | 1444 | U+006F U+0077 |
| 25 | `ɚ` | 1430 | U+025A |
| 26 | `d̪` | 1369 | U+0064 U+032A |
| 27 | `b` | 1305 | U+0062 |
| 28 | `aj` | 1245 | U+0061 U+006A |
| 29 | `ɒ` | 1214 | U+0252 |
| 30 | `tʃ` | 1199 | U+0074 U+0283 |
| 31 | `ʊ` | 1176 | U+028A |
| 32 | `l` | 1047 | U+006C |
| 33 | `j` | 947 | U+006A |
| 34 | `p` | 941 | U+0070 |
| 35 | `v` | 921 | U+0076 |
| 36 | `h` | 866 | U+0068 |
| 37 | `ç` | 836 | U+00E7 |
| 38 | `ɡ` | 836 | U+0261 |
| 39 | `ŋ` | 820 | U+014B |
| 40 | `ʎ` | 687 | U+028E |
| 41 | `pʰ` | 643 | U+0070 U+02B0 |
| 42 | `aw` | 589 | U+0061 U+0077 |
| 43 | `cʰ` | 573 | U+0063 U+02B0 |
| 44 | `ɝ` | 527 | U+025D |
| 45 | `tʰ` | 522 | U+0074 U+02B0 |
| 46 | `tʲ` | 517 | U+0074 U+02B2 |
| 47 | `kʰ` | 516 | U+006B U+02B0 |
| 48 | `ɲ` | 481 | U+0272 |
| 49 | `mʲ` | 480 | U+006D U+02B2 |
| 50 | `ʃ` | 471 | U+0283 |
| 51 | `dʒ` | 447 | U+0064 U+0292 |
| 52 | `t̪` | 404 | U+0074 U+032A |
| 53 | `vʲ` | 334 | U+0076 U+02B2 |
| 54 | `ʉ` | 317 | U+0289 |
| 55 | `dʲ` | 303 | U+0064 U+02B2 |
| 56 | `bʲ` | 301 | U+0062 U+02B2 |
| 57 | `n̩` | 293 | U+006E U+0329 |
| 58 | `fʲ` | 284 | U+0066 U+02B2 |
| 59 | `c` | 247 | U+0063 |
| 60 | `ɟ` | 218 | U+025F |
| 61 | `cʷ` | 215 | U+0063 U+02B7 |
| 62 | `ɾ` | 165 | U+027E |
| 63 | `ɒː` | 160 | U+0252 U+02D0 |
| 64 | `ɔj` | 135 | U+0254 U+006A |
| 65 | `θ` | 131 | U+03B8 |
| 66 | `pʲ` | 129 | U+0070 U+02B2 |
| 67 | `ɑː` | 74 | U+0251 U+02D0 |
| 68 | `ʒ` | 69 | U+0292 |
| 69 | `ɫ̩` | 68 | U+026B U+0329 |
| 70 | `ɾ̃` | 59 | U+027E U+0303 |
| 71 | `ı` | 49 | U+0131 |
| 72 | `ɾʲ` | 38 | U+027E U+02B2 |
| 73 | `ɜː` | 18 | U+025C U+02D0 |
| 74 | `ɖ` | 18 | U+0256 |
| 75 | `a` | 18 | U+0061 |
| 76 | `m̩` | 18 | U+006D U+0329 |
| 77 | `i:` | 17 | U+0069 U+003A |
| 78 | `ʌ` | 15 | U+028C |
| 79 | `ʧ` | 14 | U+02A7 |
| 80 | `r` | 11 | U+0072 |
| 81 | `g` | 8 | U+0067 |
| 82 | `œ` | 4 | U+0153 |
| 83 | `rd` | 4 | U+0072 U+0064 |
| 84 | `ʤ` | 3 | U+02A4 |
| 85 | `u` | 3 | U+0075 |
| 86 | `ɳ` | 3 | U+0273 |
| 87 | `ɑw` | 2 | U+0251 U+0077 |
| 88 | `aʊ` | 2 | U+0061 U+028A |
| 89 | `q` | 2 | U+0071 |
| 90 | `e` | 2 | U+0065 |
| 91 | `ɠ` | 2 | U+0260 |
| 92 | `tʷ` | 2 | U+0074 U+02B7 |
| 93 | `nsıd` | 1 | U+006E U+0073 U+0131 U+0064 |
| 94 | `ᴊ` | 1 | U+1D0A |
| 95 | `aː` | 1 | U+0061 U+02D0 |
| 96 | `nt` | 1 | U+006E U+0074 |
| 97 | `ɜː d` | 1 | U+025C U+02D0 U+0020 U+0064 |
| 98 | `zing` | 1 | U+007A U+0069 U+006E U+0067 |
| 99 | `o` | 1 | U+006F |
| 100 | `ɛj` | 1 | U+025B U+006A |
| 101 | `st` | 1 | U+0073 U+0074 |
| 102 | `ö` | 1 | U+00F6 |
| 103 | `rt` | 1 | U+0072 U+0074 |
| 104 | `ʉ:` | 1 | U+0289 U+003A |
| 105 | `ɜ` | 1 | U+025C |
| 106 | `ɑj` | 1 | U+0251 U+006A |
| 107 | `rk` | 1 | U+0072 U+006B |
| 108 | `eı` | 1 | U+0065 U+0131 |
| 109 | `nə` | 1 | U+006E U+0259 |
| 110 | `dv` | 1 | U+0064 U+0076 |
| 111 | `t ö d` | 1 | U+0074 U+0020 U+00F6 U+0020 U+0064 |
| 112 | `his` | 1 | U+0068 U+0069 U+0073 |
| 113 | `u:` | 1 | U+0075 U+003A |
| 114 | `retn` | 1 | U+0072 U+0065 U+0074 U+006E |
| 115 | `ə-` | 1 | U+0259 U+002D |
| 116 | `pt` | 1 | U+0070 U+0074 |
| 117 | `ɔ` | 1 | U+0254 |
| 118 | `ai` | 1 | U+0061 U+0069 |
| 119 | `lɪ` | 1 | U+006C U+026A |
| 120 | `ʤə` | 1 | U+02A4 U+0259 |
| 121 | `əɾ` | 1 | U+0259 U+027E |

---
## B. POWSM model output inventory (test clips)

Source: `mod/dev/poc_cache/learner_phones.json` — 100 learner recordings (`user_phones`: erem/omer/umit/ibrahim) + 25 native reference recordings (`ref_phones`: genam_katherine). POWSM free-alignment; word-boundary `▁` stripped. **74 distinct tokens** (learner 74, reference 46).

| # | token | total | learner | reference | codepoints | panphon |
|---|---|---|---|---|---|---|
| 1 | `ə` | 377 | 314 | 63 | U+0259 | yes |
| 2 | `ɪ` | 272 | 220 | 52 | U+026A | yes |
| 3 | `t` | 257 | 204 | 53 | U+0074 | yes |
| 4 | `ɹ` | 231 | 194 | 37 | U+0279 | yes |
| 5 | `n` | 222 | 175 | 47 | U+006E | yes |
| 6 | `l` | 203 | 143 | 60 | U+006C | yes |
| 7 | `i` | 197 | 150 | 47 | U+0069 | yes |
| 8 | `a` | 145 | 119 | 26 | U+0061 | yes |
| 9 | `s` | 145 | 114 | 31 | U+0073 | yes |
| 10 | `w` | 142 | 122 | 20 | U+0077 | yes |
| 11 | `j` | 127 | 114 | 13 | U+006A | yes |
| 12 | `d` | 121 | 94 | 27 | U+0064 | yes |
| 13 | `m` | 113 | 88 | 25 | U+006D | yes |
| 14 | `ð` | 108 | 80 | 28 | U+00F0 | yes |
| 15 | `f` | 105 | 83 | 22 | U+0066 | yes |
| 16 | `e` | 103 | 92 | 11 | U+0065 | yes |
| 17 | `k` | 97 | 72 | 25 | U+006B | yes |
| 18 | `ɛ` | 96 | 77 | 19 | U+025B | yes |
| 19 | `o` | 95 | 83 | 12 | U+006F | yes |
| 20 | `ʃ` | 90 | 73 | 17 | U+0283 | yes |
| 21 | `p` | 88 | 62 | 26 | U+0070 | yes |
| 22 | `æ` | 83 | 70 | 13 | U+00E6 | yes |
| 23 | `ŋ` | 79 | 63 | 16 | U+014B | yes |
| 24 | `ɑ` | 75 | 59 | 16 | U+0251 | yes |
| 25 | `ʊ` | 75 | 53 | 22 | U+028A | yes |
| 26 | `kʰ` | 72 | 55 | 17 | U+006B U+02B0 | yes |
| 27 | `ɔ` | 71 | 49 | 22 | U+0254 | yes |
| 28 | `ɡ` | 65 | 54 | 11 | U+0261 | yes |
| 29 | `z` | 62 | 53 | 9 | U+007A | yes |
| 30 | `b` | 62 | 57 | 5 | U+0062 | yes |
| 31 | `tʰ` | 60 | 43 | 17 | U+0074 U+02B0 | yes |
| 32 | `ʎ` | 57 | 57 | 0 | U+028E | yes |
| 33 | `v` | 53 | 40 | 13 | U+0076 | yes |
| 34 | `d̪` | 47 | 47 | 0 | U+0064 U+032A | yes |
| 35 | `u` | 44 | 25 | 19 | U+0075 | yes |
| 36 | `l̴` | 36 | 36 | 0 | U+006C U+0334 | yes |
| 37 | `h` | 32 | 24 | 8 | U+0068 | yes |
| 38 | `θ` | 30 | 24 | 6 | U+03B8 | yes |
| 39 | `ə˞` | 25 | 3 | 22 | U+0259 U+02DE | yes |
| 40 | `pʰ` | 25 | 17 | 8 | U+0070 U+02B0 | yes |
| 41 | `ɜ˞` | 24 | 24 | 0 | U+025C U+02DE | yes |
| 42 | `ɪ̃` | 20 | 7 | 13 | U+026A U+0303 | yes |
| 43 | `ʌ` | 18 | 6 | 12 | U+028C | yes |
| 44 | `ɒ` | 16 | 16 | 0 | U+0252 | yes |
| 45 | `ɐ` | 16 | 16 | 0 | U+0250 | yes |
| 46 | `ɲ` | 15 | 15 | 0 | U+0272 | yes |
| 47 | `bʲ` | 13 | 13 | 0 | U+0062 U+02B2 | yes |
| 48 | `ɔ̃` | 12 | 10 | 2 | U+0254 U+0303 | yes |
| 49 | `ʊ̃` | 12 | 6 | 6 | U+028A U+0303 | yes |
| 50 | `ʒ` | 11 | 9 | 2 | U+0292 | yes |
| 51 | `cʰ` | 11 | 11 | 0 | U+0063 U+02B0 | yes |
| 52 | `c` | 10 | 10 | 0 | U+0063 | yes |
| 53 | `ɛ̃` | 8 | 3 | 5 | U+025B U+0303 | yes |
| 54 | `mʲ` | 8 | 8 | 0 | U+006D U+02B2 | yes |
| 55 | `r` | 6 | 6 | 0 | U+0072 | yes |
| 56 | `ɑ̃` | 5 | 3 | 2 | U+0251 U+0303 | yes |
| 57 | `fʲ` | 4 | 4 | 0 | U+0066 U+02B2 | yes |
| 58 | `ṳ` | 4 | 4 | 0 | U+0075 U+0324 | yes |
| 59 | `æ̃` | 3 | 2 | 1 | U+00E6 U+0303 | yes |
| 60 | `vʲ` | 3 | 3 | 0 | U+0076 U+02B2 | yes |
| 61 | `dʲ` | 3 | 3 | 0 | U+0064 U+02B2 | yes |
| 62 | `o̤` | 3 | 3 | 0 | U+006F U+0324 | yes |
| 63 | `b̤` | 3 | 3 | 0 | U+0062 U+0324 | yes |
| 64 | `ʉ` | 3 | 3 | 0 | U+0289 | yes |
| 65 | `t͡ʃ` | 3 | 3 | 0 | U+0074 U+0361 U+0283 | yes |
| 66 | `ʃʰ` | 2 | 2 | 0 | U+0283 U+02B0 | yes |
| 67 | `pʲ` | 2 | 2 | 0 | U+0070 U+02B2 | yes |
| 68 | `t̪` | 2 | 2 | 0 | U+0074 U+032A | yes |
| 69 | `ɟ` | 2 | 2 | 0 | U+025F | yes |
| 70 | `ũ` | 2 | 1 | 1 | U+0075 U+0303 | yes |
| 71 | `lʲ` | 1 | 1 | 0 | U+006C U+02B2 | yes |
| 72 | `bˠ` | 1 | 1 | 0 | U+0062 U+02E0 | yes |
| 73 | `kʲ` | 1 | 1 | 0 | U+006B U+02B2 | yes |
| 74 | `nʲ` | 1 | 1 | 0 | U+006E U+02B2 | yes |

