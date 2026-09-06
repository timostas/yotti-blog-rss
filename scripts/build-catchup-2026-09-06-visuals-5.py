#!/usr/bin/env python3
from pathlib import Path

from PIL import Image, ImageDraw, ImageFont, ImageOps


ROOT = Path(__file__).resolve().parent.parent
GEN = Path("/Users/Stanislav/.codex/generated_images/01a06014-44ae-7ab0-a1f9-01aff61cd0a1")
COVERS = ROOT / "assets" / "covers"
INLINE = ROOT / "assets" / "inline"
FONT = "/System/Library/Fonts/Supplemental/Arial.ttf"
BOLD = "/System/Library/Fonts/Supplemental/Arial Bold.ttf"
PAPER, INK, MUTED, PINE, BLUE = "#F7F3ED", "#172421", "#51615C", "#24776B", "#4C86A8"

SOURCES = {
    "cover-pe": "exec-5e013336-cf6f-4e67-ab87-b469f48d2bb3.png",
    "pe-plaza": "exec-3788ee6c-5a95-4671-9326-a38e63cf81c3.png",
    "pe-sanlazaro": "exec-69d3fce5-46a8-4154-a1f9-72643eb10785.png",
    "pe-courtyard": "exec-4e31abf4-c55d-43fc-8c06-b3ddc14986c7.png",
    "jp-castle": "exec-59eba48e-d3a0-41df-a729-073704a09173.png",
    "cover-jp": "exec-afd7672f-9a62-4adb-8841-31831d74dc67.png",
    "jp-nawate": "exec-360ed756-95f5-425c-a236-f551500563bc.png",
    "jp-nakamachi": "exec-28add027-88c0-4c6d-9f18-e971512acc7d.png",
    "jp-lacquer": "exec-3a5576b9-7969-4908-99cd-d1b82d4bbeaa.png",
    "jp-soba": "exec-bf2bdc67-c5d0-4214-82ca-1f566be7be44.png",
    "cover-rs": "exec-685747b8-371c-40a0-b175-09b8f79c4d88.png",
    "rs-center": "exec-69e106af-6837-48ed-8430-3943648065b4.png",
    "rs-gradic": "exec-ded0cdc5-3bc2-4995-a016-df66963e1a42.png",
    "rs-fortress": "exec-8c11bd19-c185-45a9-9acc-5062a04da82e.png",
    "rs-danube": "exec-b552943a-d861-48b2-aef0-66d38f67cd48.png",
}


def face(size, bold=False):
    return ImageFont.truetype(BOLD if bold else FONT, size)


def save_webp(image, path, limit, quality=76):
    path.parent.mkdir(parents=True, exist_ok=True)
    for value in range(quality, 28, -4):
        image.save(path, "WEBP", quality=value, method=6, optimize=True)
        if path.stat().st_size <= limit:
            return
    raise RuntimeError(f"{path} exceeds {limit} bytes")


def photo(key, name, cover=False):
    source = GEN / SOURCES[key]
    size = (1672, 941) if cover else (1440, 960)
    image = ImageOps.fit(Image.open(source).convert("RGB"), size, Image.Resampling.LANCZOS)
    save_webp(image, (COVERS if cover else INLINE) / f"{name}.webp", (400 if cover else 300) * 1024)


def wrap(draw, text, font, width):
    lines, current = [], ""
    for word in text.split():
        trial = f"{current} {word}".strip()
        if draw.textbbox((0, 0), trial, font=font)[2] <= width:
            current = trial
        else:
            lines.append(current)
            current = word
    if current:
        lines.append(current)
    return lines


def graphic(name, title, subtitle, rows):
    image = Image.new("RGB", (1200, 720), PAPER)
    draw = ImageDraw.Draw(image)
    draw.rounded_rectangle((42, 38, 1158, 682), radius=34, fill="white", outline="#D9E1DD", width=3)
    draw.text((76, 64), title, font=face(47, True), fill=INK)
    draw.text((76, 124), subtitle, font=face(27), fill=MUTED)
    row_height = 420 // len(rows)
    for index, (badge, heading, body) in enumerate(rows):
        y = 194 + index * row_height
        draw.rounded_rectangle((76, y, 202, y + 68), radius=20, fill=PINE if index % 2 == 0 else BLUE)
        draw.text((91, y + 16), badge, font=face(27, True), fill="white")
        draw.text((232, y), heading, font=face(31, True), fill=INK)
        for line_index, line in enumerate(wrap(draw, body, face(25), 850)[:2]):
            draw.text((232, y + 40 + line_index * 28), line, font=face(25), fill=MUTED)
    save_webp(image, INLINE / f"{name}.webp", 100 * 1024, 88)


