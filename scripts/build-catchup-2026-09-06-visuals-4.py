#!/usr/bin/env python3
from pathlib import Path

from PIL import Image, ImageDraw, ImageFont, ImageOps


ROOT = Path(__file__).resolve().parent.parent
GEN = Path("/Users/Stanislav/.codex/generated_images/01a06014-44ae-7ab0-a1f9-01aff61cd0a1")
COVERS = ROOT / "assets" / "covers"
INLINE = ROOT / "assets" / "inline"
FONT = "/System/Library/Fonts/Supplemental/Arial.ttf"
BOLD = "/System/Library/Fonts/Supplemental/Arial Bold.ttf"
PAPER = "#F7F3ED"
INK = "#172421"
MUTED = "#51615C"
PINE = "#24776B"
BLUE = "#4C86A8"
CORAL = "#F36B59"

SOURCES = {
    "cover-uz": "exec-1b5f0175-e241-44fd-b403-da487ffcc7c0.png",
    "cover-be": "exec-8a9531c2-295e-4726-bf8b-4ac049955c42.png",
    "cover-gh": "exec-f19ca6fe-64c8-47d0-99b7-f7f3292fe7f6.png",
    "cover-al": "exec-f473c1cc-1b08-4007-bfd5-d4180b519789.png",
    "samarkand-shade": "exec-8c44b4fd-bff2-4d8f-a41d-0bd660e1bb1f.png",
    "samarkand-lunch": "exec-53d3f22b-3fd7-4147-ba29-79b96d478d04.png",
    "samarkand-shah": "exec-d7cb4d02-cd8f-4031-8815-0a1dbf8acf7a.png",
    "samarkand-blue": "exec-73519753-72b2-4e5d-9118-d6b4b5c24aa5.png",
    "ghent-quays": "exec-a1a0eb5c-b689-4dd0-8d4b-216b760ea0d5.png",
    "ghent-artisan": "exec-b49dea0c-7e46-4b55-a53d-7f7d6730db72.png",
    "ghent-press": "exec-f38bae0c-a871-4622-b5d6-ac2111c94628.png",
    "ghent-patershol": "exec-283fddff-6531-4e63-882a-83556e1f075f.png",
    "ghent-dusk": "exec-6270dcfd-1b62-48f3-8ce7-11b592dc09f0.png",
    "accra-market": "exec-2fbd8cc0-0815-4c0b-8ad8-9325617940ec.png",
    "accra-museum": "exec-5d296789-d3ea-405d-a0ad-bc71b3935625.png",
    "accra-park": "exec-4f222f95-31cc-40bd-a331-4323501b0d6c.png",
    "albania-tirana": "exec-719fc1a6-3948-4f21-a602-427babcaec57.png",
    "albania-road": "exec-eea20104-2ef5-4488-87ce-6c8e4a7c9ca8.png",
}


def font(size: int, bold: bool = False):
    return ImageFont.truetype(BOLD if bold else FONT, size)


def save_webp(image: Image.Image, path: Path, limit: int, start_quality: int = 76):
    path.parent.mkdir(parents=True, exist_ok=True)
    for quality in range(start_quality, 28, -4):
        image.save(path, "WEBP", quality=quality, method=6, optimize=True)
        if path.stat().st_size <= limit:
            return
    raise RuntimeError(f"{path} exceeds {limit} bytes")


def photo(source_key: str, name: str, cover: bool = False):
    source = GEN / SOURCES[source_key]
    if not source.exists():
        raise FileNotFoundError(source)
    size = (1672, 941) if cover else (1440, 960)
    image = ImageOps.fit(Image.open(source).convert("RGB"), size, Image.Resampling.LANCZOS)
    save_webp(image, (COVERS if cover else INLINE) / f"{name}.webp", (400 if cover else 300) * 1024)


def wrap(draw: ImageDraw.ImageDraw, text: str, face, width: int):
    lines, current = [], ""
    for word in text.split():
        trial = f"{current} {word}".strip()
        if draw.textbbox((0, 0), trial, font=face)[2] <= width:
            current = trial
        else:
            if current:
                lines.append(current)
            current = word
    if current:
        lines.append(current)
    return lines


