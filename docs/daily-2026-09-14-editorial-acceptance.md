# Daily editorial acceptance — 14 September 2026

Base: `b399915d51b963a635650d35def7da0e02e5dcd2`. One isolated batch, no
parallel queue writer. Four unique RU/EN units taken from `plannedPublications`;
eight plans and three reserve ideas remain. No archive article or existing URL
was edited. The existing seven-batch recovery registry remains intact.

Preflight reread both public RSS feeds: 126 unique items per locale, all 28
recovery IDs present, zero 14 September publications. Recovery is not credited
again to this daily package. The scheduled morning slots had already passed;
the first two new units use actual later release slots, never 10:00/10:30
backdating. The two evening slots remain 20:00 and 20:30 MSK.

## Units and evidence

- `esim-wifi-calling`: selected number → carrier confirmation → appropriate
  device setting → distinct incoming/outgoing test. The neighbouring number,
  airplane-mode and SMS pages answer different questions.
- `italy-bologna-porticoes-rain-day`: choose a short portico outing, distinguish
  timber from masonry and separate San Luca's ascent. This is a seasonal
  decision guide, not a road itinerary or an all-Bologna attraction list.
- `kenya-mombasa-old-town-coast-day`: distinguish the fort, residential street
  details and harbour from a separate beach visit. The map is historical
  evidence, not current business opening information.
- `taiwan-tainan-temple-market-morning`: temple/market relationship and separate
  operating patterns, with Shennong Street optional. It does not duplicate
  Pinglin, Omicho or Bangkok's evening markets.

Each locale has its own excerpt-based editorial findings, applied corrections,
accepted passages, weakest dimensions and review record in `editorialEvidence`.
Drafting and the separate AI editorial pass: `gpt-6-astra / high`, one draft per
locale. This is not a claim of independent human review or firsthand travel.
The editorial pass changed specific Russian abstractions, an unexplained
English network term and two infographic headings. Working internal links were
read back from the public sitemap rather than inferred from old queue metadata.

The bounded reader tasks are complete below 900 words: choices, limitations,
fallbacks and relevant links are included, without a generic FAQ, ranking list
or padded conclusion. Scores (87/100 editorial, utility 86, original value 84,
fact support 90) are supporting judgements only. Evidence below and per-locale
findings take precedence over scores.

## Claim support, checked 14 September

- [Apple — Wi-Fi Calling](https://support.apple.com/en-ca/108066), sections
  “Turn on Wi-Fi Calling” and “If Wi-Fi Calling isn't working”: select the line,
  service indication, address prompt and another Wi-Fi network. No promise of
  universal international availability or another SIM's data service.
- [Google — calls over Wi-Fi](https://support.google.com/phoneapp/answer/2811843?hl=en),
  “Use a mobile carrier’s Wi-Fi calling” and the charging note: carrier support,
  Android menu, indicator and possible charges. No free-call claim.
- [Bologna Welcome — porticoes](https://www.bolognawelcome.com/en/blog/los-porticos-de-bolonia-),
  wooden porticoes/Casa Isolani, Archiginnasio/Pavaglione, Santa Maria dei Servi
  and the San Luca paragraph: names, materials and the nearly 4 km ascent.
- [UNESCO — Bologna](https://whc.unesco.org/en/list/1650/), description:
  ensembles need not form a continuous covered passage. The article does not
  equate every arcade with a single uninterrupted UNESCO walkway.
- [UNESCO — Fort Jesus](https://whc.unesco.org/en/list/1295/), description,
  synthesis and authenticity: 1593–1596, Cairati, coral-rock spur, port function,
  coral stone/lime mortar. No masonry dating inferred from an illustration.
- [National Museums of Kenya — Old Town map](https://www.museums.or.ke/wp-content/uploads/2020/05/old-town-map.pdf),
  page 1, February 2004 edition: fort/Old Port relationship; legend for carved
  doors and balconies/staircases. Inspected as a scanned map. Not used to
  guarantee present market activity, shop opening or visitor access.
- [Tainan Travel — Shuixian](https://www.twtainan.net/en/attractions/detail/4363),
  “Introduce”: merchant funding, 1703, former Nanshi Harbor and market association.
  Temple hours are not used as a timetable for individual counters.
- [Tainan Travel — Shennong](https://www.twtainan.net/en/attractions/detail/4420),
  “Introduce”: Five Channels port entrance, present craft/design shops and some
  shopkeepers' photography restrictions. Read in the browser after the search
  connector temporarily failed. Street access does not imply shop opening.

## Visual and source inspection

37 masters, 148 WebP files including exact 384/720/960/master sets. Every page
uses one cover plus six logical inline images. Composition by format: Wi-Fi
2 photos + 4 diagrams; Bologna 4 + 2; Mombasa 4 + 2; Tainan 5 + 1. Locale-specific
diagrams duplicate all information in ordinary body text. No map, animation,
raw table or simulated interactive control is included.

All final masters were opened in paired 360/720-pixel views. Checked visible
subjects, hands, construction, distinct crops and diagram legibility. Generated
scenes are explicitly disclosed; the timber portico and temple captions do not
claim to depict Casa Isolani or Shuixian precisely. Mombasa's textured stone was
recompressed after the first export exceeded 300 KiB. Final page image budgets:
Wi-Fi 415,748–418,108 bytes; Bologna 760,282–761,806; Mombasa 952,100–952,676;
Tainan 906,866–909,864. Every master now fits its per-file limit.

Codex in-app browser inspected the real `createArticleHtml` output at
360/390/720/1440 px for every locale (32 captures). Each has 7 images, 6 captions,
zero horizontal overflow, zero broken images, zero missing alt/srcset/sizes and
zero declared/rendered ratio failures. Images were decoded after scrolling;
this is source layout QA, not a cold-load performance test or Yotti acceptance.
Representative rendered layouts and the mobile diagram were visually checked.
Private browser JSON, contact sheets, draft history and temporary previews
remain outside Git. All 26 referenced public destinations returned HTTP 200;
These comprise 20 unique same-locale Blog URLs (22 link occurrences across
eight articles) and six country-product URLs.

Prepublication renderer diagnostic: literal `state=FAIL`,
`publicationReadiness=DEGRADED`, only allowlisted image-delivery reasons.
Recorded as `SITE_SIDE_P1`; browser DOM and image requests confirmed intact
reference content. Known debt does not block source/RSS release. It is not
reported as fixed, and no public page receives `PUBLICLY_VERIFIED`.

Public Yotti acceptance, field p75, LCP/CLS baseline comparison, Speed Index and
traces are `UNAVAILABLE` for the new units pending the owner's RSS sync and any
separately required public acceptance. Source QA does not substitute for them.

## Release checks

Before PR: npm test, queue-report, review-report, visual-check, style-check for
all eight files, article-check against the exact merge-base, build, both RSS XML
checks and git diff --check. The final release and public RSS counters are
reported in the automation result after CI and the Pages workflow finish.
