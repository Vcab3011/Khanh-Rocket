# Khanh Rocket V2 — reverse engineering sâu, clean-room rewrite và giới hạn tương thích

Ngày nghiên cứu: 2026-10-08.
Cấu hình baseline đã hoạt động do người dùng xác nhận: commit `88dbcb4751cc649592f292811b65acb4bed8837b`. **Không sửa `build/khanh-rocket.conf`**.
Nguồn được đọc theo commit/tag cố định:

- `Gaucuto/ver2promax` config `10in1`: `70a1343587324ff5a17195d8847ce55001f9ed44`.
- `duyvinh09/Module_IOS`: `5502a6febe84b7db635d3bd31749731aed5c057b`.
- `app2smile/rules`: `df6366a7024e0b3f0aa3510c5b791eea6f3cba89`.
- `sub-store-org/Sub-Store`: release/tag `2.42.3` -> commit `a3e61061e50b40e5c5938969aab915d05d8d7069`.

**Phương pháp:** đọc trực tiếp code upstream (các script nhỏ đầy đủ; hai bundle YouTube/Spotify đi sâu vào entrypoint và codec/mutation; Sub-Store đọc các entrypoint, REST API, cron, auth/persistence/Gist modules), xác định field protobuf theo schema, tự viết implementation, thử bằng fixture giả lập Node VM. Không giải mã traffic tài khoản người dùng, không chạy script trong môi trường production, không tải được ba release bundle Sub-Store để tự xác thực SHA-256. Các kết luận về app runtime cần được thử trên iPhone.

## 1. Chi tiết cơ chế 10in1

```
App request
  -> Shadowrocket tunnel -> [Rule] rejects matching YouTube UDP/QUIC
  -> [Header Rewrite] modifies cache validators
  -> [Url Rewrite] / [Map Local] short-circuit certain YouTube ad/stat URLs
  -> selected MITM hostname + trusted local CA (only when HTTPS Decryption active)
  -> [Script] request handler (may rewrite URL/headers or synthesize HTTP response)
  -> remote app server unless request was short-circuited
  -> [Script] response handler (JSON/protobuf)
  -> $done -> application receives locally modified response
Parallel cron -> Sub-Store sync job, independent of per-request hooks
```

**Không được gộp mọi hiện tượng thành "VPN unlock Premium".** Lưu lượng được tunnel là một lớp; JSON hoặc protobuf response rewrite là lớp khác. Script client-side không tạo gói thuê bao trên server, không thể cam kết quyền phát nhạc/AI/cloud nếu phía server kiểm chứng độc lập.

## 2. Học từ cách tác giả viết

### YouTube (Module_IOS dùng bundle theo phong cách YouTube Enhance)

File `youtube.response.js` ~227 KB. Mã có runtime adapters cho Surge, Quantumult X và Loon, thư viện mã hóa protobuf, danh sách class ứng với URL. Mã sử dụng `$persistentStore` (Surge) hoặc `$prefs` (QuanX) lưu danh sách phân loại quảng cáo `YouTubeAdvertiseInfo`. Khác với một danh sách domain REJECT, cơ chế quan trọng nằm ở **đọc protobuf -> sửa các trường cấu trúc -> mã hóa lại**.

| Endpoint | Phân tích từ source | Độ bao phủ mã Khanh Native V2 |
| --- | --- | --- |
| `player` | `Player.adPlacements` field **7**, `adSlots` **68**; `playbackTracking` field **9**, bên trong `pageadViewthroughconversion` **18**; `playabilityStatus` field **2** | **Có**: xóa trường 7/68 và 18, thêm background player, sửa mini-player nếu đã tồn tại |
| `get_watch` | `Watch.contents` field **1**, `Content.player` field **2**; kế thừa xử lý Player | **Có** cho phần Player nằm trong Watch |
| `reel/reel_watch_sequence` | `Shorts.entries` field **2** -> `Entry.command` **1** -> `Command.reelWatchEndpoint` **139608561** -> `overlay` **8**; upstream bỏ entry không có overlay | **Có** trên fixture protobuf mô phỏng |
| `browse`/`next`/`search` | Đệ quy qua `richItemContents`, xét unknown fields có marker ASCII `pagead` và danh sách EML, có thể lưu white/blacklist động. `ItemSectionRenderer.richItemContents` field **1**. | **Chưa**; cần fixtures thực để tránh xóa nhầm |
| `guide` | Duyệt `rendererItems`, ẩn các mục `SPunlimited`, `FEuploads`, `FEmusic_immersive`, tùy tham số. | **Chưa** |
| `account/get_setting` | Chèn mục cấu hình liên quan tới background / download UI. | **Chưa** |
| phụ đề | Chèn caption track/ngôn ngữ dịch, bổ sung `&tlang=vi`. | **Chưa** |
| lời bài hát | Khi Browse ID bắt đầu `MPLYt` và `lyricLang !== off`, ghép lyrics và GET Google Translate với tham số `q=encodeURIComponent(text)`. | **Chưa**, chủ ý tránh gọi mạng cho đến khi có consent |
| `youtube.request` | Cùng file ở request hook nhưng entrypoint đã xem dùng `w.response.bodyBytes`; khả năng xử lý thực trên request phase **chưa chứng minh**. | **Chưa**; không tự giả định tương đương |

