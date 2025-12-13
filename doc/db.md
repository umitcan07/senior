# Nonce Database Schema

## Naming Conventions

- **Tables**: plural, snake_case (e.g., `texts`, `user_recordings`)
- **Columns**: snake_case, descriptive names
- **Primary keys**: `id` (UUID or serial)
- **Foreign keys**: `<referenced_table_singular>_id` (e.g., `author_id`)
- **Timestamps**: `created_at`, `updated_at`
- **Booleans**: `is_` or `has_` prefix (e.g., `is_active`)
- **Enums**: singular, descriptive (e.g., `recording_method`)

---

## Tables

### `users`, `sessions` etc.

> Lives in Clerk

### `texts`

| Column       | Type      | Description          |
| ------------ | --------- | -------------------- |
| `id`         | uuid      | Primary key          |
| `content`    | text      | The text content     |
| `created_at` | timestamp | Record creation time |
| `updated_at` | timestamp | Last update time     |

### `authors`

| Column          | Type         | Description                               |
| --------------- | ------------ | ----------------------------------------- |
| `id`            | uuid         | Primary key                               |
| `name`          | varchar(255) | Author name                               |
| `accent`        | varchar(50)  | Accent type (e.g., "american", "british") |
| `style`         | varchar(50)  | Speaking style                            |
| `language_code` | varchar(10)  | ISO language code (e.g., "en")            |
| `created_at`    | timestamp    | Record creation time                      |
| `updated_at`    | timestamp    | Last update time                          |

### `reference_speeches`

| Column              | Type         | Description                    |
| ------------------- | ------------ | ------------------------------ |
| `id`                | uuid         | Primary key                    |
| `storage_key`       | varchar(500) | S3/R2 object key               |
| `author_id`         | uuid         | FK → `authors.id`              |
| `text_id`           | uuid         | FK → `texts.id`                |
| `generation_method` | varchar(20)  | Enum: "tts", "native"          |
| `ipa_transcription` | text         | IPA phonetic transcription     |
| `ipa_method`        | varchar(20)  | Enum: "powsm", "cmudict"       |
| `priority`          | integer      | Display/selection priority     |
| `duration_ms`       | integer      | Audio duration in milliseconds |
| `file_size_bytes`   | integer      | File size in bytes             |
| `sample_rate_hz`    | integer      | Sample rate (e.g., 16000)      |
| `channels`          | smallint     | Number of audio channels       |
| `bitrate_kbps`      | integer      | Bitrate in kbps                |
| `created_at`        | timestamp    | Record creation time           |
| `updated_at`        | timestamp    | Last update time               |

### `user_recordings`

| Column                | Type         | Description                    |
| --------------------- | ------------ | ------------------------------ |
| `id`                  | uuid         | Primary key                    |
| `user_id`             | varchar(255) | External user ID (Clerk)       |
| `storage_key`         | varchar(500) | S3/R2 object key               |
| `recording_method`    | varchar(20)  | Enum: "upload", "record"       |
| `reference_speech_id` | uuid         | FK → `reference_speeches.id`   |
| `duration_ms`         | integer      | Audio duration in milliseconds |
| `file_size_bytes`     | integer      | File size in bytes             |
| `sample_rate_hz`      | integer      | Sample rate (e.g., 16000)      |
| `channels`            | smallint     | Number of audio channels       |
| `bitrate_kbps`        | integer      | Bitrate in kbps                |
| `created_at`          | timestamp    | Record creation time           |
| `updated_at`          | timestamp    | Last update time               |

### `audio_quality_metrics`

| Column              | Type         | Description                                |
| ------------------- | ------------ | ------------------------------------------ |
| `id`                | uuid         | Primary key                                |
| `user_recording_id` | uuid         | FK → `user_recordings.id`                  |
| `snr_db`            | decimal(5,2) | Signal-to-noise ratio in dB                |
| `noise_ratio`       | decimal(5,4) | Percentage of noise segments (0-1)         |
| `silence_ratio`     | decimal(5,4) | Percentage of silence/quiet segments (0-1) |
| `clipping_ratio`    | decimal(5,4) | Percentage of clipped samples (0-1)        |
| `quality_status`    | varchar(20)  | Enum: "accept", "warning", "reject"        |
| `quality_errors`    | text[]       | Array of error messages                    |
| `created_at`        | timestamp    | Record creation time                       |

### `analyses`

