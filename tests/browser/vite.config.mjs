import { defineConfig } from 'vite';
import { resolve } from 'node:path';

// Replace only environment/data boundaries. The production view, styles, drag and lifecycle run unchanged.
const mocks = new Map(Object.entries({
    'src/core/config.js': `export const cfg = {avatars:true, communicationEnabled:true, balloonPlacement:'bottom-left',userBalloonPlacement:'top-left', notificationAnimation:false}; export const saveCfg=()=>{}; export const THEME_DEFAULTS={panelColor:'#191326',fontColor:'#eee',accentColor:'#a078e8'};`,
    'src/i18n/i18n.js': `export const T=(key)=>({addFriend:'添加好友',btnSearch:'搜尋'}[key]||key); export const TH=T;`,
    'src/data/data.js': `export const amAdmin=()=>globalThis.admin; export const getDisplayName=n=>'玩家'+n; export const inRoomFn=()=>false; export const getAllRels=()=>[]; export const onlineFriends=[]; export const matchesSearchFields=()=>true; export const searchScoreFields=()=>0;`,
    'src/data/profile-db.js': `export const PDB={init:async()=>true,getAll:()=>new Promise(resolve=>globalThis.loads.push(resolve)),batchGet:async()=>{}};export const _pc={}; export const Snapshot={_cache:{}};`,
    'src/panel/panel-controller.js': `export const getRenderToken=()=>1;`,
    'src/panel/panel-widgets.js': `export const makeAvEl=()=>{const e=document.createElement('div');e.className='fcm-av';e.textContent='頭';return e;};export const mkBtn=(text,cls,fn)=>{const b=document.createElement('button');b.textContent=text;b.className=cls;b.onclick=fn;return b;};export const makeRelEl=()=>document.createElement('span');export const paginate=(items)=>({items,page:0,totalPages:1});export const makePageBar=()=>document.createElement('div');export const buildMgmtBtns=()=>null;export const buildPersonOps=()=>document.createElement('div');`,
    'src/chat/actions.js': `export const makeIdCell=()=>document.createElement('td');`,
    'src/chat/wps-share.js': `export const wpsShareProfile=()=>{};`,
    'src/communication/chat/services/chat-content.js': `export const esc=value=>String(value??'').replaceAll('&','&amp;').replaceAll('<','&lt;').replaceAll('"','&quot;');`,
}).map(([file, source]) => [resolve(file).replaceAll('\\','/'), source]));
export default defineConfig({ configFile: false, plugins: [{ name: 'game-fixtures', enforce: 'pre',
    load(id) { return mocks.get(id.replaceAll('\\','/')); },
}], server: { host: '127.0.0.1' } });
