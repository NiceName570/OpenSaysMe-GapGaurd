# Combined extension manual checks

Disable both standalone extensions before testing the combined package. Keep them available for comparison. Reload pages after changing modules or site settings.

1. Open **Protection**. Confirm **Ready**, and toggle protection/Combined coverage. Reopen the popup to confirm automatic saving.
2. Open **News**. Check the publisher toggle and custom-site controls. In Settings, verify the News rule status has no error.
3. Open **Research** on `https://www.nature.com/articles/nature14539`. Check DOI/open-access discovery.
4. Open an article from `https://www.reuters.com/world/` and `https://www.theatlantic.com/latest/`. Check article text, images, menus, and sign-in.
5. Check `https://www.cnn.com/` for ads, navigation, images, and video.
6. Check a video you normally watch on `https://tubitv.com/`. Record playback, errors, and controls; do not assume standalone results transfer to this package.
7. Save a harmless protection rule, change a News setting, then return to Protection: the custom rule must remain saved. Remove the test rule afterward.
8. Exclude a publisher in News and reload. News tools should pause there while Protection can remain active. Reverse the News exclusion afterward.
9. Close and reopen the browser. Confirm News rebuilds and Protection remains Ready, with preferences retained.

For a failure, record the exact URL, action, whether standalone OpenSaysMe and standalone GapGuard handle it, the combined module state, and any displayed error. No automatic live-site testing is needed.
