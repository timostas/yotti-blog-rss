---
title: "[TEST] Independent English RSS publication"
slug: "independent-english-rss-test"
description: "A technical post used to verify the independent English publishing flow from Markdown through GitHub and RSS to Yotti."
publishedAt: "2026-08-02T20:27:00+03:00"
author: "Yotti Editorial Team"
reviewer: "Yotti Reviewing Editor"
reviewedAt: "2026-08-02"
reviewAfter: "2026-09-02"
language: "en"
categories:
  - "Travel tech and services"
sources:
  - "https://timostas.github.io/yotti-blog-rss/en/rss.xml"
  - "https://yotti.net/en/blog/test-independent-english-rss-publication"
published: false
---

This publication was created specifically to verify the independent English RSS feed for Yotti Blog. It is not a customer announcement or a product guide. Its purpose is to confirm that an English article stored as Markdown can be built automatically on GitHub, added to the correct XML feed, and imported into the English section of Yotti without appearing in the Russian feed.

The test also checks that the importer receives the title, summary, publication date, author, category, and full article body. The source link must remain stable when the feed is synchronized again. If this Markdown file is updated later, Yotti should update the existing publication instead of creating a second article with the same source address.

## What this test verifies

- The English XML feed is available through a public HTTPS address.
- The channel language is set to `en`.
- The feed contains exactly one English test article.
- The Russian test article does not appear in the English feed.
- The English article does not appear in the Russian feed.
- The full body from `turbo:content` is imported correctly.
- A repeated synchronization does not create a duplicate publication.

This first English test intentionally has no cover image. Cover handling has already been tested independently in the Russian feed, so leaving it out keeps this stage focused on language separation and routing. Yotti may display its standard placeholder until a dedicated English cover is added later.

The test is successful when this article appears only in the English blog, opens on its own public page, and remains absent from the Russian blog. Once that behavior is confirmed, Russian and English editors can publish independently by selecting the appropriate language in each Markdown article.
