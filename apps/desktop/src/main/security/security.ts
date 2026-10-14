import { app, shell, session, desktopCapturer, WebContents } from 'electron';
import { createLogger } from '@echo-lingo/logger';

const log = createLogger('Security');

export function setupSecurityPolicies(webContents: WebContents): void {
  // Disallow window.open / target="_blank" navigations inside Electron
  webContents.setWindowOpenHandler(({ url }) => {
    // Only allow external HTTP/HTTPS URLs to be opened in user's default browser
    if (url.startsWith('https://') || url.startsWith('http://')) {
      shell.openExternal(url);
    }
    return { action: 'deny' };
  });

  // Block in-app navigation away from application origin
  webContents.on('will-navigate', (event, navigationUrl) => {
    const parsed = new URL(navigationUrl);
    if (parsed.protocol !== 'file:' && !navigationUrl.startsWith('http://localhost:')) {
      event.preventDefault();
      shell.openExternal(navigationUrl);
    }
  });
}

/**
 * Configure media permissions and loopback display capture for microphone and system audio
 */
export function setupMediaPermissions(): void {
  const ses = session.defaultSession;

  // Automatically approve media capture permissions for our desktop app
  ses.setPermissionRequestHandler((_webContents, permission, callback) => {
    const perm = permission as string;
    if (perm === 'media' || perm === 'display-capture') {
      return callback(true);
    }
    callback(false);
  });

  // Verify media permission check queries
  ses.setPermissionCheckHandler((_webContents, permission) => {
    const perm = permission as string;
    if (perm === 'media' || perm === 'display-capture') {
      return true;
    }
    return false;
  });

  // Support system audio loopback capture via getDisplayMedia
  if (typeof ses.setDisplayMediaRequestHandler === 'function') {
    ses.setDisplayMediaRequestHandler(async (_request, callback) => {
      try {
        log.info('[SystemAudio] Loopback display media requested. Querying screen sources...');
        const sources = await desktopCapturer.getSources({
          types: ['screen'],
          thumbnailSize: { width: 1, height: 1 },
        });
        if (sources.length > 0) {
          log.info(`[SystemAudio] Binding loopback audio to screen source: ${sources[0].name} (${sources[0].id})`);
          callback({ video: sources[0], audio: 'loopback' });
        } else {
          log.warn('[SystemAudio] No screen sources found to bind loopback audio.');
          callback({});
        }
      } catch (err) {
        log.error('[SystemAudio] Error fetching screen sources for display media:', err);
        callback({});
      }
    });
  }
}

