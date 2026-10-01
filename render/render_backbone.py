"""Render the 'assume the backbone is compromised' cinematic short with a synthesized sound track."""
import os, json, math, shutil, subprocess, pathlib, wave
import numpy as np
from playwright.sync_api import sync_playwright
ROOT=pathlib.Path(__file__).resolve().parent.parent
FPS, SR = 30, 44100
d=ROOT/".frames"/"backbone"; shutil.rmtree(d,ignore_errors=True); d.mkdir(parents=True)
with sync_playwright() as p:
    b=p.chromium.launch(); pg=b.new_page(viewport={"width":1080,"height":1920})
    pg.on("pageerror", lambda e: print("ERR:",e))
    pg.goto(f"file://{ROOT}/render/backbone_cinematic.html"); pg.wait_for_function("window.ready"); n=pg.evaluate("TOTAL")
    for i in range(n):
        pg.evaluate(f"frame({i})"); pg.screenshot(path=str(d/f"{i:04d}.jpg"), type="jpeg", quality=90)
    events=pg.evaluate("getEvents()"); b.close()

# ---------------- sound design ----------------
dur=n/FPS; N=int(dur*SR); t=np.arange(N)/SR; mix=np.zeros(N)
def env(L,a=.005,r=.1):
    x=np.ones(L); A=int(a*SR); Rr=int(r*SR)
    if A: x[:A]=np.linspace(0,1,A)
    if Rr: x[-Rr:]*=np.linspace(1,0,Rr)
    return x
def add(sig,at,gain=1.):
    i=int(at*SR); j=min(N,i+len(sig))
    if i<N: mix[i:j]+=sig[:j-i]*gain
rng=np.random.default_rng(7)
# music bed: Am - F - C - G pad, 2 s per chord, soft pulse at 100 bpm
chords=[[220,261.6,329.6],[174.6,220,261.6],[130.8,196,261.6],[196,246.9,293.7]]
bed=np.zeros(N)
for k in range(int(dur/2)+1):
    seg=np.arange(int(2*SR))/SR; s=np.zeros_like(seg)
    for f0 in chords[k%4]:
        for det in (-1.5,0,1.5): s+=np.sin(2*np.pi*(f0+det)*seg)+.3*np.sin(2*np.pi*2*(f0+det)*seg)
    s*=env(len(seg),.4,.4)/9; i=int(k*2*SR); j=min(N,i+len(seg)); bed[i:j]+=s[:j-i]
beat=60/100
for k in range(int(dur/beat)):
    L=int(.25*SR); x=np.arange(L)/SR; kick=np.sin(2*np.pi*(55+60*np.exp(-x*30))*x)*np.exp(-x*12); add(kick,k*beat,.35)
    hh=rng.standard_normal(int(.03*SR))*np.exp(-np.arange(int(.03*SR))/SR*120); add(hh,k*beat+beat/2,.05)
mix+=bed*.22
def tone(f,L,decay=20,shape='sine'):
    x=np.arange(int(L*SR))/SR; ph=2*np.pi*f*x
    w=np.sin(ph) if shape=='sine' else np.sign(np.sin(ph))
    return w*np.exp(-x*decay)
cue={}
for f,kind in events: cue.setdefault(kind,[]).append(f/FPS)
for at in cue.get('blip',[]): add(tone(1320,.08,40),at,.10)
for at in cue.get('zap',[]):
    x=np.arange(int(.09*SR))/SR; add(np.sign(np.sin(2*np.pi*(420-3000*x)*x))*np.exp(-x*30),at,.05)
for at in cue.get('reroute',[]): add(tone(880,.12,18),at,.25); add(tone(1320,.18,14),at+.09,.25)
for at in cue.get('whoosh',[]):
    L=int(.7*SR); nz=rng.standard_normal(L); k=np.linspace(2,60,L).astype(int); sm=np.array([nz[max(0,i-kk):i+1].mean() for i,kk in enumerate(k)]); add(sm*env(L,.3,.3),at,.9)
for at in cue.get('snap',[]):
    L=int(.5*SR); x=np.arange(L)/SR; boom=np.sin(2*np.pi*(45+80*np.exp(-x*25))*x)*np.exp(-x*6)
    crack=rng.standard_normal(L)*np.exp(-x*35); crush=np.round(crack*6)/6
    add(boom,at,.9); add(crush,at,.55)
for at in cue.get('chime',[]):
    for i,fq in enumerate((784,988,1319)): add(tone(fq,.6,5),at+i*.08,.22)
on=cue.get('jam_on',[None])[0]; off=cue.get('jam_off',[None])[0]
if on is not None and off is not None:
    i,j=int(on*SR),int(off*SR); x=t[i:j]-on
    hum=(np.sin(2*np.pi*60*x)+.6*np.sin(2*np.pi*120*x)+.15*rng.standard_normal(len(x)))*(.6+.4*np.sin(2*np.pi*7*x))
    fade=np.minimum(1,np.minimum(x/.3,(off-on-x)/.3)); mix[i:j]+=hum*fade*.18
    for k in np.arange(on,off,.5): add(tone(1000,.07,30),k,.12)
mix/=np.max(np.abs(mix))*1.12
wav=ROOT/".frames"/"backbone.wav"
with wave.open(str(wav),'w') as w:
    w.setnchannels(1); w.setsampwidth(2); w.setframerate(SR); w.writeframes((mix*32767).astype(np.int16).tobytes())
out=ROOT/"media"/"backbone-cinematic.mp4"
subprocess.run(["ffmpeg","-y","-loglevel","error","-framerate",str(FPS),"-i",str(d/"%04d.jpg"),"-i",str(wav),
  "-c:v","libx264","-preset","slow","-crf","22","-pix_fmt","yuv420p","-c:a","aac","-b:a","160k","-shortest","-movflags","+faststart",str(out)],check=True)
print(n,"frames", round(dur,1),"s", os.path.getsize(out)//1024,"KB", {k:len(v) for k,v in cue.items()})
