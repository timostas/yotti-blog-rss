#!/usr/bin/env python3
"""Build the v5 South Island map and compact RSS-safe graphics.

The published map uses a cached OpenStreetMap raster base with visible
attribution and OSRM road geometry. The standalone HTML version adds keyboard-
accessible hotspots and a reduced-motion mode; the RSS article keeps a compact
animated WebP plus a normal link because the Yotti importer strips active HTML.
"""

from __future__ import annotations

import json
import math
import time
import urllib.parse
import urllib.request
from pathlib import Path

from PIL import Image, ImageDraw, ImageEnhance, ImageFont


ROOT = Path(__file__).resolve().parent.parent
INLINE = ROOT / "assets" / "inline"
INTERACTIVE = ROOT / "assets" / "interactive"
COVERS = ROOT / "assets" / "covers"
CACHE = Path("/tmp/yotti-nz-map-cache-z8")
BASE_URL = "https://timostas.github.io/yotti-blog-rss/assets"
UA = "YottiBlogMapBuilder/1.0 (+https://yotti.net)"

WIDTH, HEIGHT, ZOOM = 1200, 900, 8
WEST, EAST, NORTH, SOUTH = 168.0, 173.2, -42.75, -45.65
CORAL = "#F36B59"
PINE = "#24776B"
INK = "#172421"
MUTED = "#51615C"
PAPER = "#FFFDF8"

FONT_REGULAR = "/System/Library/Fonts/Supplemental/Arial.ttf"
FONT_BOLD = "/System/Library/Fonts/Supplemental/Arial Bold.ttf"

ROUTE_MAIN_URL = (
    "https://router.project-osrm.org/route/v1/driving/"
    "172.6362,-43.5321;170.4805,-44.0047;170.0985,-44.2600;168.6626,-45.0312"
    "?overview=full&geometries=geojson&steps=false"
)
ROUTE_AORAKI_URL = (
    "https://router.project-osrm.org/route/v1/driving/"
    "170.0985,-44.2600;170.0960,-43.7360"
    "?overview=full&geometries=geojson&steps=false"
)

STOPS = {
    "christchurch": (172.6362, -43.5321),
    "tekapo": (170.4805, -44.0047),
    "twizel": (170.0985, -44.2600),
    "aoraki": (170.0960, -43.7360),
    "queenstown": (168.6626, -45.0312),
}


def font(size: int, bold: bool = False) -> ImageFont.FreeTypeFont:
    return ImageFont.truetype(FONT_BOLD if bold else FONT_REGULAR, size)


def fetch(url: str, cache_path: Path | None = None) -> bytes:
    if cache_path and cache_path.exists():
        return cache_path.read_bytes()
    request = urllib.request.Request(url, headers={"User-Agent": UA})
    with urllib.request.urlopen(request, timeout=45) as response:
        data = response.read()
    if cache_path:
        cache_path.parent.mkdir(parents=True, exist_ok=True)
        cache_path.write_bytes(data)
    return data


def world_pixel(lon: float, lat: float, zoom: int = ZOOM) -> tuple[float, float]:
    scale = 256 * (2**zoom)
    x = (lon + 180.0) / 360.0 * scale
    sin_lat = math.sin(math.radians(lat))
    y = (0.5 - math.log((1 + sin_lat) / (1 - sin_lat)) / (4 * math.pi)) * scale
    return x, y


def article_pixel(lon: float, lat: float) -> tuple[int, int]:
    x0, y0 = world_pixel(WEST, NORTH)
    x1, y1 = world_pixel(EAST, SOUTH)
    x, y = world_pixel(lon, lat)
    return round((x - x0) / (x1 - x0) * WIDTH), round((y - y0) / (y1 - y0) * HEIGHT)


