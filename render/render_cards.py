import sys, pathlib
ROOT=pathlib.Path(__file__).resolve().parent.parent
from playwright.sync_api import sync_playwright
jobs={'holdings':(42,700),'slime-path':(42,700),'baseline':(42,520),'containment':(42,175),'packet-walk':(42,150)}
only=sys.argv[1:] or list(jobs)
with sync_playwright() as p:
    b=p.chromium.launch(); pg=b.new_page(viewport={"width":1080,"height":1350})
    pg.on("pageerror", lambda e: print("ERR:",e))
    for k in only:
        seed,steps=jobs[k]
        pg.goto(f"file://{ROOT}/render/card.html?p={k}&seed={seed}&steps={steps}")
        pg.wait_for_function("window.done", timeout=300000)
        pg.screenshot(path=f"{ROOT}/media/{k}-card.png"); print("ok",k)
    b.close()
