#!/usr/bin/env python3
from pathlib import Path
from PIL import Image, ImageDraw, ImageFont, ImageOps

ROOT = Path(__file__).resolve().parent.parent
GEN = Path("/Users/Stanislav/.codex/generated_images/01a06541-78cc-7dd0-9321-9be1e27049a5")
COVERS = ROOT / "assets" / "covers"
INLINE = ROOT / "assets" / "inline"
FONT = "/System/Library/Fonts/Supplemental/Arial.ttf"
BOLD = "/System/Library/Fonts/Supplemental/Arial Bold.ttf"

SOURCES = {
    "cover-medellin": "exec-917d31e4-d422-49a9-9705-dfc16148e079.png",
    "cover-leipzig": "exec-e100a049-8f7c-4391-8f73-1964d2950096.png",
    "cover-nairobi": "exec-a3b7224c-ade9-4508-952e-3a35801e985b.png",
    "cover-bolivia": "exec-88e43740-2046-43e5-ba1a-f17d1543850a.png",
    "medellin-laureles": "exec-637c280f-42a4-4ab5-944d-b90a4a6779d4.png",
    "medellin-metro": "exec-8a3eb4af-41f3-47ab-afbc-4785ed9ce32b.png",
    "medellin-centre": "exec-857faafa-627b-42ea-8f17-b21259afdf96.png",
    "medellin-hillside": "exec-1f8e8a13-c16e-458a-9997-d6b2c4d9c2d4.png",
    "leipzig-thomas": "exec-6d325772-abac-4689-a15e-ac87430b9876.png",
    "leipzig-passage": "exec-660db127-52a4-4cc4-91e6-842f8069c5f9.png",
    "leipzig-courtyard": "exec-dbec7917-f611-4f90-a5e4-fa2fced3ad8a.png",
    "leipzig-mendelssohn": "exec-4f921e87-faa3-4fce-89ee-4981aa5651e0.png",
    "leipzig-plagwitz": "exec-a1227a85-d6b6-4e14-9d3f-65b50239cfec.png",
    "nairobi-museum": "exec-ea860bf0-7528-4dd9-9dec-8ff2922f1f64.png",
    "nairobi-forest": "exec-f8dc6898-4bf3-4ccb-9ae7-2b8a61cd944f.png",
    "nairobi-evening": "exec-7dc81189-56ef-4084-900e-88dfe08e9c98.png",
    "bolivia-lapaz": "exec-6ba5cc99-030b-4827-afd1-b4098c076ba3.png",
    "bolivia-uyuni": "exec-e535584e-56f1-4d3a-be59-194f2890f7ef.png",
}


def font(size, bold=False):
    return ImageFont.truetype(BOLD if bold else FONT, size)


def save_webp(image, target, limit, quality=72):
    target.parent.mkdir(parents=True, exist_ok=True)
    for q in range(quality, 34, -4):
        image.save(target, "WEBP", quality=q, method=6, optimize=True)
        if target.stat().st_size <= limit:
            return
    raise RuntimeError(f"{target} is larger than {limit}")


def photo(key, name, cover=False):
    source = GEN / SOURCES[key]
    size = (1800, 1125) if cover else (1440, 960)
    limit = 400 * 1024 if cover else 300 * 1024
    target = (COVERS if cover else INLINE) / f"{name}.webp"
    image = ImageOps.fit(Image.open(source).convert("RGB"), size, Image.Resampling.LANCZOS)
    save_webp(image, target, limit)


def wrap(draw, text, fnt, width):
    lines, current = [], ""
    for word in text.split():
        trial = f"{current} {word}".strip()
        if draw.textbbox((0, 0), trial, font=fnt)[2] <= width:
            current = trial
        else:
            lines.append(current); current = word
    if current: lines.append(current)
    return lines


def graphic(name, title, subtitle, rows, accent="#24776B"):
    image = Image.new("RGB", (1200, 720), "#F7F3ED")
    draw = ImageDraw.Draw(image)
    draw.rounded_rectangle((42, 38, 1158, 682), 34, fill="white", outline="#D9E1DD", width=3)
    draw.text((76, 64), title, font=font(48, True), fill="#172421")
    draw.text((76, 124), subtitle, font=font(27), fill="#51615C")
    top, row_h = 194, 420 // len(rows)
    for i, (badge, heading, body) in enumerate(rows):
        y = top + i * row_h
        draw.rounded_rectangle((76, y, 200, y + 68), 20, fill=accent if i % 2 == 0 else "#4C86A8")
        draw.text((92, y + 16), badge, font=font(28, True), fill="white")
        draw.text((230, y), heading, font=font(32, True), fill="#172421")
        for j, line in enumerate(wrap(draw, body, font(25), 850)[:2]):
            draw.text((230, y + 40 + j * 28), line, font=font(25), fill="#51615C")
    save_webp(image, INLINE / f"{name}.webp", 100 * 1024, 88)


