# Meeting Notes (December 11, 2025)

## Questions

### POWSM

- Using PR vs G2P: G2P is biased towards the target text. 
- Using ASR or ground-truth text for G2P. 
- Does ASR consider context in the sentence? Would it make sense to generate meaningless text (broken sentence structure, etc.) and use it to break the bias?

### MFA

- Aligning Phones vs Graphemes. Could grapheme alignment be useful?
- Alignment Precision 10ms. Since the main purpose of alignment is to play audio for the user, it doesn't need to be very precise. We could even play the relevant phoneme or word with padding.

### "Correct" Pronunciation

- Using CMUdict for "correct" pronunciation -> There is variation; even tiny differences are considered separate substitutions. A lookup table could be added there.
- Using G2P with a speech: Using real speaker vs using TTS. Manually generating vs programmatically generating via API. -> Cost, License etc. ()

### Application

- Listen "Correct" speech before recording. -> Alternative versions? Dialect selection? In this case, IPA will also have variation for a given text.

---

See [todo.md](todo.md) for more details.