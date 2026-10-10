# EchoLingo Database & Persistence

## Storage Overview

EchoLingo persists user data locally in an SQLite database located at:
- **Windows**: `%APPDATA%\EchoLingo\echolingo.sqlite`
- **macOS**: `~/Library/Application Support/EchoLingo/echolingo.sqlite`
- **Linux**: `~/.config/EchoLingo/echolingo.sqlite`

## Database Tables

- **`schema_migrations`**: Tracks applied database migrations and timestamps.
- **`sessions`**: Stores session headers, audio source types, selected languages, and duration.
- **`subtitle_segments`**: Stores all finalized segments with microsecond timestamps, original text, and JSON-serialized translations.
- **`glossary`**: Custom user-defined translation terminology with case-sensitivity flags.
- **`app_settings`**: Key-value store for user preferences, theme selections, and VAD thresholds.

## WAL Mode & Integrity

All connections execute with:
- `PRAGMA journal_mode = WAL;` (Write-Ahead Logging for high-throughput non-blocking reads during active speech recording).
- `PRAGMA foreign_keys = ON;` (Cascading deletion of subtitle segments when a session is removed).
