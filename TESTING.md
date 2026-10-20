# Combined extension manual checks

Disable both standalone extensions before testing the combined package. Keep them available for comparison. Reload pages after changing modules or site settings.

1. Turn the single toolbar switch **Off**, reopen the popup, and confirm it stayed Off. Reload a page: protection, publisher tools, and research lookup should all pause.
2. Turn it **On** and reopen the popup to confirm automatic saving. Reload your pages. Open **News & research tools → News** for publisher actions. Use **Settings** for preferences; those pages should all use the same blue-and-white styling.
3. Open **News & research tools → Research** on `https://www.nature.com/articles/nature14539`. Check DOI/open-access discovery.
4. Open an article from `https://www.reuters.com/world/` and `https://www.theatlantic.com/latest/`. Check article text, images, menus, and sign-in.
5. Check `https://www.cnn.com/` for ads, navigation, images, and video.
6. Check a video you normally watch on `https://tubitv.com/`. Record playback, errors, and controls; do not assume standalone results transfer to this package.
7. Save a harmless protection rule, change a News setting, then return to Protection: the custom rule must remain saved. Remove the test rule afterward.
8. Exclude a publisher in News and reload. News tools should pause there while Protection can remain active. Reverse the News exclusion afterward.
9. Save Off, close and reopen the browser, and confirm the entire program remains Off. Turn On again and verify your saved rules/preferences are restored.

For a failure, record the exact URL, action, whether standalone OpenSaysMe and standalone GapGuard handle it, the combined module state, and any displayed error. No automatic live-site testing is needed.