Bản Native-only **không đạt YouTube parity**. So sánh player/shorts qua byte-level fixture không thay thế thử nghiệm phát nhạc/video, ảnh hưởng codec, certificate pinning, YouTube version và false positives.

### Spotify (app2smile, code tiếng Trung)

`spotify-json.js`: thay `platform=iphone` thành `platform=ipad` trên request phù hợp, xử lý dạng `com:443`; không sửa response.

`spotify-proto.js`: thư viện protobuf kèm **schema 20 message types**. Mã xử lý request **POST** phản hồi 200 tại `bootstrap/v1/bootstrap` hoặc `user-customization-service/v1/customize`. Hai đường đi protobuf:

- **Customize:** `UcsResponseWrapper.success` field **1** -> `UcsResponse.accountAttributesSuccess` field **3** -> `AccountAttributesResponse.accountAttributes` map field **1**.
- **Bootstrap:** `BootstrapResponse.ucsResponseV0` **2** -> `UcsResponseWrapperV0.success` **1** -> `UcsResponseWrapperSuccess.customization` **1** -> `UcsResponseWrapper.success` **1** -> `UcsResponse.accountAttributesSuccess` **3** -> map field **1**.
- Map entry: string key field **1**, `AccountAttribute` value field **2**. `AccountAttribute.boolValue` field **2**, `stringValue` field **4**.

Upstream gán khoảng 37 khóa account: `type=premium`, `ads=false`, `on-demand=true`, `offline=true`, `high-bitrate=true`, `audio-quality='1'`, `product-expiry` và các flag khác. Điều này **chỉnh client attributes**, không chứng minh server cung cấp premium features. `eval("require")` và `Function(...)` ở thư viện protobuf bundle là điểm cần audit, **không tự nó chứng minh mã độc**.

**Khanh Native V2** tự viết wire protobuf reader/writer, bảo tồn raw unknown fields, thay map entry đúng tag, reject malformed/unexpected format và giới hạn payload 5 MB. Không phụ thuộc `protobufjs` từ mạng hoặc bundle upstream. Kiểm thử có cả Bootstrap/Customize và giữ unknown field. Cần bodyBytes thực và test trên Shadowrocket để chứng minh tính tương thích.

### Sub-Store (nguồn tiếng Trung)

Ba JS release khác biệt là **entrypoint** của một backend tương đối lớn chứ không phải ba script độc lập nhỏ.

- `sub-store-1.js` (Core): đăng ký API download, preview, sync, node-info.
- `sub-store-0.js` (Simple): đăng ký subscription/collection/file/artifact/settings/token/backup CRUD.
- `cron-sync-artifacts.js`: đọc artifact + settings, quyết định có chạy đồng bộ không; có thể tạo nội dung subscription và tải lên Gist/GitLab bằng quyền đã cấu hình.
- `utils/gist.js`: dùng `Authorization: token ...` tới GitHub API; có lựa chọn GitLab và URL API tùy chỉnh.
- `utils/cors.js`: danh sách allowed origin cho frontend; **CORS không thay cho xác thực API**.
- `utils/artifact-sync-policy.js`: `shouldRun` kiểm tra artifact bật `sync`, điều kiện token hoặc hành vi `upload:false`. Không nên nói "cứ bật cron là tự upload mọi dữ liệu".
- Hai regex `Sub-Store Core` và `Simple` **cùng match** một số route như `/download` và `/api/sync`. Shadowrocket có xử lý cụ thể nhưng thứ tự chưa được chứng minh.
- Upstream cảnh báo `sub.store` **không thuộc sở hữu** nhóm Sub-Store. Nếu interception thất bại, request rơi ra network là rủi ro riêng, nhất là nếu có URL bí mật trong query.

