# Vietnam network architecture

Vietnam VPS: always-on server, usually datacenter IP; rent a VPS in Vietnam, install Shadowsocks-rust with the supplied Compose template, and verify server egress and routing.

Vietnam residential exit: use a home Linux box with a reachable IP and router port forwarding; CGNAT usually prevents ordinary incoming connections. A standalone Tailscale exit node is an alternative, but do not assume two simultaneous iOS packet-tunnel VPN extensions work together.

## Test checklist

- [ ] Check server egress is Vietnam; verify geo-restrictions independently.
- [ ] Verify on Canadian Wi-Fi and cellular.
- [ ] Test full mode returns VN IP and Canada Direct returns Canada IP.
- [ ] Inspect DNS leaks, IPv4/IPv6 traffic and native app-specific domains.
- [ ] Use only trusted certificates; none are required for this VPN/proxy baseline.
