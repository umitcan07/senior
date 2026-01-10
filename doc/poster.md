# Nounce Poster Design Specification

## CMPE 492 Senior Project

**Format**: A0 Horizontal (1189mm × 841mm)  
**Word Count Target**: 300-800 words

---

## Poster Layout Structure

The poster follows a 4-column horizontal layout with clear visual hierarchy.

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                              HEADER SECTION                                  │
│  [BOUN Logo]    TITLE: Nounce - Pronunciation Assessment System    [QR Code] │
│                 Author, Advisors, Institution                               │
├─────────────────────────────────────────────────────────────────────────────┤
│ COLUMN 1       │ COLUMN 2        │ COLUMN 3          │ COLUMN 4            │
│ Introduction   │ Methodology     │ System Demo       │ Results &           │
│ & Problem      │ & Architecture  │ (Screenshots)     │ Conclusion          │
└─────────────────────────────────────────────────────────────────────────────┘
```

---

## Section 1: Header

### Title
**Nounce: Pronunciation Assessment System for English Language Learners**

Font: Sans-serif (e.g., Inter, Roboto), 85pt minimum  
Style: Bold, high contrast against background

### Author and Affiliations
Ümit Can Evleksiz  
**Advisors**: Lale Akarun, Murat Saraçlar  
**Department of Computer Engineering**  
Boğaziçi University

Font: 36pt for name, 24pt for affiliations

### Logos
- **Boğaziçi University Logo**: Top-left corner (download from official institutional identity page)
- **QR Code**: Top-right, linking to live demo or repository

---

## Section 2: Introduction & Problem (Column 1)

### Heading
**The Challenge** (36pt, bold)

### Content (~100 words)
English pronunciation learning faces significant barriers:

• **Limited access** to native speakers and quality instruction  
• **Fear of judgment** discourages practice  
• **Generic feedback** – "try again" without specifics  
• **No phonetic-level analysis** – learners don't know which sounds are wrong

**Nounce** addresses these challenges by providing automated, phoneme-level pronunciation feedback using state-of-the-art speech recognition models.

### Visual Placeholder
[GRAPHIC: Problem visual – icon set showing three pain points]
- Person with question mark (access)
- Speech bubble with X (feedback quality)
- Sound wave with target symbol (phonetic precision)

---

## Section 3: Methodology & Architecture (Column 2)

### Heading
**How Nounce Works** (36pt, bold)

### Subheading
**Technology Stack**

### Content (~150 words)
Nounce combines modern web development with cutting-edge speech ML:

**Frontend**
- React with TanStack Start (SSR)
- Real-time audio recording & visualization
- Responsive UI with Shadcn components

**ML Backend**
- **POWSM**: Phonetic Open Whisper-Style Speech Model
  - 350M parameters, trained on 17,000+ hours
  - Phone Recognition, ASR, G2P, P2G in one model
- RunPod serverless GPU inference
- Edit distance algorithm for error classification

**Data Layer**
- Neon PostgreSQL (serverless database)
- Cloudflare R2 (audio storage)
- Docker containerization

### Visual Placeholder
[DIAGRAM: System Architecture]
A simplified flow diagram showing:
```
User → Record Audio → Web App → RunPod (POWSM) → Analysis → Feedback
                         ↓              ↓
                    Neon DB        Audio Storage
