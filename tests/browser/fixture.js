import { injectStyles } from '../../src/panel/styles.js';
import { injectChatStyles } from '../../src/communication/chat/views/chat-styles.js';
import { renderRoomOrder } from '../../src/panel/panel-room-order.js';
import { disposePanelView, updatePanelView } from '../../src/panel/panel-lifecycle.js';
import { renderPeople } from '../../src/panel/panel-people.js';
import { contactCardHtml } from '../../src/communication/chat/views/chat-conversation-view.js';
import { createChatBalloonController } from '../../src/communication/chat/controllers/chat-balloon.js';
import { cfg } from '../../src/core/config.js';

globalThis.admin = true; globalThis.loads = []; globalThis.sent = [];
globalThis.Player = { ID: 0, MemberNumber: 10 }; globalThis.ChatRoomData = {};
globalThis.ChatRoomCharacter = Array.from({length:20},(_,i)=>({MemberNumber:i+1}));
globalThis.ServerSend = (type, packet) => sent.push({type,packet});
injectStyles(); injectChatStyles();
const content = document.querySelector('#fcm-content');
document.querySelector('#fcm-panel').classList.remove('hidden');
const balloons = createChatBalloonController({chatColors:()=>['#17131e','#eee','#a078e8'], getRoot:()=>null,
    isMaximized:()=>false, waterShapeHtml:()=>'', unreadBadge:()=>'', avatarHtml:()=>'', getDisplayName:String,
    balloonPreviewText:String, hydrateAvatars:async()=>{}, toggleChat:()=>{}});
globalThis.fixture = {
    order() { content.replaceChildren(); renderRoomOrder(content); },
    confirmOrder() { for (const {packet} of sent) {
        const order=ChatRoomCharacter, from=order.findIndex(c=>c.MemberNumber===(packet.TargetMemberNumber ?? packet.MemberNumber));
        const to=packet.Action==='Swap'?order.findIndex(c=>c.MemberNumber===packet.DestinationMemberNumber):from+(packet.Action==='MoveLeft'?-1:1);
        [order[from],order[to]]=[order[to],order[from]];
    } updatePanelView(content); },
    people() { void renderPeople(content,1); },
    leave() { disposePanelView(content); content.replaceChildren(); },
    card() { document.querySelector('#fcm-panel').style.display='none'; const host=document.createElement('div');
        host.style.cssText='--s:#17131e;--tx:#eee;--ac:#a078e8;position:relative;width:100%;height:400px';
        host.innerHTML=contactCardHtml({memberNumber:7,displayName:'櫻奈',biography:'',hasProfile:true,isFriend:false,
            avatarHtml:()=>'<span style="width:100px;height:100px;flex:none">頭像</span>'});document.body.append(host); },
    balloon(left=true) { cfg.chatBalloonPosition={x:left?8:innerWidth-62,y:8};balloons.ensure(); },
};
