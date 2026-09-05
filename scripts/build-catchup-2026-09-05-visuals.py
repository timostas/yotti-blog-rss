#!/usr/bin/env python3
from __future__ import annotations

import io
import json
import math
import time
import urllib.request
from pathlib import Path

from PIL import Image, ImageDraw, ImageEnhance, ImageFont, ImageOps

ROOT = Path(__file__).resolve().parent.parent
COVERS = ROOT / "assets" / "covers"
INLINE = ROOT / "assets" / "inline"
GEN = Path("/Users/Stanislav/.codex/generated_images/01a06541-78cc-7dd0-9321-9be1e27049a5")
CACHE = Path("/tmp/yotti-galway-map-cache")
UA = "YottiBlogMapBuilder/1.0 (+https://yotti.net)"
SITE = "https://timostas.github.io/yotti-blog-rss/assets"

FONT_REGULAR = "/System/Library/Fonts/Supplemental/Arial.ttf"
FONT_BOLD = "/System/Library/Fonts/Supplemental/Arial Bold.ttf"
INK = "#172421"
MUTED = "#51615C"
PAPER = "#F7F3ED"
CORAL = "#F36B59"
PINE = "#24776B"
BLUE = "#4C86A8"
GOLD = "#C18B3A"

SOURCES = {
    "cover-galway": "exec-fc497619-fa2f-413f-a0b6-9765a0fa7583.png",
    "cover-philippines": "exec-c5533bf7-3fae-4f36-a218-3fecc43b5692.png",
    "cover-melbourne": "exec-78bb62d6-9f26-4cc9-819d-3e10537fc906.png",
    "cover-nepal": "exec-7bd8b3e9-12c7-44e3-a9c3-01e5539a54eb.png",
    "galway-city": "exec-e9feaae4-48e1-4a53-9fa7-8a60ad7593f2.png",
    "galway-connemara": "exec-3a6ff88e-deae-449c-b8a1-95aaf4356335.png",
    "galway-aran": "exec-4314815a-755c-4bbd-abf1-3229c8ca72a4.png",
    "philippines-intramuros": "exec-068f64f6-db22-415b-942a-845b665e8d8f.png",
    "philippines-pasig": "exec-44f4389c-c87d-4c0c-969f-ddd693e983b5.png",
    "philippines-carbon": "exec-ae305216-30c7-4d8f-bc2f-f327cc5d48fe.png",
    "philippines-ferry": "exec-b1488019-458b-4c51-96cb-3ea77e8e405b.png",
    "melbourne-market": "exec-5e1b42ac-c660-4ffe-ae48-9e2f75c53850.png",
    "melbourne-laneway": "exec-7895d5d1-138b-42f4-8d6e-846ba9244c99.png",
    "melbourne-tram": "exec-65fef50b-d83b-41c3-b343-9b95f1937ac8.png",
    "melbourne-bakery": "exec-9b4c9df5-90c7-4eda-a126-8d486d0322c3.png",
    "melbourne-neighbourhood": "exec-19fe7270-3c23-4f1a-9133-003f03a0a5e9.png",
    "nepal-kathmandu": "exec-7b8f41bd-7c44-40be-84e3-e67794049581.png",
    "nepal-pokhara": "exec-8793263b-1c13-4d5e-b687-61018df30ae6.png",
}


def font(size: int, bold: bool = False):
    return ImageFont.truetype(FONT_BOLD if bold else FONT_REGULAR, size)


def save_webp(image: Image.Image, path: Path, max_bytes: int, start_quality: int = 78):
    path.parent.mkdir(parents=True, exist_ok=True)
    for quality in range(start_quality, 34, -4):
        image.save(path, "WEBP", quality=quality, method=6, optimize=True)
        if path.stat().st_size <= max_bytes:
            return
    raise RuntimeError(f"{path} exceeds {max_bytes} bytes")


def convert(source_key: str, output: Path, size: tuple[int, int], max_bytes: int):
    source = GEN / SOURCES[source_key]
    if not source.exists():
        raise FileNotFoundError(source)
    image = Image.open(source).convert("RGB")
    image = ImageOps.fit(image, size, method=Image.Resampling.LANCZOS)
    save_webp(image, output, max_bytes)


