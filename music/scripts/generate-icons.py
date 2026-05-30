#!/usr/bin/env python3
"""Generate Winamp-style PWA icons (stdlib only)."""

import struct
import zlib
from pathlib import Path

BG = (26, 26, 26)
NEON = (57, 255, 20)
NEON_DARK = (26, 107, 10)
BAR_WIDTH_RATIO = 0.55
MARGIN_RATIO = 0.18


def _chunk(tag: bytes, data: bytes) -> bytes:
    return struct.pack(">I", len(data)) + tag + data + struct.pack(">I", zlib.crc32(tag + data) & 0xFFFFFFFF)


def write_png(path: Path, size: int) -> None:
    margin = int(size * MARGIN_RATIO)
    inner_w = size - margin * 2
    inner_h = size - margin * 2
    bar_count = 5
    gap = max(2, size // 64)
    bar_w = max(4, int((inner_w - gap * (bar_count - 1)) / bar_count))
    heights = [0.35, 0.72, 1.0, 0.58, 0.82]
    rows = []
    for y in range(size):
        row = bytearray([0])
        for x in range(size):
            if x < margin or x >= size - margin or y < margin or y >= size - margin:
                row.extend(BG)
                continue
            lx = x - margin
            ly = y - margin
            bar_index = None
            for i in range(bar_count):
                bx = i * (bar_w + gap)
                if bx <= lx < bx + bar_w:
                    bar_index = i
                    break
            if bar_index is None:
                row.extend(BG)
                continue
            bar_h = int(inner_h * heights[bar_index])
            top = inner_h - bar_h
            if ly >= top:
                t = (ly - top) / max(bar_h, 1)
                color = NEON if t < 0.35 else (
                    tuple(int(NEON_DARK[j] + (NEON[j] - NEON_DARK[j]) * ((t - 0.35) / 0.65)) for j in range(3))
                )
                row.extend(color)
            else:
                row.extend(BG)
        rows.append(bytes(row))
    raw = b"".join(rows)
    ihdr = struct.pack(">IIBBBBB", size, size, 8, 2, 0, 0, 0)
    png = b"\x89PNG\r\n\x1a\n" + _chunk(b"IHDR", ihdr) + _chunk(b"IDAT", zlib.compress(raw, 9)) + _chunk(b"IEND", b"")
    path.write_bytes(png)


def main() -> None:
    out = Path(__file__).resolve().parent.parent / "icons"
    out.mkdir(parents=True, exist_ok=True)
    for size in (192, 512):
        write_png(out / f"icon-{size}.png", size)
    print("Wrote icons to", out)


if __name__ == "__main__":
    main()
