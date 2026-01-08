# Todo

## Application

- [ ] Record Audio UI tweaks
- [ ] Sidebar
- [ ] Main Content
- [ ] Have speech instance for each text so that users can choose from different speechs (can be from same or different dialects) before recording. We then use the relevant one as a reference speech for analysis.
- [ ] Listen to specific instances in a text as a reference for recording.
- [ ] Create DB Tables, Return dummy results for now.

## MFA
- [ ] Look at its Dictionary to see whether it matches with POWSM'sm
- [ ] Using MFA for word boundary detection
- [ ] Fallback options: Using Graphemes and uniform alignment.

## POWSM
- [ ] Analyze the software to see whether the ASR model works with phonetic data under the hood. 
- [ ] Canonical IPA fallback: CMUDict.

## Static Content
- [ ] Decide on whether to serve from R2 or /public folder