**Chưa tự viết Sub-Store tương đương.** Nó bao gồm parser định dạng proxy, rule conversion, storage, remote download, auth, retry/scheduler, backup/sync; để đạt feature parity đòi hỏi specifications và nhiều fixture. AGPL-3.0 của Sub-Store cần được tuân thủ nếu sao chép/phân phối bản sửa đổi. Metadata release 2.42.3 đã có SHA-256 từ GitHub, nhưng ba file release chưa được phân tích byte-level riêng.

## 3. Audit các script JSON của Module_IOS

| Original | Cách can thiệp | Điểm yếu/nhận định xác minh | Native V2 |
| --- | --- | --- | --- |
| SoundCloudGoPlus | `configuration/ios`: đặt `plan`, ghi đè danh sách `features` | parse JSON không có catch; thay thế list có thể xóa tính năng mới | Có guarded rewrite |
| AlightMotion | `getAccountStatusAndLicenses`: tạo JSON license mới | parse thừa rồi thay toàn response | Có guarded rewrite |
| PicsArt | Request `apple/purchases` -> `$done({response:{status:200,body}})` | Là synthetic HTTP response trên request hook, **không mặc nhiên sai** | Có synthetic response độc lập |
| Wink | Thay `data` VIP; suffix dùng `alert`/`console` với thông báo chữ Hán | URL `sojson.com` trong chuỗi là reference, không chứng minh outbound request; popup chạy sau `$done` | Có, loại bỏ popup |
| Truecaller | Dựa vào URL tạo `subscriptions/status` hoặc `products/apple`, list 28 feature flags | fallback không luôn giữ dữ liệu gốc; nhiều giá trị hardcode | Có, guard unknown URL |
| KineMaster | Thay toàn response thuê bao | bỏ field máy chủ, parse thừa | Có |
| CamScanner | Sửa `data.psnl_vip_property`, điểm/số dư, nhiều nhánh phụ | `/queryProperty` và `/getPrivilegeItem` trong script **không khớp** regex config 10in1 hiện có; nested data giả định luôn tồn tại | Có cả ba nhánh trong JS, config cũ chỉ kích hoạt nhánh đầu |
| BeautyPlus | Thay toàn response VIP/balance | không bảo tồn response gốc | Có |
| Locket (RevenueCat) | Đọc User-Agent rồi đặt `subscriber.subscriptions`, `entitlements`; nhánh fallback có thể đặt `pro` ở app khác | host `api.revenuecat.com` dùng chung nhiều app => blast radius lớn; nested object không được guard | Có riêng cho User-Agent Locket, **cố ý không giữ fallback sửa app khác** |
| deleteHeader | Đặt `X-RevenueCat-ETag` rỗng | có logic trùng [Header Rewrite]; thao tác mutating header | Có, idempotent và guard |
| Spotify JSON | Đổi URL | URL string replace rộng và log | Có, giới hạn URL, không log |

**Lưu ý:** Synthetic entitlement/trial/purchase trong các script không chứng minh quyền lợi thật hoặc giao dịch hợp lệ. Mọi kết quả còn phụ thuộc server verification và phiên bản ứng dụng.

## 4. Khanh V2 thực sự độc lập được tới đâu?

- **Đã có** 11 chương trình JS nhỏ độc lập, thay đổi JSON hoặc URL/header; script không import source code upstream.
- **Đã có** `spotify-protobuf.js` tự xử lý binary wire format (schema paths + attribute map).
- **Đã có** `youtube-player-protobuf.js` tự xử lý `player`, `get_watch`, `reel_watch_sequence` (ad fields, background, mini player, Shorts overlay).
- **Đã có** 13 script files (11 JS nhỏ + 2 codec lớn), mock runtime tests, malformed input tests, generated isolated profiles.
- **Chưa**: Youtube Browse/Next/Search/Guide/Settings/captions/lyrics; YouTube request-phase semantics; Sub-Store Core/Simple/Sync; full API and app-version compatibility; release binary inspection. Không được nói "100% 10in1".
- **Không thể chứng minh bằng static tests:** iOS app entitlement, certificate pinning, streaming/network side effects, server validation, Google Translate flow, battery/latency/CPU.

