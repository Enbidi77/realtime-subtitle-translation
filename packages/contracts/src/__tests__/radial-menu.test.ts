import { describe, it, expect } from 'vitest';
import {
  RadialMenuActionIdSchema,
  RadialMenuStateSchema,
  RadialMenuExecuteRequestSchema,
  AppSettingsSchema,
  IPC_CHANNELS,
} from '@echo-lingo/contracts';

describe('Radial Menu Contracts & Configuration', () => {
  it('validates supported radial menu actions', () => {
    const validActions = [
      'toggle-listening',
      'pause-listening',
      'capture-translate',
      'continuous-ocr',
      'translate-clipboard',
      'toggle-overlay',
      'toggle-click-through',
      'show-ocr-panel',
      'clear-subtitles',
      'copy-last',
      'open-settings',
      'open-app',
    ];

    for (const action of validActions) {
      expect(RadialMenuActionIdSchema.safeParse(action).success).toBe(true);
    }

    expect(RadialMenuActionIdSchema.safeParse('invalid-action').success).toBe(false);
  });

  it('validates radial menu state schema', () => {
    const validState = {
      isListening: true,
      isPaused: false,
      isOverlayVisible: true,
      isClickThrough: false,
      isContinuousOcr: false,
      isOcrPanelVisible: false,
      sourceLanguage: 'auto',
      targetLanguages: ['vi'],
      lastSubtitleText: 'Hello world',
    };

    const parsed = RadialMenuStateSchema.safeParse(validState);
    expect(parsed.success).toBe(true);
    if (parsed.success) {
      expect(parsed.data.isListening).toBe(true);
      expect(parsed.data.targetLanguages).toEqual(['vi']);
    }
  });

  it('validates radial menu execute request schema', () => {
    const validReq = { actionId: 'capture-translate' };
    const parsed = RadialMenuExecuteRequestSchema.safeParse(validReq);
    expect(parsed.success).toBe(true);
  });

  it('defines radial menu IPC channels', () => {
    expect(IPC_CHANNELS.RADIAL_MENU_SHOW).toBe('radial-menu:show');
    expect(IPC_CHANNELS.RADIAL_MENU_HIDE).toBe('radial-menu:hide');
    expect(IPC_CHANNELS.RADIAL_MENU_TOGGLE).toBe('radial-menu:toggle');
    expect(IPC_CHANNELS.RADIAL_MENU_EXECUTE_ACTION).toBe('radial-menu:execute-action');
    expect(IPC_CHANNELS.RADIAL_MENU_GET_STATE).toBe('radial-menu:get-state');
    expect(IPC_CHANNELS.RADIAL_MENU_STATE_STREAM).toBe('radial-menu:state-stream');
  });

  it('includes open-radial-menu shortcut in default AppSettingsSchema', () => {
    const defaultParsed = AppSettingsSchema.parse({});
    expect(defaultParsed.keyboardShortcuts['open-radial-menu']).toBe(
      'CommandOrControl+Shift+Space'
    );
  });
});

