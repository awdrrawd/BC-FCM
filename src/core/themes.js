const THEME_PRESETS = Object.freeze({
    violet: Object.freeze(['#1a1821', '#f1ecff', '#7648fe']),
    eu: Object.freeze(['#171d29', '#f2efe6', '#cda85a']),
    electronic: Object.freeze(['#0b0f14', '#d9f8ff', '#35e0c9']),
    jp: Object.freeze(['#f7f3ea', '#2b2a28', '#b23b32']),
    cn: Object.freeze(['#1a1210', '#f2e6d8', '#c23616']),
    silentblack: Object.freeze(['#0a0a0a', '#ededed', '#d8d8d8']),
    minimalwhite: Object.freeze(['#fafafa', '#171717', '#171717']),
});

const THEME_KEYS = Object.freeze(Object.keys(THEME_PRESETS));

function themeColors(name = 'violet') {
    return THEME_PRESETS[name] || THEME_PRESETS.violet;
}

export { THEME_PRESETS, THEME_KEYS, themeColors };
