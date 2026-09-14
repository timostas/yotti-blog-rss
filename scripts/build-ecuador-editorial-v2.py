#!/usr/bin/env python3
"""Build editable, country-specific information graphics; no photographic edits.

Four distinct reader jobs. The timeline repeats infinitely and has a complete
static equivalent. All variants retain the same aspect ratio and visible text.
"""
from pathlib import Path
from PIL import Image, ImageDraw, ImageFont

ROOT = Path(__file__).resolve().parents[1]
OUT = ROOT / 'assets/inline'
W, H = 1200, 800
NAVY, PAPER, INK, TEAL, GOLD = '#102C3C', '#FAF6ED', '#183239', '#167568', '#DDA651'
FONT = '/System/Library/Fonts/Supplemental/Arial.ttf'
BOLD = '/System/Library/Fonts/Supplemental/Arial Bold.ttf'

def font(n, bold=False):
    return ImageFont.truetype(BOLD if bold else FONT, n)

def text(d, xy, value, size=48, fill=INK, bold=False):
    f = font(size, bold)
    box = d.textbbox(xy, value, font=f)
    assert box[2] <= W - 38 and box[3] <= H - 30, (value, box)
    d.text(xy, value, font=f, fill=fill)

def base(kicker, title, dark=False):
    im = Image.new('RGB', (W,H), NAVY if dark else PAPER)
    d = ImageDraw.Draw(im)
    text(d,(56,40),kicker,38,GOLD if dark else TEAL,True)
    text(d,(56,104),title,60,'white' if dark else INK,True)
    return im,d

def timeline(lang, active=-1):
    ru = lang == 'ru'
    im,d = base('ЭКВАДОР · ПОДГОТОВКА' if ru else 'ECUADOR · GETTING CONNECTED',
                'Подготовка телефона' if ru else 'Prepare your phone',True)
    rows = [('Дома','Установить по Wi-Fi'),('В Кито','Проверить мобильные данные'),('До островов','Сохранить билеты и адреса')] if ru else [('At home','Install over Wi-Fi'),('In Quito','Test the mobile connection'),('Before the islands','Save tickets and addresses')]
    d.line((94,252,94,632),fill='#466271',width=5)
    for i,(head,body) in enumerate(rows):
        y=220+i*170
        if active == i:
            d.rounded_rectangle((42,y-9,1158,y+133),radius=20,fill='#21495B')
        d.ellipse((65,y+30,125,y+90),fill=GOLD if active==i else '#466271')
        text(d,(80,y+35),str(i+1),40,NAVY if active==i else 'white',True)
        text(d,(160,y),head,48,'white',True)
        text(d,(160,y+64),body,52,'#D5E5E8')
    text(d,(56,716),'Установка и начало срока — разные события' if ru else 'Installation and plan validity are different events',38,'#D5E5E8')
    return im

def coverage(lang):
    ru=lang=='ru'
    im,d=base('ДО ПОКУПКИ' if ru else 'BEFORE YOU BUY','Три проверки покрытия' if ru else 'Three coverage checks')
    rows=[('01','Тариф','Включены ли Галапагосы?'),('02','Партнёрская сеть','Какая сеть доступна пакету?'),('03','Место проживания','Проверен ли нужный остров?')] if ru else [('01','The plan','Does it include the Galápagos?'),('02','The partner network','Which network can this plan use?'),('03','Your destination','Has your island been checked?')]
    for i,(n,h,b) in enumerate(rows):
        y=225+175*i
        text(d,(56,y),n,60,TEAL,True)
        text(d,(176,y),h,48,INK,True)
        text(d,(176,y+68),b,50)
        if i<2:d.line((176,y+141,1140,y+141),fill='#CCD6D0',width=2)
    return im

def arrivals(lang):
    ru=lang=='ru'
    im,d=base('ПРИЛЁТ НА ГАЛАПАГОСЫ' if ru else 'ARRIVING IN THE GALÁPAGOS','Два разных прибытия' if ru else 'Two different arrivals')
    rows=[('Бальтра','Переправа через Итабаку','Затем — Пуэрто-Айора','на острове Санта-Крус'),('Сан-Кристобаль','Без переправы на Санта-Крус','Пуэрто-Бакерисо-Морено','на том же острове')] if ru else [('Baltra','Cross the Itabaca Channel','Then continue to Puerto Ayora','on Santa Cruz'),('San Cristóbal','No crossing to Santa Cruz','Puerto Baquerizo Moreno','is on the same island')]
    for i,(h,a,b,c) in enumerate(rows):
        x=56+i*574
        d.rounded_rectangle((x,218,x+518,728),radius=20,fill='#E6EEE7' if i==0 else '#E8EBF0')
        text(d,(x+24,248),h,48,TEAL,True)
        # Explicit line breaks preserve legibility instead of shrinking text.
        lines = (["Через канал", "Итабака", "в Пуэрто-Айору", "на Санта-Крус"] if i==0 else ["Пуэрто-Бакерисо-", "Морено", "на том же", "острове"]) if ru else (["Across Itabaca", "to Puerto Ayora", "on Santa Cruz"] if i==0 else ["Puerto Baquerizo", "Moreno is on", "the same island"])
        for j,line in enumerate(lines):
            assert d.textbbox((0,0),line,font=font(48))[2] <= 470, line
            text(d,(x+24,350+j*66),line,48)
    return im

def budget(lang):
    ru=lang=='ru'
    im,d=base('ПРИМЕР, НЕ НОРМА РАСХОДА' if ru else 'WORKED EXAMPLE, NOT A USAGE ESTIMATE','Как посчитать пакет' if ru else 'Work out your allowance')
    text(d,(56,244),'7 × 300 МБ' if ru else '7 × 300 MB',96,TEAL,True)
    text(d,(56,365),'7 дней × ваш расход за день' if ru else '7 days × your daily use',48)
    d.line((56,458,1144,458),fill='#CCD6D0',width=3)
    text(d,(56,503),'2,1 ГБ + запас' if ru else '2.1 GB + a buffer',70,INK,True)
    text(d,(56,614),'Видео и раздачу считайте отдельно' if ru else 'Add video and hotspot use separately',50)
    text(d,(56,706),'Срок пакета тоже должен покрывать поездку' if ru else 'The validity must also cover your trip',39,TEAL)
    return im

def save_variants(name, frames, durations=None):
    for width in (384,720,960,W):
        path=OUT/(name+('' if width==W else f'-{width}w')+'.webp')
        imgs=[im.resize((width,round(H*width/W)),Image.Resampling.LANCZOS) for im in frames]
        kwargs=dict(format='WEBP',quality=88,method=6)
        if len(imgs)>1:kwargs.update(save_all=True,append_images=imgs[1:],duration=durations,loop=0)
        imgs[0].save(path,**kwargs)
        assert path.stat().st_size<=102400,(path,path.stat().st_size)
        print(path.name,path.stat().st_size)

if __name__=='__main__':
    for lang in ('ru','en'):
        save_variants(f'ecuador-v2-activation-{lang}',[timeline(lang,i) for i in (0,1,2,-1)],[2400,2400,2400,4800])
        save_variants(f'ecuador-v2-activation-static-{lang}',[timeline(lang)])
        for name,fn in [('coverage',coverage),('arrivals',arrivals),('data',budget)]:
            save_variants(f'ecuador-v2-{name}-{lang}',[fn(lang)])
