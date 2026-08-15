---
name: yotti-editorial-voice
description: Write, localize, revise, and quality-check Yotti Blog RU/EN travel articles in a natural journalistic voice. Use for every new or edited Markdown article under articles/, including titles, leads, headings, SEO sections, and the mandatory human editorial pass before publication.
---

# Yotti Editorial Voice

Before writing or revising, read [references/human-editorial-standard.md](references/human-editorial-standard.md) in full.

## Workflow

1. Preserve the reader intent, verified facts, sources, permanent slug, categories, and stable metadata.
2. Write five plain title candidates. Say each aloud. Reject titles that sound like a slogan, essay theme, advertising line, translation, or AI-generated metaphor. Choose the clearest natural title, not the cleverest one.
3. Build an article-specific structure from the material. Do not start from a universal template. Use a list, takeaway block, conclusion, or FAQ only when it makes this article easier to use.
4. Draft with concrete nouns and verbs. Let facts, places, choices, and observed details carry the prose. Do not manufacture a cinematic opening when a direct opening is stronger.
5. Localize independently. Write RU as contemporary edited Russian and EN as idiomatic English travel journalism; never mirror sentences or headings line by line.
6. Perform a separate human editorial pass after the draft. Re-read without defending the original wording. Rewrite the title, lead, headings, transitions, and endings that feel composed for effect. Remove repeated conclusions, moralising, staged contrasts, and unnecessary instructions to the reader. Do not add new facts during this pass.
7. Run `npm run style-check -- <RU file> <EN file>`. Treat every reported error as blocking. Use the single allowed repair for the article if necessary, then run the check again.

## Publication gate

Publish only when all statements below are true:

- the title could be said naturally in conversation and accurately describes the article;
- headings identify useful sections without trying to sound profound;
- paragraphs do not repeatedly follow thesis, contrast, lesson, and uplifting conclusion;
- the writer does not order the reader around when a neutral explanation would work;
- removing the country name would break the article because its details are genuinely local;
- RU and EN feel independently edited;
- the style checker passes with zero blocking markers.

Use `gpt-5.6-sol / high` for both drafting and the distinct human editorial pass. A stronger model does not replace this workflow.
