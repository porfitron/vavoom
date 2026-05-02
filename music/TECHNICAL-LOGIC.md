# Technical Logic: Audio & Playlist

## Core Functionality
- **Engine:** Use Vanilla JavaScript with the HTML5 `<audio>` element. 
- **Playlist Management:** - The playlist is a JSON array of objects: `[{ title: "Song Name", url: "/mp3s/song.mp3" }]`.
    - Auto-advance to the next track when one ends.
- **Visualizer:** A simple CSS-based or Canvas-based frequency visualizer that reacts to the audio playback.

## Server Integration
- Assume MP3 files are located in a `/public/audio/` directory.
- On load, fetch the playlist and populate the UI list items.