def tile_basemap() -> Image.Image:
    x0, y0 = world_pixel(WEST, NORTH)
    x1, y1 = world_pixel(EAST, SOUTH)
    min_x, max_x = math.floor(x0 / 256), math.floor(x1 / 256)
    min_y, max_y = math.floor(y0 / 256), math.floor(y1 / 256)
    canvas = Image.new("RGB", ((max_x - min_x + 1) * 256, (max_y - min_y + 1) * 256))

    for tile_y in range(min_y, max_y + 1):
        for tile_x in range(min_x, max_x + 1):
            cache_path = CACHE / str(ZOOM) / str(tile_x) / f"{tile_y}.png"
            data = fetch(f"https://tile.openstreetmap.org/{ZOOM}/{tile_x}/{tile_y}.png", cache_path)
            tile = Image.open(__import__("io").BytesIO(data)).convert("RGB")
            canvas.paste(tile, ((tile_x - min_x) * 256, (tile_y - min_y) * 256))
            time.sleep(0.06)

    crop = canvas.crop(
        (
            round(x0 - min_x * 256),
            round(y0 - min_y * 256),
            round(x1 - min_x * 256),
            round(y1 - min_y * 256),
        )
    ).resize((WIDTH, HEIGHT), Image.Resampling.LANCZOS)
    crop = ImageEnhance.Color(crop).enhance(0.62)
    crop = ImageEnhance.Contrast(crop).enhance(0.93)
    wash = Image.new("RGBA", crop.size, (255, 251, 244, 52))
    crop = Image.alpha_composite(crop.convert("RGBA"), wash)
    return crop.convert("RGB")


def route_coordinates(url: str, name: str) -> list[tuple[float, float]]:
    payload = json.loads(fetch(url, CACHE / f"{name}.json"))
    if payload.get("code") != "Ok":
        raise RuntimeError(f"OSRM error for {name}: {payload.get('code')}")
    return [tuple(point) for point in payload["routes"][0]["geometry"]["coordinates"]]


def downsample(points: list[tuple[int, int]], max_points: int = 820) -> list[tuple[int, int]]:
    step = max(1, math.ceil(len(points) / max_points))
    sampled = points[::step]
    if sampled[-1] != points[-1]:
        sampled.append(points[-1])
    return sampled


def segment(points: list[tuple[int, int]], ratio: float) -> list[tuple[int, int]]:
    if ratio <= 0:
        return []
    index = max(2, round((len(points) - 1) * min(ratio, 1.0)) + 1)
    return points[:index]


def rounded_label(draw: ImageDraw.ImageDraw, xy: tuple[int, int], title: str, subtitle: str, side: str, y_offset: int = 0) -> None:
    px, py = xy
    title_font, sub_font = font(38, True), font(30)
    title_box = draw.textbbox((0, 0), title, font=title_font)
    sub_box = draw.textbbox((0, 0), subtitle, font=sub_font)
    box_w = max(title_box[2], sub_box[2]) + 52
    box_h = 104
    x = px + 26 if side == "right" else px - box_w - 26
    y = py - box_h // 2 + y_offset
    x = max(18, min(WIDTH - box_w - 18, x))
    y = max(82, min(HEIGHT - box_h - 52, y))
    draw.rounded_rectangle((x, y, x + box_w, y + box_h), radius=22, fill=(255, 253, 248, 238), outline=(23, 36, 33, 34), width=2)
    draw.text((x + 26, y + 13), title, font=title_font, fill=INK)
    draw.text((x + 26, y + 58), subtitle, font=sub_font, fill=MUTED)


