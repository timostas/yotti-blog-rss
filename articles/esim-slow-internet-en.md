---
title: "Travel eSIM running slowly: how to find the cause"
slug: "esim-slow-internet-en"
description: "Separate weak signal, network congestion, plan limits and phone settings when a travel eSIM connects but mobile data remains slow."
publishedAt: "2026-08-24T07:00:00Z"
author: "Yotti Editorial Team"
reviewer: "Yotti Editor"
reviewedAt: "2026-08-24"
reviewAfter: "2027-02-24"
language: "en"
categories: ["Travel connectivity"]
sources:
  - "https://support.apple.com/en-us/108383"
  - "https://support.google.com/pixelphone/answer/14116080?hl=en"
cover:
  url: "https://timostas.github.io/yotti-blog-rss/assets/covers/esim-slow-internet.png"
  type: "image/png"
  alt: "A traveler reading a map at a cafe table on a Lisbon street at dusk"
published: true
---

A slow travel eSIM is usually connected correctly. The useful question is what is restricting the connection now: radio signal, a busy local network, the plan’s high-speed allowance, phone settings or an app that sits between the phone and the internet. Test in two locations before changing anything. One poor result in a station basement or a crowded square is not a profile diagnosis.

Do not replace the APN unless the provider has supplied a manual value. An APN mistake can remove data access altogether; it cannot create spare capacity on a congested network.

## Start with a small, controlled test

Switch Wi-Fi off and load a simple webpage, a map and a short piece of video. When only one app is slow, the cellular link is probably not the bottleneck. Check that app’s cellular-data permission, pause any VPN and try again.

If everything is slow, note the location, time and network indicator. One or two speed tests can help, but repeated tests consume a meaningful amount of a small travel package. A comparison from the same spot a few minutes later is more informative than chasing the highest number.

Move near a window or outdoors for the second test. Underground platforms, lifts, trains and thick walls reduce signal. Google’s Pixel guidance recommends disabling Wi-Fi, checking the mobile signal indicator and changing location when signal is weak.

Strong bars with a large drop at a predictable busy time point elsewhere. Concert venues, city centres and transport hubs can overload a cell even when reception looks excellent. Restarting the handset cannot clear demand from hundreds of nearby users.

## Read the plan before diagnosing the phone

Use Wi-Fi to open the current order. Check the remaining allowance, expiry and any fair-use or high-speed threshold. Some plans continue at a reduced rate after a daily or total allowance has been reached. The phone still shows service, so the result can look like a technical fault.

The handset’s data counter is useful for finding heavy apps, but its period may not match the provider’s billing period. For a [Yotti eSIM](https://yotti.net/en/), use the order status as the commercial record. If the high-speed allowance has ended, resetting network settings will not restore it.

Background work matters too. Photo backups, laptop updates over hotspot and automatic app downloads can occupy the connection without being visible in the browser. Stop tethering for the test and inspect recent cellular usage by app.

## The 5G symbol is not a speed guarantee

A phone may move between 5G and LTE as conditions change. Apple’s default 5G Auto mode uses LTE when 5G would not deliver a noticeably better experience. Google notes that a 5G status icon can indicate that the service is available in the area without proving that the current data session is using it.

On iPhone, open Settings, Cellular or Mobile Data, select the travel line and open Voice & Data. Leave 5G Auto as the sensible baseline where it is available. Forcing 5G On can use more battery and does not improve a weak or overloaded network.

On Pixel, the path is Settings, Network & internet, SIMs, the selected operator and Preferred network type. The options vary by model, country and carrier. Use the recommended automatic mode unless the provider tells you otherwise.

Battery-saving modes can also change network behaviour. Pixel Battery Saver turns off 5G, while Low Power Mode limits some 5G use on certain iPhones. That may explain a change of icon, though stable LTE should still carry data.

## Remove one extra layer at a time

A VPN can add latency or choose a distant route. Pause it for one comparison, then turn it back on. If the same pages become responsive without it, the eSIM does not need reinstalling; the VPN server or configuration needs attention.

Low Data Mode and Android data-saving controls deliberately reduce background activity. They are useful on a limited plan, but video quality and app refreshes may feel slower than usual. Check the setting on the travel line before assuming the network has been throttled.

When a browser works but one service does not, look at that service’s outage status, regional availability and permissions. Mobile connectivity is already present.

## Compare like with like

A hotel Wi-Fi result and a cellular result answer different questions. For the travel line, test from the same place with the same page: first under normal settings, then with the VPN and tethering paused. Changing the room, network mode, server and application together makes an improvement impossible to attribute.

Disable automatic cellular-data switching during the comparison on a Dual SIM phone. Otherwise the handset may quietly move to the home line when the travel signal weakens. A fast result could then be expensive roaming rather than a recovered eSIM. Check the per-line data record afterwards.

Another person’s phone is only a rough reference. Different handsets support different radio bands, and two travel plans in the same country may use different partners. Location and time alone do not make the connections equivalent.

## Keep the safe fallback intact

Do not erase a profile that still passes data. Erasing it does not improve coverage and may require new activation details. A complete network reset is also disproportionate after one slow session because it changes saved Wi-Fi and other connections.

Support can investigate a concise record: order number, country, phone model, local network, time, signal level, network type and results with the VPN paused. Say whether the slowdown follows you to another location. Cases where signal is present but no data passes at all are a separate route under [Travel connectivity](https://yotti.net/en/blog/tag/Travel%20connectivity).