| Column                   | Type         | Description                        |
| ------------------------ | ------------ | ---------------------------------- |
| `id`                     | uuid         | Primary key                        |
| `user_recording_id`      | uuid         | FK → `user_recordings.id`          |
| `reference_speech_id`    | uuid         | FK → `reference_speeches.id`       |
| `processing_duration_ms` | integer      | ML processing time in milliseconds |
| `overall_score`          | decimal(5,4) | Overall pronunciation score (0-1)  |
| `confidence`             | decimal(5,4) | Model confidence (0-1)             |
| `target_phonemes`        | text         | Target IPA phonemes                |
| `recognized_phonemes`    | text         | Recognized IPA phonemes            |
| `phoneme_distance`       | integer      | Edit distance for phonemes         |
| `phoneme_score`          | decimal(5,4) | Phoneme-level score (0-1)          |
| `phoneme_errors`         | jsonb        | Array of phoneme-level errors      |
| `target_words`           | text         | Target words                       |
| `recognized_words`       | text         | Recognized words                   |
| `word_distance`          | integer      | Edit distance for words            |
| `word_score`             | decimal(5,4) | Word-level score (0-1)             |
| `word_errors`            | jsonb        | Array of word-level errors         |
| `alignment_id`           | uuid         | FK → `alignments.id` (nullable)    |
| `created_at`             | timestamp    | Record creation time               |

### `alignments`

| Column             | Type         | Description                  |
| ------------------ | ------------ | ---------------------------- |
| `id`               | uuid         | Primary key                  |
| `analysis_id`      | uuid         | FK → `analyses.id`           |
| `storage_key`      | varchar(500) | S3/R2 key for alignment data |
| `alignment_method` | varchar(20)  | Enum: "mfa", "wav2textgrid"  |
| `created_at`       | timestamp    | Record creation time         |

### `user_preferences`

| Column                | Type         | Description                  |
| --------------------- | ------------ | ---------------------------- |
| `id`                  | uuid         | Primary key                  |
| `user_id`             | varchar(255) | External user ID (Clerk)     |
| `preferred_author_id` | uuid         | FK → `authors.id` (nullable) |
| `created_at`          | timestamp    | Record creation time         |
| `updated_at`          | timestamp    | Last update time             |

---

## JSON Data Structures

### `phoneme_errors` (jsonb array)

```json
[
  {
    "type": "substitute",
    "position": 29,
    "expected": "s",
    "actual": "θ",
    "timestamp_start_ms": 4550,
    "timestamp_end_ms": 4670
  },
  {
    "type": "insert",
    "position": 16,
    "actual": "d",
    "timestamp_start_ms": 2750,
    "timestamp_end_ms": 2850
  },
  {
    "type": "delete",
    "position": 54,
    "expected": "a",
    "timestamp_start_ms": 6370,
    "timestamp_end_ms": 6400
  }
]
```

### `word_errors` (jsonb array)

```json
[
  {
    "type": "substitute",
    "position": 6,
    "expected": "thursday",
    "actual": "turnsday"
  },
  {
    "type": "delete",
    "position": 7,
    "expected": "i"
  }
]
```

### `quality_errors` (text array)

```sql
-- PostgreSQL text array
ARRAY['SNR too low: 8.5 dB (minimum: 12 dB)', 'Silence ratio out of range: 3.2% (acceptable: 5-70%)']
```

---

## Indexes

```sql
-- Foreign key indexes
CREATE INDEX idx_reference_speeches_author_id ON reference_speeches(author_id);
CREATE INDEX idx_reference_speeches_text_id ON reference_speeches(text_id);
CREATE INDEX idx_user_recordings_user_id ON user_recordings(user_id);
CREATE INDEX idx_user_recordings_reference_speech_id ON user_recordings(reference_speech_id);
CREATE INDEX idx_user_preferences_user_id ON user_preferences(user_id);
CREATE INDEX idx_analyses_user_recording_id ON analyses(user_recording_id);
CREATE INDEX idx_audio_quality_metrics_user_recording_id ON audio_quality_metrics(user_recording_id);

-- JSONB indexes for error aggregation queries
CREATE INDEX idx_analyses_phoneme_errors ON analyses USING GIN (phoneme_errors);
CREATE INDEX idx_analyses_word_errors ON analyses USING GIN (word_errors);

-- Query optimization indexes
CREATE INDEX idx_user_recordings_created_at ON user_recordings(created_at DESC);
CREATE INDEX idx_analyses_created_at ON analyses(created_at DESC);
```
---

## Quality Thresholds

| Metric         | Accept | Warning         | Reject      |
| -------------- | ------ | --------------- | ----------- |
| SNR            | ≥15 dB | 12-15 dB        | <12 dB      |
| Silence Ratio  | 10-50% | 5-10% or 50-70% | <5% or >70% |
| Clipping Ratio | <0.1%  | 0.1-1%          | >1%         |

---

## Enums

```sql
-- Generation method for reference speeches
CREATE TYPE generation_method AS ENUM ('tts', 'native');

-- IPA transcription method
CREATE TYPE ipa_method AS ENUM ('powsm', 'cmudict');

-- User recording method
CREATE TYPE recording_method AS ENUM ('upload', 'record');

-- Audio quality status
CREATE TYPE quality_status AS ENUM ('accept', 'warning', 'reject');

-- Alignment method
CREATE TYPE alignment_method AS ENUM ('mfa', 'wav2textgrid');

-- Error type (used in JSON, not as DB enum)
-- Values: 'substitute', 'insert', 'delete'
```

---