def draw_map(base: Image.Image, main: list[tuple[int, int]], branch: list[tuple[int, int]], locale: str, main_ratio: float = 1.0, branch_ratio: float = 1.0) -> Image.Image:
    image = base.copy().convert("RGBA")
    draw = ImageDraw.Draw(image, "RGBA")
    main_part, branch_part = segment(main, main_ratio), segment(branch, branch_ratio)

    if len(main_part) > 1:
        draw.line(main_part, fill=(255, 253, 248, 238), width=22, joint="curve")
        draw.line(main_part, fill=CORAL, width=11, joint="curve")
    if len(branch_part) > 1:
        draw.line(branch_part, fill=(255, 253, 248, 238), width=20, joint="curve")
        draw.line(branch_part, fill=PINE, width=10, joint="curve")

    labels = {
        "ru": {
            "christchurch": ("Крайстчерч", "дни 1–2", "left", -24),
            "tekapo": ("Текапо", "база на 3 ночи", "right", -72),
            "twizel": ("Твайзел", "альтернатива Текапо", "right", 62),
            "aoraki": ("Аораки", "поездка на день", "left", -18),
            "queenstown": ("Куинстаун", "дни 6–9", "right", 0),
        },
        "en": {
            "christchurch": ("Christchurch", "days 1–2", "left", -24),
            "tekapo": ("Tekapo", "three-night base", "right", -72),
            "twizel": ("Twizel", "Tekapo alternative", "right", 62),
            "aoraki": ("Aoraki", "day trip", "left", -18),
            "queenstown": ("Queenstown", "days 6–9", "right", 0),
        },
    }[locale]

    for key, (title, subtitle, side, y_offset) in labels.items():
        xy = article_pixel(*STOPS[key])
        colour = PINE if key == "aoraki" else CORAL
        draw.ellipse((xy[0] - 13, xy[1] - 13, xy[0] + 13, xy[1] + 13), fill=PAPER, outline=colour, width=7)
        rounded_label(draw, xy, title, subtitle, side, y_offset)

    title = "Южный остров · 9 дней" if locale == "ru" else "South Island · 9 days"
    draw.rounded_rectangle((28, 24, 520, 94), radius=22, fill=(23, 36, 33, 226))
    draw.text((54, 39), title, font=font(38, True), fill=PAPER)
    draw.rounded_rectangle((WIDTH - 405, HEIGHT - 54, WIDTH - 18, HEIGHT - 12), radius=12, fill=(255, 253, 248, 226))
    draw.text((WIDTH - 387, HEIGHT - 47), "© OSM contributors · OSRM", font=font(25), fill=MUTED)
    return image.convert("RGB")


def save_map_assets(base: Image.Image, main: list[tuple[int, int]], branch: list[tuple[int, int]], locale: str) -> None:
    static = draw_map(base, main, branch, locale)
    static_path = INLINE / f"new-zealand-road-map-{locale}-static-v5.webp"
    static.save(static_path, "WEBP", quality=78, method=6, optimize=True)

    ratios = [0.0, 0.08, 0.18, 0.30, 0.43, 0.57, 0.70, 0.84, 1.0]
    frames = [draw_map(base, main, branch, locale, ratio, 0.0) for ratio in ratios]
    frames += [draw_map(base, main, branch, locale, 1.0, ratio) for ratio in (0.18, 0.42, 0.68, 1.0)]
    durations = [320] + [190] * (len(frames) - 2) + [2600]
    animated_path = INLINE / f"new-zealand-road-map-{locale}-animated-v5.webp"
    frames[0].save(
        animated_path,
        "WEBP",
        save_all=True,
        append_images=frames[1:],
        duration=durations,
        loop=3,
        quality=62,
        method=6,
        minimize_size=True,
    )


def card(draw: ImageDraw.ImageDraw, box: tuple[int, int, int, int], badge: str, title: str, text: str, colour: str) -> None:
    x0, y0, x1, y1 = box
    draw.rounded_rectangle(box, radius=34, fill="#FFFFFF", outline="#D9E1DD", width=3)
    draw.rounded_rectangle((x0 + 28, y0 + 28, x0 + 188, y0 + 108), radius=25, fill=colour)
    draw.text((x0 + 61, y0 + 43), badge, font=font(38, True), fill="#FFFFFF")
    draw.text((x0 + 224, y0 + 31), title, font=font(48, True), fill=INK)
    draw.text((x0 + 224, y0 + 93), text, font=font(32), fill=MUTED)


