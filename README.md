# Yotti Blog RSS

Минимальный статический RSS-сервис без Tilda.

## Локальная проверка

```bash
npm ci
npm test
npm run queue-report
npm run style-check -- articles/<slug>-ru.md articles/<slug>-en.md
npm run visual-check
npm run article-check -- --files articles/<slug>-ru.md articles/<slug>-en.md
# либо для полного diff-scope PR:
npm run article-check -- --base <git-commit>
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
- `docs/rss-rich-article-visual-standard.md` — визуальный ритм, карты,
  фотографии, таблицы и двухслойная совместимость длинных RSS-статей.

Статью можно заранее сохранить в `main` с `published: true` и будущим
`publishedAt`. До наступления указанного момента она не попадёт ни в RSS, ни в
публичные HTML-файлы. GitHub Actions проверяет расписание каждые 30 минут.

Для `published: true` сборка также требует `reviewer`, `reviewedAt`,
`reviewAfter` и минимум два уникальных HTTPS-источника в `sources`. При
нарушении любого правила публикация останавливается до исправления статьи.

Для всех новых длинных статей с 3 сентября 2026 года CI дополнительно требует
ровно семь разных локальных WebP: обложку и шесть встроенных материалов. Их
состав зависит от формата статьи; обязательны реальные размеры, уникальные alt,
подписи, адаптивные пропорции и общий бюджет загрузки до 1,2 МБ. Правила и
публичная проверка после синхронизации описаны в
`docs/rss-rich-article-visual-standard.md`.

Для любой новой или изменённой статьи — независимо от её исходного
`publishedAt` — change-scoped `article-check` требует ровно семь логических
изображений, responsive `srcset`/`sizes` и точные intrinsic dimensions. Изменение
используемого asset включает в scope все статьи-потребители. Производные WebP из
`srcset` относятся к тому же креативу и не увеличивают exact-7 count.

Смысловая перелинковка задаётся явным `queue.items[].semanticLinkClass` только
для новой/затронутой единицы: `focused-technical` требует минимум две ссылки,
`standard` — минимум три. Диапазон 3–5 — редакционная цель, не hard maximum.
Считаются только фактически присутствующие в body ссылки на другие статьи Yotti
Blog той же локали; product/site/tag/self links не считаются.
`internalContextLinks` остаётся planning-only и не доказывает перелинковку.

Три слоя доказательств не взаимозаменяемы: source-ready подтверждает статический
gate, GitHub Pages — сборку и RSS, а публичная Yotti-страница проверяется только
после ручной синхронизации. Недоступная публичная telemetry обозначается
`UNAVAILABLE` и оставляет страницу `INCOMPLETE`, но не становится `PASS`.

После подтверждённой ручной синхронизации публичный capture сохраняется только
в локальной непубличной директории и проверяется так:

```bash
npm run public-page-check -- --evidence /private/path/capture.json
```

Evidence schema v1 связывает `itemId`, RU/EN URL, профиль cold-load и замеры на
360/390/720 px. Для каждого viewport нужны HTTP/final/canonical, LCP, CLS,
transfer, overflow и семь DOM-изображений с `currentSrc`, responsive-атрибутами,
размерами и моментом запроса. Baseline обязан иметь тот же profile fingerprint.
Raw trace, capture и скриншоты не коммитятся и не загружаются workflow artifact.

Результаты буквальны: `PASS` означает полный успешный замер; измеренный дефект —
`FAIL`; отсутствующий browser/trace/baseline/показатель — `UNAVAILABLE` и общий
`INCOMPLETE`; испорченная identity/schema — `CONTRACT_ERROR`. `FAIL` или
`CONTRACT_ERROR` дают exit 1, чистый `PASS` и `INCOMPLETE` без доказанного
дефекта — exit 0, ошибка CLI/чтения JSON — exit 2. Потребитель обязан читать
state, а не только exit code; `PUBLICLY_VERIFIED` допустим только для `PASS`.

Workflow `Article review report` ежедневно в 09:15 по Москве проверяет
`reviewAfter`. Просроченные и приближающиеся сроки отображаются в GitHub Actions
Summary, но не удаляют статью из RSS. Локально тот же отчёт запускается командой
`npm run review-report`.
