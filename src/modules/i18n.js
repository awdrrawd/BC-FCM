import { cfg } from './config.js';
// ════════════════════════════════════════
//  FCM module: i18n.js
//  (split from Plugins/liko-FCM.user.js)
// ════════════════════════════════════════

    const L = {
        zh: {
            panelTitle: '🎛 FCM ─ 好友與房間管理', tabFriends: '個人關係', tabRoom: '房間管理', tabSettings: '設定',
            tabPeople: '人員查詢',  tabHelp: '🔖 說明',
            minimize: '—', close: '×', miniLabel: '好友與房間管理',
            search: '搜尋名稱或ID...', roomSearch: '搜尋 / 輸入ID添加...',
            sortBy: '排序', sortRel: '關係', sortId: 'ID', sortName: '名稱', sortAdded: '添加時間', sortSeen: '最後見面',
            showOnly: '顯示', togNick: '暱稱', togName: '名稱',
            fOnline: '在線', fOffline: '不在線', fOwner: '主人', fLover: '戀人', fSub: '奴隸', fFriend: '好友',
            colName: '名稱', colId: 'ID', colRel: '關係', colZone: '分區', colRoom: '房間',
            colPerm: '權限', colOps: '動作', colMgmt: '房管', colMgmtNoPerm: '房管（無權）',
            colSeen: '最後見面',
            relOwner: '主人', relLover: '戀人', relSub: '奴隸', relFriend: '好友', relContact: '單向好友',
            zoneF: '♀', zoneM: '♂', zoneX: '♀♂', zoneUnk: '—',
            online: '在線', offline: '不在線',
            btnView: '查看', btnBeep: '私信', btnWhisper: '悄悄話', btnAddFriend: '＋好友', btnRmFriend: '－好友',
            btnAddAdmin: '＋管理', btnRmAdmin: '－管理', btnAddWhite: '＋白單', btnRmWhite: '－白單',
            btnAddBan: '＋黑單', btnRmBan: '－黑單', btnKick: '逐出', btnAddBlack: '＋黑單', btnRmBlack: '－黑單',
            btnAdd: '添加', btnAddTitle: '添加ID到名單',
            roomTabs: { members: '房內人員', admin: '管理者', white: '白名單', ban: '黑名單' },
            notInRoom: '目前不在任何房間中', noAdminWarn: '⚠ 無管理員權限，房管欄僅供查看',
            setAvatars: '顯示頭像', setAvatarsNote: '在列表中顯示角色頭像（見過後才有，或由角色資料重建）',
            setProfiles: '啟用自動儲存個人資料', setProfilesNote: '與 WCE bce-past-profiles 相容，同房間時自動儲存',
            dbOk: '已連線', dbNo: '未連線',
            langLabel: '語言',
            whisperIndicatorLabel: '私聊/BEEP 輸入框提示色',
            ghostHideLabel: '幽靈名單隱身', ghostHideNote: '幽靈名單中的角色在聊天室不顯示身體（只對自己有效）',
            whisperIndicatorNote: '輸入 /w /whisper /beep 或進入悄悄話模式時，聊天框會顯示紫色邊框提示',
            langNote: 'Auto: 依 BC TranslationLanguage（CN/TW→中文，其餘→English）',
            langDetected: tl => `目前偵測: ${tl || '未設定'}`,
            btnReloadAvatars: '頭像快取管理', reloadAvatarsNote: '清除快取或載入好友頭像',
            btnLoadFriendAvatars: '載入好友頭像', loadFriendAvatarsNote: '掃描所有好友，讓 BC 緩存外觀後統一截圖（約需數十秒）',
            btnClearAvatarCache: '清除頭像快取', clearAvatarCacheNote: '清除所有已儲存的頭像快照，下次遇到時重新截取',
            loadingFriendAvatars: n => `載入好友頭像中... 剩餘 ${n} 人`,
            loadFriendAvatarsDone: '好友頭像載入完成',
            noProfile: '尚無個人資料\n（需先與此人在同一房間）',
            confirmDel: n => `確定刪除好友「${n}」？`,
            confirmKick: n => `確定逐出「${n}」？`,
            confirmRoom: n => `🚪 前往房間「${n}」？`,
            confirmAddBan: n => `確定將「${n}」加入黑名單？\n對方將無法與你互動。`,
            confirmAddGhost: n => `確定將「${n}」加入幽靈名單？\n你將不會再收到任何該玩家的信息。`,
            tabRoomSearch: '查詢房間', roomSearch2: '搜尋房間...', roomSearchBtn: '搜尋',
            roomSearching: '搜尋中...', roomSearchEmpty: '沒有找到房間',
            roomFavLabel: '★ 最愛', roomJoin: '加入', roomMixed: '混合', roomFemale: '女性', roomMale: '男性',
            totalRooms: n => `共 ${n} 間`, roomPrivateLabel: '私人',
            permAdmin: '管理', permPass: 'PASS', permBan: 'BAN', permVisit: '訪客',
            youLabel: '（你）', copyId: '點擊複製ID', copyDone: '已複製！',
            total: n => `共 ${n} 人`,
            beepTitle: n => `BEEP → ${n}`,
            beepPlaceholder: '輸入訊息（可留空）\nCtrl+Enter 發送',
            beepSend: '發送 BEEP', beepCancel: '取消',
            beepSummon: '召喚',
            beepSummonTitle: '請確定您有召喚對方的權限，否則對方只會收到 summon',
            beepSummonNoRoom: '需在房間內才能召喚',
            noData: '（空白）', noFriends: '沒有符合條件的好友',
            fWhitelist: '白名單', fBlacklist: '黑名單', fGhost: '幽靈',
            relWhitelist: '白名單', relBlacklist: '黑名單', relGhost: '幽靈',
            roomPrivate: '私人', roomPublic: '',
            saveModeLabel: '儲存模式',
            saveModeOff: '不儲存', saveModeName: '僅名稱', saveModeAvatar: '名稱與頭像', saveModeFull: '完整資料（WCE 相容）',
            saveModeDesc_off: '不儲存任何資料。如果你有安裝 WCE 並啟用其 Profiles 功能，建議選此選項避免重複儲存（WCE 已幫你存好了）。',
            saveModeDesc_name: '只儲存成員編號、BC 名稱、暱稱。幾乎不佔空間，可用來顯示離線好友名稱。',
            saveModeDesc_avatar: '額外儲存頭像快照（在遇見時自動擷取，儲存於獨立的 FCM-Snapshot 資料庫）。',
            saveModeDesc_full: '完整儲存：名稱、暱稱、外觀/BIO/稱號等。與 WCE bce-past-profiles 資料庫完全相容，互相共用。頭像另存於 FCM-Snapshot。',
            wceDetected: '✅ 偵測到 WCE Profiles 功能，已自動設為完整資料模式（與 WCE 共用同一個 DB，避免衝突）',
            wceNotDetected: '未偵測到 WCE。建議若只需顯示名稱則選「僅名稱」，需要頭像則選「名稱與頭像」。',
            reloadStatus: n => n > 0 ? `頭像載入中... 剩餘 ${n} 人，請稍等` : '頭像載入完成',
            exportProfiles: '匯出 Profiles', exportNote: '匯出為 JSON（與 WCE 格式相容）',
            importProfiles: '匯入 Profiles', importNote: '從 JSON 匯入（相同 ID 以較新的 seen 時間為準）',
            exportDone: n => `✓ 已匯出 ${n} 筆 profiles`,
            importDone: (p, n) => `✓ 已匯入 profiles: ${p} 筆${n ? `，notes: ${n} 筆` : ''}`,
            profilesTitle: '已儲存的 Profiles', profilesHint: '點擊開啟角色資訊',
            profilesEmpty: '沒有符合條件的 profiles', profilesTotal: (n, t) => `顯示 ${n} / 共 ${t} 筆`,
            searchProfiles: '搜尋名稱或ID...',
            peopleSearchPlaceholder: '輸入名稱或 ID，按 Enter 搜尋...',
            peopleSearchHint: '顯示最近見過的 100 人 · 輸入後按 Enter 或點「搜尋」',
            peopleNoResults: '沒有找到符合的人員',
            peopleUnknownId: n => `請問您是否在搜尋 #${n}？你並無該人員資料`,
            peopleSimilarIds: '包含此數字的相似 ID：',
            peopleUnknownName: '名稱未知',
            peopleOneSidedWarn: () => `⚠ 提醒：此操作為單方面添加。如果有需要，請您主動通知對方。`,
            peopleTotal: (n, t) => t !== undefined ? `顯示 ${n} / 共 ${t} 筆` : `共 ${n} 筆`,
            colShare: '分享',
            btnShare: '分享',
            shareLocalMsg: (name, id) => `📜 已分享 ${name} (${id}) 的 Profile`,
            shareRecvMsg: (from, display, date) => `📜 ${from} 分享了 ${display} 保存於: ${date}`,
            shareOpen: '▶ 開啟',
            whisperAvatarLabel: '私聊時顯示對象頭像',
            whisperAvatarNote: '進入悄悄話/BEEP 模式時，在輸入框旁顯示對象的頭像',
            whisperNoSignal: '無訊號',
            oocProtectLabel: 'OOC 保護（悄悄話時停用 Ctrl+Enter）',
            oocProtectNote: '悄悄話/BEEP 模式下，封鎖 Ctrl+Enter 以防止 OOC 內容作為普通對話發出',
            btnVisibilityLabel: '按鈕顯示設定',
            btnVisibilityNote: '控制 FCM 按鈕在各頁面的顯示狀態（至少須保留一個）',
            btnShowChatRoom: '聊天室按鈕',
            btnShowMainHall: '大廳按鈕',
            btnShowProfile: '個人檔案按鈕',
            profileRelLabel: 'Profile 關係人快速搜尋',
            profileRelNote: '查看角色資料頁時，將主人／戀人等關係人的 ID 做成按鈕，點擊即開啟 FCM 人員查詢並帶入該 ID（須配合 Profile 保存功能）',
            profileRelTitle: '🔍 關係人快速查詢',
            noBeepNotFriend: '非好友，無法私信',
            profileRelColorLabel: '修改顏色',
            colorNone: '無色',
            // ── 添加好友流程 ──
            addFriendTitle: n => `是否添加「${n}」為好友？`,
            addFriendNotifyHint: '（可發送通知給對方，需有 FCM）',
            btnAgree: '同意', btnAgreeNotify: '同意且通知', btnViewProfile: '查看',
            friendReqNeedRoom: '需與對方在同一房間才能發送通知',
            friendReqIncoming: n => `${n} 發送好友邀請，請問你是否同意？`,
            friendReqSent: n => `📩 已發送好友邀請通知給「${n}」`,
            friendReqAdded: n => `✓ 已將「${n}」加為好友`,
            // ── 房間類型 / 分享 ──
            roomTypeMap: '地圖', roomTypeMix: '混合',
            roomLockedCanJoin: '已上鎖，你有進入權限', roomLockedNoAccess: '已上鎖，你沒有進入權限',
            roomHereBadge: '🏠 你', roomReenter: '重新進入',
            roomReenterConfirm: n => `你已經在「${n}」中了。\n確定要重新進入嗎？`,
            btnCancel: '取消', btnConfirm: '確認', roomGo: '🚪 前往',
            beepSummonConfirm: n => `請確定您有召喚對方的權限，否則對方只會收到文字 "summon"。\n\n確定要召喚「${n}」嗎？`,
            // ── 通用 UI（統一走 i18n，取代 inline 特例）──
            btnRemove: '移除', btnAddConfirm: '加入', btnRefresh: '重新整理',
            btnAddGhost: '＋幽靈', btnRmGhost: '－幽靈',
            btnClear: '清除', btnClearing: '清除中...', btnSearch: '搜尋',
            confirmRmWhite: n => `移除「${n}」白名單？`,
            confirmAddWhite: n => `將「${n}」加入白名單？`,
            confirmRmBlack: n => `移除「${n}」黑名單？`,
            confirmRmGhost: n => `移除「${n}」幽靈？`,
            avReloadTitle: '點擊重新抓取頭像',
            togNickToBCName: '切換為BC名稱', togNickToNick: '切換為暱稱',
            btnSnapshotTitle: '快照目前名單（強制重建頭像）',
            roomPrivPrefix: '[私人] ', roomFull: '⚠ 房間已滿', roomGoPrompt: '前往此房間？',
            roomPrivShort: '(私人)', roomPrivateHidden: '(私密)',
            peopleDbNotConnected: '資料庫未連線，請確認儲存模式已設定',
            shareNeedRoom: '需在聊天室中才能分享',
            pageInfo: (a, b) => `第 ${a} / ${b} 頁`,
            sortFavFirst: '最愛優先', sortFriendFirst: '好友優先', sortNameOnly: '名稱優先',
            setSecUI: '⚙ UI 管理', setSecChat: '⚙ 聊天室管理',
            avCacheCleared: '✓ 頭像快取已清除', noFriendsToLoad: '沒有需要載入的好友',
            avWaitLeft: s => `等待 BC 緩存外觀... 剩餘 ${s} 秒`,
            avWait: s => `等待 BC 緩存外觀... ${s} 秒`,
            avSnapshotting: '開始截圖...',
            wceTagDetected: '偵測到 WCE Profiles', colorEditLabel: '修改顏色',
            cmdProfilesDesc: '<篩選> - 開啟人員查詢（依名稱或 ID 篩選）',
            roomShareBtn: '分享', roomJoinRoomBtn: '加入房間',
            roomShareNeedRoom: '需在聊天室中才能分享房間',
            roomShareIntro: n => `${n} 分享了一個房間信息`,
            roomShareLocalDone: n => `📤 已分享房間「${n}」到聊天室`,
        },
        en: {
            panelTitle: '🎛 FCM ─ Friends and ChatRoom Manager', tabFriends: 'Relations', tabRoom: 'Room Mgmt', tabSettings: 'Settings',
            tabPeople: 'People', tabHelp: '🔖 Help',
            minimize: '—', close: '×', miniLabel: 'Friends and ChatRoom Manager',
            search: 'Search name or ID...', roomSearch: 'Search / Enter ID to add...',
            sortBy: 'Sort', sortRel: 'Relation', sortId: 'ID', sortName: 'Name', sortAdded: 'Added', sortSeen: 'Last Seen',
            showOnly: 'Show', togNick: 'Nick', togName: 'Name',
            fOnline: 'Online', fOffline: 'Offline', fOwner: 'Owner', fLover: 'Lover', fSub: 'Sub', fFriend: 'Friend',
            colName: 'Name', colId: 'ID', colRel: 'Rel.', colZone: 'Zone', colRoom: 'Room',
            colPerm: 'Perm.', colOps: 'Actions', colMgmt: 'Room Admin', colMgmtNoPerm: 'Room Admin (no perm)',
            colSeen: 'Last Seen',
            relOwner: 'Owner', relLover: 'Lover', relSub: 'Sub', relFriend: 'Friend', relContact: 'One-way',
            zoneF: '♀', zoneM: '♂', zoneX: '♀♂', zoneUnk: '—',
            online: 'Online', offline: 'Offline',
            btnView: 'View', btnBeep: 'BEEP', btnWhisper: 'Msg', btnAddFriend: '+Frnd', btnRmFriend: '-Frnd',
            btnAddAdmin: '＋Admin', btnRmAdmin: '－Admin', btnAddWhite: '＋White', btnRmWhite: '－White',
            btnAddBan: '＋BAN', btnRmBan: '－BAN', btnKick: 'Kick',  btnAddBlack: '＋Black', btnRmBlack: '－Black',
            btnAdd: 'Add', btnAddTitle: 'Add ID to list',
            roomTabs: { members: 'Members', admin: 'Admins', white: 'Whitelist', ban: 'Blacklist' },
            notInRoom: 'Not currently in a room', noAdminWarn: '⚠ No admin rights — Room Admin column is view-only',
            setAvatars: 'Show Avatars', setAvatarsNote: 'Show portraits (saved on encounter, stored in FCM-Snapshot DB)',
            setProfiles: 'Enable Profile Auto-Save', setProfilesNote: 'WCE bce-past-profiles compatible',
            dbOk: 'Connected', dbNo: 'Not connected',
            langLabel: 'Language',
            whisperIndicatorLabel: 'Whisper/BEEP Input Glow Color',
            ghostHideLabel: 'Ghost List Hide', ghostHideNote: 'Characters on your ghost list are hidden in chatroom (only affects your view)',
            whisperIndicatorNote: 'Shows a purple glow on the chat input when /w /whisper /beep is typed or whisper mode is active',
            langNote: 'Auto: follows BC TranslationLanguage (CN/TW→Chinese, others→English)',
            langDetected: tl => `Detected: ${tl || 'not set'}`,
            btnReloadAvatars: 'Avatar Cache', reloadAvatarsNote: 'Clear cache or load friend avatars',
            btnLoadFriendAvatars: 'Load Friend Avatars', loadFriendAvatarsNote: 'Scan all friends, wait for BC to cache appearances, then snapshot (may take tens of seconds)',
            btnClearAvatarCache: 'Clear Avatar Cache', clearAvatarCacheNote: 'Delete all saved avatar snapshots — new ones will be captured on next encounter',
            loadingFriendAvatars: n => `Loading friend avatars... ${n} remaining`,
            loadFriendAvatarsDone: 'Friend avatar loading complete',
            noProfile: 'No profile data\n(Must have been in same room)',
            confirmDel: n => `Unfriend "${n}"?`,
            confirmKick: n => `Kick "${n}"?`,
            confirmRoom: n => `🚪 Go to room "${n}"?`,
            confirmAddBan: n => `Blacklist "${n}"?\nThey will no longer be able to interact with you.`,
            confirmAddGhost: n => `Add "${n}" to ghost list?\nYou will no longer receive any messages from that person.`,
            tabRoomSearch: 'Search Rooms', roomSearch2: 'Search rooms...', roomSearchBtn: 'Search',
            roomSearching: 'Searching...', roomSearchEmpty: 'No rooms found',
            roomFavLabel: '★ Favs', roomJoin: 'Join', roomMixed: 'Mixed', roomFemale: 'Female', roomMale: 'Male',
            totalRooms: n => `Rooms: ${n}`, roomPrivateLabel: 'Private',
            permAdmin: 'Admin', permPass: 'PASS', permBan: 'BAN', permVisit: 'Visit',
            youLabel: '(You)', copyId: 'Click to copy ID', copyDone: 'Copied!',
            total: n => `Total: ${n}`,
            beepTitle: n => `BEEP → ${n}`,
            beepPlaceholder: 'Type message (can be empty)\nCtrl+Enter to send',
            beepSend: 'Send BEEP', beepCancel: 'Cancel',
            beepSummon: 'Summon',
            beepSummonTitle: 'You must have the authority to summon the other player.\nOtherwise, they will only receive "summon".',
            beepSummonNoRoom: 'Must be in a room to summon',
            noData: '(Empty)', noFriends: 'No matching entries',
            fWhitelist: 'Whitelist', fBlacklist: 'Blacklist', fGhost: 'Ghost',
            relWhitelist: 'WL', relBlacklist: 'BL', relGhost: 'Ghost',
            roomPrivate: 'Private', roomPublic: '',
            saveModeLabel: 'Save Mode',
            saveModeOff: 'Off', saveModeName: 'Name only', saveModeAvatar: 'Name + Avatar', saveModeFull: 'Full profile (WCE)',
            saveModeDesc_off: "Don't save any data. If you have WCE with Profiles enabled, choose this to avoid duplicates (WCE already saves for you).",
            saveModeDesc_name: 'Save member number, BC name, and nickname only. Minimal space, used for displaying offline friend names.',
            saveModeDesc_avatar: 'Also save avatar snapshot (auto-captured when encountered, stored in separate FCM-Snapshot DB).',
            saveModeDesc_full: 'Full save: name, nickname, appearance/BIO/title etc. Fully compatible with WCE bce-past-profiles DB. Avatars stored separately in FCM-Snapshot.',
            wceDetected: '✅ WCE Profiles detected — auto-set to Full mode (shared DB, no conflicts)',
            wceNotDetected: 'WCE not detected. Use Name-only for minimal storage, or Name+Avatar if you want portraits.',
            reloadStatus: n => n > 0 ? `Loading avatars... ${n} remaining, please wait` : 'Avatar loading complete',
            exportProfiles: 'Export Profiles', exportNote: 'Export as JSON (WCE-compatible format)',
            importProfiles: 'Import Profiles', importNote: 'Import from JSON (newer seen timestamp wins on conflict)',
            exportDone: n => `✓ Exported ${n} profiles`,
            importDone: (p, n) => `✓ Imported profiles: ${p}${n ? `, notes: ${n}` : ''}`,
            profilesTitle: 'Saved Profiles', profilesHint: 'Click to open character info',
            profilesEmpty: 'No matching profiles', profilesTotal: (n, t) => `Showing ${n} of ${t}`,
            searchProfiles: 'Search name or ID...',
            peopleSearchPlaceholder: 'Name or ID — press Enter to search...',
            peopleSearchHint: 'Showing last 100 encountered · type then press Enter or click Search',
            peopleNoResults: 'No matching people found',
            peopleUnknownId: n => `Did you mean #${n}? No record found for this ID.`,
            peopleSimilarIds: 'Similar IDs containing this number:',
            peopleUnknownName: 'Name unknown',
            peopleOneSidedWarn: () => `⚠ Note: This action is a one-way addition. If necessary, please notify the other party yourself.`,
            peopleTotal: (n, t) => t !== undefined ? `Showing ${n} of ${t}` : `Total: ${n}`,
            colShare: 'Share',
            btnShare: 'Share',
            shareLocalMsg: (name, id) => `📜 Shared profile: ${name} (${id})`,
            shareRecvMsg: (from, display, date) => `📜 ${from} shared a profile: ${display} saved: ${date}`,
            shareOpen: '▶ Open',
            whisperAvatarLabel: 'Show target avatar during whisper',
            whisperAvatarNote: 'Displays the target\'s avatar near the chat input when in whisper/BEEP mode',
            whisperNoSignal: 'No signal',
            oocProtectLabel: 'OOC Protection (block Ctrl+Enter during whisper)',
            oocProtectNote: 'In whisper/BEEP mode, blocks Ctrl+Enter to prevent OOC content from being sent as normal chat',
            btnVisibilityLabel: 'Button Visibility',
            btnVisibilityNote: 'Control which screens show the FCM button (at least one must remain enabled)',
            btnShowChatRoom: 'ChatRoom button',
            btnShowMainHall: 'Main Hall button',
            btnShowProfile: 'Profile button',
            profileRelLabel: 'Quick Search Profile Relations',
            profileRelNote: 'On a character profile page, turn related people (owner/lovers) IDs into buttons — click to open FCM People search prefilled with that ID (requires the Profile save feature)',
            profileRelTitle: '🔍 Quick Relation Lookup',
            noBeepNotFriend: 'Not a friend — cannot BEEP',
            profileRelColorLabel: 'Color',
            colorNone: 'No color',
            // ── Add-friend flow ──
            addFriendTitle: n => `Add "${n}" as a friend?`,
            addFriendNotifyHint: '(Can notify them — requires FCM)',
            btnAgree: 'Agree', btnAgreeNotify: 'Agree & Notify', btnViewProfile: 'View',
            friendReqNeedRoom: 'Must be in the same room to notify',
            friendReqIncoming: n => `${n} sent you a friend request. Do you accept?`,
            friendReqSent: n => `📩 Friend request notification sent to "${n}"`,
            friendReqAdded: n => `✓ Added "${n}" as a friend`,
            // ── Room type / share ──
            roomTypeMap: 'Map', roomTypeMix: 'Hybrid',
            roomLockedCanJoin: 'Locked — you can join', roomLockedNoAccess: 'Locked — no access',
            roomHereBadge: '🏠 You', roomReenter: 'Re-enter',
            roomReenterConfirm: n => `You are already in "${n}".\nRe-enter the room?`,
            btnCancel: 'Cancel', btnConfirm: 'Confirm', roomGo: '🚪 Go',
            beepSummonConfirm: n => `Make sure you have permission to summon them, otherwise they will only receive the text "summon".\n\nSummon "${n}"?`,
            // ── Common UI (unified via i18n, replacing inline special cases) ──
            btnRemove: 'Remove', btnAddConfirm: 'Add', btnRefresh: 'Refresh',
            btnAddGhost: '＋Ghost', btnRmGhost: '－Ghost',
            btnClear: 'Clear', btnClearing: 'Clearing...', btnSearch: 'Search',
            confirmRmWhite: n => `Remove "${n}" from whitelist?`,
            confirmAddWhite: n => `Add "${n}" to whitelist?`,
            confirmRmBlack: n => `Remove "${n}" from blacklist?`,
            confirmRmGhost: n => `Remove "${n}" from ghost?`,
            avReloadTitle: 'Click to reload avatar',
            togNickToBCName: 'Switch to BC name', togNickToNick: 'Switch to nickname',
            btnSnapshotTitle: 'Snapshot current list (force rebuild)',
            roomPrivPrefix: '[Private] ', roomFull: '⚠ Full', roomGoPrompt: 'Go to room?',
            roomPrivShort: '(Priv)', roomPrivateHidden: '(Private)',
            peopleDbNotConnected: 'DB not connected — set a save mode in Settings',
            shareNeedRoom: 'Must be in a chat room to share',
            pageInfo: (a, b) => `Page ${a} / ${b}`,
            sortFavFirst: 'Fav First', sortFriendFirst: 'Friends First', sortNameOnly: 'Name',
            setSecUI: '⚙ UI Management', setSecChat: '⚙ Chat Room',
            avCacheCleared: '✓ Cache cleared', noFriendsToLoad: 'No friends need loading',
            avWaitLeft: s => `Waiting for BC... ${s}s left`,
            avWait: s => `Waiting for BC... ${s}s`,
            avSnapshotting: 'Snapshotting...',
            wceTagDetected: 'WCE detected', colorEditLabel: 'Color',
            cmdProfilesDesc: '<filter> - Open People search (filter by name or ID)',
            roomShareBtn: 'Share', roomJoinRoomBtn: 'Join Room',
            roomShareNeedRoom: 'Must be in a chat room to share',
            roomShareIntro: n => `${n} shared a room`,
            roomShareLocalDone: n => `📤 Shared room "${n}" to the chat`,
        },
    };

    // ════════════════════════════════════════
    //  多語系統：與 HSC 共用 Liko-i18n 引擎 + 自載 FCM 字庫
    //  T(key, ...args) 讀 window.Liko._FCM_strings（支援 {0}{1} 位置參數）；
    //  未載入時退回上方 L（zh/en，含函式型 key），保證離線可用。
    // ════════════════════════════════════════
    const I18N_NS = 'FCM';
    const FCM_LANGS = ['auto', 'TW', 'CN', 'EN', 'JP', 'KR', 'DE', 'FR', 'RU', 'UA'];
    const FCM_LANG_NAMES = { auto: 'Auto', TW: '繁體中文', CN: '简体中文', EN: 'English', JP: '日本語', KR: '한국어', DE: 'Deutsch', FR: 'Français', RU: 'Русский', UA: 'Українська' };

    // 依 bundle（assets/main.js）位置解析同層根目錄的素材網址；本地 vite preview 與 Pages 皆適用。
    function assetUrl(path) {
        const url = new URL(import.meta.url);
        url.pathname = url.pathname.replace(/\/assets\/[^/]+$/, `/${String(path).replace(/^\//, '')}`);
        url.search = '';
        return url.toString();
    }
    const LIKO_I18N_ENGINE_URL = assetUrl('Translation/BC_i18n.js');
    const LIKO_FCM_STRINGS_URL = assetUrl('Translation/FCM-i18n.js');

    // 加時間戳避免 CDN 快取到舊字庫（翻譯會經常修改）
    function _i18nLoadScript(url) {
        const u = url + (url.includes('?') ? '&' : '?') + 't=' + Date.now();
        return fetch(u)
            .then(res => { if (!res.ok) throw new Error(`[FCM] 無法載入 ${url} (${res.status})`); return res.text(); })
            .then(code => { new Function(code)(); });
    }
    async function ensureI18n() {
        try {
            // 能力偵測：新引擎 BC_i18n 暴露 __Sys_i18n__.ensure；舊 v1 只有 version 會被誤判
            if (typeof window.Liko?.__Sys_i18n__?.ensure !== 'function') await _i18nLoadScript(LIKO_I18N_ENGINE_URL);
            await window.Liko?.__Sys_i18n__?.ensure(I18N_NS, LIKO_FCM_STRINGS_URL);   // 依 URL 去重
        } catch (e) { console.warn('🐈‍⬛ [FCM] i18n 載入失敗，改用內建 zh/en:', e.message); }
    }

    // 目前語言：玩家手動選 > 遊戲語系（ZH→TW）；相容舊值 zh/en
    function fcmLang() {
        try {
            let sel = (cfg && cfg.lang) || 'auto';
            if (sel && sel !== 'auto') {
                if (sel === 'zh') return 'TW';
                if (sel === 'en') return 'EN';
                return String(sel).toUpperCase();
            }
            const raw = (typeof TranslationLanguage !== 'undefined' ? TranslationLanguage : '') || 'EN';
            const c = String(raw).toUpperCase().trim();
            return c === 'ZH' ? 'TW' : (c || 'EN');
        } catch { return 'EN'; }
    }

    // 中文語系（TW/CN）→ 供大量 inline 三元判斷使用（其餘語言走英文分支）
    function isZh() { const l = fcmLang(); return l === 'TW' || l === 'CN'; }

    // 取翻譯：引擎（__Sys_i18n__）有此 key 就用引擎 t()，args 以陣列傳入走位置式 {0}{1}，
    //   並把 FCM 自己算好的語言（含手動選擇）以第 4 參 forceLang 傳入；引擎未載入才退內建 L（含函式型 key）。
    function T(key, ...args) {
        const eng = window.Liko?.__Sys_i18n__;
        if (eng?.has?.(I18N_NS, key)) return eng.t(I18N_NS, key, args, fcmLang());
        const d = isZh() ? L.zh : L.en;
        const v = d[key] ?? L.en[key] ?? key;
        return typeof v === 'function' ? v(...args) : v;
    }

export { isZh, T, L, I18N_NS, FCM_LANGS, FCM_LANG_NAMES, fcmLang, ensureI18n, assetUrl };