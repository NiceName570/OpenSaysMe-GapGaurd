# Your GapGuard test sheet

Start with **Combined coverage ON** and **YouTube skip helper OFF**. Test only one ad blocker at a time. A separate Edge profile is useful if you prefer not to touch your daily setup. No automated live-site tests were run by the builder.

## 1. Confirm it loads

Load the `extension` folder using **Load unpacked** at `edge://extensions`. Open **GapGuard → Settings & tests**.

- Status says **Ready**.
- Build information shows Core and Combined rule counts.
- If the extension fails to load, paste Edge's exact error. If it loads but status is **Needs attention**, paste that message instead.

## 2. Test sites

| Site | Check |
| --- | --- |
| https://d3ward.com/adblock | Record the score and failing categories. Cosmetic tests can be site-specific, so a failed item is not proof of a general failure. |
| https://adblock-tester.com/ | Record score and failed checks. Some contextual advertising tests are marked unreliable by the test publisher. |
| https://canyoublockit.com/ | Start with the simple test and observe visible ad formats. Record banners, overlays, or new windows that survive. |
| https://www.youtube.com/ | Play a few ordinary videos and navigate between them. Note ads, player errors, black screens, and whether seeking/audio/fullscreen work. |
| Your usual 2–3 ad-heavy websites | Check ads and normal functions: images, menus, search, forms, and video. These results matter more than synthetic scores. |

Keep VPN/DNS, Edge tracking protection, account sign-in state, and cookie decisions consistent between comparisons. Reload with **Ctrl+Shift+R** after switching modes or extensions. Do not count the absence of an ad in one visit as conclusive; repeat when practical.

## 3. Find actual gaps

For a miss or broken page, use this short sequence:

1. Combined ON: record what happens.
2. Combined OFF (Core): reload and compare.
3. GapGuard OFF: reload and check whether the problem disappears.
4. If useful, disable GapGuard and try the original blocker that handled this page well. Record its name, version/settings, and Ad Remover trial/license status if applicable.

An improvement in Combined is a candidate success. A problem appearing only in Combined identifies a supplemental rule conflict. A problem present with GapGuard OFF likely needs a different explanation.

## 4. Controls and regression checks

- In **Settings**, toggle protection, Combined coverage, or the YouTube helper. Each switch saves immediately without clicking **Save settings**; reopen Settings to confirm. Unfinished rule and exception edits should remain untouched.
- **Pause on this site** → reload → protection is paused there; another site remains protected.
- **Resume on this site** → reload → protection returns.
- **Block an element** → select an unwanted element → confirm through the picker → reload → rule persists. Avoid selecting meaningful navigation or content.
- Settings → **Custom rules** → remove the picker rule → save/reload → element returns.
- Export settings. Import the file into the form, review it, then save. Existing rules and site exceptions should remain correct.
- Restart Edge and check settings persist.
- Optional: enable the YouTube helper and test whether available Skip ad buttons get clicked. It should not skip ordinary video content. Turn it off if it misbehaves.

## Send back only this

```text
Site / video URL:
Problem or improvement:
Combined ON:
Core only:
GapGuard OFF:
Original blocker, if compared:
Steps to reproduce:
```

For test pages, just send the score plus failed checks. Screenshots are useful when the issue is visual. **Export diagnostic summary** omits browsing URLs; nothing uploads automatically. You decide whether to attach it.

Do not chase 100% by adding rules solely for the test site. We want actual coverage with working websites.
