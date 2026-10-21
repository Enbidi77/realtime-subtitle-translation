# Privacy Policy for EchoLingo

**Last Updated:** October 21, 2026

EchoLingo ("we", "our", or "the Application") is committed to protecting your privacy. This Privacy Policy explains our practices regarding data collection, processing, storage, and security when you use the EchoLingo desktop application on Windows and other supported platforms.

---

## 1. Core Privacy Philosophy: Offline-First & Zero Data Harvesting

EchoLingo is built from the ground up as a **privacy-first, offline-capable application**:
- **Zero Telemetry & Tracking:** EchoLingo does not collect telemetry, diagnostic logs, background analytics, or behavioral tracking data.
- **Zero Profiling & Advertising:** We do not display ads, create advertising profiles, or sell any personal data to third parties.
- **No Cloud Synchronization by Default:** All application states, speech recognition, OCR processing, translation histories, and session databases are stored locally on your device.

---

## 2. Permissions & Hardware Access

EchoLingo requests access to certain hardware features solely to provide its core functionality:

### A. Microphone & Audio Input
- **Purpose:** Used in real-time to transcribe spoken speech into live subtitles.
- **Data Handling:** Audio streams are captured and processed in memory. Audio data is resampled and sent only to the speech engine configured by the user (such as Windows built-in speech recognition, local Whisper models, or user-selected cloud providers). EchoLingo does not record, upload, or transmit your raw voice data to our own servers.

### B. Screen Capture & Display Duplication
- **Purpose:** Used exclusively when you trigger the on-screen OCR (Optical Character Recognition) or Screen Translation feature.
- **Data Handling:** Only the specific rectangular screen area or window you designate is captured. The captured image frame is processed in memory to extract text and is discarded immediately after processing. Screenshots are never uploaded to any remote server by EchoLingo.

### C. Network & Internet Access
- **Purpose:** Required only if you choose to use cloud-based translation or speech recognition providers (e.g., OpenAI, Groq, DeepL, Google Translate), or to check for software updates.
- **Offline Modes:** If you use offline engines (such as Windows System Speech, Local Whisper, Windows WinRT OCR, or local Ollama models), the application functions completely offline without sending any data over the internet.

---

## 3. Storage and Data Retention

- **Local SQLite Database:** Your session logs, subtitle history, saved glossary terms, and OCR history are stored solely in a local SQLite database on your device.
- **User Control:** You retain full ownership and control over your data. You can view, search, export, or permanently delete your sessions and history directly within the application at any time.
- **Credential Protection:** Any third-party API keys you enter (such as DeepL or OpenAI keys) are encrypted using your operating system's native cryptographic vault (Windows DPAPI via Electron `safeStorage`). They are never stored in plaintext, never logged, and never transmitted to anyone other than the respective API provider during active requests.

---

## 4. Third-Party Services and Cloud Providers

If you configure external cloud services for speech transcription or translation, your text or audio snippets are transmitted directly and securely (via HTTPS) to those providers under their respective terms and privacy policies:
- **OpenAI:** [OpenAI Privacy Policy](https://openai.com/policies/privacy-policy/)
- **Groq:** [Groq Privacy Policy](https://groq.com/privacy-policy/)
- **DeepL:** [DeepL Privacy Policy](https://www.deepl.com/en/privacy)
- **Google Cloud / Google Translate:** [Google Privacy Policy](https://policies.google.com/privacy)

EchoLingo operates solely as a direct client and does not intermediary-cache or inspect traffic between your device and these third-party endpoints.

---

## 5. Children's Privacy

EchoLingo is a general-purpose utility desktop application and does not knowingly collect, store, or solicit personal information from children under the age of 13.

---

## 6. Changes to This Privacy Policy

We may update this Privacy Policy from time to time to reflect feature enhancements or legal requirements. Updated versions will be published with an updated "Last Updated" date.

---

## 7. Contact Us

If you have any questions, feedback, or concerns regarding this Privacy Policy or your data privacy while using EchoLingo, please contact:

- **Project / Publisher:** EchoLingo Team
- **Email:** support@echolingo.app *(or your preferred support email address)*
- **Repository / Support:** https://github.com/echolingo/echo-lingo *(or your support URL)*

