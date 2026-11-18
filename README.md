# Peep & Post

A sight book for classic rifles with iron sights. Most ballistics apps assume a modern rifle with a telescopic sight; Peep & Post is built around ladder sights, battle apertures, foresight blades and service-rifle targets.

It currently supports the **Lee-Enfield No4** and its four rear sights (Mk1 micrometer, Mk2 flip, Mk3 and Mk4 pressed leaf).

## What it does

- Records test firings: range, sight setting and clicks, group position and size in inches, MOA or on the Bisley Zero Range card, with either a point-of-impact or a lollipop (6 o'clock) hold.
- Calibrates your sight from those groups and works out the setting for every range, in clicks above or below the 100-yard marks on a Mk1.
- Lollipop settings for Figure 11, Figure 12, Figure 12C and NRA round-bull targets.
- Foresight blade advice, battle-aperture impact, crosswind drift, and a trajectory plot to compare loads.
- Ammunition presets for PPU and Sellier & Bellot .303 British.

## Using it

Open the app at **https://tac02.github.io/peep-and-post/**.

On Android, open that link in Chrome and choose **Install app** (or ⋮ menu → *Add to Home screen*). It then works like any other app, including with no signal on the range.

Your records are saved on your own device only. Use **Backup or move your data → Download backup file** now and then to keep a copy safe or move to another phone.

## How it's built

A single self-contained page (`index.html`) with no build step and no server. `manifest.webmanifest` and `sw.js` make it installable and usable offline.

The trajectory model is a point-mass G1 solver. Each sight mark is modelled as the elevation a Mk VII-type round needs at that range, then corrected by your own test groups.

## Making changes

1. Edit `index.html` (or the other files).
2. In `sw.js`, bump `VERSION` (e.g. `pp-v1` → `pp-v2`) so installed copies pick up the change.
3. Commit to `main`. GitHub Pages republishes within a minute or two.

See [ROADMAP.md](ROADMAP.md) for planned rifles, calibres and features.

## Sources for built-in data

- Target dimensions: NRA Handbook 2026 (Bisley Bible), Appendix V; NRA Civilian Service Rifle & Practical Rifle Handbook; MoD JSP 403 for the Figure 11 height.
- Ammunition figures: manufacturers' published velocity and BC. The S&B 180 gr SP BC is estimated from S&B's own drop table.

Always confirm settings on paper before relying on them.