def route_plan(locale: str) -> Image.Image:
    image = Image.new("RGB", (1440, 870), "#F7F3ED")
    draw = ImageDraw.Draw(image)
    copy = {
        "ru": (
            "Девять дней, три базы",
            "Восемь ночей и только два переезда между отелями",
            [("1–2", "Крайстчерч", "2 ночи · город и подготовка машины", CORAL), ("3–5", "Текапо или Твайзел", "3 ночи · озёра и день в Аораки", "#6DA8BA"), ("6–9", "Куинстаун", "3 ночи · два полных дня и вылет", PINE)],
        ),
        "en": (
            "Nine days, three bases",
            "Eight nights and only two hotel changes",
            [("1–2", "Christchurch", "2 nights · city and car preparation", CORAL), ("3–5", "Tekapo or Twizel", "3 nights · lakes and an Aoraki day", "#6DA8BA"), ("6–9", "Queenstown", "3 nights · two full days and departure", PINE)],
        ),
    }[locale]
    draw.text((64, 48), copy[0], font=font(62, True), fill=INK)
    draw.text((64, 126), copy[1], font=font(34), fill=MUTED)
    for index, values in enumerate(copy[2]):
        card(draw, (58, 205 + index * 205, 1382, 385 + index * 205), *values)
    return image


def booking_plan(locale: str) -> Image.Image:
    image = Image.new("RGB", (1440, 760), "#F7F3ED")
    draw = ImageDraw.Draw(image)
    if locale == "ru":
        title, subtitle = "Что решить дома, а что — в дороге", "Закрепите дорогие вещи; оставьте свободу погоде"
        left_title, right_title = "Забронировать заранее", "Решить на месте"
        left = ["Перелёты и аренду в одну сторону", "Жильё по схеме 2 + 3 + 3 ночи", "Одно важное занятие в Куинстауне"]
        right = ["День поездки в Аораки", "Остановки на обед и фотографии", "Короткие прогулки и резервный день"]
    else:
        title, subtitle = "What to settle at home — and on the road", "Fix the expensive pieces; leave weather room"
        left_title, right_title = "Book ahead", "Decide locally"
        left = ["Flights and a one-way rental", "Accommodation in a 2 + 3 + 3 pattern", "One important Queenstown activity"]
        right = ["Which day to drive to Aoraki", "Lunch and photography stops", "Short walks and the spare-weather day"]
    draw.text((64, 46), title, font=font(58, True), fill=INK)
    draw.text((64, 120), subtitle, font=font(34), fill=MUTED)
    boxes = [(58, 195, 1382, 438, CORAL, left_title, left), (58, 455, 1382, 698, PINE, right_title, right)]
    for x0, y0, x1, y1, colour, heading, rows in boxes:
        draw.rounded_rectangle((x0, y0, x1, y1), radius=34, fill="#FFFFFF", outline="#D9E1DD", width=3)
        draw.rounded_rectangle((x0 + 28, y0 + 24, x0 + 520, y0 + 91), radius=23, fill=colour)
        draw.text((x0 + 54, y0 + 35), heading, font=font(36, True), fill="#FFFFFF")
        for idx, row in enumerate(rows):
            cy = y0 + 108 + idx * 42
            draw.ellipse((x0 + 42, cy + 7, x0 + 62, cy + 27), fill=colour)
            draw.text((x0 + 82, cy), row, font=font(29), fill=INK)
    return image


def svg_path(points: list[tuple[int, int]]) -> str:
    if not points:
        return ""
    return "M " + " L ".join(f"{x} {y}" for x, y in downsample(points, 520))