def graphic(name: str, title: str, subtitle: str, rows: list[tuple[str, str, str]]):
    image = Image.new("RGB", (1200, 720), PAPER)
    draw = ImageDraw.Draw(image)
    draw.rounded_rectangle((42, 38, 1158, 682), radius=34, fill="white", outline="#D9E1DD", width=3)
    draw.text((76, 64), title, font=font(47, True), fill=INK)
    draw.text((76, 124), subtitle, font=font(27), fill=MUTED)
    row_height = 420 // len(rows)
    for index, (badge, heading, body) in enumerate(rows):
        y = 194 + index * row_height
        draw.rounded_rectangle((76, y, 202, y + 68), radius=20, fill=PINE if index % 2 == 0 else BLUE)
        draw.text((91, y + 16), badge, font=font(27, True), fill="white")
        draw.text((232, y), heading, font=font(31, True), fill=INK)
        for line_index, line in enumerate(wrap(draw, body, font(25), 850)[:2]):
            draw.text((232, y + 40 + line_index * 28), line, font=font(25), fill=MUTED)
    save_webp(image, INLINE / f"{name}.webp", 100 * 1024, 88)


def main():
    covers = {
        "cover-uz": "uzbekistan-samarkand-shade-evening-walk",
        "cover-be": "belgium-ghent-canal-craft-weekend",
        "cover-gh": "ghana-accra-market-coast-city-day",
        "cover-al": "buy-esim-albania-tirana-riviera",
    }
    for key, name in covers.items():
        photo(key, name, True)

    photos = {
        "samarkand-shade": "samarkand-registan-shade",
        "samarkand-lunch": "samarkand-chaikhana-lunch",
        "samarkand-shah": "samarkand-shah-i-zinda-afternoon",
        "samarkand-blue": "samarkand-registan-blue-hour",
        "ghent-quays": "ghent-graslei-korenlei-morning",
        "ghent-artisan": "ghent-leather-artisan",
        "ghent-press": "ghent-industrial-printing-press",
        "ghent-patershol": "ghent-patershol-lane",
        "ghent-dusk": "ghent-canal-dusk",
        "accra-market": "accra-makola-market-edge",
        "accra-museum": "accra-national-museum-gallery",
        "accra-park": "accra-nkrumah-memorial-park",
        "albania-tirana": "albania-tirana-offline-setup",
        "albania-road": "albania-llogara-coastal-bus",
    }
    for key, name in photos.items():
        photo(key, name)

    blocks = {
        "ru": {
            "samarkand-heat-rhythm": ("День вокруг жары", "Главные прогулки — по краям дня", [("07:00", "Большой ансамбль", "Регистан или Шахи-Зинда до сильного солнца"), ("13:00", "Длинная пауза", "Обед, тень и минимум переходов"), ("18:00", "Вторая прогулка", "Вернуться к архитектуре в мягком свете")]),
            "samarkand-evening-choice": ("Что оставить на вечер", "Один сильный финал лучше гонки", [("СВЕТ", "Регистан", "Открытая площадь и смена дневного света"), ("ТИШЕ", "Гур-Эмир", "Компактный визит без длинной связки"), ("РЕЗЕРВ", "Сад или чай", "Если жара забрала больше сил")]),
            "ghent-craft-loop": ("Гент через ремесло", "Вода связывает три разные остановки", [("УТРО", "Набережные", "Graslei и Korenlei до плотного потока"), ("ДЕНЬ", "Мастерская", "Один процесс, материал и разговор"), ("ВЕЧЕР", "Patershol", "Узкие улицы и короткий путь к воде")]),
            "accra-day-order": ("Один день в Аккре", "Три содержательные остановки без зигзагов", [("УТРО", "Makola", "Короткий рыночный блок с ясной целью"), ("ДЕНЬ", "National Museum", "История и искусство в прохладе"), ("ВЕЧЕР", "Nkrumah Park", "Открытое пространство ближе к побережью")]),
            "accra-market-plan": ("Как читать рынок", "Сначала задача, потом покупка", [("ВХОД", "Выберите край", "Не стойте в главном потоке"), ("ТОВАР", "Один ряд", "Ткань, корзина или продукты — не всё сразу"), ("ВЫХОД", "Точка встречи", "Сохраните ориентир до погружения в ряды")]),
            "accra-move-plan": ("Переезды по городу", "Каждый участок проверяется отдельно", [("АДРЕС", "Точный вход", "Музей, парк и рынок имеют разные стороны"), ("ВРЕМЯ", "Оставьте запас", "Плотный трафик не превращайте в точный прогноз"), ("ОФЛАЙН", "Сохраните маршрут", "Адрес жилья и точки дня доступны без сети")]),
            "albania-esim-preflight": ("До поездки", "Профиль готовится на надёжном Wi-Fi", [("1", "Совместимость", "Телефон поддерживает есим и не заблокирован"), ("2", "Установка", "QR-код и инструкция сохранены отдельно"), ("3", "Активация", "Линию включают по условиям выбранного пакета")]),
            "albania-city-coast-data": ("Тирана и Ривьера", "Связь решает разные задачи", [("ТИР", "Город", "Навигация, сообщения и адрес жилья"), ("ДОРОГА", "Переезд", "Маршрут и остановки сохранены заранее"), ("БЕРЕГ", "Ривьера", "Контакты жилья и обратный план офлайн")]),
            "albania-offline-kit": ("Офлайн-набор", "Сохраните до горной дороги", [("КАРТА", "Тирана — Химара", "Ключевые развилки и адрес ночёвки"), ("БРОНЬ", "Транспорт и жильё", "Скриншоты с датой и контактом"), ("ЗАРЯД", "Питание", "Кабель и пауэрбанк доступны в пути")]),
            "albania-data-fix": ("Если данных нет", "Проверка без удаления профиля", [("ЛИНИЯ", "Выберите есим", "Назначьте её для мобильных данных"), ("РОУМ", "Проверьте роуминг", "Следуйте инструкции текущего пакета"), ("СЕТЬ", "Обновите связь", "Авиарежим, выбор сети, затем поддержка")]),
        },
        "en": {
            "samarkand-heat-rhythm": ("Build around the heat", "Put the long walks at the edges of the day", [("07:00", "Major ensemble", "Registan or Shah-i-Zinda before strong sun"), ("13:00", "Long pause", "Lunch, shade and very little walking"), ("18:00", "Second walk", "Return to the architecture in softer light")]),
            "samarkand-evening-choice": ("Choose one evening finish", "One strong ending beats a rushed list", [("LIGHT", "Registan", "Open square and changing evening light"), ("QUIET", "Gur-e-Amir", "A compact visit without a long connection"), ("BUFFER", "Garden or tea", "Use it when the heat has taken more energy")]),
            "ghent-craft-loop": ("Ghent through making", "Water links three different stops", [("AM", "The quays", "Graslei and Korenlei before the busy hours"), ("PM", "One workshop", "Follow a process, material and conversation"), ("EVE", "Patershol", "Small streets and a short return to the water")]),
            "accra-day-order": ("One day in Accra", "Three substantial stops without zigzags", [("AM", "Makola", "A short market visit with one purpose"), ("MID", "National Museum", "History and art in a cooler room"), ("EVE", "Nkrumah Park", "Open space closer to the coast")]),
            "accra-market-plan": ("How to read the market", "Choose the task before the purchase", [("EDGE", "Pick an entrance", "Pause outside the main flow"), ("ROW", "Follow one category", "Textiles, baskets or food — not everything"), ("EXIT", "Keep a meeting point", "Save one landmark before entering the lanes")]),
            "accra-move-plan": ("Moving through Accra", "Treat every leg as a separate decision", [("DOOR", "Use the exact entrance", "The market, museum and park face different streets"), ("BUFFER", "Allow extra time", "Dense traffic is not a precise timetable"), ("SAVE", "Keep the route offline", "Accommodation and day stops work without data")]),
            "albania-esim-preflight": ("Before departure", "Prepare the profile on reliable Wi-Fi", [("1", "Compatibility", "The phone supports eSIM and is unlocked"), ("2", "Installation", "Keep the QR code and instructions separately"), ("3", "Activation", "Turn the line on according to the chosen plan")]),
            "albania-city-coast-data": ("Tirana and the Riviera", "Mobile data has different jobs", [("TIA", "In the city", "Navigation, messages and accommodation"), ("ROAD", "In transit", "Save the route and planned stops first"), ("COAST", "On the Riviera", "Keep lodging contacts and a return plan offline")]),
            "albania-offline-kit": ("Your offline kit", "Save it before the mountain road", [("MAP", "Tirana to Himarë", "Key turns and the overnight address"), ("BOOK", "Transport and stay", "Screenshots with date and contact"), ("POWER", "Stay charged", "Keep cable and power bank within reach")]),
            "albania-data-fix": ("No mobile data?", "Troubleshoot without deleting the profile", [("LINE", "Select the eSIM", "Assign it to mobile data"), ("ROAM", "Check roaming", "Follow the instructions for the current plan"), ("NET", "Refresh connection", "Airplane Mode, network choice, then support")]),
        },
    }
    for locale, items in blocks.items():
        for name, payload in items.items():
            graphic(f"{name}-{locale}", *payload)


if __name__ == "__main__":
    main()
