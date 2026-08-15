// ==UserScript==
// @name         本地測試 - FCM
// @namespace    https://github.com/awdrrawd/BC-FCM
// @version      0.1
// @description  FCM 本地開發載入器
// @author       Likolisu
// @supportURL   https://github.com/awdrrawd/BC-FCM
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
    import(`http://localhost:5176/assets/main.js?v=${Date.now()}`)
        .catch(e => console.error('🐈‍⬛ [FCM] 本地載入失敗（vite preview 有開嗎？）:', e));
}

// Local dev loader: reads the bundle from the local vite preview server.
// The ?v= timestamp busts the cache so every reload picks up the latest build.
// Run ` npm run dev ` , then reload BC.
