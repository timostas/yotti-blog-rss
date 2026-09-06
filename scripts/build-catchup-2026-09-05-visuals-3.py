#!/usr/bin/env python3
from __future__ import annotations
import io, json, math, time, urllib.request
from pathlib import Path
from PIL import Image, ImageDraw, ImageEnhance, ImageFont, ImageOps

ROOT=Path(__file__).resolve().parent.parent
GEN=Path('/Users/Stanislav/.codex/generated_images/01a06541-78cc-7dd0-9321-9be1e27049a5')
COVERS=ROOT/'assets'/'covers'; INLINE=ROOT/'assets'/'inline'; CACHE=Path('/tmp/yotti-turku-map-cache')
FONT='/System/Library/Fonts/Supplemental/Arial.ttf'; BOLD='/System/Library/Fonts/Supplemental/Arial Bold.ttf'
PAPER='#F7F3ED'; INK='#172421'; MUTED='#51615C'; PINE='#24776B'; BLUE='#4C86A8'; CORAL='#F36B59'
S={
'cover-turku':'exec-db2e27a9-9d79-40b7-8206-9aa2b253a8f6.png','cover-penang':'exec-ff9dfc20-c11b-4032-9df4-3a7b2a6aeea3.png','cover-halifax':'exec-a591ab20-3bab-432c-96ff-6cc67e11c184.png','cover-botswana':'exec-4c602be3-7fd4-4e93-b312-e513326150bf.png',
'turku-river':'exec-9f2bbf11-3d4b-4f73-a0b2-f900f609016e.png','turku-nauvo':'exec-91e05e99-d63e-4b3a-9890-d3abc44efa68.png','turku-bus':'exec-d5fe667e-2d63-4832-a85c-c00efd10cc68.png',
'penang-street':'exec-d5593c5d-76ab-4b9f-9b8e-f173d9371336.png','penang-craft':'exec-15635b59-77e7-4588-a002-265c0a7b2e8c.png','penang-kopitiam':'exec-b4fcc6ca-32a9-45d1-a6a0-66a4b25303d0.png','penang-hawker':'exec-187e72fd-f999-4e94-b525-cf4ce0f15512.png','penang-jetties':'exec-0dc46484-1a52-4e75-9a78-d1d1b989341e.png',
'halifax-boardwalk':'exec-54f4d391-539b-4925-90f9-14cbe9c3d397.png','halifax-museum':'exec-d59dbfc1-7516-4b37-995f-76216361d5fb.png','halifax-terminal':'exec-1ffa9251-6fb6-4975-b783-14ada904b627.png','halifax-lunch':'exec-cbc64a8d-5da6-40e6-96bb-d0e47ea4279d.png',
'botswana-gaborone':'exec-54ce7855-2b7d-43c2-87c6-50b1b75b5fcc.png','botswana-okavango':'exec-2b7f7778-058d-47f7-afb6-f37dab23241b.png'}

def font(n,b=False): return ImageFont.truetype(BOLD if b else FONT,n)
def save(im,p,limit,q=72):
 p.parent.mkdir(parents=True,exist_ok=True)
 for quality in range(q,30,-4):
  im.save(p,'WEBP',quality=quality,method=6,optimize=True)
  if p.stat().st_size<=limit:return
 raise RuntimeError(f'{p} too large')
def photo(key,name,cover=False):
 im=ImageOps.fit(Image.open(GEN/S[key]).convert('RGB'),(1800,1125) if cover else (1440,960),Image.Resampling.LANCZOS)
 save(im,(COVERS if cover else INLINE)/f'{name}.webp',(400 if cover else 300)*1024)
def wrap(d,t,f,w):
 out=[]; cur=''
 for word in t.split():
  trial=f'{cur} {word}'.strip()
  if d.textbbox((0,0),trial,font=f)[2]<=w:cur=trial
  else:out.append(cur);cur=word
 if cur:out.append(cur)
 return out
