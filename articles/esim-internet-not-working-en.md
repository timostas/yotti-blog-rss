---
title: "eSIM has signal but no internet: a step-by-step check"
slug: "esim-internet-not-working-en"
description: "A focused check for an eSIM that shows a carrier and signal but passes no data: test the data line, roaming, plan status, APN and app path."
publishedAt: "2026-08-22T09:40:00Z"
author: "Yotti Editorial Team"
reviewer: "Yotti Editor"
reviewedAt: "2026-09-06"
reviewAfter: "2026-12-05"
language: "en"
categories: ["Travel connectivity"]
sources:
  - "https://support.apple.com/guide/iphone/use-dual-sim-iph9c5776d3c/ios"
  - "https://support.apple.com/en-gb/102483"
  - "https://support.google.com/pixelphone/answer/9449293?hl=en"
  - "https://support.google.com/pixelphone/answer/2926415?hl=en"
  - "https://support.google.com/pixelphone/answer/14116080?hl=en"
  - "https://support.google.com/pixelphone/answer/2819583?hl=en"
  - "https://support.google.com/pixelphone/answer/2819524?hl=en"
  - "https://www.samsung.com/us/support/answer/ANS10001619/"
  - "https://support.apple.com/en-us/111786"
  - "https://yotti.net/en/how-it-works"
editorial:
  authorUrl: "https://yotti.net/en/about"
  modifiedAt: "2026-09-06T19:31:00.000Z"
  imageTitle: "Checking an eSIM mobile-data connection"
  imageDescription: "A traveller in a hotel lobby checks the selected mobile-data line on a phone"
  alternate:
    language: "ru"
    url: "https://yotti.net/blog/esim-vidit-set-no-internet-ne-rabotaet-gde-iskat-prichinu"
  sourceNotes:
    - title: "Apple Support: choose a cellular-data line with Dual SIM"
      url: "https://support.apple.com/guide/iphone/use-dual-sim-iph9c5776d3c/ios"
    - title: "Apple Support: view and edit an APN"
      url: "https://support.apple.com/en-gb/102483"
    - title: "Google Pixel Help: choose a SIM and mobile-network settings"
      url: "https://support.google.com/pixelphone/answer/2926415?hl=en"
    - title: "Samsung Support: SIM manager and the primary SIM"
      url: "https://www.samsung.com/us/support/answer/ANS10001619/"
    - title: "Apple Support: network-reset consequences in general guidance"
      url: "https://support.apple.com/en-us/111786"
    - title: "Yotti: installation, roaming and the single-use QR code"
      url: "https://yotti.net/en/how-it-works"
cover:
  url: "https://timostas.github.io/yotti-blog-rss/assets/covers/esim-internet-not-working-remediation.webp"
  type: "image/webp"
  alt: "A traveller in a hotel lobby checking mobile-data settings on a phone"
  width: 1600
  height: 900
  srcset: "https://timostas.github.io/yotti-blog-rss/assets/covers/esim-internet-not-working-remediation-384w.webp 384w, https://timostas.github.io/yotti-blog-rss/assets/covers/esim-internet-not-working-remediation-720w.webp 720w, https://timostas.github.io/yotti-blog-rss/assets/covers/esim-internet-not-working-remediation-960w.webp 960w, https://timostas.github.io/yotti-blog-rss/assets/covers/esim-internet-not-working-remediation.webp 1600w"
  sizes: "(max-width: 760px) calc(100vw - 56px), 760px"
published: true
---

A carrier name and signal bars narrow the problem: the phone can see, or may have attached to, a mobile network. They do not show whether the travel line has a working data path. Keep the eSIM installed while testing. A Yotti QR code is intended for one installation, so deleting the profile can turn a data fault into a reinstallation case.

<figure class="yotti-information-graphic">
  <img src="https://timostas.github.io/yotti-blog-rss/assets/inline/esim-internet-not-working-symptom-splitter-en-v1.webp" srcset="https://timostas.github.io/yotti-blog-rss/assets/inline/esim-internet-not-working-symptom-splitter-en-v1-384w.webp 384w, https://timostas.github.io/yotti-blog-rss/assets/inline/esim-internet-not-working-symptom-splitter-en-v1-720w.webp 720w, https://timostas.github.io/yotti-blog-rss/assets/inline/esim-internet-not-working-symptom-splitter-en-v1-960w.webp 960w, https://timostas.github.io/yotti-blog-rss/assets/inline/esim-internet-not-working-symptom-splitter-en-v1.webp 1440w" sizes="(max-width: 760px) calc(100vw - 56px), 760px" width="1440" height="900" decoding="async" alt="Troubleshooting diagram separating one-app failure, no data, slow data and no-network symptoms.">
  <figcaption>The first controlled test selects the branch; change one variable at a time.</figcaption>
