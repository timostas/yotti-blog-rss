# Yotti Blog RSS

Минимальный статический RSS-сервис без Tilda.

## Локальная проверка

```bash
npm ci
npm test
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

## Работа редактора

- `docs/editor-guide.md` — публикация статьи от шаблона до Yotti;
- `docs/content-planning-and-scheduling.md` — рекомендуемый контент-план и
  схема отложенной публикации;
- `templates/article-ru.md` — шаблон русской статьи;
- `templates/article-en.md` — шаблон английской статьи;
- `templates/content-plan.md` — таблица контент-плана на месяц.
- `templates/country-research.md` — карточка исследования страны;
- `templates/article-brief.md` — бриф до написания статьи;
- `docs/editorial-quality-standard.md` — обязательный контроль качества.

Сейчас публикация происходит после изменения файлов в `main`. Будущая дата
`publishedAt` ещё не откладывает появление статьи в RSS; автоматическое
расписание описано как следующий отдельный этап.