def main():
    for key, name in {
        "cover-pe": "peru-arequipa-highland-first-day",
        "cover-jp": "japan-matsumoto-castle-craft-morning",
        "cover-rs": "serbia-novi-sad-danube-weekend",
    }.items():
        photo(key, name, True)

    for key, name in {
        "pe-plaza": "arequipa-plaza-morning",
        "pe-courtyard": "arequipa-sillar-courtyard-pause",
        "pe-sanlazaro": "arequipa-san-lazaro-lane",
        "jp-castle": "matsumoto-castle-moat-morning",
        "jp-nawate": "matsumoto-nawate-opening",
        "jp-nakamachi": "matsumoto-nakamachi-kura",
        "jp-lacquer": "matsumoto-lacquerware-hands",
        "jp-soba": "matsumoto-soba-early-lunch",
        "rs-center": "novi-sad-centre-morning",
        "rs-gradic": "novi-sad-gradic-street",
        "rs-fortress": "novi-sad-fortress-terrace",
        "rs-danube": "novi-sad-danube-sunset",
    }.items():
        photo(key, name)

    blocks = {
        "ru": {
            "arequipa-first-day-radius": ("Первый день рядом", "Один компактный круг вместо дальнего выезда", [("БАЗА", "Plaza de Armas", "Аркады и короткие выходы из тени"), ("ПАУЗА", "Тихий двор", "Сесть до того, как усталость накопилась"), ("ФИНИШ", "San Lázaro", "Только если темп остаётся комфортным")]),
            "arequipa-energy-check": ("Решение после каждого блока", "План сокращается без чувства потери", [("ЛЕГКО", "Продолжить рядом", "Следующая точка в пределах центра"), ("ТЯЖЕЛО", "Вернуться на базу", "Отдых важнее завершения списка"), ("СИМПТОМЫ", "Остановиться", "Обратиться за медицинской помощью")]),
            "arequipa-next-day": ("Что не ставить на прибытие", "Дальний выезд требует отдельного решения", [("КОЛЬКА", "Не сегодня", "Оставить каньон на подготовленный день"), ("ВИД", "Без погони", "Mirador не обязателен для первого вечера"), ("ЗАПАС", "Проверить утром", "Сон и самочувствие определяют следующий план")]),
            "matsumoto-craft-loop": ("Утро в Мацумото", "Замок задаёт начало, ремесло — смысл", [("РАНО", "Замок и ров", "Спокойный внешний круг до плотного потока"), ("ПОТОМ", "Nawate и Nakamachi", "Смотрите, какие лавки действительно открылись"), ("ФИНАЛ", "Один мастер", "Материал и процесс вместо покупок по списку")]),
            "novi-sad-weekend-split": ("Два берега — два блока", "Не связывайте всё одним длинным днём", [("СУБ", "Центр", "Площадь, жилые улицы и Дунай"), ("ВС", "Петроварадин", "Gradić, крепость и мастерские"), ("ЗАПАС", "Набережная", "Оставьте её для света и погоды")]),
            "novi-sad-crossing-choice": ("Когда переходить Дунай", "Решение зависит от энергии и света", [("ПЕШКОМ", "Один берег за раз", "Мост — часть дня, если хочется идти"), ("ТРАНСПОРТ", "Беречь силы", "Доехать к подъёму и вернуться отдельно"), ("ВЕЧЕР", "Не спешить", "Вид с крепости не требует длинного чек-листа")]),
        },
        "en": {
            "arequipa-first-day-radius": ("Keep day one close", "One compact loop instead of a distant excursion", [("BASE", "Plaza de Armas", "Arcades and short steps out of the shade"), ("PAUSE", "A quiet courtyard", "Sit down before tiredness accumulates"), ("FINISH", "San Lázaro", "Add it only if the pace still feels comfortable")]),
            "arequipa-energy-check": ("Decide after every block", "The plan can shrink without becoming a failure", [("EASY", "Continue nearby", "Choose the next stop inside the centre"), ("HEAVY", "Return to base", "Rest matters more than completing a list"), ("SYMPTOM", "Stop the walk", "Seek medical help rather than self-diagnosing")]),
            "arequipa-next-day": ("Leave these for later", "A distant trip deserves a separate decision", [("COLCA", "Not on arrival", "Save the canyon for a prepared day"), ("VIEW", "Skip the chase", "A mirador is optional on the first evening"), ("BUFFER", "Recheck tomorrow", "Sleep and how you feel shape the next plan")]),
            "matsumoto-craft-loop": ("A Matsumoto morning", "The castle opens it; craft gives it meaning", [("EARLY", "Castle and moat", "A quiet outer loop before the busy hours"), ("NEXT", "Nawate and Nakamachi", "Notice which workshops have actually opened"), ("FINISH", "Choose one maker", "Follow material and process, not a shopping list")]),
            "novi-sad-weekend-split": ("Two banks, two blocks", "Do not force both into one long day", [("SAT", "City centre", "Square, residential streets and the Danube"), ("SUN", "Petrovaradin", "Gradić, fortress and working studios"), ("BUFFER", "The promenade", "Keep it flexible for light and weather")]),
            "novi-sad-crossing-choice": ("When to cross the Danube", "Choose by energy and available light", [("WALK", "One bank at a time", "The bridge counts when you want the distance"), ("RIDE", "Save your legs", "Travel to the climb and return separately"), ("DUSK", "Stay unhurried", "The fortress view needs no long checklist")]),
        },
    }
    for locale, items in blocks.items():
        for name, payload in items.items():
            graphic(f"{name}-{locale}", *payload)


if __name__ == "__main__":
    main()