</figure>

## Start with one repeatable test

Turn Wi-Fi off, load two unrelated websites and send one message. Repeat exactly that test after each change. If several settings, the APN and network selection move together, a successful result will not identify what helped.

<figure class="yotti-photo">
  <img src="https://timostas.github.io/yotti-blog-rss/assets/inline/esim-internet-not-working-controlled-browser-test-v1.webp" srcset="https://timostas.github.io/yotti-blog-rss/assets/inline/esim-internet-not-working-controlled-browser-test-v1-384w.webp 384w, https://timostas.github.io/yotti-blog-rss/assets/inline/esim-internet-not-working-controlled-browser-test-v1-720w.webp 720w, https://timostas.github.io/yotti-blog-rss/assets/inline/esim-internet-not-working-controlled-browser-test-v1-960w.webp 960w, https://timostas.github.io/yotti-blog-rss/assets/inline/esim-internet-not-working-controlled-browser-test-v1.webp 1440w" sizes="(max-width: 760px) calc(100vw - 56px), 760px" width="1440" height="960" loading="lazy" decoding="async" alt="A traveller by a hotel window compares a phone with brief connection-test notes.">
  <figcaption>Two ordinary pages and one message separate a data-path failure from an app problem.</figcaption>
</figure>

### If only one app fails

When both websites load and another message goes through, general mobile data is available. Check the failed app's cellular-data permission and current service status. Pause a VPN only for one comparison; that isolates a traffic path and does not prove that the VPN caused the failure. Leave the eSIM and APN unchanged in this branch.

### If nothing loads although a carrier is visible

Confirm first that the travel eSIM is enabled and assigned to mobile data. The home line may remain available for calls and codes, but automatic data switching should be paused during the test. Menu names vary by handset, operating system and carrier.

<figure class="yotti-information-graphic">
  <img src="https://timostas.github.io/yotti-blog-rss/assets/inline/esim-internet-not-working-dual-sim-roles-en-v1.webp" srcset="https://timostas.github.io/yotti-blog-rss/assets/inline/esim-internet-not-working-dual-sim-roles-en-v1-384w.webp 384w, https://timostas.github.io/yotti-blog-rss/assets/inline/esim-internet-not-working-dual-sim-roles-en-v1-720w.webp 720w, https://timostas.github.io/yotti-blog-rss/assets/inline/esim-internet-not-working-dual-sim-roles-en-v1-960w.webp 960w, https://timostas.github.io/yotti-blog-rss/assets/inline/esim-internet-not-working-dual-sim-roles-en-v1.webp 1440w" sizes="(max-width: 760px) calc(100vw - 56px), 760px" width="1440" height="900" loading="lazy" decoding="async" alt="Dual-SIM diagram with the travel eSIM assigned to data, the home line kept for calls and automatic switching paused.">
  <figcaption>During the test, each line has one unambiguous job.</figcaption>
</figure>

For a Yotti eSIM, enable data roaming on the Yotti line, not on the home SIM. Another provider's order remains the authority for its plan. The narrower guide explains [when Data Roaming should be on for a travel eSIM](https://yotti.net/en/blog/should-data-roaming-be-on-for-a-travel-esim).