def wrap(draw: ImageDraw.ImageDraw, text: str, fnt, width: int) -> list[str]:
    words = text.split()
    lines, current = [], ""
    for word in words:
        trial = f"{current} {word}".strip()
        if draw.textbbox((0, 0), trial, font=fnt)[2] <= width:
            current = trial
        else:
            if current:
                lines.append(current)
            current = word
    if current:
        lines.append(current)
    return lines


def graphic(path: Path, title: str, subtitle: str, rows: list[tuple[str, str, str]], accent: str = PINE):
    image = Image.new("RGB", (1200, 720), PAPER)
    draw = ImageDraw.Draw(image)
    draw.rounded_rectangle((42, 38, 1158, 682), radius=34, fill="#FFFFFF", outline="#D9E1DD", width=3)
    draw.text((76, 68), title, font=font(52, True), fill=INK)
    draw.text((76, 132), subtitle, font=font(29), fill=MUTED)
    top = 202
    row_h = max(110, 410 // max(1, len(rows)))
    for index, (badge, heading, body) in enumerate(rows):
        y = top + index * row_h
        draw.rounded_rectangle((76, y, 208, y + 72), radius=22, fill=accent if index % 2 == 0 else BLUE)
        draw.text((94, y + 17), badge, font=font(30, True), fill="#FFFFFF")
        draw.text((242, y + 2), heading, font=font(34, True), fill=INK)
        body_lines = wrap(draw, body, font(27), 840)[:2]
        for line_index, line in enumerate(body_lines):
            draw.text((242, y + 45 + line_index * 30), line, font=font(27), fill=MUTED)
    save_webp(image, path, 100 * 1024, 86)


def fetch(url: str, cache_path: Path) -> bytes:
    if cache_path.exists():
        return cache_path.read_bytes()
    request = urllib.request.Request(url, headers={"User-Agent": UA})
    with urllib.request.urlopen(request, timeout=45) as response:
        data = response.read()
    cache_path.parent.mkdir(parents=True, exist_ok=True)
    cache_path.write_bytes(data)
    return data


WIDTH, HEIGHT, ZOOM = 1200, 900, 9
WEST, EAST, NORTH, SOUTH = -10.35, -8.85, 53.72, 53.12
STOPS = {
    "galway": (-9.0568, 53.2707),
    "rossaveel": (-9.5560, 53.2670),
    "clifden": (-10.0210, 53.4890),
    "letterfrack": (-9.9490, 53.5530),
}


def world_pixel(lon: float, lat: float):
    scale = 256 * (2**ZOOM)
    x = (lon + 180) / 360 * scale
    sin_lat = math.sin(math.radians(lat))
    y = (0.5 - math.log((1 + sin_lat) / (1 - sin_lat)) / (4 * math.pi)) * scale
    return x, y


def article_pixel(lon: float, lat: float):
    x0, y0 = world_pixel(WEST, NORTH)
    x1, y1 = world_pixel(EAST, SOUTH)
    x, y = world_pixel(lon, lat)
    return round((x - x0) / (x1 - x0) * WIDTH), round((y - y0) / (y1 - y0) * HEIGHT)


def basemap():
    x0, y0 = world_pixel(WEST, NORTH)
    x1, y1 = world_pixel(EAST, SOUTH)
    min_x, max_x = math.floor(x0 / 256), math.floor(x1 / 256)
    min_y, max_y = math.floor(y0 / 256), math.floor(y1 / 256)
    canvas = Image.new("RGB", ((max_x - min_x + 1) * 256, (max_y - min_y + 1) * 256))
    for ty in range(min_y, max_y + 1):
        for tx in range(min_x, max_x + 1):
            data = fetch(f"https://tile.openstreetmap.org/{ZOOM}/{tx}/{ty}.png", CACHE / str(ZOOM) / str(tx) / f"{ty}.png")
            tile = Image.open(io.BytesIO(data)).convert("RGB")
            canvas.paste(tile, ((tx - min_x) * 256, (ty - min_y) * 256))
            time.sleep(0.05)
    crop = canvas.crop((round(x0 - min_x * 256), round(y0 - min_y * 256), round(x1 - min_x * 256), round(y1 - min_y * 256)))
    crop = crop.resize((WIDTH, HEIGHT), Image.Resampling.LANCZOS)
    crop = ImageEnhance.Color(crop).enhance(0.55)
    return Image.blend(crop, Image.new("RGB", crop.size, "#FFF9EF"), 0.20)


def route(url: str, name: str):
    payload = json.loads(fetch(url, CACHE / f"{name}.json"))
    points = payload["routes"][0]["geometry"]["coordinates"]
    step = max(1, math.ceil(len(points) / 550))
    return [article_pixel(*point) for point in points[::step]] + [article_pixel(*points[-1])]


def map_frame(base: Image.Image, coast: list[tuple[int, int]], ferry: list[tuple[int, int]], ratio: float, locale: str):
    image = base.copy().convert("RGBA")
    draw = ImageDraw.Draw(image, "RGBA")
    end = max(2, round(len(coast) * ratio))
    draw.line(coast[:end], fill=(255, 255, 255, 238), width=20, joint="curve")
    draw.line(coast[:end], fill=CORAL, width=10, joint="curve")
    if ratio > 0.55:
        branch_end = max(2, round(len(ferry) * min(1, (ratio - 0.55) / 0.45)))
        draw.line(ferry[:branch_end], fill=(255, 255, 255, 238), width=18, joint="curve")
        draw.line(ferry[:branch_end], fill=PINE, width=9, joint="curve")
    labels = {
        "ru": {"galway": "Голуэй · база", "rossaveel": "Россавил · паром", "clifden": "Клифден", "letterfrack": "Леттерфрак"},
        "en": {"galway": "Galway · base", "rossaveel": "Rossaveel · ferry", "clifden": "Clifden", "letterfrack": "Letterfrack"},
    }[locale]
    for key, label in labels.items():
        x, y = article_pixel(*STOPS[key])
        draw.ellipse((x - 11, y - 11, x + 11, y + 11), fill="#FFFDF8", outline=CORAL if key != "rossaveel" else PINE, width=6)
        box = draw.textbbox((0, 0), label, font=font(28, True))
        bx = max(12, min(WIDTH - (box[2] - box[0]) - 38, x + 16))
        by = max(74, min(HEIGHT - 80, y - 30))
        draw.rounded_rectangle((bx, by, bx + box[2] - box[0] + 22, by + 45), radius=12, fill=(255, 253, 248, 232))
        draw.text((bx + 11, by + 7), label, font=font(28, True), fill=INK)
    title = "Голуэй как база · 4 дня" if locale == "ru" else "Galway as a base · 4 days"
    draw.rounded_rectangle((24, 20, 520, 84), radius=20, fill=(23, 36, 33, 226))
    draw.text((48, 34), title, font=font(36, True), fill="#FFFDF8")
    draw.rounded_rectangle((795, 846, 1184, 888), radius=12, fill=(255, 253, 248, 230))
    draw.text((812, 854), "© OSM contributors · OSRM", font=font(23), fill=MUTED)
    return image.convert("RGB")


def build_maps():
    base = basemap()
    coast = route("https://router.project-osrm.org/route/v1/driving/-9.0568,53.2707;-10.0210,53.4890;-9.9490,53.5530?overview=full&geometries=geojson&steps=false", "galway-coast")
    ferry = route("https://router.project-osrm.org/route/v1/driving/-9.0568,53.2707;-9.5560,53.2670?overview=full&geometries=geojson&steps=false", "galway-rossaveel")
    for locale in ("ru", "en"):
        static = map_frame(base, coast, ferry, 1, locale)
        save_webp(static, INLINE / f"ireland-galway-road-map-{locale}-static.webp", 100 * 1024, 64)
        frames = [map_frame(base, coast, ferry, ratio, locale) for ratio in (0.03, 0.18, 0.38, 0.58, 0.78, 1.0)]
        target = INLINE / f"ireland-galway-road-map-{locale}-animated.webp"
        for quality in (38, 32, 26, 22):
            frames[0].save(target, "WEBP", save_all=True, append_images=frames[1:], duration=[350, 220, 220, 220, 220, 2400], loop=0, quality=quality, method=6, minimize_size=True)
            if target.stat().st_size <= 300 * 1024:
                break
        if target.stat().st_size > 300 * 1024:
            raise RuntimeError(f"animated map too large: {target.stat().st_size}")


def main():
    cover_files = {
        "cover-galway": "ireland-galway-west-coast-base.webp",
        "cover-philippines": "philippines-manila-or-cebu-first-base.webp",
        "cover-melbourne": "melbourne-markets-laneways-neighbourhoods.webp",
        "cover-nepal": "buy-esim-nepal-kathmandu-pokhara.webp",
    }
    for key, name in cover_files.items():
        convert(key, COVERS / name, (1672, 941), 400 * 1024)
    photo_keys = [key for key in SOURCES if not key.startswith("cover-") and key != "galway-connemara"] + ["galway-connemara"]
    for key in photo_keys:
        convert(key, INLINE / f"{key}.webp", (1440, 960), 210 * 1024)

    data = {
        "ru": {
            "galway-route-plan": ("Четыре дня из одной базы", "Два выезда можно менять местами по погоде", [("1", "Голуэй", "знакомство с городом и свободный вечер"), ("2", "Коннемара", "Клифден и Леттерфрак одним выездом"), ("3", "Аранские острова", "паромный день через Россавил"), ("4", "Резерв", "город, побережье или перенос морского дня")]),
            "galway-weather-plan": ("Как переставлять дни", "Морской выезд получает лучший прогноз", [("ЯСНО", "Острова", "открытые виды и меньше риска потерять паромный день"), ("ОБЛАЧНО", "Коннемара", "дорожный день остаётся содержательным"), ("ДОЖДЬ", "Голуэй", "рынок, музей и короткие прогулки между помещениями")]),
            "philippines-base-choice": ("Манила или Себу", "Выбор зависит от следующего участка поездки", [("МАНИЛА", "Город и история", "Интрамурос, музеи и прямой старт по Лусону"), ("СЕБУ", "Островной узел", "компактнее для дальнейших паромов и Висайских островов"), ("ОБА", "Нужен запас", "первый день не стоит перегружать пересадками")]),
            "philippines-onward-route": ("Куда двигаться дальше", "Сначала выбираем регион, затем аэропорт", [("ЛУСОН", "Старт из Манилы", "городской день перед северным или южным маршрутом"), ("ВИСАЙИ", "Старт из Себу", "город и гавань перед островным продолжением"), ("СМЕШАННЫЙ", "Внутренний перелёт", "не склеивать две базы в один уставший день")]),
            "melbourne-day-rhythm": ("Один день в трёх масштабах", "Рынок, центр и один жилой район", [("УТРО", "Queen Victoria Market", "завтрак и торговые ряды до городской суеты"), ("ДЕНЬ", "Переулки центра", "короткий маршрут без охоты за каждым граффити"), ("ВЕЧЕР", "Fitzroy или Carlton", "трамвай, прогулка и ужин в одном районе")]),
            "nepal-setup-check": ("Настройка до вылета", "Профиль готов, пакет включится в Непале", [("1", "Проверить телефон", "совместимость с есим и отсутствие блокировки оператора"), ("2", "Установить по Wi-Fi", "сохранить QR-код и не удалять профиль"), ("3", "Выбрать данные", "в Непале включить линию и роуминг данных")]),
            "nepal-two-base-plan": ("Катманду и Покхара", "Связь помогает в городах, офлайн-план — между ними", [("КТМ", "Катманду", "адрес жилья, такси, карты и сообщения"), ("ПУТЬ", "Переезд", "офлайн-карта и сохранённые билеты"), ("PKR", "Покхара", "навигация по городу и связь с жильём")]),
            "nepal-offline-kit": ("Что сохранить офлайн", "Минимум, который работает без сигнала", [("КАРТА", "Две базы и дорога", "адреса, точки прибытия и район жилья"), ("БРОНЬ", "Билеты и отели", "скриншоты с датами и контактами"), ("ПЛАН", "Встречи и поддержка", "время, место и номер заказа есим")]),
            "nepal-diagnostics": ("Если данных нет", "Проверяем по одному уровню", [("ЛИНИЯ", "Включена ли есим", "и выбрана ли она для мобильных данных"), ("РОУМИНГ", "Разрешён ли роуминг", "для туристического профиля он обычно нужен"), ("СЕТЬ", "Есть ли регистрация", "перезапуск сети без удаления профиля"), ("ПОМОЩЬ", "Сохранить данные", "написать в поддержку, не стирая есим")]),
        },
        "en": {
            "galway-route-plan": ("Four days from one base", "Swap the two outings when the forecast changes", [("1", "Galway", "city orientation and an unplanned evening"), ("2", "Connemara", "Clifden and Letterfrack in one outing"), ("3", "Aran Islands", "a ferry day through Rossaveel"), ("4", "Weather buffer", "city, coast or a moved sea day")]),
            "galway-weather-plan": ("How to move the days", "Give the sea outing the clearest forecast", [("CLEAR", "Islands", "open views and a safer ferry day"), ("CLOUD", "Connemara", "a road journey still works in mixed weather"), ("RAIN", "Galway", "market, museum and short covered walks")]),
            "philippines-base-choice": ("Manila or Cebu", "Choose around the next region, not a city ranking", [("MANILA", "City and history", "Intramuros, museums and a start into Luzon"), ("CEBU", "Island hub", "a compact gateway to onward Visayas travel"), ("EITHER", "Keep a buffer", "do not overload the arrival day with connections")]),
            "philippines-onward-route": ("Where the trip goes next", "Choose the region first, then the airport", [("LUZON", "Start in Manila", "a city day before a northern or southern leg"), ("VISAYAS", "Start in Cebu", "city and harbour before island travel"), ("BOTH", "Use a separate flight day", "avoid forcing two bases into one tired day")]),
            "melbourne-day-rhythm": ("One day at three scales", "Market, central lanes and one neighbourhood", [("MORNING", "Queen Victoria Market", "breakfast and trading halls before the rush"), ("MIDDAY", "Central laneways", "a short walk without collecting every mural"), ("EVENING", "Fitzroy or Carlton", "tram, streets and dinner in one area")]),
            "nepal-setup-check": ("Set up before departure", "The profile is ready; the plan starts in Nepal", [("1", "Check the phone", "eSIM support and no carrier lock"), ("2", "Install on Wi-Fi", "save the QR code and keep the profile"), ("3", "Select data", "enable the line and data roaming in Nepal")]),
            "nepal-two-base-plan": ("Kathmandu and Pokhara", "Mobile data helps in cities; offline files cover the road", [("KTM", "Kathmandu", "accommodation, taxis, maps and messages"), ("ROAD", "Transfer", "offline map and saved tickets"), ("PKR", "Pokhara", "local navigation and accommodation contact")]),
            "nepal-offline-kit": ("Keep these offline", "The small kit that works without a signal", [("MAP", "Both bases and road", "arrival points, addresses and accommodation area"), ("BOOK", "Tickets and stays", "screenshots with dates and contacts"), ("PLAN", "Meetings and support", "time, place and eSIM order number")]),
            "nepal-diagnostics": ("When data is missing", "Check one layer at a time", [("LINE", "Is the eSIM on?", "and selected for mobile data"), ("ROAM", "Is roaming enabled?", "travel profiles normally require it"), ("NET", "Is the phone registered?", "refresh the connection without deleting the profile"), ("HELP", "Keep the evidence", "contact support before erasing the eSIM")]),
        },
    }
    for locale, graphics in data.items():
        for name, values in graphics.items():
            graphic(INLINE / f"{name}-{locale}.webp", *values)
    build_maps()


if __name__ == "__main__":
    main()
