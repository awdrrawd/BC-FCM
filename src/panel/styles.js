import { cfg, THEME_DEFAULTS } from '../core/config.js';
// ════════════════════════════════════════
//  FCM module: styles.js
//  (split from Plugins/liko-FCM.user.js)
// ════════════════════════════════════════

    // ── 主題顏色覆蓋 ─────────────────────────────────────────────
    //  由三個基色（面板底色 / 字體顏色 / 強調色）以 color-mix 推導出整套深淺色，
    //  注入一份 id="fcm-theme" 的覆蓋樣式；三者皆為預設時移除覆蓋、保留原生配色。
    //  ★ 語意化的關係／權限標籤與彩色按鈕（紅／綠／紫…）刻意不覆蓋，維持辨識度。
    function applyTheme() {
        const p = (cfg && cfg.panelColor)  || THEME_DEFAULTS.panelColor;
        const t = (cfg && cfg.fontColor)   || THEME_DEFAULTS.fontColor;
        const a = (cfg && cfg.accentColor) || THEME_DEFAULTS.accentColor;
        let el = document.getElementById('fcm-theme');
        if (!el) { el = document.createElement('style'); el.id = 'fcm-theme'; document.head.appendChild(el); }
        const mix = (c1, pct, c2) => `color-mix(in srgb, ${c1} ${pct}%, ${c2})`;
        const presetTokens = {
            violet: ['#13101a','#322744','#2c2140','#2a2338','#9c93b8'],
            eu: ['#1e2636','#262f44','#303a54','#2f3a52','#aab2c9'],
            electronic: ['#10161d','#16202b','#17324a','#1c2a33','#6f8a99'],
            jp: ['#efe8d8','#e6ddc8','#ded1b2','#d8cdb3','#7a7266'],
            cn: ['#241a17','#2e211d','#3a2620','#4a332b','#b8a58f'],
            silentblack: ['#121212','#1c1c1c','#262626','#232323','#7a7a7a'],
            minimalwhite: ['#f2f2f2','#ececec','#e2e2e2','#e0e0e0','#8a8a8a'],
        };
        const preset = presetTokens[cfg?.themePreset];
        const colorScheme = ['jp', 'minimalwhite'].includes(cfg?.themePreset) ? 'light' : 'dark';
        const panel2     = preset?.[3] || mix(p, 88, '#000');
        const panel1     = preset?.[0] || mix(p, 80, '#000');
        const panelRaised = preset?.[1] || mix(p, 82, a);
        const panelSelected = preset?.[2] || mix(p, 72, a);
        const panelHead  = mix(p, 78, a);               // 帶強調色的表頭
        const rowHover   = panelRaised;                 // 列 hover
        const inputBg    = mix(p, 70, '#000');          // 輸入框底
        const border     = preset?.[3] || mix(a, 55, '#000');
        const borderSoft = mix(a, 40, p);               // 柔邊框
        const textDim    = preset?.[4] || mix(t, 62, p);
        const accentB    = mix(a, 72, '#fff');          // 亮強調（標題 / 選中分頁）
        const hdrGrad    = mix(p, 84, a);               // 標題列漸層起點
        // 只主題化「純色」按鈕（查看／悄悄話／重新整理…）；語意化的彩色按鈕
        //  （私訊藍／好友綠／黑單紅／幽靈紫／管理橘…）排除在外，保留辨識色。
        const _plainBtn = ':not(.fcm-btn-red):not(.fcm-btn-green):not(.fcm-btn-purple):not(.fcm-btn-blue):not(.fcm-btn-orange)';
        el.textContent = `
#fcm-panel{background:${p}!important;border-color:${border}!important;color:${t}!important;}
#fcm-mini{background:${p}!important;border-color:${border}!important;color:${textDim}!important;}
#fcm-mini:hover{background:${rowHover}!important;border-color:${a}!important;}
.fcm-mini-pill{background:${border}!important;}
#fcm-hdr{background:linear-gradient(135deg, ${hdrGrad}, ${p})!important;border-bottom-color:${border}!important;}
#fcm-title{color:${accentB}!important;}
.fcm-hbtn{background:${panel1}!important;border-color:${border}!important;color:${textDim}!important;}
.fcm-hbtn:hover{background:${rowHover}!important;color:${accentB}!important;border-color:${a}!important;}
#fcm-tabs{background:${panel1}!important;border-bottom-color:${border}!important;}
.fcm-tab{color:${textDim}!important;}
.fcm-tab:hover{color:${accentB}!important;background:${rowHover}!important;}
.fcm-tab.active{color:${accentB}!important;border-bottom-color:${a}!important;background:${p}!important;}
.fcm-toolbar{background:${panel1}!important;border-bottom-color:${borderSoft}!important;color:${textDim}!important;}
.fcm-nick-tog,.fcm-ftog{background:transparent!important;border-color:${border}!important;color:${textDim}!important;}
.fcm-nick-tog:hover,.fcm-ftog:hover,.fcm-ftog.on{background:${panelSelected}!important;border-color:${a}!important;color:${accentB}!important;}
.fcm-subtabs{background:${panel1}!important;border-bottom-color:${borderSoft}!important;}
.fcm-stab{color:${textDim}!important;}
.fcm-stab.active{color:${accentB}!important;border-bottom-color:${a}!important;}
.fcm-count{background:${panel1}!important;color:${textDim}!important;border-top-color:${panel2}!important;}
.fcm-scroll{background:${p}!important;}
.fcm-tbl th{background:${panelHead}!important;color:${textDim}!important;border-bottom-color:${border}!important;}
.fcm-tbl td{border-bottom-color:${panel2}!important;}
.fcm-row:hover td{background:${rowHover}!important;}
.fcm-row td{border-bottom-color:${border}!important;}
.fcm-name{color:${t}!important;}
.fcm-av{background:${panel1}!important;border-color:${border}!important;color:${a}!important;}
.fcm-you{color:${a}!important;}.fcm-id,.fcm-id-copy{color:${textDim}!important;}.fcm-id-copy:hover{color:${a}!important;}.fcm-zone{color:${accentB}!important;}
.fcm-search{background:${inputBg}!important;border-color:${border}!important;color:${t}!important;}
.fcm-search::placeholder{color:${textDim}!important;}.fcm-clear-btn{color:${textDim}!important;}.fcm-clear-btn:hover{color:${a}!important;}
.fcm-search:hover{border-color:${a}!important;}.fcm-search:focus{background:${panel1}!important;border-color:${a}!important;color:${t}!important;box-shadow:0 0 0 2px color-mix(in srgb, ${a} 24%, transparent)!important;}
.fcm-search::selection{background:${a}!important;color:${p}!important;}
.fcm-sel{background:${inputBg}!important;border-color:${border}!important;color:${t}!important;color-scheme:${colorScheme};}
.fcm-sel:hover,.fcm-sel:focus{border-color:${a}!important;outline:none!important;box-shadow:0 0 0 2px color-mix(in srgb, ${a} 20%, transparent)!important;}
.fcm-sel option{background:${panel1}!important;color:${t}!important;}.fcm-sel option:checked{background:${a}!important;color:${p}!important;}.fcm-sel option:disabled{color:${textDim}!important;}
.fcm-btn${_plainBtn}{background:${p}!important;border-color:${border}!important;color:${textDim}!important;}
.fcm-btn${_plainBtn}:hover{background:${rowHover}!important;border-color:${a}!important;color:${accentB}!important;}
.fcm-set-label{color:${t}!important;}
.fcm-set-note{color:${textDim}!important;}
.fcm-settings-section{color:${accentB}!important;border-bottom-color:${a}!important;}
.fcm-settings-wrap label,.fcm-settings-wrap label span{color:${textDim}!important;}
.fcm-settings-wrap input[type="color"]{background:${panel1}!important;border-color:${border}!important;}
.fcm-avatar-options{background:${panel1}!important;border-color:${border}!important;}
.fcm-set-desc,.fcm-dbstat{background:${panel1}!important;color:${textDim}!important;border-color:${a}!important;}
.fcm-people-hint,.fcm-page-bar{background:${panel1}!important;color:${textDim}!important;border-color:${border}!important;}
.fcm-unknown-id-box,.fcm-help-card{background:${panel1}!important;border-color:${border}!important;color:${textDim}!important;}
.fcm-unknown-id-title{color:${accentB}!important;}
.fcm-help-title{color:${accentB}!important;}.fcm-help-text,.fcm-help-item,.fcm-help-item span{color:${textDim}!important;}.fcm-help-item .fcm-help-dot{color:${a}!important;}.fcm-help-footer{color:${textDim}!important;}
.fcm-toolbar .fcm-lbl-sm{color:${textDim}!important;}
.fcm-color-edit-label{color:${textDim}!important;}.fcm-color-button{border-color:${a}!important;}
.fcm-room-card{border-color:${border}!important;background:transparent!important;}
.fcm-room-card:hover{background:${rowHover}!important;}
.fcm-room-name,.fcm-room-creator{color:${t}!important}.fcm-room-desc,.fcm-room-count{color:${textDim}!important;}
.fcm-room-link,.fcm-room-private{color:${a}!important;border-bottom-color:${a}!important;}.fcm-empty-value,.fcm-empty,.fcm-offline,.fcm-room{color:${textDim}!important;}
.fcm-zone-filter-btn{background:transparent!important;border-color:${border}!important;color:${textDim}!important;}.fcm-zone-filter-btn.active{background:${panelSelected}!important;border-color:${a}!important;color:${accentB}!important;}
.fcm-wce-tag{background:transparent!important;border-color:${a}!important;color:${a}!important;}
.fcm-btn-red,.fcm-btn-green,.fcm-btn-purple,.fcm-btn-blue,.fcm-btn-orange{background:transparent!important;}
.fcm-btn-red:hover,.fcm-btn-green:hover,.fcm-btn-purple:hover,.fcm-btn-blue:hover,.fcm-btn-orange:hover{background:${rowHover}!important;}
.fcm-warn{background:color-mix(in srgb, ${a} 50%, transparent)!important;color:${t}!important;border-color:${border}!important;text-align:center!important;}
#fcm-panel input[type="checkbox"]{accent-color:${a}!important;}
#fcm-panel *{scrollbar-color:${a} ${panelRaised};scrollbar-width:auto;}
#fcm-panel *::-webkit-scrollbar{width:10px;height:10px;}#fcm-panel *::-webkit-scrollbar-track{background:${panelRaised}!important;border-left:1px solid ${border}!important;}#fcm-panel *::-webkit-scrollbar-thumb{background:${a}!important;border:2px solid ${panelRaised}!important;border-radius:7px;}#fcm-panel *::-webkit-scrollbar-thumb:hover{background:${accentB}!important;}
.fcm-overlay{background:rgba(0,0,0,.55)!important;}
.fcm-dialog{background:${p}!important;border-color:${a}!important;color:${t}!important;}
.fcm-dialog div{color:${t}!important;}.fcm-dialog span{color:${textDim}!important;}
.fcm-dialog textarea,.fcm-dialog input{background:${panel1}!important;border-color:${border}!important;color:${t}!important;scrollbar-color:${a} ${panel1};}
.fcm-dialog textarea::placeholder,.fcm-dialog input::placeholder{color:${textDim}!important;}
.fcm-dialog button{background:transparent!important;}.fcm-dialog button:hover{background:${rowHover}!important;}
.fcm-chat-card,.fcm-room-share-message{background:color-mix(in srgb, ${p} 92%, transparent)!important;border-color:${a}!important;color:${t}!important;}
.fcm-chat-card div{color:${t}!important;}.fcm-chat-card span{color:${textDim}!important;}.fcm-chat-card button{background:transparent!important;}
.fcm-room-share-intro,.fcm-room-share-creator,.fcm-room-share-description{color:${textDim}!important;}
.fcm-room-share-name{color:${t}!important;}.fcm-room-share-count{color:${a}!important;}
.fcm-room-share-description{border-color:${border}!important;scrollbar-color:${a} ${panel1};}
.fcm-room-share-badge{background:transparent!important;border-color:${a}!important;color:${a}!important;}
.fcm-room-share-button{background:transparent!important;border-color:${a}!important;color:${a}!important;}.fcm-room-share-button:hover{background:${rowHover}!important;}
.fcm-settings-nav{background:${panel1}!important;border-color:${borderSoft}!important;}
.fcm-settings-nav button{color:${textDim}!important;border-color:${borderSoft}!important;}
.fcm-settings-nav button:hover,.fcm-settings-nav button.active{color:${accentB}!important;border-color:${a}!important;background:${rowHover}!important;}
.fcm-theme-presets .fcm-btn.active{color:${a}!important;border-color:${a}!important;background:${panelSelected}!important;box-shadow:0 0 0 1px ${a} inset!important;}
.fcm-settings-wrap::-webkit-scrollbar-track,.fcm-scroll::-webkit-scrollbar-track{background:${panelRaised}!important;}
.fcm-settings-wrap::-webkit-scrollbar-thumb,.fcm-scroll::-webkit-scrollbar-thumb{background:${a}!important;border-color:${panelRaised}!important;}
.fcm-tog.on{background:${mix(a, 38, p)}!important;border-color:${a}!important;}
.fcm-tog.on .fcm-tog-dot{background:${accentB}!important;}
.fcm-tog{background:${panel1}!important;border-color:${border}!important;}.fcm-tog .fcm-tog-dot{background:${textDim}!important;}
`;
        window.dispatchEvent(new CustomEvent('fcm-theme-change'));
    }

    function injectStyles() {
        if (document.getElementById('fcm-css')) return;
        const s = document.createElement('style'); s.id = 'fcm-css';
        s.textContent = `
#fcm-panel,#fcm-panel *{box-sizing:border-box;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;}
#fcm-panel *{user-select:none;} #fcm-panel input,#fcm-panel textarea{user-select:text!important;}
#fcm-panel{position:fixed;top:50%;left:50%;transform:translate(-50%,-50%);width:min(1050px,96vw);height:min(650px,92vh);
  background:#1a1821;border:2px solid #7648fe;border-radius:14px;box-shadow:0 12px 60px rgba(0,0,0,.75);z-index:99990;display:flex;flex-direction:column;overflow:hidden;}
#fcm-panel.hidden{display:none!important;}
#fcm-mini{position:fixed;bottom:16px;left:50%;transform:translateX(-50%);width:220px;height:40px;background:#1e1635;border:2px solid #5a48a8;border-radius:20px;display:none;align-items:center;justify-content:center;gap:10px;cursor:pointer;z-index:99990;color:#c4a0e0;font-size:12px;transition:all .15s;}
#fcm-mini.visible{display:flex;} #fcm-mini:hover{border-color:#b090f0;background:#261a48;}
.fcm-mini-pill{width:32px;height:4px;background:#5a48a8;border-radius:2px;}
.fcm-mini-lbl{font-size:9px;color:#8068a8;letter-spacing:1.2px;}
#fcm-hdr{background:linear-gradient(135deg,#2a2050,#1e1635);padding:10px 16px;display:flex;align-items:center;gap:8px;border-bottom:1px solid #4a3890;cursor:move;flex-shrink:0;min-height:46px;}
#fcm-title{color:#e8c8ff;font-size:13px;letter-spacing:2px;font-weight:700;flex:1;}
.fcm-hbtn{width:28px;height:28px;border-radius:50%;background:#261a40;border:1px solid #5a48a8;color:#c4a0e0;cursor:pointer;display:flex;align-items:center;justify-content:center;font-size:17px;line-height:1;transition:all .15s;flex-shrink:0;}
.fcm-hbtn:hover{background:#3a2860;color:#f0d8ff;border-color:#9070d8;}
#fcm-tabs{display:flex;background:#1a1230;border-bottom:1px solid #4a3890;flex-shrink:0;}
.fcm-tab{padding:10px 22px;color:#7060a0;cursor:pointer;font-size:11px;letter-spacing:1.2px;font-weight:700;border-bottom:2px solid transparent;transition:all .15s;}
.fcm-tab:hover{color:#c4a0e0;background:#211540;} .fcm-tab.active{color:#e0b8ff;border-bottom-color:#a078e8;background:#1e1438;}
#fcm-content{flex:1;overflow:hidden;display:flex;flex-direction:column;min-height:0;}
.fcm-toolbar{padding:8px 14px;display:flex;align-items:center;gap:6px;flex-wrap:nowrap;border-bottom:1px solid #362858;flex-shrink:0;background:#211540;overflow-x:auto;}
.fcm-search-wrap{position:relative;display:inline-flex;align-items:center;width:min(200px,35vw);flex-shrink:0;}
.fcm-search{background:#1a1030;border:1px solid #5048a0;border-radius:8px;padding:6px 26px 6px 10px;color:#f0e4ff;font-size:12px;width:100%;outline:none;transition:border-color .15s;}
.fcm-search:focus{border-color:#9078d0;} .fcm-search::placeholder{color:#5a4878;}
.fcm-clear-btn{position:absolute;right:6px;background:none;border:none;color:#6050a0;cursor:pointer;font-size:15px;padding:0 2px;line-height:1;transition:color .15s;}
.fcm-clear-btn:hover{color:#f0d8ff;}
.fcm-sel{background:#1a1030;border:1px solid #5048a0;border-radius:8px;padding:5px 6px;color:#c4a0e0;font-size:11px;outline:none;cursor:pointer;max-width:110px;flex-shrink:0;}
.fcm-sel option{background:#1a1030;}
.fcm-lbl-sm{font-size:10px;color:#6050a0;letter-spacing:1px;font-weight:700;white-space:nowrap;flex-shrink:0;}
.fcm-spacer{flex:1;}
.fcm-ftog{padding:3px 10px;border-radius:12px;border:1px solid #4838a0;background:transparent;color:#6058a0;font-size:10px;cursor:pointer;transition:all .15s;font-weight:700;white-space:nowrap;flex-shrink:0;}
.fcm-ftog:hover{color:#c4a0e0;border-color:#8068c0;} .fcm-ftog.on{background:#301c58;border-color:#b088e8;color:#e0c0ff;}
.fcm-nick-tog{padding:3px 10px;border-radius:12px;border:1px solid #4838a0;background:#301c58;color:#e0c0ff;font-size:10px;cursor:pointer;font-weight:700;white-space:nowrap;flex-shrink:0;transition:all .15s;}
.fcm-nick-tog:hover{border-color:#b088e8;}
.fcm-subtabs{display:flex;background:#1a1230;border-bottom:1px solid #362858;flex-shrink:0;padding:0 10px;}
.fcm-stab{padding:7px 18px;color:#5a4880;cursor:pointer;font-size:10px;letter-spacing:1px;font-weight:700;border-bottom:2px solid transparent;transition:all .15s;}
.fcm-stab:hover{color:#c4a0e0;} .fcm-stab.active{color:#d0a8f8;border-bottom-color:#a078e8;}
.fcm-scroll-wrap{flex:1;display:flex;flex-direction:column;min-height:0;overflow:hidden;}
.fcm-scroll{flex:1;overflow-y:auto;overflow-x:auto;min-height:0;}
.fcm-scroll::-webkit-scrollbar{width:5px;height:5px;}
.fcm-scroll::-webkit-scrollbar-track{background:#1a1030;}
.fcm-scroll::-webkit-scrollbar-thumb{background:#7648fe;border-radius:3px;}
.fcm-count{font-size:11px;color:#9080b8;padding:6px 14px;background:#1a1230;border-top:1px solid #2a2048;letter-spacing:1px;flex-shrink:0;text-align:center;}
.fcm-tbl{width:100%;border-collapse:collapse;font-size:12px;table-layout:fixed;}
.fcm-tbl th{background:#261a4a;color:#c4a0e0;font-size:10px;letter-spacing:1.2px;padding:9px 10px;text-align:center;border-bottom:2px solid #4a3890;font-weight:700;white-space:nowrap;position:sticky;top:0;z-index:2;}
.fcm-tbl th.fcm-th-left{text-align:left;}
.fcm-tbl th.fcm-th-mgmt{color:#f0a060;} .fcm-tbl th.fcm-th-mgmt-off{color:#6050a0;}
.fcm-tbl td{padding:6px 10px;border-bottom:1px solid #2a2048;vertical-align:middle;white-space:nowrap;}
.fcm-row:hover td{background:#2e2258;}
.fcm-td-mgmt.no-perm{opacity:0.4;pointer-events:none;}
.fcm-avwrap{display:flex;align-items:center;gap:5px;}
.fcm-fav{cursor:pointer;font-size:15px;line-height:1;color:#5a4878;flex-shrink:0;transition:color .15s;}
.fcm-fav.on{color:#f0c040;} .fcm-fav:hover{color:#ffd860;}
.fcm-av{width:36px;height:36px;border-radius:8px;background:#201838;border:1px solid #4a3890;overflow:hidden;display:flex;align-items:center;justify-content:center;font-size:11px;color:#a080c8;flex-shrink:0;font-weight:700;}
.fcm-av img{width:36px;height:36px;object-fit:cover;display:block;border-radius:7px;}
.fcm-name{color:#f0e4ff;font-size:12px;font-weight:600;max-width:130px;overflow:hidden;text-overflow:ellipsis;}
.fcm-id{color:#7060a0;font-size:11px;}
.fcm-id-copy{cursor:pointer;transition:color .15s;} .fcm-id-copy:hover{color:#c090ff;}
.fcm-sta{font-size:10px;margin-top:2px;}
.fcm-online{color:#50c870;} .fcm-offline{color:#7060a0;} .fcm-you{font-size:10px;color:#a080e8;margin-top:2px;}
.fcm-zone{font-size:16px;color:#d0a8f0;text-align:center;}
.fcm-room{font-size:12px;color:#9878b8;}
.fcm-room-link{font-size:13px;color:#7090f8;cursor:pointer;font-weight:600;display:inline-block;max-width:118px;overflow:hidden;text-overflow:ellipsis;border-bottom:1px dotted #7090f8;transition:color .15s;vertical-align:middle;}
.fcm-room-link:hover{color:#b0c8ff;border-bottom-color:#b0c8ff;}
.fcm-rel{font-size:10px;font-weight:800;padding:2px 10px;border-radius:10px;display:inline-block;white-space:nowrap;}
.fcm-rel-owner  {background:#2a0808;color:#ff8888;border:1px solid #801818;}
.fcm-rel-lover  {background:#28082a;color:#ff9ae0;border:1px solid #801868;}
.fcm-rel-sub    {background:#082018;color:#60e0b0;border:1px solid #106040;}
.fcm-rel-friend {background:#08102a;color:#88c8ff;border:1px solid #184880;}
.fcm-rel-contact  {background:#1c1830;color:#a890c8;border:1px solid #483868;}
.fcm-rel-whitelist{background:#0d2a1a;color:#60d090;border:1px solid #208050;font-size:9px;padding:1px 5px;}
.fcm-rel-blacklist{background:#2a0d0d;color:#d07070;border:1px solid #802020;font-size:9px;padding:1px 5px;}
.fcm-rel-ghost    {background:#1a1a1a;color:#909090;border:1px solid #505050;font-size:9px;padding:1px 5px;}
.fcm-perms{display:flex;gap:3px;flex-wrap:wrap;justify-content:center;}
.fcm-perm{font-size:10px;padding:2px 8px;border-radius:6px;font-weight:800;white-space:nowrap;}
.fcm-perm-admin{background:#280808;color:#ff7060;border:1px solid #801010;}
.fcm-perm-pass {background:#082018;color:#50d880;border:1px solid #105030;}
.fcm-perm-ban  {background:#1c1c1c;color:#888888;border:1px solid #444444;}
.fcm-perm-visit{background:#1c1830;color:#9878b8;border:1px solid #483868;}
.fcm-btns{display:flex;gap:3px;flex-wrap:nowrap;align-items:center;}
.fcm-btn{padding:3px 6px;border-radius:6px;border:1px solid #4838a0;background:#1e1635;color:#b098d0;font-size:10px;cursor:pointer;transition:all .15s;white-space:nowrap;font-weight:600;}
.fcm-btn:hover{background:#2a1e50;border-color:#9070c8;color:#e8d0ff;}
.fcm-btn:disabled{opacity:.35;cursor:not-allowed;pointer-events:none;}
.fcm-btn-red   {border-color:#801010;color:#f08080;}.fcm-btn-red:hover{background:#2a0808;border-color:#d04040;color:#ffb0b0;}
.fcm-btn-purple{border-color:#7030b8;color:#c080f0;}.fcm-btn-purple:hover{background:#2a1040;border-color:#c080f0;}
.fcm-btn-blue  {border-color:#184888;color:#80c8ff;}.fcm-btn-blue:hover{background:#0a1e38;border-color:#4098d8;color:#c0e8ff;}
.fcm-btn-green {border-color:#104830;color:#60d890;}.fcm-btn-green:hover{background:#081e10;border-color:#30b858;color:#a0ffc0;}
.fcm-btn-orange{border-color:#604010;color:#f0a050;}.fcm-btn-orange:hover{background:#281808;border-color:#c06820;color:#ffc880;}
.fcm-empty{padding:50px;text-align:center;color:#4a3870;font-size:12px;letter-spacing:1px;}
.fcm-warn{padding:8px 16px;font-size:11px;color:#f0a060;background:#20100a;border-bottom:1px solid #601c08;flex-shrink:0;}
.fcm-onesided-warn{padding:8px 14px;font-size:11px;color:#e8a040;background:#1e1205;border:1px solid #604010;border-radius:6px;margin:8px 14px;line-height:1.5;}
.fcm-settings-wrap{padding:16px 24px;display:flex;flex-direction:column;gap:6px;overflow-y:auto;}
.fcm-settings-wrap::-webkit-scrollbar{width:7px}.fcm-settings-wrap::-webkit-scrollbar-track{background:#111016}.fcm-settings-wrap::-webkit-scrollbar-thumb{background:#7648fe;border-radius:5px}
.fcm-settings-nav{position:sticky;top:-16px;z-index:5;display:flex;gap:8px;padding:10px 24px;background:#1a1821;border-bottom:1px solid #332b50;margin:-16px -24px 4px;width:calc(100% + 48px);}
.fcm-settings-nav button{flex:1;padding:8px 12px;border-radius:8px;border:1px solid #40366c;background:transparent;color:#aaa1c4;font-weight:700;cursor:pointer;}
.fcm-settings-section{scroll-margin-top:58px;}
.fcm-theme-presets{display:flex;gap:8px;flex-wrap:wrap;margin-top:10px}.fcm-theme-presets .fcm-btn{font-size:12px;padding:6px 10px}
.fcm-set-row{display:flex;align-items:flex-start;gap:14px;padding:3px 0;}
.fcm-tog{width:42px;height:22px;border-radius:11px;border:1px solid #4838a0;background:#1a1030;cursor:pointer;position:relative;transition:all .2s;flex-shrink:0;margin-top:2px;margin-right:4px;}
.fcm-tog.on{background:#3a1858;border-color:#b080e8;}
.fcm-tog-dot{position:absolute;top:3px;left:3px;width:14px;height:14px;border-radius:50%;background:#4838a8;transition:all .2s;}
.fcm-tog.on .fcm-tog-dot{left:23px;background:#d090f8;}
.fcm-set-label{color:#e8d4ff;font-size:15px;font-weight:600;}
.fcm-set-note{color:#a090c8;font-size:12px;margin-top:5px;line-height:1.6;}
.fcm-set-desc{color:#a090c8;font-size:12px;margin-top:6px;padding:8px 12px;background:#1a1030;border-radius:6px;border-left:2px solid #5048a0;line-height:1.6;}
.fcm-settings-wrap .fcm-sel{max-width:none;width:auto;font-size:12px;padding:6px 10px;flex-shrink:0;}
.fcm-tab-disabled{opacity:0.4;cursor:not-allowed !important;}
.fcm-tab-disabled:hover{color:#7060a0 !important;background:transparent !important;}
.fcm-dbstat{font-size:12px;color:#8070a8;padding:10px 14px;background:#1a1030;border-radius:8px;border:1px solid #3a2870;margin-top:4px;}
.fcm-divider{height:1px;background:#2a2048;margin:4px 0;}
.fcm-wce-tag{display:inline-block;font-size:11px;padding:2px 8px;border-radius:10px;margin-left:8px;vertical-align:middle;white-space:nowrap;}
.fcm-wce-tag-yes{background:rgba(16,80,40,.5);border:1px solid #30a060;color:#70e0a0;}
.fcm-reload-status{font-size:11px;color:#80c090;min-height:0;transition:opacity .3s;}
.fcm-people-hint{padding:10px 16px;font-size:11px;color:#6050a0;background:#1a1230;border-bottom:1px solid #2a2048;letter-spacing:.5px;}
.fcm-unknown-id-box{margin:16px;padding:14px 16px;background:#1a1030;border:1px solid #5a48a8;border-radius:10px;display:flex;flex-direction:column;gap:10px;}
.fcm-unknown-id-title{color:#d0a8f0;font-size:13px;font-weight:700;}
.fcm-seen-date{font-size:10px;color:#6050a0;margin-top:2px;}
.fcm-empty-value{font-size:11px;}
/* Whisper avatar: drawn on BC canvas, no DOM overlay needed */
/* OOC flash */
@keyframes fcm-ooc-flash{0%{box-shadow:0 0 0 3px #ff4040cc,0 0 16px #ff404088;border-color:#ff4040;}50%{box-shadow:0 0 0 6px #ff404066,0 0 24px #ff404044;border-color:#ff8080;}100%{box-shadow:0 0 0 3px #ff4040cc,0 0 16px #ff404088;border-color:#ff4040;}}
.fcm-ooc-blocked{animation:fcm-ooc-flash .3s ease-in-out 3;}
/* Btn visibility checkboxes */
.fcm-chk-row{display:flex;align-items:center;gap:8px;padding:4px 0;}
.fcm-chk-row input[type=checkbox]{width:16px;height:16px;accent-color:#a078e8;cursor:pointer;flex-shrink:0;}
.fcm-chk-row label{color:#c4a0e0;font-size:13px;cursor:pointer;}
.fcm-chk-row label.fcm-chk-disabled{color:#ff8080;}
        `;
        document.head.appendChild(s);
        applyTheme();   // 套用使用者主題顏色（若非預設）
    }

export { injectStyles, applyTheme };