def interactive_html(locale: str, main: list[tuple[int, int]], branch: list[tuple[int, int]]) -> str:
    ru = locale == "ru"
    page_url = (
        "https://yotti.net/blog/new-zealand/marshrut-po-yuzhnomu-ostrovu-novoy-zelandii-kraystcherch-tekapo-i-kuinstaun"
        if ru
        else "https://yotti.net/en/blog/new-zealand/a-slower-south-island-road-trip-from-christchurch-to-queenstown"
    )
    entries = [
        ("christchurch", "Крайстчерч" if ru else "Christchurch", "Дни 1–2" if ru else "Days 1–2", "Первые две ночи" if ru else "First two nights", "Крайстчерч: первые две ночи" if ru else "Two nights in Christchurch"),
        ("tekapo", "Текапо" if ru else "Tekapo", "Дни 3–5" if ru else "Days 3–5", "База у озера" if ru else "The lakeside base", "Текапо или Твайзел" if ru else "Tekapo or Twizel"),
        ("twizel", "Твайзел" if ru else "Twizel", "Дни 3–5" if ru else "Days 3–5", "Ближе к Аораки" if ru else "Closer to Aoraki", "Текапо или Твайзел" if ru else "Tekapo or Twizel"),
        ("aoraki", "Аораки" if ru else "Aoraki", "Один день" if ru else "One day", "Зависит от погоды" if ru else "Weather decides", "День в Аораки" if ru else "A day at Aoraki"),
        ("queenstown", "Куинстаун" if ru else "Queenstown", "Дни 6–9" if ru else "Days 6–9", "Финальная база" if ru else "The final base", "Два дня в Куинстауне" if ru else "Two full days in Queenstown"),
    ]
    offsets = {
        "christchurch": (-310, -52),
        "tekapo": (22, -100),
        "twizel": (22, 20),
        "aoraki": (-310, -42),
        "queenstown": (22, -42),
    }
    hotspots = []
    for key, label, days, note, fragment in entries:
        x, y = article_pixel(*STOPS[key])
        url = page_url + "#:~:text=" + urllib.parse.quote(fragment)
        dx, dy = offsets[key]
        hotspots.append(
            f'<a class="stop stop-{key}" href="{url}" aria-label="{label}: {note}">'
            f'<circle class="pin" cx="{x}" cy="{y}" r="15"/>'
            f'<g class="label" transform="translate({x + dx} {y + dy})">'
            f'<rect width="288" height="84" rx="20"/><text x="22" y="34">{label}</text>'
            f'<text class="small" x="22" y="63">{days} · {note}</text></g>'
            f'<title>{label}: {note}</title></a>'
        )
    return f'''<!doctype html>
<html lang="{locale}"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>{"Интерактивная карта маршрута по Южному острову" if ru else "Interactive South Island route map"}</title>
<style>
*{{box-sizing:border-box}}body{{margin:0;background:#f7f3ed;color:{INK};font-family:Arial,sans-serif}}main{{width:min(100%,1200px);margin:auto;overflow:hidden}}svg{{display:block;width:100%;height:auto}}.road{{fill:none;stroke-linecap:round;stroke-linejoin:round;stroke-dasharray:1;stroke-dashoffset:1;animation:draw 11s ease-in-out infinite}}.main{{stroke:{CORAL};stroke-width:11}}.branch{{stroke:{PINE};stroke-width:10;animation-delay:1.4s}}.under{{fill:none;stroke:#fffdf8;stroke-width:22;stroke-linecap:round;stroke-linejoin:round;opacity:.9}}.stop{{color:{CORAL};outline:none}}.stop-aoraki{{color:{PINE}}}.pin{{fill:#fffdf8;stroke:currentColor;stroke-width:8}}.label rect{{fill:#fffdf8;stroke:#d9e1dd;stroke-width:2;filter:drop-shadow(0 5px 10px rgba(23,36,33,.13))}}.label text{{font-size:34px;font-weight:700;fill:{INK}}}.label .small{{font-size:22px;font-weight:400;fill:{MUTED}}}.stop:hover .label rect,.stop:focus .label rect{{stroke:currentColor;stroke-width:5}}.stop:hover .pin,.stop:focus .pin{{fill:currentColor}}.meta{{display:flex;justify-content:space-between;gap:12px;padding:10px 14px 13px;background:#172421;color:white;font-size:14px}}.meta p{{margin:0}}@keyframes draw{{0%,8%{{stroke-dashoffset:1}}58%,88%{{stroke-dashoffset:0}}100%{{stroke-dashoffset:-1}}}}@media(max-width:640px){{.label text{{font-size:42px}}.label .small{{display:none}}.meta{{font-size:12px;flex-wrap:wrap}}}}@media(prefers-reduced-motion:reduce){{.road{{animation:none;stroke-dashoffset:0}}}}
</style></head><body><main>
<svg viewBox="0 0 {WIDTH} {HEIGHT}" role="img" aria-labelledby="map-title map-desc">
<title id="map-title">{"Маршрут Крайстчерч — Текапо или Твайзел — Аораки — Куинстаун" if ru else "Christchurch — Tekapo or Twizel — Aoraki — Queenstown route"}</title>
<desc id="map-desc">{"Нажмите на название места, чтобы открыть соответствующий раздел статьи." if ru else "Select a place name to open the matching article section."}</desc>
<image href="../inline/new-zealand-road-map-{locale}-base-v5.webp" width="{WIDTH}" height="{HEIGHT}"/>
<path class="under" pathLength="1" d="{svg_path(main)}"/><path class="road main" pathLength="1" d="{svg_path(main)}"/>
<path class="under" pathLength="1" d="{svg_path(branch)}"/><path class="road branch" pathLength="1" d="{svg_path(branch)}"/>
{''.join(hotspots)}
</svg><div class="meta"><p>{"Наведите или нажмите на город · маршрут повторяется" if ru else "Hover or select a city · the route repeats"}</p><p>© OpenStreetMap contributors · OSRM</p></div>
</main></body></html>'''


