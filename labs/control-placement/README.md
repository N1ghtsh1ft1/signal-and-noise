# Lab: Network placement of security controls (Cisco Packet Tracer)

Build the reference network from the **Control Placement** carousel and the **Gauntlet** video, then put each security control where it belongs.

Every control is tagged with its job:
**P** = Preventive (stops it) · **D** = Detective (sees it) · **C** = Corrective (fixes it)

> All addresses are lab-only (RFC 1918 inside, RFC 5737 documentation ranges outside). Replace `<lab-password>` and `<lab-key>` with values you make up for the lab, and never reuse real passwords.

---

## 1. Devices to drag in

| Role | Packet Tracer device | Control |
|---|---|---|
| ISP / Internet | 1941 router + Server ("web on the internet") | — |
| Edge router | 1941 / 4331 router | **P** ACL, anti-spoofing |
| Firewall | ASA 5506-X | **P/D** stateful firewall, zones by security level |
| DMZ web server | Server | sits in the screened subnet |
| Core switch | 3650 (Layer 3) | VLAN routing + ACLs between VLANs |
| Access switch | 2960 | **P/C** port-security (NAC stand-in) |
| Server switch | 2960 | VLAN 20 |
| IDS sensor | Sniffer device on the core uplink (or hub + PC in Simulation mode) | **D** watches a copy |
| AAA | Server (AAA service) | **P/D** who logged in, what they did |
| Syslog | Server (Syslog service) | **D** central logs |
| NTP | Server (NTP service) | keeps timestamps honest |
| Jump box | PC in VLAN 99 | **P** the only admin path |

## 2. Addressing plan

| Segment | Network | Gateway |
|---|---|---|
| Edge ↔ ISP | 203.0.113.0/30 | ISP .1 / Edge .2 |
| Edge ↔ ASA outside | 198.51.100.0/29 | Edge .1 / ASA .2 / web server's public NAT .3 |
| ASA DMZ | 10.10.50.0/24 | ASA .1, web server .10 |
| ASA inside ↔ Core | 10.10.0.0/30 | ASA .1 / Core .2 |
| VLAN 10 Users | 10.10.10.0/24 | Core SVI .1 |
| VLAN 20 Servers | 10.10.20.0/24 | Core SVI .1 |
| VLAN 99 Mgmt | 10.10.99.0/24 | Core SVI .1 (jump .10, AAA .20, syslog .30, NTP .40) |

---

## 3. Layer 1: Edge router (P), filter early

```
interface g0/0
 description to-ISP
 ip address 203.0.113.2 255.255.255.252
!
ip access-list extended EDGE-IN
 remark drop outside packets pretending to be private (anti-spoofing)
 deny ip 10.0.0.0 0.255.255.255 any
 deny ip 172.16.0.0 0.15.255.255 any
 deny ip 192.168.0.0 0.0.255.255 any
 deny ip 127.0.0.0 0.255.255.255 any
 permit ip any any
!
interface g0/0
 ip access-group EDGE-IN in
```
**Why here:** it's the cheapest place to throw away traffic that can never be legit.
Also on the edge router:
```
interface g0/1
 description to-ASA
 ip address 198.51.100.1 255.255.255.248
ip route 0.0.0.0 0.0.0.0 203.0.113.1
```
And on the ISP router, so the internet can find you: `ip route 198.51.100.0 255.255.255.248 203.0.113.2`

**Test:** give an outside PC a 10.x address, ping in, and watch the drop in Simulation mode.

## 4. Layer 2: ASA firewall (P/D), inline, stateful

