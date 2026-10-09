# Gymbro UI styling

The web workout flow uses the SAKA CSS kit supplied by the user at `/Users/khalid/Downloads/SAKA` on 9 October 2026. The source stylesheet is copied to `frontend/public/saka-style.css`; `frontend/public/gymbro-ui.css` contains only Gymbro layout and component adaptations. SAKA's dark orange preset is the default. The supplied gallery remains outside the repository because it is a demonstration page, not an app screen.

Use SAKA's cyan preset, `saka-card`, `saka-btn`, `saka-input`, `saka-select`, `saka-kicker`, and layout classes with semantic HTML. Use `.saka-prose` for instructions and longer sentences. Keep touch controls at least about 40 px high, retain visible focus, and check mobile width and reduced motion. Normal pages must scroll; the camera view uses a fixed `100dvh` grid so preview, rep count, status, and controls stay visible together.

The original SAKA gallery links to a remote Space Mono font. Gymbro leaves that link out so an already cached app works offline; SAKA's system monospace fallbacks are used. The style applies to the web adapter. Native screens can adopt the same color/spacing tokens when the native UI is implemented.