def optimize_photos() -> None:
    cover = Image.open(COVERS / "new-zealand-south-island-slow-road.png").convert("RGB")
    cover.thumbnail((1672, 941), Image.Resampling.LANCZOS)
    cover.save(COVERS / "new-zealand-south-island-slow-road-v5.webp", "WEBP", quality=84, method=6, optimize=True)
    for name in ("christchurch-avon", "lake-pukaki", "queenstown-waterfront"):
        source = Image.open(INLINE / f"new-zealand-{name}-v2.webp").convert("RGB")
        source.thumbnail((1440, 960), Image.Resampling.LANCZOS)
        source.save(INLINE / f"new-zealand-{name}-v5.webp", "WEBP", quality=80, method=6, optimize=True)


def main() -> None:
    INLINE.mkdir(parents=True, exist_ok=True)
    INTERACTIVE.mkdir(parents=True, exist_ok=True)
    base = tile_basemap()
    main_route = downsample([article_pixel(*point) for point in route_coordinates(ROUTE_MAIN_URL, "main-route")])
    aoraki_route = downsample([article_pixel(*point) for point in route_coordinates(ROUTE_AORAKI_URL, "aoraki-route")])
    for locale in ("ru", "en"):
        base.save(INLINE / f"new-zealand-road-map-{locale}-base-v5.webp", "WEBP", quality=76, method=6, optimize=True)
        save_map_assets(base, main_route, aoraki_route, locale)
        route_plan(locale).save(INLINE / f"new-zealand-route-plan-{locale}-v5.webp", "WEBP", quality=82, method=6, optimize=True)
        booking_plan(locale).save(INLINE / f"new-zealand-booking-plan-{locale}-v5.webp", "WEBP", quality=82, method=6, optimize=True)
        (INTERACTIVE / f"new-zealand-south-island-map-{locale}-v5.html").write_text(interactive_html(locale, main_route, aoraki_route), encoding="utf-8")
    optimize_photos()


if __name__ == "__main__":
    main()
