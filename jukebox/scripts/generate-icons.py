#!/usr/bin/env python3
"""Generate 16-bit pixel-art jukebox PWA icons (stdlib only)."""

import struct
import zlib
from pathlib import Path

OUT = Path(__file__).resolve().parent.parent / "icons"
SIZES = (192, 512)
CANVAS = 40

PALETTE = {
    ".": (31, 15, 8),
    "w": (61, 34, 20),
    "W": (92, 56, 32),
    "c": (106, 102, 96),
    "C": (200, 196, 188),
    "s": (245, 230, 168),
    "S": (255, 208, 96),
    "o": (255, 179, 71),
    "O": (232, 90, 0),
    "y": (255, 220, 60),
    "g": (127, 255, 77),
    "G": (60, 180, 40),
    "r": (255, 42, 42),
    "R": (192, 40, 30),
    "p": (255, 77, 122),
    "u": (255, 60, 80),
    "t": (42, 24, 16),
    "*": (255, 208, 96),
}


def _chunk(tag: bytes, data: bytes) -> bytes:
    return struct.pack(">I", len(data)) + tag + data + struct.pack(">I", zlib.crc32(tag + data) & 0xFFFFFFFF)


def set_px(grid: list[list[str]], x: int, y: int, ch: str) -> None:
    h, w = len(grid), len(grid[0])
    if 0 <= x < w and 0 <= y < h:
        grid[y][x] = ch


def fill_rect(grid: list[list[str]], x0: int, y0: int, x1: int, y1: int, ch: str) -> None:
    for y in range(y0, y1):
        for x in range(x0, x1):
            set_px(grid, x, y, ch)


def build_sprite() -> list[list[str]]:
    w, h = 28, 34
    g = [["." for _ in range(w)] for _ in range(h)]

    # Glowing arch (dome)
    arch_rows = [
        (1, 11, 17, "r"),
        (2, 10, 18, "r"),
        (3, 9, 19, "R"),
        (4, 8, 20, "O"),
        (5, 7, 21, "o"),
    ]
    for y, x0, x1, ch in arch_rows:
        fill_rect(g, x0, y, x1, y + 1, ch)

    # Wood body frame
    fill_rect(g, 6, 5, 22, 30, "w")
    fill_rect(g, 7, 6, 21, 29, "W")

    # Left / right neon columns
    for y in range(6, 28):
        set_px(g, 7, y, "y" if y % 3 == 0 else "o")
        set_px(g, 8, y, "o" if y % 2 else "y")
        set_px(g, 19, y, "g" if y % 2 else "G")
        set_px(g, 20, y, "G" if y % 3 else "g")

    # Playlist screen
    fill_rect(g, 10, 8, 18, 17, "s")
    fill_rect(g, 11, 9, 17, 16, "S")
    for y, x0, x1 in ((10, 11, 14), (11, 11, 16), (12, 11, 15), (13, 11, 17), (14, 11, 14)):
        fill_rect(g, x0, y, x1, y + 1, "t")

    # Control / EQ strip
    fill_rect(g, 10, 17, 18, 19, "c")
    for x in (10, 12, 14, 16):
        fill_px_col(g, x, 17, 19, "C")

    # Speaker grille (checker chrome)
    for y in range(19, 27):
        for x in range(9, 19):
            if (x + y) % 2 == 0:
                set_px(g, x, y, "C")
            else:
                set_px(g, x, y, "c")

    # Star badge
    set_px(g, 13, 22, "*")
    set_px(g, 14, 22, "*")
    set_px(g, 15, 22, "*")
    set_px(g, 14, 21, "*")
    set_px(g, 14, 23, "*")

    # Bottom neon U-glow
    fill_rect(g, 7, 27, 21, 29, "u")
    fill_rect(g, 8, 28, 20, 30, "r")

    # Outer red trim
    for y in range(5, 30):
        set_px(g, 6, y, "r")
        set_px(g, 21, y, "r")
    for x in range(7, 21):
        set_px(g, x, 29, "r")
    for x in range(8, 20):
        set_px(g, x, 30, "R")

    return g


def fill_px_col(grid: list[list[str]], x: int, y0: int, y1: int, ch: str) -> None:
    for y in range(y0, y1):
        set_px(grid, x, y, ch)


def blit_sprite(canvas: list[list[str]], sprite: list[list[str]]) -> list[list[str]]:
    sh, sw = len(sprite), len(sprite[0])
    ox = (CANVAS - sw) // 2
    oy = (CANVAS - sh) // 2
    out = [row[:] for row in canvas]
    for y, row in enumerate(sprite):
        for x, ch in enumerate(row):
            if ch != ".":
                set_px(out, ox + x, oy + y, ch)
    return out


def to_rgb_grid(char_grid: list[list[str]]) -> list[list[tuple[int, int, int]]]:
    return [[PALETTE[ch] for ch in row] for row in char_grid]


def scale_nearest(grid: list[list[tuple[int, int, int]]], size: int) -> list[list[tuple[int, int, int]]]:
    src = len(grid)
    out = []
    for y in range(size):
        sy = min(src - 1, int(y * src / size))
        row = []
        for x in range(size):
            sx = min(src - 1, int(x * src / size))
            row.append(grid[sy][sx])
        out.append(row)
    return out


def write_png(path: Path, grid: list[list[tuple[int, int, int]]]) -> None:
    size = len(grid)
    rows = []
    for y in range(size):
        row = bytearray([0])
        for x in range(size):
            row.extend(grid[y][x])
        rows.append(bytes(row))
    raw = b"".join(rows)
    ihdr = struct.pack(">IIBBBBB", size, size, 8, 2, 0, 0, 0)
    png = b"\x89PNG\r\n\x1a\n" + _chunk(b"IHDR", ihdr) + _chunk(b"IDAT", zlib.compress(raw, 9)) + _chunk(b"IEND", b"")
    path.write_bytes(png)


def main() -> None:
    base = [["." for _ in range(CANVAS)] for _ in range(CANVAS)]
    canvas = blit_sprite(base, build_sprite())
    rgb = to_rgb_grid(canvas)
    OUT.mkdir(parents=True, exist_ok=True)
    for size in SIZES:
        write_png(OUT / f"icon-{size}.png", scale_nearest(rgb, size))
    print("Wrote 16-bit jukebox icons to", OUT)


if __name__ == "__main__":
    main()
