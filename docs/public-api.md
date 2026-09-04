# FCM public API

FCM exposes its stable integration surface at `window.Liko.FCM`. Check
`apiVersion` before depending on a newer capability. All member numbers may be
passed as numbers or numeric strings; invalid values return `null` or `false`.

## Avatar

```js
const url = await Liko.FCM.avatar.get(123456);
const refreshedUrl = await Liko.FCM.avatar.refresh(123456);
const removed = await Liko.FCM.avatar.remove(123456);
```

- `get` resolves the player's shared avatar when they are in the room, then
  falls back to FCM's saved snapshot.
- `refresh` always attempts a new capture. It uses the live room character when
  available, otherwise reconstructs the saved Profile and waits for its assets.
- `remove` deletes only FCM's saved snapshot.
- Returned `blob:` URLs are owned by FCM. Consumers must not revoke them.

## Profiles

```js
const profile = await Liko.FCM.profiles.get(123456);
const exists = await Liko.FCM.profiles.has(123456);
const opened = await Liko.FCM.profiles.open(123456);
const shared = await Liko.FCM.profiles.share(123456);
```

- `get` returns a detached copy, so changing it cannot mutate FCM's cache.
- `open` prefers the live room character and otherwise opens a saved Profile.
- `share` sends a saved full Profile through FCM's room-sharing protocol. It
  returns `false` outside a room or when no complete saved Profile exists.

The database objects, caches, HTML generators, and transport packet handlers
remain private implementation details.
