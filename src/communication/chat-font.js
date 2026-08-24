import { cfg } from '../core/config.js';
// ════════════════════════════════════════
//  共用字型對照表：FCM 面板與 CHAT 面板共用同一份 cfg.chatFontFamily 設定，
//  避免兩邊各自維護一份對照表而字型逐漸跑掉不一致。
// ════════════════════════════════════════
const FONT_STACKS = {
    system: '-apple-system,"Segoe UI",sans-serif',
    heiti: '"Microsoft JhengHei","Microsoft YaHei","Noto Sans CJK TC",sans-serif',
    ming: 'PMingLiU,MingLiU,"Noto Serif CJK TC",serif',
    kai: 'DFKai-SB,KaiTi,"Noto Serif CJK TC",serif',
    mono: 'Consolas,"Courier New",monospace',
};

function chatFontFamily() {
    return FONT_STACKS[cfg.chatFontFamily] || FONT_STACKS.system;
}

export { chatFontFamily, FONT_STACKS };