```

Use clean icons: microphone, browser, cloud, database

---

## Section 4: System Demo & Features (Column 3)

### Heading
**Application Demo** (36pt, bold)

### Visual Placeholders
This section is primarily visual – 60% graphics, 40% text.

[SCREENSHOT 1: Practice Text Selection]
Caption: "Select practice texts by difficulty (beginner → advanced) and category"

[SCREENSHOT 2: Recording Interface]
Caption: "Real-time audio visualization during recording"

[SCREENSHOT 3: Analysis Results]
Caption: "Phoneme-level feedback with error highlighting"
- Show color-coded IPA comparison
- Show substitution/insertion/deletion markers

### Key Features List (~80 words)
**User Features**
• Browser-based speech recording  
• IPA transcription of user speech  
• Error classification: substitution, insertion, deletion  
• Progress tracking over time  

**Admin Features**
• Text management (CRUD)  
• Reference speech upload  
• IPA transcription management  

---

## Section 5: Results & Conclusion (Column 4)

### Heading
**Results & Impact** (36pt, bold)

### Visual Placeholder
[CHART: POWSM Performance Comparison]
Bar chart showing PFER (Phonetic Feature Error Rate) across models:
- Allosaurus: 16.14
- Wav2Vec2Phoneme: 11.11
- ZIPA-CR-Large: 2.99
- **POWSM: 2.62** (highlighted)

Caption: "POWSM outperforms specialized phone recognition models (PFER↓)"

### Content (~100 words)
**Key Achievements**
• Full-stack web application with modern UI/UX  
• Integrated state-of-the-art POWSM model  
• Phoneme-level error detection and visualization  
• Scalable serverless architecture  

**Impact**
Nounce democratizes pronunciation learning by providing:
- Accessible 24/7 practice without human tutors
- Detailed, actionable feedback at the phonetic level
- Respectful approach that values linguistic diversity

**Future Work**
- Fine-tune POWSM for Turkish L1 speakers  
- Add reference audio with voice cloning  
- Expand to British English  
- Mobile application  

### Conclusion Callout Box
> **Nounce empowers English learners with precise, phonetic-level feedback – making quality pronunciation instruction accessible to everyone.**

---

## Section 6: Footer

### Acknowledgments
"This project utilizes POWSM (CMU), Montreal Forced Aligner, TanStack, and Neon PostgreSQL."

### References (18pt, compact)
- Li et al. (2025). POWSM: A Phonetic Open Whisper-Style Speech Foundation Model. arXiv.
- McAuliffe et al. (2017). Montreal Forced Aligner. Interspeech.

### Contact/Links
GitHub: github.com/umitcan07/senior  
Live Demo: [QR Code]

Font: 18pt for all footer text

---

## Design Guidelines

### Color Palette
| Element           | Color                          |
|-------------------|--------------------------------|
| Background        | White (#FFFFFF) or Light Gray  |
| Primary Accent    | Deep Blue (#1E3A8A)            |
| Secondary Accent  | Teal (#0D9488)                 |
| Highlight/CTA     | Orange (#F97316)               |
| Text (primary)    | Dark Gray (#1F2937)            |
| Text (secondary)  | Medium Gray (#6B7280)          |

### Typography
| Element           | Font              | Size     |
|-------------------|-------------------|----------|
| Title             | Inter Bold        | 85pt+    |
| Section Headers   | Inter SemiBold    | 36pt     |
| Body Text         | Inter Regular     | 24pt     |
| Captions          | Inter Italic      | 18pt     |
| References        | Inter Light       | 18pt     |

### Visual Elements
- **Grid lines**: Use invisible alignment guides for clean layout
- **White space**: Generous margins (≥50mm outer, ≥30mm between columns)
- **Bullets**: Consistent style throughout (solid circles or dashes)
- **Icons**: Flat, consistent icon style (e.g., Lucide, Heroicons)
- **Charts**: Clean, minimal styling with clear labels

### Readability Distances
- Title: Readable from 15+ feet (4.5m)
- Headers: Readable from 10 feet (3m)
- Body: Readable from 5 feet (1.5m)
- Captions/References: Readable from 3 feet (1m)

---

## Visual Asset Checklist

| Asset                               | Source/Action                        |
|-------------------------------------|--------------------------------------|
| Boğaziçi University Logo            | Download from institutional site     |
| Nounce Application Logo              | `app/public/og-image.png`            |
| Practice Text Selection Screenshot  | Capture from running app             |
| Recording Interface Screenshot      | Capture from running app             |
| Analysis Results Screenshot         | Capture from running app             |
| System Architecture Diagram         | Create (Figma/Draw.io)               |
| POWSM Performance Bar Chart         | Create from paper data               |
| Problem Icons                       | Use icon library (Lucide/Heroicons)  |
| QR Code (Demo/Repo Link)            | Generate via qr-code-generator.com   |

---

## Word Count Estimate

| Section                    | Words  |
|----------------------------|--------|
| Title + Author             | 25     |
| Introduction & Problem     | 100    |
| Methodology & Architecture | 150    |
| System Demo & Features     | 80     |
| Results & Conclusion       | 100    |
| Footer & References        | 45     |
| **Total**                  | ~500   |

✓ Within 300-800 word guideline

---

## Three Key Questions (Poster Preparation)

### 1. What is the most important/interesting/astounding finding?
**POWSM enables phoneme-level pronunciation feedback without language-specific training**, outperforming specialized models while supporting four different tasks. This allows Nounce to provide precise "which sound is wrong" feedback instead of vague "try again" messages.

### 2. How can I visually share my research with attendees?
- **System architecture diagram**: Shows the clean flow from user recording to ML analysis
- **Application screenshots**: Demonstrate the actual user experience
- **PFER comparison chart**: Quantifies POWSM's state-of-the-art performance
- **Error visualization example**: Shows how substitution/insertion/deletion errors are displayed

### 3. What information can I convey during my talk that will complement my poster?
- **Live demonstration**: Record speech and show real-time analysis
- **POWSM deep dive**: Explain the model architecture for technical audiences
- **User stories**: Describe specific scenarios where Nounce helps (test preparation, professional communication)
- **Ethical nuances**: Elaborate on dialect respect, data privacy, and accessibility philosophy
- **Future vision**: Voice cloning for personalized reference audio, L1-specific error patterns
