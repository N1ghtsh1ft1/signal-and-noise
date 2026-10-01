/* Copy for every piece: card text, video beats, trader translation. Plain words on purpose. */
window.SN_COPY = {
  'holdings': {
    hook: ['One hacked laptop', 'shouldn’t mean a hacked company.'],
    sec: 'Segmentation: you can’t stop every break-in, but you decide how far one can go.',
    trade: 'Position sizing: one bad trade shouldn’t empty the whole account.',
    beats: [
      [0, 'Each shape is one part of a network. Colors = trust zones.'],
      [.22, 'Red = a breach spreading out from one laptop.'],
      [.45, 'It can only cross a border where a rule says yes (yellow lines).'],
      [.7, 'The red area is the blast radius. Segmentation keeps it small.']
    ]
  },
  'slime-path': {
    hook: ['Hackers don’t need a map.', 'They find the path anyway.'],
    sec: 'Lateral movement: attackers poke around until they find the shortest road to the important servers.',
    trade: 'Stop hunting: price finds clusters of stops the same way. Put yours where everyone’s is and it’s a target.',
    beats: [
      [0, '14,000 tiny agents start from one phished computer.'],
      [.25, 'No plan. Each one just follows the strongest trail it can sense.'],
      [.5, 'Roads form to the valuable servers on their own.'],
      [.75, 'Hardened zones (blue circles) force the roads to go around. That’s defense.']
    ]
  },
  'baseline': {
    hook: ['You can’t spot weird', 'if you don’t know normal.'],
    sec: 'Anomaly detection: learn what normal traffic looks like, then flag what doesn’t fit.',
    trade: 'Unusual volume: a spike only stands out if you know what an average day looks like.',
    beats: [
      [0, 'Blue lines = normal traffic going with the usual flow.'],
      [.25, 'A few lines ignore the flow and move in a straight line.'],
      [.5, 'They get scored on how much they disagree with normal.'],
      [.72, 'Cross the line and it’s flagged. That’s a big part of SOC work.']
    ]
  },
  'containment': {
    hook: ['In a breach, speed', 'beats perfect.'],
    sec: 'Incident response: spread → contain → eradicate → recover. The earlier the line, the smaller the circle.',
    trade: 'Daily loss limit: stop, contain the damage, review, come back tomorrow. No arguing with it mid-trade.',
    beats: [
      [0, 'This pattern copies itself, like malware does.'],
      [.24, 'Detected. A boundary closes around the infected area.'],
      [.45, 'Inside the line it can grow. Outside, nothing gets through.'],
      [.68, 'Now it gets cleaned out, and things go back to normal.']
    ]
  },
  'packet-walk': {
    hook: ['What actually happens', 'after you hit Enter (or Buy)?'],
    sec: 'Every hop checks the packet, changes what it has to, and can say no. NAT swaps your private IP for a public one.',
    trade: 'Your order gets the same treatment: login check, risk check, then the exchange matches it.',
    beats: [
      [0, 'Top: one packet leaving your computer. Bottom: one trade order.'],
      [.08, 'Switch and router move it along. The MAC address changes every hop.'],
      [.22, 'Firewall checks the rules and swaps your IP (that’s NAT).'],
      [.36, 'Both arrive. Connection made, order filled.'],
      [.5, 'Run it again, but this time a rule says NO.'],
      [.68, 'Blocked at the firewall. Rejected at the risk check. Same idea.']
    ]
  }
};
