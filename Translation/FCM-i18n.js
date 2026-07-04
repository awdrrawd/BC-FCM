// Liko - FCM i18n 字庫
// 此檔案由 FCM 插件動態載入，不需手動安裝
// 載入後自動呼叫 register('FCM', {...})，並暴露 window.Liko._FCM_strings 供 FCM 依使用者選的語言查表
// 佔位符以 {0} {1} {2} 表示位置參數，由 FCM 的 T(key, ...args) 依序代入
// 語言：TW 繁中 / CN 簡中 / EN 英 / DE 德 / FR 法 / RU 俄 / UA 烏

(function () {
    if (!window.Liko?.i18n?.register) {
        console.error('[Liko FCM strings] i18n 引擎尚未載入');
        return;
    }

    const FCM_STRINGS = {
        // ── 面板 / 分頁 ─────────────────────────────────────────────
        'panelTitle': { TW: '🎛 FCM ─ 好友與房間管理', CN: '🎛 FCM ─ 好友与房间管理', EN: '🎛 FCM ─ Friends and ChatRoom Manager', DE: '🎛 FCM ─ Freunde- und Raum-Manager', FR: '🎛 FCM ─ Gestionnaire d\'amis et de salons', RU: '🎛 FCM ─ Менеджер друзей и комнат', UA: '🎛 FCM ─ Менеджер друзів і кімнат' },
        'tabFriends': { TW: '個人關係', CN: '个人关系', EN: 'Relations', DE: 'Beziehungen', FR: 'Relations', RU: 'Связи', UA: 'Зв\'язки' },
        'tabRoom': { TW: '房間管理', CN: '房间管理', EN: 'Room Mgmt', DE: 'Raum-Verw.', FR: 'Gest. salon', RU: 'Комната', UA: 'Кімната' },
        'tabSettings': { TW: '設定', CN: '设置', EN: 'Settings', DE: 'Einstellungen', FR: 'Réglages', RU: 'Настройки', UA: 'Налаштування' },
        'tabPeople': { TW: '人員查詢', CN: '人员查询', EN: 'People', DE: 'Personen', FR: 'Personnes', RU: 'Люди', UA: 'Люди' },
        'tabHelp': { TW: '🔖 說明', CN: '🔖 说明', EN: '🔖 Help', DE: '🔖 Hilfe', FR: '🔖 Aide', RU: '🔖 Справка', UA: '🔖 Довідка' },
        'minimize': { TW: '—', CN: '—', EN: '—', DE: '—', FR: '—', RU: '—', UA: '—' },
        'close': { TW: '×', CN: '×', EN: '×', DE: '×', FR: '×', RU: '×', UA: '×' },
        'miniLabel': { TW: '好友與房間管理', CN: '好友与房间管理', EN: 'Friends and ChatRoom Manager', DE: 'Freunde- und Raum-Manager', FR: 'Gestionnaire d\'amis et de salons', RU: 'Менеджер друзей и комнат', UA: 'Менеджер друзів і кімнат' },

        // ── 工具列 / 排序 / 篩選 ────────────────────────────────────
        'search': { TW: '搜尋名稱或ID...', CN: '搜索名称或ID...', EN: 'Search name or ID...', DE: 'Name oder ID suchen...', FR: 'Chercher nom ou ID...', RU: 'Поиск по имени или ID...', UA: 'Пошук за іменем або ID...' },
        'roomSearch': { TW: '搜尋 / 輸入ID添加...', CN: '搜索 / 输入ID添加...', EN: 'Search / Enter ID to add...', DE: 'Suchen / ID eingeben...', FR: 'Chercher / saisir ID...', RU: 'Поиск / ввести ID...', UA: 'Пошук / введіть ID...' },
        'sortBy': { TW: '排序', CN: '排序', EN: 'Sort', DE: 'Sortieren', FR: 'Trier', RU: 'Сортировка', UA: 'Сортування' },
        'sortRel': { TW: '關係', CN: '关系', EN: 'Relation', DE: 'Beziehung', FR: 'Relation', RU: 'Связь', UA: 'Зв\'язок' },
        'sortId': { TW: 'ID', CN: 'ID', EN: 'ID', DE: 'ID', FR: 'ID', RU: 'ID', UA: 'ID' },
        'sortName': { TW: '名稱', CN: '名称', EN: 'Name', DE: 'Name', FR: 'Nom', RU: 'Имя', UA: 'Ім\'я' },
        'sortAdded': { TW: '添加時間', CN: '添加时间', EN: 'Added', DE: 'Hinzugefügt', FR: 'Ajouté', RU: 'Добавлен', UA: 'Додано' },
        'sortSeen': { TW: '最後見面', CN: '最后见面', EN: 'Last Seen', DE: 'Zuletzt gesehen', FR: 'Vu récemment', RU: 'Был замечен', UA: 'Востаннє бачили' },
        'showOnly': { TW: '顯示', CN: '显示', EN: 'Show', DE: 'Zeigen', FR: 'Afficher', RU: 'Показать', UA: 'Показати' },
        'togNick': { TW: '暱稱', CN: '昵称', EN: 'Nick', DE: 'Spitzn.', FR: 'Surnom', RU: 'Ник', UA: 'Нік' },
        'togName': { TW: '名稱', CN: '名称', EN: 'Name', DE: 'Name', FR: 'Nom', RU: 'Имя', UA: 'Ім\'я' },
        'fOnline': { TW: '在線', CN: '在线', EN: 'Online', DE: 'Online', FR: 'En ligne', RU: 'В сети', UA: 'У мережі' },
        'fOffline': { TW: '不在線', CN: '不在线', EN: 'Offline', DE: 'Offline', FR: 'Hors ligne', RU: 'Не в сети', UA: 'Не в мережі' },
        'fOwner': { TW: '主人', CN: '主人', EN: 'Owner', DE: 'Besitzer', FR: 'Maître', RU: 'Владелец', UA: 'Власник' },
        'fLover': { TW: '戀人', CN: '恋人', EN: 'Lover', DE: 'Geliebte', FR: 'Amant', RU: 'Возлюбленный', UA: 'Коханий' },
        'fSub': { TW: '奴隸', CN: '奴隶', EN: 'Sub', DE: 'Sub', FR: 'Soumis', RU: 'Раб', UA: 'Раб' },
        'fFriend': { TW: '好友', CN: '好友', EN: 'Friend', DE: 'Freund', FR: 'Ami', RU: 'Друг', UA: 'Друг' },

        // ── 表格欄位 ─────────────────────────────────────────────────
        'colName': { TW: '名稱', CN: '名称', EN: 'Name', DE: 'Name', FR: 'Nom', RU: 'Имя', UA: 'Ім\'я' },
        'colId': { TW: 'ID', CN: 'ID', EN: 'ID', DE: 'ID', FR: 'ID', RU: 'ID', UA: 'ID' },
        'colRel': { TW: '關係', CN: '关系', EN: 'Rel.', DE: 'Bez.', FR: 'Rel.', RU: 'Связь', UA: 'Зв\'язок' },
        'colZone': { TW: '分區', CN: '分区', EN: 'Zone', DE: 'Zone', FR: 'Zone', RU: 'Зона', UA: 'Зона' },
        'colRoom': { TW: '房間', CN: '房间', EN: 'Room', DE: 'Raum', FR: 'Salon', RU: 'Комната', UA: 'Кімната' },
        'colPerm': { TW: '權限', CN: '权限', EN: 'Perm.', DE: 'Rechte', FR: 'Droits', RU: 'Права', UA: 'Права' },
        'colOps': { TW: '動作', CN: '动作', EN: 'Actions', DE: 'Aktionen', FR: 'Actions', RU: 'Действия', UA: 'Дії' },
        'colMgmt': { TW: '房管', CN: '房管', EN: 'Room Admin', DE: 'Raum-Admin', FR: 'Admin salon', RU: 'Админ комнаты', UA: 'Адмін кімнати' },
        'colMgmtNoPerm': { TW: '房管（無權）', CN: '房管（无权）', EN: 'Room Admin (no perm)', DE: 'Raum-Admin (keine Rechte)', FR: 'Admin salon (sans droit)', RU: 'Админ комнаты (нет прав)', UA: 'Адмін кімнати (немає прав)' },
        'colSeen': { TW: '最後見面', CN: '最后见面', EN: 'Last Seen', DE: 'Zuletzt gesehen', FR: 'Vu récemment', RU: 'Был замечен', UA: 'Востаннє бачили' },

        // ── 關係標籤 ─────────────────────────────────────────────────
        'relOwner': { TW: '主人', CN: '主人', EN: 'Owner', DE: 'Besitzer', FR: 'Maître', RU: 'Владелец', UA: 'Власник' },
        'relLover': { TW: '戀人', CN: '恋人', EN: 'Lover', DE: 'Geliebte', FR: 'Amant', RU: 'Возлюбленный', UA: 'Коханий' },
        'relSub': { TW: '奴隸', CN: '奴隶', EN: 'Sub', DE: 'Sub', FR: 'Soumis', RU: 'Раб', UA: 'Раб' },
        'relFriend': { TW: '好友', CN: '好友', EN: 'Friend', DE: 'Freund', FR: 'Ami', RU: 'Друг', UA: 'Друг' },
        'relContact': { TW: '單向好友', CN: '单向好友', EN: 'One-way', DE: 'Einseitig', FR: 'Unilatéral', RU: 'Односторонний', UA: 'Односторонній' },
        'relWhitelist': { TW: '白名單', CN: '白名单', EN: 'WL', DE: 'WL', FR: 'LB', RU: 'БС', UA: 'БС' },
        'relBlacklist': { TW: '黑名單', CN: '黑名单', EN: 'BL', DE: 'BL', FR: 'LN', RU: 'ЧС', UA: 'ЧС' },
        'relGhost': { TW: '幽靈', CN: '幽灵', EN: 'Ghost', DE: 'Geist', FR: 'Fantôme', RU: 'Призрак', UA: 'Привид' },

        // ── 分區 / 在線 ──────────────────────────────────────────────
        'zoneF': { TW: '♀', CN: '♀', EN: '♀', DE: '♀', FR: '♀', RU: '♀', UA: '♀' },
        'zoneM': { TW: '♂', CN: '♂', EN: '♂', DE: '♂', FR: '♂', RU: '♂', UA: '♂' },
        'zoneX': { TW: '♀♂', CN: '♀♂', EN: '♀♂', DE: '♀♂', FR: '♀♂', RU: '♀♂', UA: '♀♂' },
        'zoneUnk': { TW: '—', CN: '—', EN: '—', DE: '—', FR: '—', RU: '—', UA: '—' },
        'online': { TW: '在線', CN: '在线', EN: 'Online', DE: 'Online', FR: 'En ligne', RU: 'В сети', UA: 'У мережі' },
        'offline': { TW: '不在線', CN: '不在线', EN: 'Offline', DE: 'Offline', FR: 'Hors ligne', RU: 'Не в сети', UA: 'Не в мережі' },

        // ── 動作按鈕 ─────────────────────────────────────────────────
        'btnView': { TW: '查看', CN: '查看', EN: 'View', DE: 'Ansehen', FR: 'Voir', RU: 'Профиль', UA: 'Профіль' },
        'btnBeep': { TW: '私信', CN: '私信', EN: 'BEEP', DE: 'BEEP', FR: 'BEEP', RU: 'BEEP', UA: 'BEEP' },
        'btnWhisper': { TW: '悄悄話', CN: '悄悄话', EN: 'Msg', DE: 'Flüstern', FR: 'Chuchoter', RU: 'Шёпот', UA: 'Шепіт' },
        'btnAddFriend': { TW: '＋好友', CN: '＋好友', EN: '+Frnd', DE: '+Freund', FR: '+Ami', RU: '+Друг', UA: '+Друг' },
        'btnRmFriend': { TW: '－好友', CN: '－好友', EN: '-Frnd', DE: '-Freund', FR: '-Ami', RU: '-Друг', UA: '-Друг' },
        'btnAddAdmin': { TW: '＋管理', CN: '＋管理', EN: '＋Admin', DE: '＋Admin', FR: '＋Admin', RU: '＋Админ', UA: '＋Адмін' },
        'btnRmAdmin': { TW: '－管理', CN: '－管理', EN: '－Admin', DE: '－Admin', FR: '－Admin', RU: '－Админ', UA: '－Адмін' },
        'btnAddWhite': { TW: '＋白單', CN: '＋白单', EN: '＋White', DE: '＋Whitel.', FR: '＋Blanche', RU: '＋БелСп', UA: '＋БілСп' },
        'btnRmWhite': { TW: '－白單', CN: '－白单', EN: '－White', DE: '－Whitel.', FR: '－Blanche', RU: '－БелСп', UA: '－БілСп' },
        'btnAddBan': { TW: '＋黑單', CN: '＋黑单', EN: '＋BAN', DE: '＋BANN', FR: '＋BAN', RU: '＋БАН', UA: '＋БАН' },
        'btnRmBan': { TW: '－黑單', CN: '－黑单', EN: '－BAN', DE: '－BANN', FR: '－BAN', RU: '－БАН', UA: '－БАН' },
        'btnKick': { TW: '逐出', CN: '逐出', EN: 'Kick', DE: 'Kicken', FR: 'Expulser', RU: 'Выгнать', UA: 'Вигнати' },
        'btnAddBlack': { TW: '＋黑單', CN: '＋黑单', EN: '＋Black', DE: '＋Blackl.', FR: '＋Noire', RU: '＋ЧёрСп', UA: '＋ЧорСп' },
        'btnRmBlack': { TW: '－黑單', CN: '－黑单', EN: '－Black', DE: '－Blackl.', FR: '－Noire', RU: '－ЧёрСп', UA: '－ЧорСп' },
        'btnAdd': { TW: '添加', CN: '添加', EN: 'Add', DE: 'Hinzuf.', FR: 'Ajouter', RU: 'Добавить', UA: 'Додати' },
        'btnAddTitle': { TW: '添加ID到名單', CN: '添加ID到名单', EN: 'Add ID to list', DE: 'ID zur Liste hinzufügen', FR: 'Ajouter l\'ID à la liste', RU: 'Добавить ID в список', UA: 'Додати ID до списку' },

        // ── 房管子分頁 ───────────────────────────────────────────────
        'roomTab_members': { TW: '房內人員', CN: '房内人员', EN: 'Members', DE: 'Mitglieder', FR: 'Membres', RU: 'Участники', UA: 'Учасники' },
        'roomTab_admin': { TW: '管理者', CN: '管理者', EN: 'Admins', DE: 'Admins', FR: 'Admins', RU: 'Админы', UA: 'Адміни' },
        'roomTab_white': { TW: '白名單', CN: '白名单', EN: 'Whitelist', DE: 'Whitelist', FR: 'Liste blanche', RU: 'Белый список', UA: 'Білий список' },
        'roomTab_ban': { TW: '黑名單', CN: '黑名单', EN: 'Blacklist', DE: 'Blacklist', FR: 'Liste noire', RU: 'Чёрный список', UA: 'Чорний список' },
        'notInRoom': { TW: '目前不在任何房間中', CN: '目前不在任何房间中', EN: 'Not currently in a room', DE: 'Derzeit in keinem Raum', FR: 'Actuellement dans aucun salon', RU: 'Сейчас не в комнате', UA: 'Зараз не в кімнаті' },
        'noAdminWarn': { TW: '⚠ 無管理員權限，房管欄僅供查看', CN: '⚠ 无管理员权限，房管栏仅供查看', EN: '⚠ No admin rights — Room Admin column is view-only', DE: '⚠ Keine Admin-Rechte — Raum-Admin-Spalte nur lesbar', FR: '⚠ Pas de droits admin — colonne Admin salon en lecture seule', RU: '⚠ Нет прав админа — столбец «Админ комнаты» только для просмотра', UA: '⚠ Немає прав адміна — стовпець «Адмін кімнати» лише для перегляду' },

        // ── 設定：頭像 / 資料 ────────────────────────────────────────
        'setAvatars': { TW: '顯示頭像', CN: '显示头像', EN: 'Show Avatars', DE: 'Avatare anzeigen', FR: 'Afficher les avatars', RU: 'Показывать аватары', UA: 'Показувати аватари' },
        'setAvatarsNote': { TW: '在列表中顯示角色頭像（見過後才有，或由角色資料重建）', CN: '在列表中显示角色头像（见过后才有，或由角色资料重建）', EN: 'Show portraits (saved on encounter, stored in FCM-Snapshot DB)', DE: 'Porträts anzeigen (bei Begegnung gespeichert, in FCM-Snapshot-DB)', FR: 'Afficher les portraits (enregistrés lors d\'une rencontre, dans la BD FCM-Snapshot)', RU: 'Показывать портреты (сохраняются при встрече, в БД FCM-Snapshot)', UA: 'Показувати портрети (зберігаються при зустрічі, у БД FCM-Snapshot)' },
        'setProfiles': { TW: '啟用自動儲存個人資料', CN: '启用自动保存个人资料', EN: 'Enable Profile Auto-Save', DE: 'Profil-Autospeicherung aktivieren', FR: 'Activer l\'enreg. auto des profils', RU: 'Автосохранение профилей', UA: 'Автозбереження профілів' },
        'setProfilesNote': { TW: '與 WCE bce-past-profiles 相容，同房間時自動儲存', CN: '与 WCE bce-past-profiles 兼容，同房间时自动保存', EN: 'WCE bce-past-profiles compatible', DE: 'Kompatibel mit WCE bce-past-profiles', FR: 'Compatible avec WCE bce-past-profiles', RU: 'Совместимо с WCE bce-past-profiles', UA: 'Сумісно з WCE bce-past-profiles' },
        'dbOk': { TW: '已連線', CN: '已连接', EN: 'Connected', DE: 'Verbunden', FR: 'Connecté', RU: 'Подключено', UA: 'Підключено' },
        'dbNo': { TW: '未連線', CN: '未连接', EN: 'Not connected', DE: 'Nicht verbunden', FR: 'Non connecté', RU: 'Не подключено', UA: 'Не підключено' },

        // ── 設定：語言 ───────────────────────────────────────────────
        'langLabel': { TW: '語言', CN: '语言', EN: 'Language', DE: 'Sprache', FR: 'Langue', RU: 'Язык', UA: 'Мова' },
        'langNote': { TW: 'Auto: 依 BC TranslationLanguage（CN/TW→中文，其餘→English）', CN: 'Auto: 依 BC TranslationLanguage（CN/TW→中文，其余→English）', EN: 'Auto: follows BC TranslationLanguage (CN/TW→Chinese, others→English)', DE: 'Auto: folgt BC TranslationLanguage (CN/TW→Chinesisch, sonst→Englisch)', FR: 'Auto : suit BC TranslationLanguage (CN/TW→chinois, autres→anglais)', RU: 'Авто: по BC TranslationLanguage (CN/TW→китайский, иначе→английский)', UA: 'Авто: за BC TranslationLanguage (CN/TW→китайська, інакше→англійська)' },

        // ── 設定：私聊 / 幽靈 ────────────────────────────────────────
        'whisperIndicatorLabel': { TW: '私聊/BEEP 輸入框提示色', CN: '私聊/BEEP 输入框提示色', EN: 'Whisper/BEEP Input Glow Color', DE: 'Flüster-/BEEP-Eingabe-Farbe', FR: 'Couleur de la zone de chuchotement/BEEP', RU: 'Цвет подсветки поля шёпота/BEEP', UA: 'Колір підсвітки поля шепоту/BEEP' },
        'whisperIndicatorNote': { TW: '輸入 /w /whisper /beep 或進入悄悄話模式時，聊天框會顯示紫色邊框提示', CN: '输入 /w /whisper /beep 或进入悄悄话模式时，聊天框会显示紫色边框提示', EN: 'Shows a purple glow on the chat input when /w /whisper /beep is typed or whisper mode is active', DE: 'Zeigt einen violetten Rand am Chat-Eingabefeld, wenn /w /whisper /beep getippt oder Flüstermodus aktiv ist', FR: 'Affiche un halo violet sur la zone de chat quand /w /whisper /beep est saisi ou en mode chuchotement', RU: 'Показывает фиолетовую рамку поля ввода при вводе /w /whisper /beep или в режиме шёпота', UA: 'Показує фіолетову рамку поля вводу при введенні /w /whisper /beep або в режимі шепоту' },
        'ghostHideLabel': { TW: '幽靈名單隱身', CN: '幽灵名单隐身', EN: 'Ghost List Hide', DE: 'Geisterliste ausblenden', FR: 'Masquer liste fantôme', RU: 'Скрытие по списку призраков', UA: 'Приховування за списком привидів' },
        'ghostHideNote': { TW: '幽靈名單中的角色在聊天室不顯示身體（只對自己有效）', CN: '幽灵名单中的角色在聊天室不显示身体（只对自己有效）', EN: 'Characters on your ghost list are hidden in chatroom (only affects your view)', DE: 'Charaktere auf deiner Geisterliste werden im Raum ausgeblendet (nur deine Ansicht)', FR: 'Les personnages de votre liste fantôme sont masqués dans le salon (votre vue seulement)', RU: 'Персонажи из списка призраков скрыты в комнате (только у вас)', UA: 'Персонажі зі списку привидів приховані в кімнаті (лише для вас)' },

        // ── 設定：頭像快取管理 ───────────────────────────────────────
        'btnReloadAvatars': { TW: '頭像快取管理', CN: '头像缓存管理', EN: 'Avatar Cache', DE: 'Avatar-Cache', FR: 'Cache d\'avatars', RU: 'Кэш аватаров', UA: 'Кеш аватарів' },
        'reloadAvatarsNote': { TW: '清除快取或載入好友頭像', CN: '清除缓存或加载好友头像', EN: 'Clear cache or load friend avatars', DE: 'Cache leeren oder Freund-Avatare laden', FR: 'Vider le cache ou charger les avatars d\'amis', RU: 'Очистить кэш или загрузить аватары друзей', UA: 'Очистити кеш або завантажити аватари друзів' },
        'btnLoadFriendAvatars': { TW: '載入好友頭像', CN: '加载好友头像', EN: 'Load Friend Avatars', DE: 'Freund-Avatare laden', FR: 'Charger les avatars d\'amis', RU: 'Загрузить аватары друзей', UA: 'Завантажити аватари друзів' },
        'loadFriendAvatarsNote': { TW: '掃描所有好友，讓 BC 緩存外觀後統一截圖（約需數十秒）', CN: '扫描所有好友，让 BC 缓存外观后统一截图（约需数十秒）', EN: 'Scan all friends, wait for BC to cache appearances, then snapshot (may take tens of seconds)', DE: 'Alle Freunde scannen, auf BC-Cache warten, dann Schnappschuss (kann Sekunden dauern)', FR: 'Analyser tous les amis, attendre le cache BC, puis capturer (peut prendre des dizaines de secondes)', RU: 'Сканировать всех друзей, дождаться кэша BC, затем снимок (может занять десятки секунд)', UA: 'Сканувати всіх друзів, дочекатися кешу BC, потім знімок (може зайняти десятки секунд)' },
        'btnClearAvatarCache': { TW: '清除頭像快取', CN: '清除头像缓存', EN: 'Clear Avatar Cache', DE: 'Avatar-Cache leeren', FR: 'Vider le cache d\'avatars', RU: 'Очистить кэш аватаров', UA: 'Очистити кеш аватарів' },
        'clearAvatarCacheNote': { TW: '清除所有已儲存的頭像快照，下次遇到時重新截取', CN: '清除所有已保存的头像快照，下次遇到时重新截取', EN: 'Delete all saved avatar snapshots — new ones will be captured on next encounter', DE: 'Alle gespeicherten Avatar-Schnappschüsse löschen — neue bei nächster Begegnung', FR: 'Supprimer tous les avatars enregistrés — recapturés à la prochaine rencontre', RU: 'Удалить все сохранённые снимки аватаров — новые при следующей встрече', UA: 'Видалити всі збережені знімки аватарів — нові при наступній зустрічі' },
        'loadFriendAvatarsDone': { TW: '好友頭像載入完成', CN: '好友头像加载完成', EN: 'Friend avatar loading complete', DE: 'Laden der Freund-Avatare abgeschlossen', FR: 'Chargement des avatars d\'amis terminé', RU: 'Загрузка аватаров друзей завершена', UA: 'Завантаження аватарів друзів завершено' },
        'loadingFriendAvatars': { TW: '載入好友頭像中... 剩餘 {0} 人', CN: '加载好友头像中... 剩余 {0} 人', EN: 'Loading friend avatars... {0} remaining', DE: 'Lade Freund-Avatare... {0} übrig', FR: 'Chargement des avatars... {0} restant(s)', RU: 'Загрузка аватаров... осталось {0}', UA: 'Завантаження аватарів... залишилось {0}' },

        // ── 確認對話 ─────────────────────────────────────────────────
        'noProfile': { TW: '尚無個人資料\n（需先與此人在同一房間）', CN: '尚无个人资料\n（需先与此人在同一房间）', EN: 'No profile data\n(Must have been in same room)', DE: 'Keine Profildaten\n(Muss im selben Raum gewesen sein)', FR: 'Aucune donnée de profil\n(Doit avoir été dans le même salon)', RU: 'Нет данных профиля\n(Нужно было быть в одной комнате)', UA: 'Немає даних профілю\n(Потрібно було бути в одній кімнаті)' },
        'confirmDel': { TW: '確定刪除好友「{0}」？', CN: '确定删除好友「{0}」？', EN: 'Unfriend "{0}"?', DE: '„{0}" entfreunden?', FR: 'Retirer « {0} » des amis ?', RU: 'Удалить «{0}» из друзей?', UA: 'Видалити «{0}» з друзів?' },
        'confirmKick': { TW: '確定逐出「{0}」？', CN: '确定逐出「{0}」？', EN: 'Kick "{0}"?', DE: '„{0}" kicken?', FR: 'Expulser « {0} » ?', RU: 'Выгнать «{0}»?', UA: 'Вигнати «{0}»?' },
        'confirmRoom': { TW: '🚪 前往房間「{0}」？', CN: '🚪 前往房间「{0}」？', EN: '🚪 Go to room "{0}"?', DE: '🚪 Zum Raum „{0}" gehen?', FR: '🚪 Aller au salon « {0} » ?', RU: '🚪 Перейти в комнату «{0}»?', UA: '🚪 Перейти до кімнати «{0}»?' },
        'confirmAddBan': { TW: '確定將「{0}」加入黑名單？\n對方將無法與你互動。', CN: '确定将「{0}」加入黑名单？\n对方将无法与你互动。', EN: 'Blacklist "{0}"?\nThey will no longer be able to interact with you.', DE: '„{0}" auf die Blacklist setzen?\nDiese Person kann nicht mehr mit dir interagieren.', FR: 'Mettre « {0} » sur liste noire ?\nCette personne ne pourra plus interagir avec vous.', RU: 'Добавить «{0}» в чёрный список?\nОн больше не сможет взаимодействовать с вами.', UA: 'Додати «{0}» до чорного списку?\nВін більше не зможе взаємодіяти з вами.' },
        'confirmAddGhost': { TW: '確定將「{0}」加入幽靈名單？\n你將不會再收到任何該玩家的信息。', CN: '确定将「{0}」加入幽灵名单？\n你将不会再收到任何该玩家的信息。', EN: 'Add "{0}" to ghost list?\nYou will no longer receive any messages from that person.', DE: '„{0}" zur Geisterliste hinzufügen?\nDu erhältst keine Nachrichten mehr von dieser Person.', FR: 'Ajouter « {0} » à la liste fantôme ?\nVous ne recevrez plus aucun message de cette personne.', RU: 'Добавить «{0}» в список призраков?\nВы больше не будете получать от него сообщений.', UA: 'Додати «{0}» до списку привидів?\nВи більше не отримуватимете від нього повідомлень.' },

        // ── 房間搜尋 ─────────────────────────────────────────────────
        'tabRoomSearch': { TW: '查詢房間', CN: '查询房间', EN: 'Search Rooms', DE: 'Räume suchen', FR: 'Chercher salons', RU: 'Поиск комнат', UA: 'Пошук кімнат' },
        'roomSearch2': { TW: '搜尋房間...', CN: '搜索房间...', EN: 'Search rooms...', DE: 'Räume suchen...', FR: 'Chercher des salons...', RU: 'Поиск комнат...', UA: 'Пошук кімнат...' },
        'roomSearchBtn': { TW: '搜尋', CN: '搜索', EN: 'Search', DE: 'Suchen', FR: 'Chercher', RU: 'Поиск', UA: 'Пошук' },
        'roomSearching': { TW: '搜尋中...', CN: '搜索中...', EN: 'Searching...', DE: 'Suche...', FR: 'Recherche...', RU: 'Поиск...', UA: 'Пошук...' },
        'roomSearchEmpty': { TW: '沒有找到房間', CN: '没有找到房间', EN: 'No rooms found', DE: 'Keine Räume gefunden', FR: 'Aucun salon trouvé', RU: 'Комнаты не найдены', UA: 'Кімнат не знайдено' },
        'roomFavLabel': { TW: '★ 最愛', CN: '★ 最爱', EN: '★ Favs', DE: '★ Favoriten', FR: '★ Favoris', RU: '★ Избранное', UA: '★ Обране' },
        'roomJoin': { TW: '加入', CN: '加入', EN: 'Join', DE: 'Beitreten', FR: 'Rejoindre', RU: 'Войти', UA: 'Приєднатися' },
        'roomMixed': { TW: '混合', CN: '混合', EN: 'Mixed', DE: 'Gemischt', FR: 'Mixte', RU: 'Смешанная', UA: 'Змішана' },
        'roomFemale': { TW: '女性', CN: '女性', EN: 'Female', DE: 'Weiblich', FR: 'Féminin', RU: 'Женская', UA: 'Жіноча' },
        'roomMale': { TW: '男性', CN: '男性', EN: 'Male', DE: 'Männlich', FR: 'Masculin', RU: 'Мужская', UA: 'Чоловіча' },
        'totalRooms': { TW: '共 {0} 間', CN: '共 {0} 间', EN: 'Rooms: {0}', DE: 'Räume: {0}', FR: 'Salons : {0}', RU: 'Комнат: {0}', UA: 'Кімнат: {0}' },
        'roomPrivateLabel': { TW: '私人', CN: '私人', EN: 'Private', DE: 'Privat', FR: 'Privé', RU: 'Приватная', UA: 'Приватна' },

        // ── 房間權限 ─────────────────────────────────────────────────
        'permAdmin': { TW: '管理', CN: '管理', EN: 'Admin', DE: 'Admin', FR: 'Admin', RU: 'Админ', UA: 'Адмін' },
        'permPass': { TW: 'PASS', CN: 'PASS', EN: 'PASS', DE: 'PASS', FR: 'PASS', RU: 'PASS', UA: 'PASS' },
        'permBan': { TW: 'BAN', CN: 'BAN', EN: 'BAN', DE: 'BANN', FR: 'BAN', RU: 'БАН', UA: 'БАН' },
        'permVisit': { TW: '訪客', CN: '访客', EN: 'Visit', DE: 'Gast', FR: 'Visiteur', RU: 'Гость', UA: 'Гість' },
        'youLabel': { TW: '（你）', CN: '（你）', EN: '(You)', DE: '(Du)', FR: '(Vous)', RU: '(Вы)', UA: '(Ви)' },
        'copyId': { TW: '點擊複製ID', CN: '点击复制ID', EN: 'Click to copy ID', DE: 'Klicken zum Kopieren der ID', FR: 'Cliquer pour copier l\'ID', RU: 'Нажмите, чтобы скопировать ID', UA: 'Натисніть, щоб скопіювати ID' },
        'copyDone': { TW: '已複製！', CN: '已复制！', EN: 'Copied!', DE: 'Kopiert!', FR: 'Copié !', RU: 'Скопировано!', UA: 'Скопійовано!' },
        'total': { TW: '共 {0} 人', CN: '共 {0} 人', EN: 'Total: {0}', DE: 'Gesamt: {0}', FR: 'Total : {0}', RU: 'Всего: {0}', UA: 'Всього: {0}' },

        // ── BEEP 視窗 ────────────────────────────────────────────────
        'beepTitle': { TW: 'BEEP → {0}', CN: 'BEEP → {0}', EN: 'BEEP → {0}', DE: 'BEEP → {0}', FR: 'BEEP → {0}', RU: 'BEEP → {0}', UA: 'BEEP → {0}' },
        'beepPlaceholder': { TW: '輸入訊息（可留空）\nCtrl+Enter 發送', CN: '输入消息（可留空）\nCtrl+Enter 发送', EN: 'Type message (can be empty)\nCtrl+Enter to send', DE: 'Nachricht eingeben (optional)\nStrg+Enter zum Senden', FR: 'Tapez un message (facultatif)\nCtrl+Entrée pour envoyer', RU: 'Введите сообщение (можно пусто)\nCtrl+Enter для отправки', UA: 'Введіть повідомлення (можна порожнє)\nCtrl+Enter для надсилання' },
        'beepSend': { TW: '發送 BEEP', CN: '发送 BEEP', EN: 'Send BEEP', DE: 'BEEP senden', FR: 'Envoyer BEEP', RU: 'Отправить BEEP', UA: 'Надіслати BEEP' },
        'beepCancel': { TW: '取消', CN: '取消', EN: 'Cancel', DE: 'Abbrechen', FR: 'Annuler', RU: 'Отмена', UA: 'Скасувати' },
        'beepSummon': { TW: '召喚', CN: '召唤', EN: 'Summon', DE: 'Rufen', FR: 'Convoquer', RU: 'Призвать', UA: 'Викликати' },
        'beepSummonTitle': { TW: '請確定您有召喚對方的權限，否則對方只會收到 summon', CN: '请确定您有召唤对方的权限，否则对方只会收到 summon', EN: 'You must have the authority to summon the other player.\nOtherwise, they will only receive "summon".', DE: 'Du benötigst die Berechtigung, den anderen Spieler zu rufen.\nSonst erhält er nur „summon".', FR: 'Vous devez avoir l\'autorité pour convoquer l\'autre joueur.\nSinon, il ne recevra que « summon ».', RU: 'У вас должно быть право призывать другого игрока.\nИначе он получит только «summon».', UA: 'Ви повинні мати право викликати іншого гравця.\nІнакше він отримає лише «summon».' },
        'beepSummonNoRoom': { TW: '需在房間內才能召喚', CN: '需在房间内才能召唤', EN: 'Must be in a room to summon', DE: 'Zum Rufen musst du in einem Raum sein', FR: 'Il faut être dans un salon pour convoquer', RU: 'Для призыва нужно быть в комнате', UA: 'Для виклику потрібно бути в кімнаті' },
        'noData': { TW: '（空白）', CN: '（空白）', EN: '(Empty)', DE: '(Leer)', FR: '(Vide)', RU: '(Пусто)', UA: '(Порожньо)' },
        'noFriends': { TW: '沒有符合條件的好友', CN: '没有符合条件的好友', EN: 'No matching entries', DE: 'Keine passenden Einträge', FR: 'Aucune entrée correspondante', RU: 'Нет подходящих записей', UA: 'Немає відповідних записів' },
        'fWhitelist': { TW: '白名單', CN: '白名单', EN: 'Whitelist', DE: 'Whitelist', FR: 'Liste blanche', RU: 'Белый список', UA: 'Білий список' },
        'fBlacklist': { TW: '黑名單', CN: '黑名单', EN: 'Blacklist', DE: 'Blacklist', FR: 'Liste noire', RU: 'Чёрный список', UA: 'Чорний список' },
        'fGhost': { TW: '幽靈', CN: '幽灵', EN: 'Ghost', DE: 'Geist', FR: 'Fantôme', RU: 'Призрак', UA: 'Привид' },
        'roomPrivate': { TW: '私人', CN: '私人', EN: 'Private', DE: 'Privat', FR: 'Privé', RU: 'Приватная', UA: 'Приватна' },
        'roomPublic': { TW: '', CN: '', EN: '', DE: '', FR: '', RU: '', UA: '' },

        // ── 設定：儲存模式 ───────────────────────────────────────────
        'saveModeLabel': { TW: '儲存模式', CN: '保存模式', EN: 'Save Mode', DE: 'Speichermodus', FR: 'Mode d\'enregistrement', RU: 'Режим сохранения', UA: 'Режим збереження' },
        'saveModeOff': { TW: '不儲存', CN: '不保存', EN: 'Off', DE: 'Aus', FR: 'Désactivé', RU: 'Выкл.', UA: 'Вимк.' },
        'saveModeName': { TW: '僅名稱', CN: '仅名称', EN: 'Name only', DE: 'Nur Name', FR: 'Nom seul', RU: 'Только имя', UA: 'Лише ім\'я' },
        'saveModeAvatar': { TW: '名稱與頭像', CN: '名称与头像', EN: 'Name + Avatar', DE: 'Name + Avatar', FR: 'Nom + avatar', RU: 'Имя + аватар', UA: 'Ім\'я + аватар' },
        'saveModeFull': { TW: '完整資料（WCE 相容）', CN: '完整资料（WCE 兼容）', EN: 'Full profile (WCE)', DE: 'Vollständiges Profil (WCE)', FR: 'Profil complet (WCE)', RU: 'Полный профиль (WCE)', UA: 'Повний профіль (WCE)' },
        'saveModeDesc_off': { TW: '不儲存任何資料。如果你有安裝 WCE 並啟用其 Profiles 功能，建議選此選項避免重複儲存（WCE 已幫你存好了）。', CN: '不保存任何资料。如果你有安装 WCE 并启用其 Profiles 功能，建议选此选项避免重复保存（WCE 已帮你存好了）。', EN: "Don't save any data. If you have WCE with Profiles enabled, choose this to avoid duplicates (WCE already saves for you).", DE: 'Keine Daten speichern. Wenn WCE mit Profilen aktiv ist, wähle dies, um Duplikate zu vermeiden (WCE speichert bereits).', FR: 'Ne rien enregistrer. Si WCE avec Profils est activé, choisissez ceci pour éviter les doublons (WCE enregistre déjà).', RU: 'Ничего не сохранять. Если у вас WCE с профилями, выберите это, чтобы избежать дублей (WCE уже сохраняет).', UA: 'Нічого не зберігати. Якщо у вас WCE з профілями, оберіть це, щоб уникнути дублів (WCE вже зберігає).' },
        'saveModeDesc_name': { TW: '只儲存成員編號、BC 名稱、暱稱。幾乎不佔空間，可用來顯示離線好友名稱。', CN: '只保存成员编号、BC 名称、昵称。几乎不占空间，可用来显示离线好友名称。', EN: 'Save member number, BC name, and nickname only. Minimal space, used for displaying offline friend names.', DE: 'Nur Mitgliedsnummer, BC-Name und Spitzname speichern. Minimal, zeigt Namen von Offline-Freunden.', FR: 'Enregistrer seulement le numéro, le nom BC et le surnom. Peu d\'espace, affiche les noms d\'amis hors ligne.', RU: 'Сохранять только номер, имя BC и никнейм. Минимум места, для имён офлайн-друзей.', UA: 'Зберігати лише номер, ім\'я BC і нікнейм. Мінімум місця, для імен офлайн-друзів.' },
        'saveModeDesc_avatar': { TW: '額外儲存頭像快照（在遇見時自動擷取，儲存於獨立的 FCM-Snapshot 資料庫）。', CN: '额外保存头像快照（在遇见时自动截取，保存于独立的 FCM-Snapshot 数据库）。', EN: 'Also save avatar snapshot (auto-captured when encountered, stored in separate FCM-Snapshot DB).', DE: 'Zusätzlich Avatar-Schnappschuss speichern (bei Begegnung erfasst, in separater FCM-Snapshot-DB).', FR: 'Enregistrer aussi l\'avatar (capturé lors d\'une rencontre, dans une BD FCM-Snapshot séparée).', RU: 'Также сохранять снимок аватара (при встрече, в отдельной БД FCM-Snapshot).', UA: 'Також зберігати знімок аватара (при зустрічі, в окремій БД FCM-Snapshot).' },
        'saveModeDesc_full': { TW: '完整儲存：名稱、暱稱、外觀/BIO/稱號等。與 WCE bce-past-profiles 資料庫完全相容，互相共用。頭像另存於 FCM-Snapshot。', CN: '完整保存：名称、昵称、外观/BIO/称号等。与 WCE bce-past-profiles 数据库完全兼容，互相共用。头像另存于 FCM-Snapshot。', EN: 'Full save: name, nickname, appearance/BIO/title etc. Fully compatible with WCE bce-past-profiles DB. Avatars stored separately in FCM-Snapshot.', DE: 'Vollständig: Name, Spitzname, Aussehen/BIO/Titel usw. Voll kompatibel mit WCE bce-past-profiles-DB. Avatare separat in FCM-Snapshot.', FR: 'Complet : nom, surnom, apparence/BIO/titre, etc. Totalement compatible avec la BD WCE bce-past-profiles. Avatars stockés dans FCM-Snapshot.', RU: 'Полностью: имя, ник, внешность/BIO/титул и т.д. Полная совместимость с БД WCE bce-past-profiles. Аватары — в FCM-Snapshot.', UA: 'Повністю: ім\'я, нік, зовнішність/BIO/титул тощо. Повна сумісність з БД WCE bce-past-profiles. Аватари — у FCM-Snapshot.' },
        'wceDetected': { TW: '✅ 偵測到 WCE Profiles 功能，已自動設為完整資料模式（與 WCE 共用同一個 DB，避免衝突）', CN: '✅ 检测到 WCE Profiles 功能，已自动设为完整资料模式（与 WCE 共用同一个 DB，避免冲突）', EN: '✅ WCE Profiles detected — auto-set to Full mode (shared DB, no conflicts)', DE: '✅ WCE-Profile erkannt — automatisch auf Vollmodus gesetzt (gemeinsame DB, keine Konflikte)', FR: '✅ Profils WCE détectés — mode Complet auto (BD partagée, sans conflit)', RU: '✅ Обнаружены профили WCE — авто-режим «Полный» (общая БД, без конфликтов)', UA: '✅ Виявлено профілі WCE — авто-режим «Повний» (спільна БД, без конфліктів)' },
        'wceNotDetected': { TW: '未偵測到 WCE。建議若只需顯示名稱則選「僅名稱」，需要頭像則選「名稱與頭像」。', CN: '未检测到 WCE。建议若只需显示名称则选「仅名称」，需要头像则选「名称与头像」。', EN: 'WCE not detected. Use Name-only for minimal storage, or Name+Avatar if you want portraits.', DE: 'WCE nicht erkannt. „Nur Name" für minimalen Speicher, „Name+Avatar" für Porträts.', FR: 'WCE non détecté. « Nom seul » pour un stockage minimal, « Nom+avatar » pour les portraits.', RU: 'WCE не обнаружен. «Только имя» для минимума, «Имя+аватар» для портретов.', UA: 'WCE не виявлено. «Лише ім\'я» для мінімуму, «Ім\'я+аватар» для портретів.' },

        // ── 匯出 / 匯入 ──────────────────────────────────────────────
        'exportProfiles': { TW: '匯出 Profiles', CN: '导出 Profiles', EN: 'Export Profiles', DE: 'Profile exportieren', FR: 'Exporter les profils', RU: 'Экспорт профилей', UA: 'Експорт профілів' },
        'exportNote': { TW: '匯出為 JSON（與 WCE 格式相容）', CN: '导出为 JSON（与 WCE 格式兼容）', EN: 'Export as JSON (WCE-compatible format)', DE: 'Als JSON exportieren (WCE-kompatibel)', FR: 'Exporter en JSON (compatible WCE)', RU: 'Экспорт в JSON (совместим с WCE)', UA: 'Експорт у JSON (сумісно з WCE)' },
        'importProfiles': { TW: '匯入 Profiles', CN: '导入 Profiles', EN: 'Import Profiles', DE: 'Profile importieren', FR: 'Importer les profils', RU: 'Импорт профилей', UA: 'Імпорт профілів' },
        'importNote': { TW: '從 JSON 匯入（相同 ID 以較新的 seen 時間為準）', CN: '从 JSON 导入（相同 ID 以较新的 seen 时间为准）', EN: 'Import from JSON (newer seen timestamp wins on conflict)', DE: 'Aus JSON importieren (bei Konflikt gewinnt neuerer Zeitstempel)', FR: 'Importer depuis JSON (le plus récent l\'emporte en cas de conflit)', RU: 'Импорт из JSON (при конфликте побеждает более новая метка)', UA: 'Імпорт з JSON (при конфлікті перемагає новіша мітка)' },
        'exportDone': { TW: '✓ 已匯出 {0} 筆 profiles', CN: '✓ 已导出 {0} 条 profiles', EN: '✓ Exported {0} profiles', DE: '✓ {0} Profile exportiert', FR: '✓ {0} profils exportés', RU: '✓ Экспортировано профилей: {0}', UA: '✓ Експортовано профілів: {0}' },

        // ── Profiles 列表 ────────────────────────────────────────────
        'profilesTitle': { TW: '已儲存的 Profiles', CN: '已保存的 Profiles', EN: 'Saved Profiles', DE: 'Gespeicherte Profile', FR: 'Profils enregistrés', RU: 'Сохранённые профили', UA: 'Збережені профілі' },
        'profilesHint': { TW: '點擊開啟角色資訊', CN: '点击打开角色信息', EN: 'Click to open character info', DE: 'Klicken für Charakter-Info', FR: 'Cliquer pour ouvrir la fiche', RU: 'Нажмите, чтобы открыть профиль', UA: 'Натисніть, щоб відкрити профіль' },
        'profilesEmpty': { TW: '沒有符合條件的 profiles', CN: '没有符合条件的 profiles', EN: 'No matching profiles', DE: 'Keine passenden Profile', FR: 'Aucun profil correspondant', RU: 'Нет подходящих профилей', UA: 'Немає відповідних профілів' },
        'profilesTotal': { TW: '顯示 {0} / 共 {1} 筆', CN: '显示 {0} / 共 {1} 条', EN: 'Showing {0} of {1}', DE: 'Zeige {0} von {1}', FR: 'Affichage de {0} sur {1}', RU: 'Показано {0} из {1}', UA: 'Показано {0} з {1}' },
        'searchProfiles': { TW: '搜尋名稱或ID...', CN: '搜索名称或ID...', EN: 'Search name or ID...', DE: 'Name oder ID suchen...', FR: 'Chercher nom ou ID...', RU: 'Поиск по имени или ID...', UA: 'Пошук за іменем або ID...' },

        // ── 人員查詢 ─────────────────────────────────────────────────
        'peopleSearchPlaceholder': { TW: '輸入名稱或 ID，按 Enter 搜尋...', CN: '输入名称或 ID，按 Enter 搜索...', EN: 'Name or ID — press Enter to search...', DE: 'Name oder ID — Enter zum Suchen...', FR: 'Nom ou ID — Entrée pour chercher...', RU: 'Имя или ID — Enter для поиска...', UA: 'Ім\'я або ID — Enter для пошуку...' },
        'peopleSearchHint': { TW: '顯示最近見過的 100 人 · 輸入後按 Enter 或點「搜尋」', CN: '显示最近见过的 100 人 · 输入后按 Enter 或点「搜索」', EN: 'Showing last 100 encountered · type then press Enter or click Search', DE: 'Zeigt die letzten 100 Begegnungen · tippen und Enter oder Suchen klicken', FR: 'Affiche les 100 dernières rencontres · saisir puis Entrée ou cliquer Chercher', RU: 'Показаны последние 100 встреч · введите и нажмите Enter или «Поиск»', UA: 'Показано останні 100 зустрічей · введіть і натисніть Enter або «Пошук»' },
        'peopleNoResults': { TW: '沒有找到符合的人員', CN: '没有找到符合的人员', EN: 'No matching people found', DE: 'Keine passenden Personen gefunden', FR: 'Aucune personne correspondante', RU: 'Подходящих людей не найдено', UA: 'Відповідних людей не знайдено' },
        'peopleUnknownId': { TW: '請問您是否在搜尋 #{0}？你並無該人員資料', CN: '请问您是否在搜索 #{0}？你并无该人员资料', EN: 'Did you mean #{0}? No record found for this ID.', DE: 'Meintest du #{0}? Kein Eintrag für diese ID gefunden.', FR: 'Vouliez-vous dire #{0} ? Aucun enregistrement pour cet ID.', RU: 'Вы искали #{0}? Записей для этого ID не найдено.', UA: 'Ви шукали #{0}? Записів для цього ID не знайдено.' },
        'peopleSimilarIds': { TW: '包含此數字的相似 ID：', CN: '包含此数字的相似 ID：', EN: 'Similar IDs containing this number:', DE: 'Ähnliche IDs mit dieser Zahl:', FR: 'ID similaires contenant ce nombre :', RU: 'Похожие ID с этим числом:', UA: 'Схожі ID з цим числом:' },
        'peopleUnknownName': { TW: '名稱未知', CN: '名称未知', EN: 'Name unknown', DE: 'Name unbekannt', FR: 'Nom inconnu', RU: 'Имя неизвестно', UA: 'Ім\'я невідоме' },
        'peopleOneSidedWarn': { TW: '⚠ 提醒：此操作為單方面添加。如果有需要，請您主動通知對方。', CN: '⚠ 提醒：此操作为单方面添加。如果有需要，请您主动通知对方。', EN: '⚠ Note: This action is a one-way addition. If necessary, please notify the other party yourself.', DE: '⚠ Hinweis: Dies ist eine einseitige Aktion. Bei Bedarf informiere die andere Person selbst.', FR: '⚠ Note : action unilatérale. Si nécessaire, prévenez l\'autre personne vous-même.', RU: '⚠ Внимание: это одностороннее добавление. При необходимости уведомите другого сами.', UA: '⚠ Увага: це одностороннє додавання. За потреби повідомте іншого самі.' },
        'peopleTotal': { TW: '顯示 {0} / 共 {1} 筆', CN: '显示 {0} / 共 {1} 条', EN: 'Showing {0} of {1}', DE: 'Zeige {0} von {1}', FR: 'Affichage de {0} sur {1}', RU: 'Показано {0} из {1}', UA: 'Показано {0} з {1}' },

        // ── 分享 ─────────────────────────────────────────────────────
        'colShare': { TW: '分享', CN: '分享', EN: 'Share', DE: 'Teilen', FR: 'Partager', RU: 'Поделиться', UA: 'Поділитися' },
        'btnShare': { TW: '分享', CN: '分享', EN: 'Share', DE: 'Teilen', FR: 'Partager', RU: 'Поделиться', UA: 'Поділитися' },
        'shareLocalMsg': { TW: '📜 已分享 {0} ({1}) 的 Profile', CN: '📜 已分享 {0} ({1}) 的 Profile', EN: '📜 Shared profile: {0} ({1})', DE: '📜 Profil geteilt: {0} ({1})', FR: '📜 Profil partagé : {0} ({1})', RU: '📜 Профиль отправлен: {0} ({1})', UA: '📜 Профіль надіслано: {0} ({1})' },
        'shareRecvMsg': { TW: '📜 {0} 分享了 {1} 保存於: {2}', CN: '📜 {0} 分享了 {1} 保存于: {2}', EN: '📜 {0} shared a profile: {1} saved: {2}', DE: '📜 {0} teilte ein Profil: {1} gespeichert: {2}', FR: '📜 {0} a partagé un profil : {1} enregistré : {2}', RU: '📜 {0} поделился профилем: {1} сохранён: {2}', UA: '📜 {0} поділився профілем: {1} збережено: {2}' },
        'shareOpen': { TW: '▶ 開啟', CN: '▶ 打开', EN: '▶ Open', DE: '▶ Öffnen', FR: '▶ Ouvrir', RU: '▶ Открыть', UA: '▶ Відкрити' },

        // ── 設定：私聊頭像 / OOC / 按鈕顯示 ─────────────────────────
        'whisperAvatarLabel': { TW: '私聊時顯示對象頭像', CN: '私聊时显示对象头像', EN: 'Show target avatar during whisper', DE: 'Ziel-Avatar beim Flüstern zeigen', FR: 'Afficher l\'avatar de la cible en chuchotement', RU: 'Показывать аватар при шёпоте', UA: 'Показувати аватар при шепоті' },
        'whisperAvatarNote': { TW: '進入悄悄話/BEEP 模式時，在輸入框旁顯示對象的頭像', CN: '进入悄悄话/BEEP 模式时，在输入框旁显示对象的头像', EN: "Displays the target's avatar near the chat input when in whisper/BEEP mode", DE: 'Zeigt den Avatar des Ziels neben der Eingabe im Flüster-/BEEP-Modus', FR: "Affiche l'avatar de la cible près de la saisie en mode chuchotement/BEEP", RU: 'Показывает аватар цели рядом с полем ввода в режиме шёпота/BEEP', UA: 'Показує аватар цілі біля поля вводу в режимі шепоту/BEEP' },
        'oocProtectLabel': { TW: 'OOC 保護（悄悄話時停用 Ctrl+Enter）', CN: 'OOC 保护（悄悄话时停用 Ctrl+Enter）', EN: 'OOC Protection (block Ctrl+Enter during whisper)', DE: 'OOC-Schutz (Strg+Enter beim Flüstern blockieren)', FR: 'Protection OOC (bloquer Ctrl+Entrée en chuchotement)', RU: 'OOC-защита (блокировать Ctrl+Enter при шёпоте)', UA: 'OOC-захист (блокувати Ctrl+Enter при шепоті)' },
        'oocProtectNote': { TW: '悄悄話/BEEP 模式下，封鎖 Ctrl+Enter 以防止 OOC 內容作為普通對話發出', CN: '悄悄话/BEEP 模式下，封锁 Ctrl+Enter 以防止 OOC 内容作为普通对话发出', EN: 'In whisper/BEEP mode, blocks Ctrl+Enter to prevent OOC content from being sent as normal chat', DE: 'Blockiert im Flüster-/BEEP-Modus Strg+Enter, damit OOC-Inhalt nicht als normaler Chat gesendet wird', FR: 'En mode chuchotement/BEEP, bloque Ctrl+Entrée pour éviter d\'envoyer du contenu OOC en chat normal', RU: 'В режиме шёпота/BEEP блокирует Ctrl+Enter, чтобы OOC не ушёл в обычный чат', UA: 'У режимі шепоту/BEEP блокує Ctrl+Enter, щоб OOC не пішов у звичайний чат' },
        'btnVisibilityLabel': { TW: '按鈕顯示設定', CN: '按钮显示设置', EN: 'Button Visibility', DE: 'Schaltflächen-Sichtbarkeit', FR: 'Visibilité des boutons', RU: 'Видимость кнопок', UA: 'Видимість кнопок' },
        'btnVisibilityNote': { TW: '控制 FCM 按鈕在各頁面的顯示狀態（至少須保留一個）', CN: '控制 FCM 按钮在各页面的显示状态（至少须保留一个）', EN: 'Control which screens show the FCM button (at least one must remain enabled)', DE: 'Legt fest, auf welchen Bildschirmen die FCM-Schaltfläche erscheint (mindestens eine aktiv)', FR: 'Contrôle sur quels écrans le bouton FCM apparaît (au moins un actif)', RU: 'Где показывать кнопку FCM (хотя бы одна должна остаться включённой)', UA: 'Де показувати кнопку FCM (хоча б одна має лишитися увімкненою)' },
        'btnShowChatRoom': { TW: '聊天室按鈕', CN: '聊天室按钮', EN: 'ChatRoom button', DE: 'Raum-Schaltfläche', FR: 'Bouton salon', RU: 'Кнопка в комнате', UA: 'Кнопка в кімнаті' },
        'btnShowMainHall': { TW: '大廳按鈕', CN: '大厅按钮', EN: 'Main Hall button', DE: 'Haupthallen-Schaltfläche', FR: 'Bouton hall principal', RU: 'Кнопка в холле', UA: 'Кнопка в холі' },
        'btnShowProfile': { TW: '個人檔案按鈕', CN: '个人档案按钮', EN: 'Profile button', DE: 'Profil-Schaltfläche', FR: 'Bouton profil', RU: 'Кнопка профиля', UA: 'Кнопка профілю' },

        // ── Profile 關係人快速搜尋（新功能）──────────────────────────
        'profileRelLabel': { TW: 'Profile 關係人快速搜尋', CN: 'Profile 关系人快速搜索', EN: 'Quick Search Profile Relations', DE: 'Schnellsuche für Profil-Beziehungen', FR: 'Recherche rapide des relations du profil', RU: 'Быстрый поиск связей профиля', UA: 'Швидкий пошук зв\'язків профілю' },
        'profileRelNote': { TW: '查看角色資料頁時，將主人／戀人等關係人的 ID 做成按鈕，點擊即開啟 FCM 人員查詢並帶入該 ID', CN: '查看角色资料页时，将主人／恋人等关系人的 ID 做成按钮，点击即打开 FCM 人员查询并带入该 ID', EN: 'On a character profile page, turn related people (owner/lovers) IDs into buttons — click to open FCM People search prefilled with that ID', DE: 'Wandelt auf einer Charakter-Profilseite die IDs verwandter Personen (Besitzer/Geliebte) in Schaltflächen um — Klick öffnet die FCM-Personensuche mit dieser ID', FR: 'Sur une fiche de personnage, transforme les ID des relations (maître/amants) en boutons — cliquer ouvre la recherche FCM préremplie avec cet ID', RU: 'На странице профиля превращает ID связанных людей (владелец/возлюбленные) в кнопки — клик открывает поиск людей FCM с этим ID', UA: 'На сторінці профілю перетворює ID пов\'язаних людей (власник/кохані) на кнопки — клік відкриває пошук людей FCM із цим ID' },
        'profileRelTitle': { TW: '🔍 關係人快速查詢', CN: '🔍 关系人快速查询', EN: '🔍 Quick Relation Lookup', DE: '🔍 Schnelle Beziehungssuche', FR: '🔍 Recherche rapide de relations', RU: '🔍 Быстрый поиск связей', UA: '🔍 Швидкий пошук зв\'язків' },
        'noBeepNotFriend': { TW: '非好友，無法私信', CN: '非好友，无法私信', EN: 'Not a friend — cannot BEEP', DE: 'Kein Freund — BEEP nicht möglich', FR: 'Pas un ami — BEEP impossible', RU: 'Не друг — BEEP недоступен', UA: 'Не друг — BEEP недоступний' },
    };

    window.Liko.i18n.register('FCM', FCM_STRINGS);
    window.Liko._FCM_strings = FCM_STRINGS;   // 供 FCM 自行依使用者選的語言查表
    if (window.Liko?.i18n) window.Liko.i18n._fcmStringsLoaded = true;
})();
