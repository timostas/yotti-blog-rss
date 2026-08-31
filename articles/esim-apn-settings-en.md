---
title: "eSIM APN settings: when and how to change them"
slug: "esim-apn-settings-en"
description: "Change an eSIM APN only when the provider gives an exact value. Find the setting on iPhone or Android, enter it safely and test mobile data."
publishedAt: "2026-08-22T22:10:48Z"
author: "Yotti Editorial Team"
reviewer: "Yotti Editor"
reviewedAt: "2026-08-23"
reviewAfter: "2027-02-23"
language: "en"
categories: ["Travel connectivity"]
sources:
  - "https://support.apple.com/en-us/102483"
  - "https://support.google.com/pixelphone/answer/2926415?hl=en"
cover:
  url: "https://timostas.github.io/yotti-blog-rss/assets/covers/esim-apn-settings.png"
  type: "image/png"
  alt: "A traveler marking a route in a notebook at a table above the Mediterranean coast"
published: true
---

Change an eSIM APN only when the provider gives you an exact value or its support team asks you to enter one. Most travel eSIMs configure this setting automatically. If mobile data already works, leave the APN alone: a mistyped entry can stop an otherwise healthy connection.

APN stands for Access Point Name. It tells the phone which network path to use for cellular data. That makes it relevant when an eSIM has joined a mobile network but cannot reach the internet. It will not repair an eSIM that has no service, revive an expired data package or make a data-only plan receive SMS.

## The order confirmation is your source of truth

Open the email, app or setup page supplied with your current plan. Look for a line labelled APN. If it says “automatic,” the provider does not expect a manual entry. If it shows a short value, copy that value exactly, without adding spaces.

Avoid APN lists from forums and generic travel guides. Two eSIMs used in the same country can route through different partners and require different settings. An old value that once worked for a local carrier is not evidence that it belongs to your plan.

The usual fields look technical, but that does not mean they all need an answer. The provider may supply:

- an APN, which is the main value;
- a username and password, less commonly;
- another field only where its own instructions explicitly require it.

Leave proxy, port, MCC, MNC, authentication type, MMSC and similar fields untouched unless the provider has supplied exact entries. Guessing those values creates a second problem without solving the first.

## Decide whether the APN is the right place to look

The most useful clue is the phone’s current state.

**There is no carrier name, signal or mobile-network registration.** Do not start with the APN. The eSIM first needs to be enabled and accepted by a network.

**The phone has service, but the home SIM is selected for cellular data.** Choose the travel eSIM as the data line. An APN edit cannot override the wrong SIM selection.

**The eSIM has service and is the data line, its allowance is active, and the provider supplied a manual APN.** This is the case for checking or entering the value.

**Only SMS or calls fail.** APN settings concern data access. Check whether the plan actually includes a number, voice or texting instead.

Before editing, take a screenshot of the original APN screen or note the selected entry. Keep QR codes and full device identifiers out of the image. On Android, creating a separate APN is often preferable to overwriting an existing one because it preserves a quick route back.

## Enter an APN on iPhone

Apple says APN settings are visible only when the carrier allows them to be edited. Depending on the carrier and interface language, use one of these paths:

1. Open Settings, Cellular, then Cellular Data Network.
2. Or open Settings, Mobile Data, Mobile Data Options, then Mobile Data Network.
3. Locate the cellular-data fields for the travel eSIM.
4. Enter the APN supplied by the provider. Add a username or password only if the same instructions include them.
5. Return to the previous screen. Available changes save automatically.

The menu may be absent. That does not mean the eSIM installation failed. The carrier can prevent manual editing or provide its settings through a configuration profile. Ask the eSIM provider for the correct method rather than installing an unverified profile from a search result.

Apple also notes that an iOS update can reset manually changed APN settings to their defaults unless a configuration profile supplies them. If data stops immediately after an update, compare the screen with the provider’s current instructions before making any broader changes.

## Find the APN menu on Android

On a Google Pixel, open Settings, Network & internet, then SIMs. Select the travel eSIM and open Access point names. Google cautions that the available mobile-network options vary by phone and Android version.

Manufacturers use slightly different labels, so another Android phone may place the screen under Mobile network, SIM manager or Connections. The important detail is to choose the travel eSIM before opening Access point names; editing the home SIM’s entry will not change the travel connection.

Where the phone offers an Add button, the sequence is usually:

1. Create a new access point and give it a recognisable name, such as “Travel.”
2. Type the APN exactly as it appears in the order.
3. Enter a username and password only if they were supplied.
4. Save the entry from the screen menu.
5. Select the new APN so its radio button or marker becomes active.

If the entry vanishes after saving, do not fill every blank field to force it through. Return to the provider’s instructions and ask which fields are mandatory for that device. Android may already hold carrier information that should not be replaced.

## Test the new route, not a cached app

Turn off Wi-Fi after saving. Confirm that the travel eSIM is still selected for mobile data and that data roaming follows the provider’s instructions. Switch Airplane Mode on for a few seconds, then off, allowing the phone to register again.

Now open two unfamiliar web pages in a browser. A frequently used app may display stored content or quietly resume over Wi-Fi, so it is a poor first test. If both pages load through cellular data, the APN is working. There is no need to reset anything else.

If they do not load, compare the entry with the order character by character and check that the new APN is actually selected. On Android, switch back to the original access point you recorded. On iPhone, Apple provides Reset Settings inside Cellular Data Network to restore the carrier defaults; an installed configuration profile will restore its own default information.

A reset of every network setting is a much larger step. It can remove saved network choices and does not tell you whether the APN was wrong. Keep the test narrow, and do not erase the eSIM while support can still inspect the installed profile.

## Give support a useful snapshot

Send the provider the order number, phone model, country, network name shown on screen and the exact APN you entered. Say whether a 4G or 5G indicator appears, which SIM is selected for data, and what happens with Wi-Fi disabled. A cropped APN screenshot can help; the eSIM QR code, passwords, one-time codes and full EID should remain private.

If support confirms that the plan uses an automatic APN, restore the original setting. No carrier name or signal belongs to the [installed eSIM with no network](https://yotti.net/en/blog/esim-installed-but-no-network-a-safe-troubleshooting-order) path; signal with failed webpages belongs to the broader [eSIM internet diagnosis](https://yotti.net/en/blog/esim-has-signal-but-no-internet-what-to-check). For a [Yotti eSIM](https://yotti.net/en/), always use the APN attached to the current order rather than a value copied from another destination or plan.
