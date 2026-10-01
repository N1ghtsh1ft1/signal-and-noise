#!/usr/bin/env python3
"""
failover_sim.py - "assume the backbone is compromised" lab tool.

Reads a topology (JSON), sends a numbered stream of packets from source to
destination, fails/restores links mid-stream, re-routes around the damage,
and proves the message arrived intact (sequence numbers + SHA-256).

It also exports a Mermaid diagram so a beginner can SEE the network and the
path that was used. Paste the .mmd output into https://mermaid.live or a
GitHub README to render it.

Pure Python 3 standard library. No installs.

    python3 failover_sim.py topology.json
    python3 failover_sim.py topology.json --message "assume the backbone is compromised" --seed 7
    python3 failover_sim.py topology.json --mermaid map.mmd

This is a teaching simulator. It does not touch real interfaces or send real traffic.
"""
import argparse, hashlib, heapq, json, random, sys

LINK_STYLE = {"fiber": "===", "wifi": "---", "lte": "-.-", "radio": "-.-", "satcom": "-.-"}


def load(path):
    with open(path) as f:
        topo = json.load(f)
    ids = {n["id"] for n in topo["nodes"]}
    for l in topo["links"]:
        if l["a"] not in ids or l["b"] not in ids:
            sys.exit(f"link {l['a']}-{l['b']} points at a node that does not exist")
        l["up"] = True
    return topo


def key(a, b):
    return tuple(sorted((a, b)))


def best_path(topo, src, dst):
    """Dijkstra on latency, ignoring links that are down. Loss adds a penalty."""
    adj = {}
    for l in topo["links"]:
        if not l["up"]:
            continue
        cost = l["latency_ms"] * (1 + 10 * l["loss"])
        adj.setdefault(l["a"], []).append((l["b"], cost, l))
        adj.setdefault(l["b"], []).append((l["a"], cost, l))
    dist, prev, pq = {src: 0.0}, {}, [(0.0, src)]
    while pq:
        d, u = heapq.heappop(pq)
        if u == dst:
            break
        if d > dist.get(u, 1e18):
            continue
        for v, c, l in adj.get(u, []):
            nd = d + c
            if nd < dist.get(v, 1e18):
                dist[v], prev[v] = nd, (u, l)
                heapq.heappush(pq, (nd, v))
    if dst not in dist:
        return None, None
    path, links, v = [dst], [], dst
    while v != src:
        u, l = prev[v]
        path.append(u); links.append(l); v = u
    return path[::-1], links[::-1]


def set_links(topo, pair, up):
    for l in topo["links"]:
        if key(l["a"], l["b"]) == key(*pair):
            l["up"] = up
            return l
    sys.exit(f"event refers to unknown link {pair}")


def mermaid(topo, used_links):
    used = {key(l["a"], l["b"]) for l in used_links}
    out = ["flowchart LR"]
    for n in topo["nodes"]:
        out.append(f'  {n["id"].replace("-", "_")}["{n["id"]}<br/><small>{n["role"]}</small>"]')
    idx = []
    for i, l in enumerate(topo["links"]):
        a, b = l["a"].replace("-", "_"), l["b"].replace("-", "_")
        arrow = LINK_STYLE.get(l["type"], "--")
        label = f'{l["type"]} {l["latency_ms"]}ms'
        out.append(f"  {a} {arrow}|{label}| {b}")
        if key(l["a"], l["b"]) in used:
            idx.append(str(i))
    if idx:
        out.append(f"  linkStyle {','.join(idx)} stroke:#39ff88,stroke-width:4px")
    out.append(f'  style {topo["source"].replace("-", "_")} fill:#ffb63d,color:#000')
    out.append(f'  style {topo["destination"].replace("-", "_")} fill:#ffb63d,color:#000')
    return "\n".join(out)


def main():
    ap = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    ap.add_argument("topology")
    ap.add_argument("--message", default="ASSUME THE BACKBONE IS COMPROMISED")
    ap.add_argument("--seed", type=int, default=1)
    ap.add_argument("--mermaid", help="write a Mermaid diagram of the network + paths used")
    args = ap.parse_args()

    random.seed(args.seed)
    topo = load(args.topology)
    src, dst = topo["source"], topo["destination"]
    events = {e["at_packet"]: e for e in topo.get("events", [])}
    data = args.message.encode()
    chunks = [data[i:i + 2] for i in range(0, len(data), 2)]   # 2 bytes per packet keeps the demo readable
    sent_hash = hashlib.sha256(data).hexdigest()

    print(f"\n  {topo['name']}  |  {src} -> {dst}  |  {len(chunks)} packets\n")
    received, used_links, current, reroutes, retries = {}, [], None, 0, 0

    for seq, chunk in enumerate(chunks, 1):
        if seq in events:
            e = events[seq]
            pair, up = (e["fail"], False) if "fail" in e else (e["restore"], True)
            set_links(topo, pair, up)
            print(f"  !! packet {seq:>2}: {e['note']}  ({pair[0]} <-> {pair[1]} {'UP' if up else 'DOWN'})")
        path, links = best_path(topo, src, dst)
        if path is None:
            print(f"  xx packet {seq:>2}: no path left. Network partitioned.")
            break
        if path != current:
            if current is not None:
                reroutes += 1
            current = path
            total = sum(l["latency_ms"] for l in links)
            kinds = "/".join(dict.fromkeys(l["type"] for l in links))
            print(f"  -> route: {' > '.join(path)}   [{kinds}, ~{total} ms]")
            used_links.extend(links)
        # each hop can drop the packet; resend until it arrives (like TCP retransmission)
        while any(random.random() < l["loss"] for l in links):
            retries += 1
        received[seq] = chunk

    # deliver out of order on purpose, then reassemble by sequence number
    order = list(received)
    random.shuffle(order)
    rebuilt = b"".join(received[s] for s in sorted(order))
    ok = hashlib.sha256(rebuilt).hexdigest() == sent_hash and len(received) == len(chunks)

    print(f"\n  arrival order (first 12): {order[:12]}")
    print(f"  reroutes: {reroutes}   retransmissions: {retries}")
    print(f"  sent     sha256: {sent_hash[:16]}...")
    print(f"  rebuilt  sha256: {hashlib.sha256(rebuilt).hexdigest()[:16]}...")
    print(f"  integrity: {'OK - message rebuilt exactly' if ok else 'FAILED - data lost'}")
    print(f"  message: {rebuilt.decode(errors='replace')}\n")

    if args.mermaid:
        with open(args.mermaid, "w") as f:
            f.write(mermaid(topo, used_links) + "\n")
        print(f"  diagram written to {args.mermaid} (paste into mermaid.live)\n")
    return 0 if ok else 1


if __name__ == "__main__":
    sys.exit(main())
