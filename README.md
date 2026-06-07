# Neon Stream

Neon Stream is a browser-based local music player with a neon-themed UI, rich library browsing, playlists, lyrics, analytics, and audio effects.

## What it does

- Loads a local music folder directly in the browser
- Scans audio files and extracts metadata, cover art, track numbers, and genres
- Builds a full library view for tracks, albums, artists, genres, playlists, and stats
- Plays music with queue control, shuffle, repeat, and crossfade
- Supports lyrics from local `.lrc` files, manual lyrics entry, and online lookup
- Tracks listening stats after a song passes 50% playback
- Persists settings, playlists, lyrics, ratings, and play stats in IndexedDB

## Main features

### Library management

- Local folder scanning with support for common formats like MP3, M4A, MP4, WAV, OGG, and FLAC
- Automatic metadata parsing from filenames and folders
- ID3 and MP4 tag reading for embedded metadata and album art
- Album art caching to reduce repeated processing
- Search across tracks, albums, and artists
- Alpha-index navigation for large library lists

### Playback

- Play, pause, next, previous, shuffle, and repeat
- Queue management with add/remove/clear actions
- Shuffle-play for tracks, albums, genres, and playlists
- Crossfade with configurable duration
- Track details modal for quick inspection

### Lyrics

- Loads synced lyrics from matching local `.lrc` files
- Falls back to saved manual lyrics
- Can fetch lyrics online when available
- Supports synced lyric highlighting during playback

### Audio enhancements

- Audio visualizer
- Dynamic top-bar and bottom-bar visual effects
- Audio normalization
- Spatial audio simulation
- Bass boost

### Personalization

- Custom interface fonts
- Font scaling
- Saved preferences across sessions
- Dark, glassmorphism-style premium UI

### Analytics

- Most played tracks
- Top artists
- Top albums
- Top genres

## How to use

1. Open `neon_player.html` in a modern desktop browser.
2. Click **Load Local Music**.
3. Select your music folder.
4. Browse the library and start playing.

> Note: browsers require you to re-select the folder each time you reopen the app.

## Storage

Neon Stream uses IndexedDB to store:

- app settings
- playlists
- manual lyrics
- ratings
- play statistics

## Future development

To make the app more scalable, the next steps could include:

- Splitting the single HTML file into modular HTML/CSS/JS assets
- Adding a dedicated metadata index layer for very large libraries
- Moving playlist, stats, and library sync to a backend service
- Supporting cloud storage and multi-device sync
- Turning the app into a PWA for installable offline use
- Introducing background library indexing and incremental updates
- Adding smarter recommendations and automated playlist generation
- Improving accessibility, keyboard navigation, and mobile responsiveness
- Adding import/export for playlists, ratings, and settings

## Notes

- The app is designed for desktop browsers.
- It depends on browser APIs such as File System access, IndexedDB, and Web Audio.
- Internet features like lyrics lookup require network access.
