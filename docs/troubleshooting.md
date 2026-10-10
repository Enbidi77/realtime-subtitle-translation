# EchoLingo Troubleshooting Guide

## Common Issues & Solutions

### 1. Microphone access denied or no audio wave detected
- **Cause**: Windows Privacy settings or operating system permissions block microphone access for desktop applications.
- **Solution**: Open **Windows Settings > Privacy & Security > Microphone**, ensure "Microphone access" is toggled ON, and "Let desktop apps access your microphone" is enabled.

### 2. System Audio (loopback) not capturing
- **Cause**: On Windows, system audio requires choosing the screen or application window containing the audio output.
- **Solution**: When clicking "Start Listening" with "System Audio" selected, choose the target monitor or browser window in the screen picker dialog.

### 3. Translation fails with cloud provider error
- **Cause**: Invalid or expired API key.
- **Solution**: Navigate to **Providers & Models** tab in EchoLingo, re-enter your API key, and click **Test Connection** to verify endpoint availability.

### 4. Floating Overlay window not appearing
- **Cause**: Overlay window was moved off-screen or hidden.
- **Solution**: Press the global shortcut `Ctrl+Shift+O` (or `Cmd+Shift+O` on macOS) to toggle and center the overlay window.
