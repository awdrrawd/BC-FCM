// ==UserScript==
// @name         Liko - FCM
// @name:zh      Liko的好友與房間管理
// @namespace    https://github.com/awdrrawd/liko-Plugin-Repository
// @version      1.5.1
// @description  Friends & Room Manager | 好友與房間管理
// @author       Likolisu
// @include      /^https:\/\/(www\.)?bondage(projects\.elementfx|-(europe|asia))\.com\/.*/
// @icon         https://raw.githubusercontent.com/awdrrawd/liko-tool-Image-storage/refs/heads/main/Images/LOGO_2.png
// @grant        none
// @run-at       document-end
// @require      https://cdn.jsdelivr.net/gh/awdrrawd/liko-Plugin-Repository@main/Plugins/expand/bcmodsdk.js
// ==/UserScript==

// Thin loader: pulls the built FCM bundle from GitHub Pages and lets it run.
// Source & modules live at https://github.com/awdrrawd/BC-FCM (built by CI to /assets/main.js).
window.Liko = window.Liko ?? {};
if (window.Liko.FCM) {
    console.warn('🐈‍⬛ [FCM] ⚠️ 已載入，略過重複匯入。');
} else {
    // Reserve the flag immediately so a second loader instance bails out here.
    //window.Liko.FCM = 'loading';
    import(`https://awdrrawd.github.io/BC-FCM/assets/main.js?v=${Date.now()}`)
        .catch(e => console.error('🐈‍⬛ [FCM] 載入失敗:', e));
}