```
interface g1/1
 nameif outside
 security-level 0
 ip address 198.51.100.2 255.255.255.248
interface g1/2
 nameif inside
 security-level 100
 ip address 10.10.0.1 255.255.255.252
interface g1/3
 nameif dmz
 security-level 50
 ip address 10.10.50.1 255.255.255.0
!
route outside 0.0.0.0 0.0.0.0 198.51.100.1
route inside 10.10.0.0 255.255.0.0 10.10.0.2
!
object network INSIDE-NET
 subnet 10.10.0.0 255.255.0.0
 nat (inside,outside) dynamic interface
!
object network DMZ-WEB
 host 10.10.50.10
 nat (dmz,outside) static 198.51.100.3
!
access-list OUTSIDE-IN extended permit tcp any host 10.10.50.10 eq www
access-group OUTSIDE-IN in interface outside
```
**Why here:** every packet between zones has to pass *through* it, so it can say no.
**Remember:** higher security level → lower is allowed by default. Lower → higher needs an ACL. So the internet can reach the DMZ web server on port 80 and nothing else.

> If your Packet Tracer ASA labels ports differently (`g1/1`…), match the names you see in `show interface ip brief`.

## 5. Layer 3: Screened subnet (P)

- The web server lives on the ASA's **dmz** interface, **not** on an inside VLAN.
- DMZ (50) → inside (100) is blocked by default. Leave it that way.
**Test:** from the DMZ server, ping an inside PC. It should fail. From the internet, browse to `198.51.100.3`. It should work.

## 6. Layer 4: Inside (P/C)

**Core switch (3650):**
```
ip routing
vlan 10
 name USERS
vlan 20
 name SERVERS
vlan 99
 name MGMT
interface vlan 10
 ip address 10.10.10.1 255.255.255.0
interface vlan 20
 ip address 10.10.20.1 255.255.255.0
interface vlan 99
 ip address 10.10.99.1 255.255.255.0
ip route 0.0.0.0 0.0.0.0 10.10.0.1
!
ip access-list extended USERS-TO-SERVERS
 remark users may reach the file server and web, nothing else in VLAN 20
 permit tcp 10.10.10.0 0.0.0.255 host 10.10.20.11 eq 445
 permit tcp 10.10.10.0 0.0.0.255 any eq www
 permit tcp 10.10.10.0 0.0.0.255 any eq 443
 deny ip 10.10.10.0 0.0.0.255 10.10.20.0 0.0.0.255
 deny ip 10.10.10.0 0.0.0.255 10.10.99.0 0.0.0.255
 permit ip any any
interface vlan 10
 ip access-group USERS-TO-SERVERS in
```

**Access switch (2960), the NAC stand-in:**
```
interface range f0/1 - 20
 switchport mode access
 switchport access vlan 10
 switchport port-security
 switchport port-security maximum 1
 switchport port-security mac-address sticky
 switchport port-security violation shutdown
interface range f0/21 - 23
 shutdown
```
**Why here:** the switch port is the front door for anything plugged in.
**Test:** plug a second PC into a secured port. The port goes `err-disabled`, which is the corrective action.
Reset it with `shutdown` then `no shutdown`.

> Real networks use **802.1X** with a RADIUS server for this. Port-security works the same way for the lab and runs in every Packet Tracer version.

## 7. Layer 5: Watchers + management plane (D)

On **every** router/switch:
```
service timestamps log datetime msec
ntp server 10.10.99.40
logging host 10.10.99.30
!
aaa new-model
tacacs-server host 10.10.99.20 key <lab-key>
aaa authentication login default group tacacs+ local
username admin secret <lab-password>
!
ip domain-name lab.local
crypto key generate rsa
 ! choose 1024 when asked
ip ssh version 2
access-list 10 permit host 10.10.99.10
line vty 0 4
 transport input ssh
 access-class 10 in
```
**Why:** admins can only reach devices **over SSH, from the jump box**, and every login is checked by AAA and written to syslog with a correct timestamp.

In the Server devices: turn on **AAA** (add each switch/router as a client with the same key), **Syslog**, and **NTP**.

**IDS:** drop a **Sniffer** on the core uplink and watch the copied traffic. A sniffer sees everything and blocks nothing, which is exactly what passive means.

---

## 8. Check yourself

1. Which device is **inline**, and which only sees a **copy**?
2. Why does the web server go in the DMZ instead of VLAN 20?
3. If the ASA dies, should traffic **fail open** or **fail closed** for a bank? For a hospital ER kiosk?
4. Name one **P**, one **D** and one **C** control in this lab.
5. Why does NTP matter for an investigation?