def graphic(name,title,subtitle,rows):
 im=Image.new('RGB',(1200,720),PAPER);d=ImageDraw.Draw(im);d.rounded_rectangle((42,38,1158,682),34,fill='white',outline='#D9E1DD',width=3);d.text((76,64),title,font=font(48,1),fill=INK);d.text((76,124),subtitle,font=font(27),fill=MUTED)
 rh=420//len(rows)
 for i,(badge,head,body) in enumerate(rows):
  y=194+i*rh;d.rounded_rectangle((76,y,200,y+68),20,fill=PINE if i%2==0 else BLUE);d.text((92,y+16),badge,font=font(28,1),fill='white');d.text((230,y),head,font=font(32,1),fill=INK)
  for j,line in enumerate(wrap(d,body,font(25),850)[:2]):d.text((230,y+40+j*28),line,font=font(25),fill=MUTED)
 save(im,INLINE/f'{name}.webp',100*1024,88)

W,H,Z=1200,800,8; WEST,EAST,NORTH,SOUTH=21.65,22.55,60.55,60.08
STOPS={'turku':(22.2666,60.4518),'pargas':(22.3020,60.2990),'n=req':(21.9090,60.1930)}
def wp(lon,lat):
 scale=256*(2**Z);x=(lon+180)/360*scale;s=math.sin(math.radians(lat));y=(.5-math.log((1+s)/(1-s))/(4*math.pi))*scale;return x,y
def px(lon,lat):
 x0,y0=wp(WEST,NORTH);x1,y1=wp(EAST,SOUTH);x,y=wp(lon,lat);return round((x-x0)/(x1-x0)*W),round((y-y0)/(y1-y0)*H)
def fetch(url,path):
 if path.exists():return path.read_bytes()
 req=urllib.request.Request(url,headers={'User-Agent':'YottiBlogMapBuilder/1.0 (+https://yotti.net)'})
 with urllib.request.urlopen(req,timeout=45) as r:data=r.read()
 path.parent.mkdir(parents=True,exist_ok=True);path.write_bytes(data);return data
def basemap():
 x0,y0=wp(WEST,NORTH);x1,y1=wp(EAST,SOUTH);a,b=math.floor(x0/256),math.floor(x1/256);c,e=math.floor(y0/256),math.floor(y1/256);canvas=Image.new('RGB',((b-a+1)*256,(e-c+1)*256))
 for ty in range(c,e+1):
  for tx in range(a,b+1):
   tile=Image.open(io.BytesIO(fetch(f'https://tile.openstreetmap.org/{Z}/{tx}/{ty}.png',CACHE/str(Z)/str(tx)/f'{ty}.png'))).convert('RGB');canvas.paste(tile,((tx-a)*256,(ty-c)*256));time.sleep(.04)
 crop=canvas.crop((round(x0-a*256),round(y0-c*256),round(x1-a*256),round(y1-c*256))).resize((W,H),Image.Resampling.LANCZOS);crop=ImageEnhance.Color(crop).enhance(.55);return Image.blend(crop,Image.new('RGB',crop.size,'#FFF9EF'),.18)
def route():
 u='https://router.project-osrm.org/route/v1/driving/22.2666,60.4518;22.3020,60.2990;21.9090,60.1930?overview=full&geometries=geojson&steps=false';p=json.loads(fetch(u,CACHE/'route.json'))['routes'][0]['geometry']['coordinates'];step=max(1,math.ceil(len(p)/500));return [px(*x) for x in p[::step]]+[px(*p[-1])]
def mapframe(base,line,ratio,locale):
 im=base.copy();d=ImageDraw.Draw(im,'RGBA');end=max(2,round(len(line)*ratio));d.line(line[:end],fill=(255,255,255,238),width=18,joint='curve');d.line(line[:end],fill=CORAL,width=9,joint='curve')
 labels={'ru':['Турку · день 1','Парайнен · по пути','Науво · ночь'],'en':['Turku · day 1','Pargas · en route','Nagu · night']}[locale]
 for (key,(lon,lat)),label in zip(STOPS.items(),labels):
  x,y=px(lon,lat);d.ellipse((x-10,y-10,x+10,y+10),fill='white',outline=PINE,width=5);d.rounded_rectangle((x+15,y-27,x+265,y+17),10,fill=(255,253,248,230));d.text((x+25,y-19),label,font=font(25,1),fill=INK)
 title='Турку — Науво · 2 дня' if locale=='ru' else 'Turku — Nagu · 2 days';d.rounded_rectangle((24,20,500,82),20,fill=(23,36,33,226));d.text((44,33),title,font=font(34,1),fill='white');d.rounded_rectangle((790,750,1182,790),10,fill=(255,253,248,230));d.text((810,757),'© OpenStreetMap · OSRM',font=font(22),fill=MUTED);return im
