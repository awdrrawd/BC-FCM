import js from '@eslint/js';
import globals from 'globals';

// Bondage Club runtime globals that FCM reads/hooks. Listed as read-only so the
// `no-undef` rule can catch genuinely missing cross-module imports of our own
// symbols (Rollup silently treats those as globals otherwise).
const bcGlobals = [
  'Player', 'ChatRoomCharacter', 'ChatRoomData', 'ChatRoomCharacterViewOffset',
  'TranslationLanguage', 'CharacterNickname', 'CharacterLoadOnline', 'CharacterRefresh',
  'InformationSheetLoadCharacter', 'InformationSheetRun', 'InformationSheetClick',
  'InformationSheetSelection', 'InformationSheetExit', 'InformationSheetSecondScreen',
  'DrawEmptyRect', 'DrawTextFit', 'DrawingGetTextSize', 'CommonGetFont',
  'ServerSend', 'ServerAccountUpdate', 'ServerRoomSearch',
  'ChatRoomSendLocal', 'ChatRoomListManipulation', 'ChatRoomGetSettings', 'ChatRoomLeave',
  'ChatRoomTargetMemberNumber', 'ChatRoomMessage', 'CommandCombine', 'CommonSetScreen',
  'CommonTime', 'CurrentScreen', 'CurrentCharacter', 'DrawButton', 'DrawImageResize',
  'MainCanvas', 'MouseIn', 'MouseX', 'MouseY', 'FriendListBeepLog',
  'Character', 'bcModSdk',
  'fbcSettings', 'BCE_VERSION', 'FBC_VERSION', 'MainHallRun', 'MainHallClick',
  'DrawProcess', 'ChatRoomClick', 'DrawCharacter', 'ServerAccountQueryResult',
  'ServerChatMessageMaxLength', 'ServerSendRateLimitQueue', 'DrawText',
  'ChatRoomSync', 'ChatRoomSyncMemberJoin', 'ChatRoomSyncRoomProperties',
  'ChatRoomSyncMemberLeave', 'AccountBeep',
];

export default [
  { ignores: ['dist/**', 'node_modules/**', 'public/**', 'Plugins/**', 'Translation/**', 'loader.user.js', 'loader.local.user.js', 'scripts/**'] },
  js.configs.recommended,
  {
    files: ['tests/browser/**', 'playwright.config.mjs'],
    languageOptions: { globals: { ...globals.node, ...globals.browser, fixture: 'readonly', sent: 'readonly', loads: 'readonly', admin: 'writable', ChatRoomCharacter: 'readonly' } },
  },
  {
    // Node-side build/config files.
    files: ['vite.config.js', 'eslint.config.js'],
    languageOptions: { globals: { ...globals.node } },
  },
  {
    files: ['src/**/*.js'],
    languageOptions: {
      ecmaVersion: 2022,
      sourceType: 'module',
      globals: {
        ...globals.browser,
        ...Object.fromEntries(bcGlobals.map(g => [g, 'readonly'])),
        // BC globals that FCM assigns to (room re-join bookkeeping).
        ChatSearchLastQueryJoinTime: 'writable',
        ChatSearchLastQueryJoin: 'writable',
        __FCM_VERSION__: 'readonly',
      },
    },
    rules: {
      'no-unused-vars': ['warn', { args: 'none', varsIgnorePattern: '^_' }],
      // A silent catch must say why (a comment satisfies the rule); otherwise log via warnLimited.
      'no-empty': ['error', { allowEmptyCatch: false }],
      indent: ['error', 4, { SwitchCase: 1 }],
      'no-cond-assign': 'off',
      'no-extra-boolean-cast': 'off',
    },
  },
];
