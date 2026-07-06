// ==UserScript==
// @name         Liko - FCM - 本地版
// @name:zh      Liko的好友與房間管理 - 本地開發
// @namespace    https://github.com/awdrrawd/liko-Plugin-Repository
// @version      1.5.0
// @description  FCM 本地開發載入器（從 vite preview 讀取，npm run dev，port 5176）
// @author       Likolisu
// @include      /^https:\/\/(www\.)?bondage(projects\.elementfx|-(europe|asia))\.com\/.*/
// @icon         https://raw.githubusercontent.com/awdrrawd/liko-tool-Image-storage/refs/heads/main/Images/LOGO_2.png
// @grant        none
// @run-at       document-end
// @require      https://cdn.jsdelivr.net/gh/awdrrawd/liko-Plugin-Repository@main/Plugins/expand/bcmodsdk.js
// ==/UserScript==

window.Liko = window.Liko ?? {};
if (window.Liko.FCM) {
    console.warn('🐈‍⬛ [FCM] ⚠️ 已載入，略過重複匯入。');
} else {
    window.Liko.FCM = 'loading';
    import(`http://localhost:5176/assets/main.js?v=${Date.now()}`)
        .catch(e => console.error('🐈‍⬛ [FCM] 本地載入失敗（vite preview 有開嗎？）:', e));
}

// Local dev loader: reads the bundle from the local vite preview server.
// The ?v= timestamp busts the cache so every reload picks up the latest build.
// Run ` npm run dev ` , then reload BC.