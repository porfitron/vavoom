# Visual Specification: Webamp Mobile

## The Aesthetic
- **Classic Winamp 2.x Skin:** Dark grays, neon greens for the visualizer/timer, and the iconic silver/beveled buttons.
- **Font:** Use a pixelated or monospace font for the timer (e.g., 'Digital-7' or standard 'Courier New').
- **Layout:** Single-column vertical stack for mobile. 
    - Top: Main Player (Visualizer, Timer, Track Info).
    - Middle: Controls (Play, Pause, EQ sliders).
    - Bottom: Scrollable Playlist.

## Mobile Optimization
- **Touch Targets:** Buttons must be at least 44x44px, even if they look like small retro buttons.
- **Responsive:** Use Flexbox/Grid to ensure the player fills the width of an iPhone/Android screen without horizontal scrolling.
- **Fixed Position:** The main transport controls should stay pinned or easily accessible.