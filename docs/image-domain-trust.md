# Image domain trust

FCM never loads an image URL from chat before its origin is trusted.

- When LCE exposes its trust API, FCM first calls `Liko.LCE.TrustedImageOrigins.isPermanentlyTrusted()`.
- FCM also maintains an in-memory origin allowlist for the current page session. Accepting the trust prompt adds only to this set.
- Rejecting or closing the prompt keeps the trust button available, so an accidental click does not permanently change anything.
- Refreshing the page clears FCM's session allowlist.

FCM intentionally does not provide its own persistent/“always trust” storage yet. Persistent trust is owned and managed by LCE through its public API.
