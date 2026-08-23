# FCM and LianChat profile compatibility

FCM keeps private preferences in `Player.ExtensionSettings.FCM` and publishes
the profile data other room members need in `Player.OnlineSharedSettings.FCM`.
The public FCM profile contains the URL avatar, a manually refreshed game-avatar
snapshot, signature, status, and separate avatar/profile update timestamps.

FCM continues to recognize LianChat's existing public fields under
`OnlineSharedSettings.LCData.MessageSetting` and its `LCPlayerInfo` account-beep
payload. URL avatars and signatures are the common compatibility surface. FCM's
game-avatar snapshot and presence status are optional extensions; old LianChat
clients are expected to ignore fields they do not recognize.

Received images are cached as Blobs in IndexedDB. `avatarUpdatedAt` is compared
with the cached record before a URL is fetched or a data URL is decoded. A room
member is captured from the game canvas only when neither shared FCM data nor a
local cached avatar exists. Manual refresh deliberately bypasses this rule.
