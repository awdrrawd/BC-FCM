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