Next, read the order or provider account. Check the remaining allowance, expiry and any daily-use rule. The network icon does not prove that the package is active. If the account shows zero data or an expired plan, use the guide for [an eSIM data allowance that has run out](https://yotti.net/en/blog/travel-esim-data-ran-out-how-to-get-back-online-safely); reinstalling the profile will not restore the allowance.

Inspect APN only if the current order supplies a value or support asks for it. Apple notes that some carriers do not allow APN editing, and Android menu locations vary. Copy only the value for the current plan. The complete procedure belongs in the [eSIM APN settings guide](https://yotti.net/en/blog/esim-apn-settings-when-and-how-to-change-them).

<figure class="yotti-information-graphic">
  <img src="https://timostas.github.io/yotti-blog-rss/assets/inline/esim-internet-not-working-order-before-apn-en-v1.webp" srcset="https://timostas.github.io/yotti-blog-rss/assets/inline/esim-internet-not-working-order-before-apn-en-v1-384w.webp 384w, https://timostas.github.io/yotti-blog-rss/assets/inline/esim-internet-not-working-order-before-apn-en-v1-720w.webp 720w, https://timostas.github.io/yotti-blog-rss/assets/inline/esim-internet-not-working-order-before-apn-en-v1-960w.webp 960w, https://timostas.github.io/yotti-blog-rss/assets/inline/esim-internet-not-working-order-before-apn-en-v1.webp 1440w" sizes="(max-width: 760px) calc(100vw - 56px), 760px" width="1440" height="900" loading="lazy" decoding="async" alt="Order-check card covering allowance, expiry, any daily rule and an APN only when the current plan supplies one.">
  <figcaption>The account is the authority for plan status; the network icon is not.</figcaption>
</figure>

### If the outcome changes

Use the new symptom instead of continuing the no-data sequence. If the carrier name or bars disappear, follow the [no-network troubleshooting order](https://yotti.net/en/blog/esim-installed-but-no-network-a-safe-troubleshooting-order). If ordinary pages work but remain slow, use the guide to [a slow travel eSIM](https://yotti.net/en/blog/travel-esim-running-slowly-how-to-find-the-cause). If the phone has data but a laptop does not, check [hotspot support and the plan's tethering terms](https://yotti.net/en/blog/can-you-use-hotspot-with-an-esim).

## Use reversible recovery before a reset

If the same two websites still fail, pause data-saving mode and the VPN for one controlled comparison. Then toggle airplane mode and restart the phone if needed. These are reversible tests; none requires deleting the eSIM.

A full network-settings reset belongs last, after checking the exact device guidance or speaking to support. Apple says an iPhone reset also affects saved Wi-Fi networks, cellular settings, VPN and APN; that source describes reset consequences, not a cellular-specific cure. Current Pixel software separates a mobile-network reset from Wi-Fi and Bluetooth. The scope is not universal across devices.

<figure class="yotti-photo">
  <img src="https://timostas.github.io/yotti-blog-rss/assets/inline/esim-internet-not-working-reversible-recovery-v1.webp" srcset="https://timostas.github.io/yotti-blog-rss/assets/inline/esim-internet-not-working-reversible-recovery-v1-384w.webp 384w, https://timostas.github.io/yotti-blog-rss/assets/inline/esim-internet-not-working-reversible-recovery-v1-720w.webp 720w, https://timostas.github.io/yotti-blog-rss/assets/inline/esim-internet-not-working-reversible-recovery-v1-960w.webp 960w, https://timostas.github.io/yotti-blog-rss/assets/inline/esim-internet-not-working-reversible-recovery-v1.webp 1440w" sizes="(max-width: 760px) calc(100vw - 56px), 760px" width="1440" height="960" loading="lazy" decoding="async" alt="A traveller restarts a phone beside luggage and a note of checks already completed.">
  <figcaption>Reversible recovery comes before a full network-settings reset.</figcaption>
</figure>

<figure class="yotti-information-graphic">
  <img src="https://timostas.github.io/yotti-blog-rss/assets/inline/esim-internet-not-working-support-handoff-en-v1.webp" srcset="https://timostas.github.io/yotti-blog-rss/assets/inline/esim-internet-not-working-support-handoff-en-v1-384w.webp 384w, https://timostas.github.io/yotti-blog-rss/assets/inline/esim-internet-not-working-support-handoff-en-v1-720w.webp 720w, https://timostas.github.io/yotti-blog-rss/assets/inline/esim-internet-not-working-support-handoff-en-v1-960w.webp 960w, https://timostas.github.io/yotti-blog-rss/assets/inline/esim-internet-not-working-support-handoff-en-v1.webp 1440w" sizes="(max-width: 760px) calc(100vw - 56px), 760px" width="1440" height="900" loading="lazy" decoding="async" alt="Support checklist: order, country, handset, displayed carrier and each test result, excluding the QR code and personal data.">
  <figcaption>A short test history is more useful than a list of guesses.</figcaption>
</figure>

## Give support the test history

Send the order number, country, handset model, carrier shown and the result of each repeatable test. Screenshots of the selected data line, roaming control and APN may help, but exclude the QR code and personal identifiers. A short sequence of observed results is more useful than several simultaneous setting changes.
