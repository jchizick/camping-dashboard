JetBrains Mono variable font, version 2.211, from the Google Fonts distribution:
https://github.com/google/fonts/blob/main/ofl/jetbrainsmono/JetBrainsMono%5Bwght%5D.ttf

This is the same font version previously provided by `next/font/google`. It is
bundled locally to avoid the Google font query parsing error in Turbopack 16.1.6.
The root layout retains the existing normal weights (400, 500, and 700), CSS
variable, display mode, and fallback fonts. The full font preserves character
coverage without a build-time network request for JetBrains Mono.

Licensed under the SIL Open Font License 1.1; see OFL-JetBrainsMono.txt.
