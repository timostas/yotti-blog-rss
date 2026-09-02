# Yotti Blog RSS

Минимальный статический RSS-сервис без Tilda.

## Локальная проверка

```bash
npm ci
npm test
npm run queue-report
npm run style-check -- articles/<slug>-ru.md articles/<slug>-en.md
npm run build
xmllint --noout dist/ru/rss.xml
xmllint --noout dist/en/rss.xml
```

Результат сборки:

- `dist/ru/rss.xml` — RSS русских статей;
- `dist/en/rss.xml` — отдельный RSS английских статей;
- `dist/{язык}/articles/*.html` — минимальные технические страницы для
  постоянных ссылок `<item><link>`.

## Публикация

Workflow `.github/workflows/publish-rss.yml` собирает проект и публикует
каталог `dist` в GitHub Pages после push в `main`. Перед первым запуском:

1. создать публичный репозиторий `timostas/yotti-blog-rss` и поместить туда эти файлы;
2. выбрать GitHub Actions как источник GitHub Pages;
3. проверить публичные RSS по адресам:
   - `https://timostas.github.io/yotti-blog-rss/ru/rss.xml`;
   - `https://timostas.github.io/yotti-blog-rss/en/rss.xml`;
4. указать каждый URL в соответствующем поле RU или EN в `yotti.net/admin/blog`.

Подтверждённое поведение импорта и обновления RSS-записей в Yotti зафиксировано в `docs/rss-import-contract.md`.

## Работа редактора

- `docs/autonomous-editorial-system.md` — автономный редакционный контур,
  масштабирование, модели, бюджет и контроль качества;
- `config/editorial-policy.json` — машиночитаемые цели и ограничения контура;
- `docs/editor-guide.md` — публикация статьи от шаблона до Yotti;
- `docs/content-planning-and-scheduling.md` — рекомендуемый контент-план и
  схема отложенной публикации;
- `templates/article-ru.md` — шаблон русской статьи;
- `templates/article-en.md` — шаблон английской статьи;
- `templates/content-plan.md` — таблица контент-плана на месяц.
- `templates/country-research.md` — карточка исследования страны;
- `templates/article-brief.md` — бриф до написания статьи;
- `docs/editorial-quality-standard.md` — обязательный контроль качества;
- `docs/research/esim-editorial-benchmark-2026-08.md` — сравнительный аудит
  20 eSIM-продавцов, рабочие диапазоны объёма и метрики публикаций.
- `docs/research/zwitchy-guides-analysis-2026-09.md` — разбор 122 материалов
  Zwitchy Guides и правила усиленных маршрутных гидов Yotti.

Статью можно заранее сохранить в `main` с `published: true` и будущим
`publishedAt`. До наступления указанного момента она не попадёт ни в RSS, ни в
публичные HTML-файлы. GitHub Actions проверяет расписание каждые 30 минут.

Для `published: true` сборка также требует `reviewer`, `reviewedAt`,
`reviewAfter` и минимум два уникальных HTTPS-источника в `sources`. При
нарушении любого правила публикация останавливается до исправления статьи.

Workflow `Article review report` ежедневно в 09:15 по Москве проверяет
`reviewAfter`. Просроченные и приближающиеся сроки отображаются в GitHub Actions
Summary, но не удаляют статью из RSS. Локально тот же отчёт запускается командой
`npm run review-report`.