def main():
    for key, name in {
        "cover-medellin": "colombia-medellin-neighbourhood-viewpoints",
        "cover-leipzig": "germany-leipzig-music-courtyards-weekend",
        "cover-nairobi": "kenya-nairobi-museum-forest-city-day",
        "cover-bolivia": "buy-esim-bolivia-la-paz-uyuni",
    }.items(): photo(key, name, True)
    for key, name in {
        "medellin-laureles": "medellin-laureles-street", "medellin-metro": "medellin-metro-valley",
        "medellin-centre": "medellin-centre-botero", "medellin-hillside": "medellin-hillside-walk",
        "leipzig-thomas": "leipzig-thomaskirche-square", "leipzig-passage": "leipzig-glass-passage",
        "leipzig-courtyard": "leipzig-historic-courtyard", "leipzig-mendelssohn": "leipzig-mendelssohn-room",
        "leipzig-plagwitz": "leipzig-plagwitz-canal", "nairobi-museum": "nairobi-national-museum-courtyard",
        "nairobi-forest": "nairobi-karura-forest-path", "nairobi-evening": "nairobi-city-early-dinner",
        "bolivia-lapaz": "bolivia-la-paz-cable-car", "bolivia-uyuni": "bolivia-uyuni-road-stop",
    }.items(): photo(key, name)

    locales = {
      "ru": {
        "med-choice": ("Две опоры Медельина", "Выбирайте район по задаче, а не по списку мест", [("УТРО", "Центр", "Музейный квартал и короткая прогулка до полудня"), ("ДЕНЬ", "Линия метро", "Один подъём к виду на долину без гонки по канатным дорогам"), ("ВЕЧЕР", "Laureles", "Ужин и спокойная прогулка рядом с жильём")]),
        "med-layer": ("Город в два слоя", "Долина задаёт маршрут, склон — только один акцент", [("1", "Сначала низ", "Освойте метро и расстояния в ровной части города"), ("2", "Потом высота", "Поднимитесь к одному району или смотровой точке"), ("3", "Вернитесь засветло", "Не связывайте два дальних склона в один вечер")]),
        "lei-rhythm": ("Ритм выходных", "Музыка и пассажи работают лучше короткими связками", [("СБ", "Старый город", "Томаскирхе, музейный дом и два соседних пассажа"), ("ВС", "Один квартал", "Дворы центра, затем Plagwitz без обратных петель"), ("ЗАПАС", "Проверьте вход", "Часы концертов и музеев уточняйте перед визитом")]),
        "nai-day": ("Городской день", "Две большие остановки и ранний финиш", [("09:00", "Музей", "Главные галереи без попытки увидеть всё"), ("13:00", "Karura", "Одна размеченная петля с запасом света"), ("17:30", "Ужин", "Возвращение в знакомый район до вечернего трафика")]),
        "nai-move": ("Между точками", "Планируйте каждую поездку как отдельный участок", [("ВЫЕЗД", "Назовите вход", "У леса несколько ворот — сохраните нужное название"), ("АВТО", "Проверьте машину", "Сверьте номер и имя водителя до посадки"), ("НАЗАД", "Оставьте запас", "Не начинайте длинную тропу перед закрытием")]),
        "nai-trail": ("Одна петля в Karura", "Дистанцию выбирают у входа по времени и погоде", [("1", "Фото карты", "Сохраните номер ворот и цвет выбранной тропы"), ("2", "Контроль времени", "Развернитесь раньше, если темп оказался медленнее"), ("3", "Офлайн-выход", "Держите адрес точки встречи без интернета")]),
        "bo-pre": ("До вылета", "Профиль готовят там, где есть надёжный Wi‑Fi", [("1", "Проверьте телефон", "Устройство поддерживает есим и не привязано к оператору"), ("2", "Установите профиль", "Сохраните QR-код и инструкцию отдельно"), ("3", "Не удаляйте", "При сбое сначала проверьте линию и роуминг данных")]),
        "bo-zones": ("Город и дорога", "Один пакет решает разные задачи не одинаково", [("ЛА-ПАС", "Городские данные", "Навигация, сообщения, заказ транспорта"), ("ТРАССА", "Неровное покрытие", "Загрузки завершите до выезда"), ("УЮНИ", "Офлайн прежде всего", "Карта, билеты и контакты хранятся на устройстве")]),
        "bo-offline": ("Офлайн-набор", "Сохраните до ночного автобуса или тура", [("КАРТА", "Ла-Пас и Уюни", "Добавьте точку жилья и место встречи"), ("БИЛЕТ", "Скриншоты", "Маршрут, бронь и контакты перевозчика"), ("БАТ", "Заряд", "Пауэрбанк и кабель доступны в ручной клади")]),
        "bo-fix": ("Если данных нет", "Диагностика без удаления профиля", [("1", "Выберите линию", "Есим назначена для мобильных данных"), ("2", "Включите роуминг", "Только у нужной линии, если требует инструкция"), ("3", "Перезапустите сеть", "Авиарежим, выбор сети, затем поддержка")]),
      },
      "en": {
        "med-choice": ("Two Medellín anchors", "Choose each area for a job, not a checklist", [("AM", "The centre", "Museums and a compact walk before midday"), ("PM", "The metro", "One cable-car climb for a valley view"), ("EVE", "Laureles", "Dinner and an easy walk near your base")]),
        "med-layer": ("A two-layer city", "Use the valley for movement and one hillside for perspective", [("1", "Learn the floor", "Understand the metro and distances below"), ("2", "Add height", "Climb to one neighbourhood or viewpoint"), ("3", "Return early", "Do not connect two distant hillsides after dark")]),
        "lei-rhythm": ("A weekend rhythm", "Music and passages work in short clusters", [("SAT", "Old town", "St Thomas, one music house and two nearby arcades"), ("SUN", "One district", "Central courtyards, then Plagwitz without backtracking"), ("CHECK", "Confirm entry", "Recheck concert and museum hours before you go")]),
        "nai-day": ("One city day", "Two substantial stops and an early finish", [("09:00", "Museum", "Choose the main galleries instead of rushing them all"), ("13:00", "Karura", "Walk one marked loop with daylight in reserve"), ("17:30", "Dinner", "Return to a familiar district before evening traffic")]),
        "nai-move": ("Moving between stops", "Treat every ride as a separate leg", [("PICKUP", "Name the gate", "The forest has several entrances; save the right one"), ("CHECK", "Verify the car", "Match the plate and driver name before boarding"), ("BACK", "Keep a buffer", "Do not begin a long trail close to closing")]),
        "nai-trail": ("One Karura loop", "Choose the distance at the gate for time and weather", [("1", "Photograph the map", "Keep the gate number and trail colour"), ("2", "Watch the clock", "Turn back early if your pace is slower"), ("3", "Keep an offline exit", "Save your meeting point without relying on data")]),
        "bo-pre": ("Before departure", "Prepare the profile on reliable Wi‑Fi", [("1", "Check the phone", "It supports eSIM and is not carrier locked"), ("2", "Install the profile", "Keep the QR code and instructions separately"), ("3", "Do not delete it", "Check the line and data roaming first")]),
        "bo-zones": ("City and road", "One plan serves very different jobs", [("LA PAZ", "City data", "Navigation, messages and ride booking"), ("ROAD", "Uneven coverage", "Finish downloads before departure"), ("UYUNI", "Offline first", "Keep maps, tickets and contacts on the device")]),
        "bo-offline": ("Your offline kit", "Save it before an overnight bus or tour", [("MAP", "La Paz and Uyuni", "Pin the hotel and meeting point"), ("TICKET", "Screenshots", "Route, booking and operator contact"), ("POWER", "Stay charged", "Keep a power bank and cable in your day bag")]),
        "bo-fix": ("No mobile data?", "Troubleshoot without deleting the profile", [("1", "Select the line", "Assign the eSIM to mobile data"), ("2", "Enable roaming", "Only on that line if the instructions require it"), ("3", "Restart the network", "Airplane mode, network selection, then support")]),
      }
    }
    names = {"med-choice":"medellin-two-anchors", "med-layer":"medellin-valley-hillside", "lei-rhythm":"leipzig-weekend-rhythm", "nai-day":"nairobi-city-day", "nai-move":"nairobi-between-stops", "nai-trail":"nairobi-karura-loop", "bo-pre":"bolivia-esim-preflight", "bo-zones":"bolivia-city-road-data", "bo-offline":"bolivia-offline-kit", "bo-fix":"bolivia-data-troubleshooting"}
    for locale, blocks in locales.items():
        for key, payload in blocks.items(): graphic(f"{names[key]}-{locale}", *payload)


if __name__ == "__main__": main()
