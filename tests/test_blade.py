"""Foresight blade correction checks. Run from the repo root: python3 tests/test_blade.py
Needs: pip install playwright && playwright install chromium (or set CHROME to a Chrome binary)."""
import json, os, threading, functools, http.server
from playwright.sync_api import sync_playwright

# Old single-rifle No4 data: three Zero Range groups, no blade recorded.
OLD = {"rifle": {"name": "Test No4", "sightType": "mk1", "clickCount": 57, "sightRadius": 28.35, "blade": None},
       "ammo": {"name": "PPU 174 gr FMJBT (PP303F)", "weight": 174, "bc": 0.478, "mv": 2400},
       "firings": [{"range": 300, "setting": "300", "shots": 3, "unit": "zr", "dy": -1.25},
                   {"range": 300, "setting": "400", "shots": 3, "unit": "zr", "dy": 1.25},
                   {"range": 300, "setting": "300", "clk": 3, "shots": 3, "unit": "zr", "dy": -0.25}]}

srv = http.server.ThreadingHTTPServer(('127.0.0.1', 0), functools.partial(http.server.SimpleHTTPRequestHandler, directory='.'))
threading.Thread(target=srv.serve_forever, daemon=True).start()
url = 'http://127.0.0.1:%d/' % srv.server_address[1]
offset = lambda pg: pg.evaluate("PP._test.compute(PP._test.cur()).a")
blade_box = '[data-panel=setup] [data-k="R.blade"]'

with sync_playwright() as p:
    b = p.chromium.launch(executable_path=os.environ.get('CHROME') or None)
    pg = b.new_page(); errors = []; pg.on('pageerror', lambda e: errors.append(str(e)))
    pg.goto(url); pg.evaluate("v => { localStorage.clear(); localStorage.setItem('no4-sight-book-local', JSON.stringify(v)); }", OLD)
    pg.reload(); pg.wait_for_timeout(500); pg.click('#subtabs [data-p=setup]')
    a0 = offset(pg)

    # 1. Typing a first blade, one key at a time, must not change the calibration.
    pg.click(blade_box); pg.keyboard.type('0.090'); pg.wait_for_timeout(100)
    assert abs(offset(pg) - a0) < 1e-6, 'first blade entry moved the calibration'
    assert pg.evaluate("PP._test.cur().firings.every(f => f.blade === null)"), 'firings stamped while typing a first blade'

    # 2. Changing 0.090 -> 0.075 stamps old groups with 0.090 and moves the offset by 0.015 / 28.35 rad = 1.819 MOA.
    pg.locator(blade_box).blur()  # a later visit to the box, as when you fit a new blade
    pg.fill(blade_box, '0.075'); pg.wait_for_timeout(100)
    assert pg.evaluate("PP._test.cur().firings.every(f => f.blade === 0.09)"), 'old groups lost their blade'
    assert abs(offset(pg) - a0 - 0.015 / 28.35 * 3437.7468) < 0.01, 'wrong correction for a blade change'

    # 3. An empty blade box makes no correction at all.
    pg.locator(blade_box).blur(); pg.fill(blade_box, ''); pg.wait_for_timeout(100)
    assert abs(offset(pg) - a0) < 1e-6, 'empty blade box moved the calibration'

    assert not errors, errors
    b.close()
srv.shutdown()
print('blade tests passed')
