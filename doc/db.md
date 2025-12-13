# Nonce Database Schema Essentials

## Tables

### `text`

- `id`
- `text`

### `author`

- `id`
- `name`
- `accent`
- `style`
- `language` (en)

### `reference_speech`

- `id`
- `path/key` (S3)
- `author_id`
- `text_id`
- `generation_method`: string (tts, native)
- `ipa_transcription`
- `ipa_method`: string (powsm, cmudict)
- `priority`: int
- `duration`
- `<file_metadata>`

### `user_recording`

- `id`
- `user_id`
- `path/key` (S3)
- `method`: (upload, record)
- `reference_speech_id`
- `<file_metadata>`

### `analysis`

- `id`
- `user_recording_id`
- `reference_speech_id`
- `processing_duration`
- `score`
- `confidence`
- `target_phonemes`
- `recognized_phonemes`
- `phoneme_analysis`: json
- `distance_phonemes`
- `target_words`
- `recognized_words`
- `word_analysis`: json
- `distance_words`
- `errors`
- `alignment_id` (?)

### `alignment` (?)

- `id`
- `alignment_data_storage_key`

### `user_preferences`

- `id`
- `user_id`
- `preferred_author_id`

## Metadata Definitions

### File Metadata

File metadata fields:
- `file_size`
- `bitrate`
- `sample_rate`
- `channels`

### Data Structures

#### `phoneme_analysis`

```json
{
    "score": "float",
    "errors": "list[error]"
}
```

#### `word_analysis`

```json
{
    "score": "float",
    "errors": "list[error]"
}
```

#### `error`

```json
{
    "type": "substitute" | "insert" | "delete",
    "position": "int",
    "expected": "string",
    "actual": "string",
    "timestamp": {
        "start": "int",
        "end": "int"
    }
}
