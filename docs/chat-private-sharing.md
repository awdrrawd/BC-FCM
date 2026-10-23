# FCM Chat private Profile sharing

Profiles continues using the existing database and schema version. Live sightings
are saved by the existing capture flow. Shared bundles carry their original seen
time: newer data is saved immediately on reception; equal/older data is not
written. Shared snapshots remain on their original chat message so an older
share can still be viewed without replacing a newer local profile.

Ordinary Beeps contain exactly the visible message text, without metadata suffixes.
Explicit @ mentions send supplementary FCMChatPrivate packets before the ordinary
Beep. Only the named recipient accepts them. Receivers associate the completed
attachment with the next matching text from that sender within two minutes.
Identical repeated Beeps cannot be uniquely distinguished without an on-wire ID;
no stronger identity guarantee is claimed. Small attachments use one packet;
larger ones split into bounded 800-character base64 chunks.

Whispers use targeted Hidden attachment packets and metadata in the actual
Whisper dictionary. Native Profile buttons are attached only to the corresponding
Whisper/Beep element. Native Whisper reply handling is retained; FCM reply IDs
provide a fallback within that peer's log. Reply previews never trigger bundle
loading or transmission. Beep replies do not send additional metadata: the sender
can keep a local reference, but the recipient cannot reconstruct an exact reply
target from plain Beep text alone.

Ordinary offline text remains queued and is sent when the friend returns. Profile
mentions cannot be queued: the composer retains the text for manual sharing when
the recipient is online. Legacy queued Profile shares are not automatically sent.
Sending and forwarding share the same sender and offline eligibility rules.

Module boundaries are unchanged except for the dedicated private packet codec and
native-chat DOM adapter. Sending, receiving, profile persistence and message
recording remain in their existing modules. No new database or generic transport
framework is introduced.

Verification: node --test scripts/chat-private.test.mjs scripts/chat-regression.test.mjs
Real two-account network interoperability still requires game testing.

## 與 PROFILESHARE、LCE、獨立 WPS 的一致性

私聊分享、房內 PROFILESHARE（FCM、LCE、獨立 WPS）只是傳輸方式不同，分享機制一致：

1. 資料以文字分成多段送出，接收端合併還原。
2. 收到就保存，不必點開；FCM 的 PROFILESHARE 與私聊分享都不受「儲存模式」影響。
3. 只保存比本機新的（`seen` 較大）；相同或較舊的不保存。檢視分享時永遠顯示分享當下的資料（PROFILESHARE 用接收時的記憶體快取，私聊用該則訊息保存的快照），不會因為本機資料更新而改變。
4. 寫入前 `seen` 一律不晚於現在（`PDB.receiveShared` 單一入口），與 LCE、獨立 WPS 相同。

兩者仍保留各自的存活時間：PROFILESHARE 為 60 秒，私聊為 2 分鐘（需等待後續配對的文字訊息）。
