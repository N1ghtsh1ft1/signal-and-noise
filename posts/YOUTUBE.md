# YouTube plan — Signal & Noise

Channel idea: **security concepts you can watch happen.** Each Short = one simulation + one idea + one trading parallel. Longer videos go deeper on the same piece.

The vertical videos in `media/*-short.mp4` are 1080×1920, 15–20 seconds, ready for Shorts. Add a music bed from YouTube's Audio Library (free to use) inside the YouTube editor.

---

## Shorts (upload as-is)

| # | Title | Description (first line) |
|---|---|---|
| 01 | One hacked laptop vs the whole company #shorts | Network segmentation, shown as a live simulation. |
| 02 | Hackers don't need a map #shorts | 14,000 slime-mold agents find the path to the domain controller. |
| 03 | How analysts spot "weird" traffic #shorts | Anomaly detection: learn normal, flag what doesn't fit. |
| 04 | Speed beats perfect in a breach #shorts | The incident response lifecycle, playing out like chemistry. |
| 05 | What happens after you hit Enter? #shorts | A packet vs a trade order, hop by hop. Then a rule says no. |

Tags: cybersecurity, security plus, SOC analyst, networking, generative art, trading, incident response

---

## Long-form ideas (8–12 min each)

**1. "I built a hacker out of slime mold"**
- 0:00 Hook: run the sim and let the roads appear on screen
- 1:00 What Physarum is (the real slime mold that redrew a map of Tokyo's rail lines)
- 3:00 Lateral movement in real attacks: phish → workstation → creds → servers
- 6:00 Turn on hardened tiers live and watch the roads reroute
- 8:00 How defenders map these paths first (attack-path tools, least privilege)
- 10:00 Trading parallel: stop hunting and liquidity

**2. "Follow one packet from your laptop to Google"**
- Use Cisco Packet Tracer in simulation mode next to the Packet Walk animation
- Show MAC changing per hop, IP staying the same, NAT at the edge
- Show an ACL deny live, then the same idea as a broker rejecting an order

**3. "Learning Security+ by building simulations"**
- Your study story: GED → college → Security+ → SOC track
- One piece per exam domain, built live on screen
- Good for recruiters: it shows how you learn, not just what you know

---

## Script template for every Short

1. **Hook (0–2s):** the headline on screen, spoken in 6 words or fewer
2. **What you see (2–8s):** describe the picture in plain words
3. **The idea (8–14s):** name the security concept
4. **Trader line (14–18s):** the one-sentence translation
5. **Loop:** end on a frame that matches the start, so replays feel seamless
