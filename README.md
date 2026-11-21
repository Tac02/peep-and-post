# Peep & Post

A sight book for classic rifles with iron sights. Most ballistics apps assume a modern rifle with a telescopic sight; Peep & Post is built around ladder sights, battle apertures, foresight blades and service-rifle targets.

It supports several **.303 British** rifles, each with its own rear-sight options:

| Rifle | Rear sights |
|---|---|
| SMLE No1 Mk III / Mk III* | Open tangent leaf 200–2000 yd, set to 25 yd (Mk III with windgauge) |
| No4 Mk1 / Mk1* and Mk2 | Mk1 micrometer (clicks), Mk2 300/600 flip, Mk3 and Mk4 pressed leaf |
| No5 Mk1 jungle carbine | No5 Mk1 micrometer to 800 yd, No5 Mk2 pressed ladder |
| P14 / No3 Mk1 | 300 yd battle aperture plus ladder 200–1650 yd |
| Long Lee / Lee-Metford | Leaf to 1800 yd (less well documented: check against your rifle) |
| Other .303 | Your own graduations |

Sight radius and foresight blade data come from the REME zeroing précis where available.

## What it does

- A home page with a tab for each rifle you add. Every rifle keeps its own sight, foresight blade, load and firings.
- Your own custom loads, saved once and usable by any rifle, alongside factory loads.
- Shot plotting: tap each hole on a picture of an NRA round bull, Figure 11, 12 or 12C, or a plain MOA grid, and the group centre, size and shot count are filled in.
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

Plain HTML, CSS and JavaScript with no build step and no server:

- `index.html` — the page
- `css/app.css` — styles
- `js/data.js` — rifles, sights, reference loads, factory ammunition and target sizes (edit this to add rifles)
- `js/ballistics.js` — trajectory model
- `js/plot.js` — shot plotting
- `js/app.js` — everything else

`manifest.webmanifest` and `sw.js` make it installable and usable offline. Data is saved in the browser on the device (`localStorage`); older No4 Sight Book data is carried over automatically.

The trajectory model is a point-mass G1 solver. Each sight mark is modelled as the elevation a Mk VII-type round needs at that range, then corrected by your own test groups.

## Making changes

1. Edit the files above. New rifles and sights go in `js/data.js`.
2. In `sw.js`, bump `VERSION` (e.g. `pp-v1` → `pp-v2`) so installed copies pick up the change.
3. Run `python3 tests/test_blade.py` (needs Playwright) to check the foresight blade maths.
4. Commit to `main`. GitHub Pages republishes within a minute or two.

See [ROADMAP.md](ROADMAP.md) for planned rifles, calibres and features.

## Sources for built-in data

- Target dimensions: NRA Handbook 2026 (Bisley Bible), Appendix V; NRA Civilian Service Rifle & Practical Rifle Handbook; MoD JSP 403 for the Figure 11 height.
- Ammunition figures: manufacturers' published velocity and BC. The S&B 180 gr SP BC is estimated from S&B's own drop table.

Always confirm settings on paper before relying on them.