def maps():
 base=basemap();line=route()
 for loc in ('ru','en'):
  full=mapframe(base,line,1,loc);save(full,INLINE/f'finland-turku-nagu-map-{loc}-static.webp',100*1024,60);frames=[mapframe(base,line,r,loc) for r in (.03,.18,.38,.58,.78,1)]
  target=INLINE/f'finland-turku-nagu-map-{loc}-animated.webp'
  for q in (38,32,26,22):
   frames[0].save(target,'WEBP',save_all=True,append_images=frames[1:],duration=[350,220,220,220,220,2300],loop=0,quality=q,method=6,minimize_size=True)
   if target.stat().st_size<=300*1024:break
  if target.stat().st_size>300*1024:raise RuntimeError('animated map too large')

def main():
 for k,n in {'cover-turku':'finland-turku-archipelago-two-day-route','cover-penang':'malaysia-penang-craft-food-afternoon','cover-halifax':'canada-halifax-waterfront-rainy-day','cover-botswana':'buy-esim-botswana-gaborone-okavango'}.items():photo(k,n,1)
 for k,n in {'turku-river':'turku-aura-river','turku-nauvo':'turku-nagu-harbour','turku-bus':'turku-archipelago-bus','penang-street':'penang-shophouse-walk','penang-craft':'penang-seal-craftsman','penang-kopitiam':'penang-kopitiam-morning','penang-hawker':'penang-hawker-evening','penang-jetties':'penang-clan-jetties','halifax-boardwalk':'halifax-rainy-boardwalk','halifax-museum':'halifax-maritime-museum','halifax-terminal':'halifax-ferry-terminal','halifax-lunch':'halifax-rainy-lunch','botswana-gaborone':'botswana-gaborone-city-data','botswana-okavango':'botswana-okavango-offline-brief'}.items():photo(k,n)
 blocks={
 'ru':{
 'turku-plan':('Два дня, две базы','Ночь в Науво снимает гонку за обратным автобусом',[('ДЕНЬ 1','Турку и переезд','Набережная Ауры, затем автобус через Парайнен'),('НОЧЬ','Науво','Гавань остаётся рядом, багаж не мешает прогулке'),('ДЕНЬ 2','Остров и возврат','Одна петля пешком, затем запас до автобуса')]),'turku-book':('Что фиксировать','Транспорт и ночёвка важнее списка мест',[('СНАЧ','Ночь в Науво','Проверьте пеший путь от остановки'),('ПОТОМ','Автобус','Сверьте весь маршрут на нужную дату'),('В ДЕНЬ','Паром','Проверьте Finferries и сообщения о движении')]),
 'penang-flow':('После полудня в Джорджтауне','Ремесло, кофе и еда идут в разном темпе',[('14:00','Мастерская','Одна работающая лавка, не ряд сувениров'),('16:00','Копитиам','Пауза в прохладе и один простой заказ'),('18:00','Уличная еда','Один район и вечер у воды')]),
 'halifax-rain':('План для дождя','Короткие выходы чередуются с помещениями',[('СЛАБО','Набережная','Пройдите один открытый участок'),('СИЛЬНО','Музей','Оставьте большой крытый блок на ливень'),('ПАУЗА','Терминал','Проверьте видимость и следующий короткий выход')]),'halifax-kit':('Что взять','Ветер у гавани меняет ощущение дождя',[('СЛОЙ','Непромокание','Куртка с капюшоном удобнее зонта'),('ОБУВЬ','Мокрый настил','Подошва нужна для дерева и камня'),('ЗАПАС','Тёплый обед','Не привязывайте его к дальней точке')]),
 'bw-pre':('До прилёта','Профиль и инструкция готовы на Wi‑Fi',[('1','Совместимость','Телефон поддерживает есим и не заблокирован'),('2','Установка','QR-код и инструкция сохранены отдельно'),('3','Проверка','Линия назначена для данных, профиль не удаляется')]),'bw-zones':('Город и дельта','Данные выполняют разные задачи',[('ГАБ','Город','Навигация, сообщения и транспорт'),('МАУН','Перед выездом','Завершите загрузки и подтвердите встречу'),('ДЕЛЬТА','Офлайн','Маршрут и контакт работают без сети')]),'bw-off':('Офлайн-набор','Сохраните до удалённого участка',[('КАРТА','Точки встречи','Лодж, аэродром или место старта'),('БРОНЬ','Подтверждения','Оператор, время и порядок связи'),('ЗАРЯД','Питание','Пауэрбанк доступен в дневной сумке')]),'bw-fix':('Если данных нет','Проверка без удаления профиля',[('1','Выберите линию','Есим назначена для мобильных данных'),('2','Проверьте роуминг','Следуйте инструкции текущего пакета'),('3','Перезапустите сеть','Авиарежим, выбор сети, затем поддержка')])},
 'en':{
 'turku-plan':('Two days, two bases','A night in Nagu removes the race for the last return',[('DAY 1','Turku and transfer','The Aura river, then a bus through Pargas'),('NIGHT','Nagu','Stay near the harbour and walk without luggage'),('DAY 2','Island and return','One local loop, then a buffer before the bus')]),'turku-book':('What to secure','Transport and the overnight matter more than a list',[('FIRST','A night in Nagu','Check the walk from the bus stop'),('NEXT','The bus','Confirm the full journey for your date'),('ON DAY','The ferry','Check Finferries traffic notices')]),
 'penang-flow':('A George Town afternoon','Craft, coffee and food each need a different pace',[('14:00','A workshop','One working trade, not a row of souvenirs'),('16:00','A kopitiam','A cool pause and one simple order'),('18:00','Hawker food','One area followed by the waterfront')]),
 'halifax-rain':('A rain plan','Short outdoor stretches alternate with shelter',[('LIGHT','Waterfront','Use one exposed section of boardwalk'),('HEAVY','Museum','Keep the long indoor block for the downpour'),('PAUSE','Terminal','Check visibility before the next short walk')]),'halifax-kit':('What to carry','Harbour wind changes how the rain feels',[('LAYER','Stay dry','A hooded shell works better than an umbrella'),('SHOES','Wet boards','Grip matters on timber and stone'),('BREAK','Warm lunch','Keep it close rather than crossing town')]),
 'bw-pre':('Before arrival','Prepare the profile and instructions on Wi‑Fi',[('1','Check compatibility','The phone supports eSIM and is unlocked'),('2','Install','Store the QR code and instructions separately'),('3','Test settings','Select the data line and do not delete it')]),'bw-zones':('City and delta','Mobile data serves different jobs',[('GAB','In the city','Navigation, messages and transport'),('MAUN','Before departure','Finish downloads and confirm the meeting'),('DELTA','Offline first','Keep the route and contact without a signal')]),'bw-off':('Your offline kit','Save it before the remote section',[('MAP','Meeting points','Lodge, airstrip or activity start'),('BOOK','Confirmations','Operator, time and contact procedure'),('POWER','Stay charged','Keep a power bank in your day bag')]),'bw-fix':('No mobile data?','Troubleshoot without deleting the profile',[('1','Select the line','Assign the eSIM to mobile data'),('2','Check roaming','Follow the current plan instructions'),('3','Restart the network','Airplane mode, network selection, then support')])}}
 names={'turku-plan':'turku-two-day-plan','turku-book':'turku-booking-order','penang-flow':'penang-afternoon-flow','halifax-rain':'halifax-rain-plan','halifax-kit':'halifax-rain-kit','bw-pre':'botswana-esim-preflight','bw-zones':'botswana-city-delta-data','bw-off':'botswana-offline-kit','bw-fix':'botswana-data-troubleshooting'}
 for loc,items in blocks.items():
  for key,payload in items.items():graphic(f'{names[key]}-{loc}',*payload)
 maps()
if __name__=='__main__':main()
