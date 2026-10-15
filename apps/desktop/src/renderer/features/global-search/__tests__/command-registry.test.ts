import { describe, it, expect, vi } from 'vitest';
import { getCommandRegistry } from '../command-registry.js';
import { SearchResultItem } from '../types.js';

describe('CommandRegistry', () => {
  it('registers and executes custom commands', async () => {
    const registry = getCommandRegistry();
    const mockHandler = vi.fn().mockReturnValue({ success: true, message: 'Executed' });

    registry.register('custom:test-action', mockHandler);

    const testItem: SearchResultItem = {
      id: 'cmd:test',
      category: 'command',
      title: 'Test Command',
      icon: 'Terminal',
      action: {
        type: 'command',
        payload: { commandId: 'custom:test-action', foo: 'bar' },
      },
    };

    const result = await registry.execute(testItem);
    expect(result.success).toBe(true);
    expect(mockHandler).toHaveBeenCalledWith({ commandId: 'custom:test-action', foo: 'bar' });

    registry.unregister('custom:test-action');
  });

  it('handles non-existent commands gracefully', async () => {
    const registry = getCommandRegistry();
    const testItem: SearchResultItem = {
      id: 'cmd:missing',
      category: 'command',
      title: 'Missing Command',
      icon: 'Terminal',
      action: {
        type: 'command',
        payload: { commandId: 'non-existent:action' },
      },
    };

    const result = await registry.execute(testItem);
    expect(result.success).toBe(false);
    expect(result.error).toContain('Command not found');
  });

  it('handles navigation action', async () => {
    const registry = getCommandRegistry();
    const testItem: SearchResultItem = {
      id: 'nav:history',
      category: 'navigation',
      title: 'History',
      icon: 'History',
      action: {
        type: 'navigate',
        payload: { page: 'history' },
      },
    };

    const result = await registry.execute(testItem);
    expect(result.success).toBe(true);
  });
});

