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
  modifiedAt: "2026-09-06T12:49:43.000Z"
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
    - title: "Yotti: installation, roaming and the single-use QR code"
      url: "https://yotti.net/en/how-it-works"
cover:
  url: "https://timostas.github.io/yotti-blog-rss/assets/covers/esim-internet-not-working-remediation.webp"
  type: "image/webp"
  alt: "A traveller in a hotel lobby checking mobile-data settings on a phone"
published: true
---

A carrier name and signal bars usually show that the phone can see or has attached to a mobile network. They do not prove that mobile data has a working path to the internet. If Wi-Fi works but cellular pages do not, start with four common checks: the selected data line, the travel line's roaming setting, the plan balance and any APN supplied with the order.

Keep the eSIM installed while you investigate. A Yotti QR code is intended for one installation, so deleting the profile can turn a data fault into a reinstallation case. If the carrier name or bars disappear, this guide no longer matches the symptom; use the separate [no-network troubleshooting order](https://yotti.net/en/blog/esim-installed-but-no-network-a-safe-troubleshooting-order).

Before changing a setting, record the carrier shown on screen, the signal level, the selected data line and the plan status in the order. A short note or screenshots without the QR code or personal details are enough. If one switch restores service, that record identifies the useful change. If it does not, support can see what has already been tested. Avoid changing the APN, network selection and several SIM controls together; a successful result would not reveal which action mattered.

## Establish what is actually failing

Turn Wi-Fi off and load two unrelated websites. Try a message as a second type of traffic. If both sites load and only one app fails, general mobile data is available; the next suspects are that app's cellular permission, a VPN or DNS path, regional availability, or the service itself.

Pages that load slowly belong to a different diagnosis. Test the line in another location and follow the guide to [a slow travel eSIM](https://yotti.net/en/blog/travel-esim-running-slowly-how-to-find-the-cause). The steps below are for a line that shows a network but cannot load ordinary pages at all.

Use the same two-site test after every change. Changing several settings together may restore service, but it leaves no clear cause and makes the problem harder to explain if support is needed.

## Make the travel eSIM the data line

Dual-SIM phones can use one line for calls and another for cellular data. Check the SIM settings and confirm that the travel eSIM owns the data role.

On an iPhone, Apple places this choice under Settings, Cellular or Mobile Data, then Cellular Data. A Pixel exposes the data-SIM choice under Network & internet and SIMs. Galaxy phones use SIM manager. Exact labels can vary with the OS release, handset and carrier, so use the settings search for “SIM” or “mobile data” if the screen differs from the vendor guide.

Disable automatic cellular-data switching for this test. That prevents the phone from silently moving the session to the home line. It is a temporary diagnostic setting, not a recommendation for every trip.

## Treat roaming as a line-specific setting

Yotti instructs customers to enable data roaming on the Yotti eSIM. A different provider may give different setup directions, so its order remains the authority for that plan.

Do not enable roaming on the home SIM merely to test the travel line. The two lines have separate controls, and any charge on the home line depends on the home tariff. Once the travel-line setting is correct, wait briefly, switch Wi-Fi off again and rerun the browser test.

For a closer look at this branch, see [when Data Roaming should be on for a travel eSIM](https://yotti.net/en/blog/should-data-roaming-be-on-for-a-travel-esim).

## Read the account before changing the phone again

Open the order or provider account and check the remaining allowance, expiry and any daily-use rule. A network indicator may remain after a plan runs out, but that behaviour is not guaranteed. The icon cannot confirm that the package is active.

Reset times are provider-specific. Do not assume that a daily allowance renews at local midnight. If the account shows zero data or an expired plan, follow the narrower guide for [an eSIM data allowance that has run out](https://yotti.net/en/blog/travel-esim-data-ran-out-how-to-get-back-online-safely). Reinstalling the profile will not restore an exhausted package.

## Inspect APN only when the order gives you one

An Access Point Name tells the phone which network path to use for cellular data. Many eSIM profiles supply it automatically. Manual editing is appropriate only when the provider gives an exact value or its support team asks for the change.

Apple notes that APN editing is unavailable with some carriers. Android menu locations differ between versions and manufacturers. Copy only the value for the current plan, without adding spaces; an APN borrowed from a forum or another country's plan can break a line that was otherwise configured correctly. The full procedure belongs in the dedicated [eSIM APN guide](https://yotti.net/en/blog/esim-apn-settings-when-and-how-to-change-them).

## Use reversible recovery before any reset

Pause a VPN and data-saving mode briefly, then repeat the controlled test. This does not assume either feature caused the outage; it removes two variables without changing the eSIM profile.

Next, toggle airplane mode off and on. Restart the phone if the data path still fails. A full network-settings reset belongs near the end, after consulting instructions for the exact device or speaking to support. Its scope is not universal: an iPhone reset affects Wi-Fi, cellular, VPN and APN settings, while current Pixel software separates the mobile-network reset from the Wi-Fi and Bluetooth reset.

## Give support evidence, not a list of guesses

Record the order number, country, handset model, carrier shown on screen and the outcome of each check. Screenshots of the selected data line, roaming control and APN can help, provided they exclude the eSIM QR code and personal identifiers.

The final symptom determines the next route. No carrier or bars means a registration problem. Working but slow pages need a speed diagnosis. If data works on the phone but not on a laptop, check [hotspot support and the plan's tethering terms](https://yotti.net/en/blog/can-you-use-hotspot-with-an-esim). Keeping those cases separate prevents a broad reset from replacing a targeted fix.
