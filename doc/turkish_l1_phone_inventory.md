# Turkish-L1 IPA output vocabulary (POWSM free-alignment)

Every distinct IPA token the model emitted when transcribing **100 Turkish-L1 learner clips** (erem, omer, umit, ibrahim). Source: `mod/dev/poc_cache/learner_phones.json` (`user_phones`), model `espnet/powsm`, adapter `/worker/assessment/adapter`. POWSM's word-boundary marker `▁` is stripped per repo convention. Regenerate with `poc_feature_diff.py --emit-learner` then re-run this extraction.

**74 unique tokens**, 3706 total occurrences. PanPhon-covered (vectorizes to one segment, after NORM_MAP): **74/74** (all covered).

Per speaker (unique / occurrences): erem 64/952, omer 57/895, umit 53/932, ibrahim 62/927

| # | token | count | codepoints | panphon |
|---|---|---|---|---|
| 1 | `ə` | 314 | U+0259 | yes |
| 2 | `ɪ` | 220 | U+026A | yes |
| 3 | `t` | 204 | U+0074 | yes |
| 4 | `ɹ` | 194 | U+0279 | yes |
| 5 | `n` | 175 | U+006E | yes |
| 6 | `i` | 150 | U+0069 | yes |
| 7 | `l` | 143 | U+006C | yes |
| 8 | `w` | 122 | U+0077 | yes |
| 9 | `a` | 119 | U+0061 | yes |
| 10 | `j` | 114 | U+006A | yes |
| 11 | `s` | 114 | U+0073 | yes |
| 12 | `d` | 94 | U+0064 | yes |
| 13 | `e` | 92 | U+0065 | yes |
| 14 | `m` | 88 | U+006D | yes |
| 15 | `f` | 83 | U+0066 | yes |
| 16 | `o` | 83 | U+006F | yes |
| 17 | `ð` | 80 | U+00F0 | yes |
| 18 | `ɛ` | 77 | U+025B | yes |
| 19 | `ʃ` | 73 | U+0283 | yes |
| 20 | `k` | 72 | U+006B | yes |
| 21 | `æ` | 70 | U+00E6 | yes |
| 22 | `ŋ` | 63 | U+014B | yes |
| 23 | `p` | 62 | U+0070 | yes |
| 24 | `ɑ` | 59 | U+0251 | yes |
| 25 | `b` | 57 | U+0062 | yes |
| 26 | `ʎ` | 57 | U+028E | yes |
| 27 | `kʰ` | 55 | U+006B U+02B0 | yes |
| 28 | `ɡ` | 54 | U+0261 | yes |
| 29 | `z` | 53 | U+007A | yes |
| 30 | `ʊ` | 53 | U+028A | yes |
| 31 | `ɔ` | 49 | U+0254 | yes |
| 32 | `d̪` | 47 | U+0064 U+032A | yes |
| 33 | `tʰ` | 43 | U+0074 U+02B0 | yes |
| 34 | `v` | 40 | U+0076 | yes |
| 35 | `l̴` | 36 | U+006C U+0334 | yes |
| 36 | `u` | 25 | U+0075 | yes |
| 37 | `h` | 24 | U+0068 | yes |
| 38 | `θ` | 24 | U+03B8 | yes |
| 39 | `ɜ˞` | 24 | U+025C U+02DE | yes |
| 40 | `pʰ` | 17 | U+0070 U+02B0 | yes |
| 41 | `ɒ` | 16 | U+0252 | yes |
| 42 | `ɐ` | 16 | U+0250 | yes |
| 43 | `ɲ` | 15 | U+0272 | yes |
| 44 | `bʲ` | 13 | U+0062 U+02B2 | yes |
| 45 | `cʰ` | 11 | U+0063 U+02B0 | yes |
| 46 | `c` | 10 | U+0063 | yes |
| 47 | `ɔ̃` | 10 | U+0254 U+0303 | yes |
| 48 | `ʒ` | 9 | U+0292 | yes |
| 49 | `mʲ` | 8 | U+006D U+02B2 | yes |
| 50 | `ɪ̃` | 7 | U+026A U+0303 | yes |
| 51 | `ʌ` | 6 | U+028C | yes |
| 52 | `ʊ̃` | 6 | U+028A U+0303 | yes |
| 53 | `r` | 6 | U+0072 | yes |
| 54 | `fʲ` | 4 | U+0066 U+02B2 | yes |
| 55 | `ṳ` | 4 | U+0075 U+0324 | yes |
| 56 | `ə˞` | 3 | U+0259 U+02DE | yes |
| 57 | `vʲ` | 3 | U+0076 U+02B2 | yes |
| 58 | `dʲ` | 3 | U+0064 U+02B2 | yes |
| 59 | `o̤` | 3 | U+006F U+0324 | yes |
| 60 | `b̤` | 3 | U+0062 U+0324 | yes |
| 61 | `ɛ̃` | 3 | U+025B U+0303 | yes |
| 62 | `ʉ` | 3 | U+0289 | yes |
| 63 | `ɑ̃` | 3 | U+0251 U+0303 | yes |
| 64 | `t͡ʃ` | 3 | U+0074 U+0361 U+0283 | yes |
| 65 | `æ̃` | 2 | U+00E6 U+0303 | yes |
| 66 | `ʃʰ` | 2 | U+0283 U+02B0 | yes |
| 67 | `pʲ` | 2 | U+0070 U+02B2 | yes |
| 68 | `t̪` | 2 | U+0074 U+032A | yes |
| 69 | `ɟ` | 2 | U+025F | yes |
| 70 | `lʲ` | 1 | U+006C U+02B2 | yes |
| 71 | `bˠ` | 1 | U+0062 U+02E0 | yes |
| 72 | `ũ` | 1 | U+0075 U+0303 | yes |
| 73 | `kʲ` | 1 | U+006B U+02B2 | yes |
| 74 | `nʲ` | 1 | U+006E U+02B2 | yes |