### Hai cấu hình canary

1. `native/v2/build/hybrid-canary.conf`: 17 hook giữ topology; **12** URL trỏ tới mã do Khanh Rocket tự viết và pin tại commit `d7d43523dd973c0184a70a3398935c15eef96648`; **5** hook upstream còn lại: Sub-Store (3), YouTube (2). Dùng **để so sánh hiệu năng/hành vi**, chưa loại bỏ hoàn toàn nguồn ngoài.
2. `native/v2/build/native-only-canary.conf`: **13** hook đều trỏ đến chính repo Khanh Rocket được pin commit; không chạy Sub-Store, không chạy YouTube request-phase/browse/next/captions/lyrics. Do đó **KHÔNG đầy đủ tính năng**. Phù hợp kiểm tra sự độc lập và các tính năng đã viết.

Các URL file script trong canary được pin theo **Git commit bất biến**, không phải nhánh `main/master/latest`; việc này giảm rủi ro thay đổi code bất ngờ. Việc raw.githubusercontent.com có thể ngừng truy cập vẫn là availability dependency (hosting), khác với phụ thuộc vào mã bên thứ ba.

Production gốc không thay đổi. Recovery:
`https://raw.githubusercontent.com/Vcab3011/Khanh-Rocket/88dbcb4751cc649592f292811b65acb4bed8837b/build/khanh-rocket.conf`

## 5. Kiểm thử thực tế bắt buộc trước khi gọi là feature parity

Thiết bị test riêng, sao lưu working profile; ghi rõ iOS/Shadowrocket/YouTube/Spotify/Locket version, trạng thái network, CA/trust, giới hạn dữ liệu giả lập, không đưa token thật vào log.

- **YouTube**: player/ad pre-roll, mid-roll, Shorts, Browse/Search/Next, mini player/background play, subtitles vi, lyrics vi, video stream quality, YouTube account actions.
- **Spotify**: search, album/artist route, shuffle/on-demand, listening, offline cache, playback after restart/login, server-side entitlement.
- **Locket**: ứng dụng Locket và một RevenueCat app **không phải** Locket (đảm bảo không chỉnh nhầm).
- **Các app JSON**: một request đúng endpoint, một request không khớp, malformed JSON, HTTP 4xx/5xx, thay đổi schema, cache header.
- **Sub-Store**: route download/preview/sync, mối quan hệ Core-Simple, persist/restart, cron không có credentials, cron có credentials trên tài khoản thử, domain fallthrough, authorization và CORS.
- **An toàn**: data loss, token leaks, outbound connections, memory/time per request, rollback.
- **Go/no-go**: Nếu không có fixture hoặc app-level PASS cho một chức năng thì **chưa tuyên bố tương đương**; duy trì bản production gốc.

## 6. Next engineering milestones

1. **YouTube full response behavior:** giải ngược các schema `Browse/Next/Search/Guide/Setting`; xây test vectors không chứa dữ liệu cá nhân và lưu unknown fields an toàn.
2. **Sub-Store original alternative:** viết subscription parser và converter riêng theo format cần hỗ trợ, rồi API/auth/storage, scheduler; không cố copy AGPL code.
3. **Real binary validation:** kiểm tra SHA-256 release bundle đúng artifact, không chỉ tin metadata; static + runtime audit (môi trường cô lập).
4. **Shadowrocket canary:** import URL của nhánh V2 trên thiết bị phụ, so sánh song song bản chuẩn và bản test, thu thập kết quả đã làm sạch.
5. **Release gate:** chỉ nâng production khi toàn bộ chức năng quan trọng đã PASS và có rollback; không tự cập nhật snapshot để che regression.

## 7. Nguyên tắc kỹ thuật và tác quyền

Có thể reverse engineer hành vi observable và protocol structure để viết implementation mới; không tự cho rằng code của Module_IOS hay app2smile được phép phân phối lại nếu không tìm thấy license. Sub-Store công bố AGPL-3.0; tránh nhập nguyên phần mã của họ vào repo proprietary mà không xử lý nghĩa vụ license. Độc lập code không đồng nghĩa với có thể vượt qua mọi xác thực phía server. Thử nghiệm chỉ nên dùng tài khoản/hạ tầng hợp pháp và có quyền.
