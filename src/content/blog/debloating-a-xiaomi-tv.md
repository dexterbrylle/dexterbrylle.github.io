---
title: "The TV That Talked Too Much"
seoTitle: "Xiaomi Mi TV P1: Reducing ads and telemetry with ADB"
description: "A working note on reducing ads and telemetry on a Xiaomi Mi TV P1 with ADB, including the mistakes I made along the way."
pubDate: 2026-11-05
tags: ["security", "privacy", "hardware"]
---

Our living room TV became slow. Each press on the remote felt like a question
that the TV had to think about.

The TV is a Xiaomi Mi TV P1, 55 inches, on Android TV 10. The last security
patch is from August 2022. It plays cartoons on the YouTube Kids profile and
NBA highlights on mine. Both had become slow to load.

One night I took two photos of the **About** screen and gave them to Claude
Code. I said: remove the bloat and the tracking. This note tells what we did,
what went wrong, and what I learned.

## Find the TV on the network

The photos gave the model number, `MITV-MOOQ2`. The router gave the rest. The
TV was on the local network with the name `mitv`, and port 5555 was open.
Network debugging was already on. I did not have to press a button on the
remote.

The first `adb connect` failed with `No route to host`. In my case, the
terminal lacked macOS **Local Network** permission. The same command worked
from a terminal that had permission.

```sh
adb connect <tv-ip>:5555
adb devices -l
```

If debugging is off on your TV, do these steps with the remote:

1. Go to **Settings > Device Preferences > About**.
2. Select **Build** and push OK seven times.
3. Go back to **Device Preferences > Developer options**.
4. Set **USB debugging** to on.
5. Go to **Settings > Network & Internet** and select your network to see the IP address.

## Measure before you remove

The TV has 1.8 GB of memory. When I started, only about 390 MB was free. One
app used 218 MB: **Mi TV+**, a set of free channels with ads. Xiaomi's
**PatchWall** launcher used 48 MB more, and I did not use it at all.

One more process was busy. `com.miui.tv.analytics` ran a service with the name
`DataCollectorService`. Its name suggested it was collecting data, though the
name alone did not tell me what it collected.

## My first mistake

The first plan was simple: disable the apps. I disabled 14 of them and
restarted the TV. All 14 came back. This firmware sets disabled apps back to
"enabled" early in the boot, before any app starts.

So we changed the method. `pm uninstall -k --user 0` removes an app for the
user. For an app installed in the system image, the APK can remain there.
That change stayed after a restart.

Then I wrote down my rules, and the first rule was: **disable, never
uninstall.** We put all the apps back. Twelve came back with no problem. Two
did not. Xiaomi copies its user-manual apps from `/system/customer-app` to
`/data/app` at first setup. The uninstall deleted the copy in `/data/app`. A
reinstall from the system image failed with a signature error. A factory reset
may restore them, but I have not tried it.

The two manuals are not important. The lesson is. Before you remove a
"system" app, find where its APK lives. Some preinstalled apps are not system
apps.

## The rules

After that night, I wrote the rules first, and the work followed them:

- Save the package list, each setting you change, and the undo commands before you change anything.
- Disable. Do not uninstall.
- Do not touch the active launcher, Play Services, the keyboard, the input services, or the live-TV apps.
- Do not touch an app that you cannot identify.
- Install apps only from their official GitHub releases.
- Do not root the TV. Do not flash it. Do not sign in for me.

## The cleanup

We disabled 19 apps in four groups:

| Group | Apps |
|---|---|
| Telemetry | Xiaomi analytics, Xiaomi statistics, Google feedback, bug report sender |
| Ads and recommendations | Mi channel rows, Google TV recommendations, partner auto-installs |
| Apps with Xiaomi tracking inside | Mi TV+, Mi video player, Mi media explorer, firmware update service |
| Things I never open | PatchWall, Mi Music, Mi Gallery, Mi screensaver, Play Games, Play Movies, retail demo mode |

```sh
adb shell pm disable-user --user 0 com.miui.tv.analytics
adb shell pm enable com.miui.tv.analytics   # undo
```

We also changed the animation and DNS settings. The animation scales went from 1.0 to 0.5, so
menus feel faster. Private DNS went to `dns.adguard-dns.com`, so the whole TV
uses a DNS server that blocks known ad and tracking hosts.

```sh
adb shell settings put global window_animation_scale 0.5
adb shell settings put global transition_animation_scale 0.5
adb shell settings put global animator_duration_scale 0.5
adb shell settings put global private_dns_mode hostname
adb shell settings put global private_dns_specifier dns.adguard-dns.com
```

After the cleanup, free memory went from about 390 MB to about 1.05 GB. The
home screen opens quickly again. The HDMI inputs and YouTube work.

## Look inside the apps

Disabling the analytics app did not answer my real question: is Xiaomi still
collecting data? To answer it, we pulled the APKs of the Xiaomi apps that were
still on and searched their code for known telemetry libraries and hosts.

Four apps had Xiaomi's **OneTrack** or **MiStat** library inside, with hosts
such as `tracking.intl.miui.com` and `data.mistat.intl.xiaomi.com`. Those apps
went into the "tracking inside" group above. The core service, `mitv.service`,
also reads a MiStat device ID. I cannot disable it without risk to the TV.

So we added a second layer. I asked AdGuard's resolver for each host that we
found:

```sh
dig +short @94.140.14.14 tracking.intl.miui.com      # 0.0.0.0
dig +short @94.140.14.14 data.mistat.intl.xiaomi.com # 0.0.0.0
dig +short @94.140.14.14 api.ad.xiaomi.com           # 0.0.0.0
```

At the time I checked, the resolver returned `0.0.0.0` for those hosts. It did
not block the update and configuration hosts I checked. DNS filtering is not a
guarantee that every tracking request is blocked.

At the end, I read the open connections on the TV. Each one went to Google,
Spotify or the AdGuard DNS server. I saw no connection to Xiaomi in that
snapshot, though it cannot prove the TV never contacts Xiaomi.

## What is not fixed

This work has limits, and I want to be honest about them.

- **Each restart undoes the cleanup.** The firmware enables the apps again at boot. After a restart, I run my local `./debloat.sh apply` script from my Mac; it is not included in this post. Ordinary apps cannot disable other apps without elevated privileges.
- **No more firmware updates.** I disabled the update service. The firmware is from 2022, so I accept this trade.
- **The core service still runs.** DNS blocks the tracking hosts I tested, but I cannot safely disable the service.

## One small gift

We installed [TV Bro](https://github.com/truefedex/tv-bro), an open-source
browser for Android TV. We took the small build from the official GitHub
release and compared its SHA-256 with the digest on the release page before
the install.

## What I learned

A slow device is often a busy device. Most of the busy work was not for me.

Measure first. Write the undo before the change. Expect the firmware to have
its own opinion. When you work with an assistant, write your rules down early.
I wrote mine after the first mistake. I will write them before the next one.

The last test was the first video on my YouTube home screen: Heat at Lakers,
full game highlights. It started with no wait. The TV did not ask any
questions.
