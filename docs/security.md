# EchoLingo Security Model & Policies

## Threat Model & Hardening

1. **Context Isolation & Sandbox**:
   - `contextIsolation: true` is strictly enforced on all browser windows.
   - `nodeIntegration: false` prevents renderer access to Node.js primitives (`require`, `process`, `fs`).
2. **Preload ContextBridge**:
   - Only narrow, strongly-typed asynchronous functions are exposed on `window.electronAPI`.
   - Raw `ipcRenderer.send` or `ipcRenderer.invoke` cannot be triggered arbitrarily.
3. **IPC Validation**:
   - All inbound requests and parameters are validated using Zod schemas defined in `@echo-lingo/contracts`.
4. **Content Security Policy (CSP)**:
   - Scripts are restricted to `'self'`.
   - External network connections are whitelisted only to configured translation and speech provider domains.
5. **Safe Subtitle Rendering**:
   - Subtitle text from user speech or imported files is rendered strictly as plain text in React DOM.
   - HTML injection and arbitrary script execution via subtitle tags are neutralized.
6. **Navigation Guardrails**:
   - In-app navigation away from application bundle is blocked.
   - External URLs (`http://`, `https://`) are delegated safely to the user's default external browser via `shell.openExternal`.
