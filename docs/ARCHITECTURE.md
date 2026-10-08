# Khanh Rocket architecture

```text
iPhone Shadowrocket traffic -> rule engine -> DIRECT (Canada) / PROXY (VN Shadowsocks exit) / REJECT
```

Configuration does not host or supply a VPN server. Create the proxy node with real credentials in Shadowrocket Home, and select Global Routing **Config**. Legacy third-party scripts are only catalogued and never loaded. The generated baseline has no HTTPS MITM and no certificate interception. Dynamic import, DNS, IPv6 and proxy transport verification remain outstanding.
