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
    jhenghei: '"Microsoft JhengHei",sans-serif',
    yahei: '"Microsoft YaHei",sans-serif',
    pmingliu: 'PMingLiU,serif',
    mingliu: 'MingLiU,serif',
    dfkai: 'DFKai-SB,serif',
    notoSansTC: '"Noto Sans TC",sans-serif',
    notoSerifTC: '"Noto Serif TC",serif',
    sourceHanSans: '"Source Han Sans TC",sans-serif',
    sourceHanSerif: '"Source Han Serif TC",serif',
};

const FONT_CHOICES = [
    ['system', '系統字型', null], ['heiti', '黑體', null], ['ming', '細明體', null], ['kai', '標楷體', null], ['mono', '等寬字體', null],
    ['jhenghei', 'Microsoft 正黑體', 'Microsoft JhengHei'], ['yahei', 'Microsoft YaHei', 'Microsoft YaHei'],
    ['pmingliu', '新細明體', 'PMingLiU'], ['mingliu', '細明體', 'MingLiU'], ['dfkai', '標楷體', 'DFKai-SB'],
    ['notoSansTC', 'Noto Sans TC', 'Noto Sans TC'], ['notoSerifTC', 'Noto Serif TC', 'Noto Serif TC'],
    ['sourceHanSans', '思源黑體', 'Source Han Sans TC'], ['sourceHanSerif', '思源宋體', 'Source Han Serif TC'],
];

function availableFontChoices() {
    if (typeof document === 'undefined') return FONT_CHOICES.filter(([, , probe]) => !probe);
    const context = document.createElement('canvas').getContext('2d');
    if (!context) return FONT_CHOICES.filter(([, , probe]) => !probe);
    const sample = 'mmmmmmmmmm漢字測試iiiiiiiiii';
    const installed = family => ['monospace', 'serif', 'sans-serif'].some(base => {
        context.font = `72px ${base}`; const fallbackWidth = context.measureText(sample).width;
        context.font = `72px "${family}",${base}`; return context.measureText(sample).width !== fallbackWidth;
    });
    return FONT_CHOICES.filter(([, , probe]) => !probe || installed(probe));
}

function chatFontFamily() {
    return FONT_STACKS[cfg.chatFontFamily] || FONT_STACKS.system;
}

export { chatFontFamily, availableFontChoices };
