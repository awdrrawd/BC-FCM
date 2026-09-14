import { cfg } from '../core/config.js';
import { T } from '../i18n/i18n.js';
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
    ['system', 'chatFontSystem', null], ['heiti', 'chatFontHeiti', null], ['ming', 'chatFontMing', null], ['kai', 'chatFontKai', null], ['mono', 'chatFontMono', null],
    ['jhenghei', 'Microsoft JhengHei', 'Microsoft JhengHei'], ['yahei', 'Microsoft YaHei', 'Microsoft YaHei'],
    ['pmingliu', 'PMingLiU', 'PMingLiU'], ['mingliu', 'MingLiU', 'MingLiU'], ['dfkai', 'DFKai-SB', 'DFKai-SB'],
    ['notoSansTC', 'Noto Sans TC', 'Noto Sans TC'], ['notoSerifTC', 'Noto Serif TC', 'Noto Serif TC'],
    ['sourceHanSans', 'Source Han Sans TC', 'Source Han Sans TC'], ['sourceHanSerif', 'Source Han Serif TC', 'Source Han Serif TC'],
];

function availableFontChoices() {
    const choices = FONT_CHOICES.map(([value, label, probe]) => [value, probe ? label : T(label), probe]);
    if (typeof document === 'undefined') return choices.filter(([, , probe]) => !probe);
    const context = document.createElement('canvas').getContext('2d');
    if (!context) return choices.filter(([, , probe]) => !probe);
    const sample = 'mmmmmmmmmm漢字測試iiiiiiiiii';
    const installed = family => ['monospace', 'serif', 'sans-serif'].some(base => {
        context.font = `72px ${base}`; const fallbackWidth = context.measureText(sample).width;
        context.font = `72px "${family}",${base}`; return context.measureText(sample).width !== fallbackWidth;
    });
    return choices.filter(([, , probe]) => !probe || installed(probe));
}

function chatFontFamily() {
    return FONT_STACKS[cfg.chatFontFamily] || FONT_STACKS.system;
}

export { chatFontFamily, availableFontChoices };
