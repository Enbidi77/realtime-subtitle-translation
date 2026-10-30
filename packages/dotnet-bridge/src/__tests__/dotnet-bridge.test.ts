import { describe, it, expect, afterAll } from "vitest";
import * as path from "node:path";
import { DotnetBinaryLocator } from "../binary-locator";
import { dotnetBridge, DotnetBridge } from "../dotnet-bridge";
import { resolvePipePath } from "../pipe-client";

describe("DotnetBridge & DotnetBinaryLocator", () => {
  afterAll(async () => {
    await dotnetBridge.dispose();
  });

  it("correctly detects Windows platform support", () => {
    const isWindows = process.platform === "win32";
    expect(DotnetBinaryLocator.isSupportedPlatform()).toBe(isWindows);
  });

  it("locates the compiled EchoLingo.Ipc binary on Windows", () => {
    if (process.platform !== "win32") return;

    const binaryPath = DotnetBinaryLocator.getBinaryPath();
    expect(binaryPath).toBeTruthy();
    expect(binaryPath?.endsWith(".exe")).toBe(true);
    expect(DotnetBinaryLocator.isAvailable()).toBe(true);
  });

  it("resolves platform-specific pipe address correctly", () => {
    const pipeAddress = resolvePipePath("my-test-pipe");
    if (process.platform === "win32") {
      expect(pipeAddress).toBe("\\\\.\\pipe\\my-test-pipe");
    } else {
      expect(pipeAddress).toContain("CoreFxPipe_my-test-pipe");
    }
  });

  it("defaults to Named Pipe transport over CLI", () => {
    expect(dotnetBridge.getTransport()).toBe("pipe");
    expect(dotnetBridge.getPipeName()).toContain("echolingo-dotnet-pipe");
  });

  it("locates the binary even when cwd is apps/desktop", () => {
    if (process.platform !== "win32") return;

    const origCwd = process.cwd();
    try {
      DotnetBinaryLocator.resetCache();
      process.chdir(path.resolve(origCwd, "apps/desktop"));
      const binaryPath = DotnetBinaryLocator.getBinaryPath();
      expect(binaryPath).toBeTruthy();
      expect(binaryPath?.endsWith(".exe")).toBe(true);
    } finally {
      process.chdir(origCwd);
      DotnetBinaryLocator.resetCache();
    }
  });

  it("successfully executes ping command via default Named Pipe transport", async () => {
    if (process.platform !== "win32") return;

    const result = await dotnetBridge.ping();
    expect(result).toBeDefined();
    expect(result.message).toBe("pong");
    expect(result.version).toBe("1.0.0");
    expect(result.platform).toBe("win32");
  });

  it("handles concurrent requests multiplexed over the Named Pipe", async () => {
    if (process.platform !== "win32") return;

    const [p1, ocrLangs, p2] = await Promise.all([
      dotnetBridge.ping(),
      dotnetBridge.ocr.getAvailableLanguages(),
      dotnetBridge.ping(),
    ]);

    expect(p1.message).toBe("pong");
    expect(p2.message).toBe("pong");
    expect(Array.isArray(ocrLangs)).toBe(true);
  });

  it("supports custom pipe name configuration", async () => {
    if (process.platform !== "win32") return;

    const customPipeBridge = new DotnetBridge({
      transport: "pipe",
      pipeName: `echolingo-custom-pipe-${Date.now()}`,
    });

    try {
      expect(customPipeBridge.getTransport()).toBe("pipe");
      const result = await customPipeBridge.ping();
      expect(result.message).toBe("pong");
    } finally {
      await customPipeBridge.dispose();
    }
  });

  it("successfully lists installed SAPI speech recognizers via Named Pipe", async () => {
    if (process.platform !== "win32") return;

    const recognizers = await dotnetBridge.speech.getInstalledRecognizers();
    expect(Array.isArray(recognizers)).toBe(true);
    if (recognizers.length > 0) {
      expect(recognizers[0]).toHaveProperty("id");
      expect(recognizers[0]).toHaveProperty("culture");
    }
  });

  it("successfully lists available WinRT OCR languages via Named Pipe", async () => {
    if (process.platform !== "win32") return;

    const languages = await dotnetBridge.ocr.getAvailableLanguages();
    expect(Array.isArray(languages)).toBe(true);
    if (languages.length > 0) {
      expect(languages[0]).toHaveProperty("languageTag");
      expect(languages[0]).toHaveProperty("displayName");
    }
  });

  it("supports stdio daemon transport mode when explicitly requested", async () => {
    if (process.platform !== "win32") return;

    const daemonBridge = new DotnetBridge({ transport: "daemon" });
    try {
      expect(daemonBridge.getTransport()).toBe("daemon");
      const pingRes = await daemonBridge.ping();
      expect(pingRes.message).toBe("pong");
    } finally {
      await daemonBridge.dispose();
    }
  });

  it("supports CLI fallback mode without daemon or pipe", async () => {
    if (process.platform !== "win32") return;

    const cliBridge = new DotnetBridge({ transport: "cli" });
    try {
      expect(cliBridge.getTransport()).toBe("cli");
      const pingRes = await cliBridge.ping();
      expect(pingRes.message).toBe("pong");
    } finally {
      await cliBridge.dispose();
    }
  });

  it("maintains backward compatibility with useDaemon: false", async () => {
    if (process.platform !== "win32") return;

    const legacyCliBridge = new DotnetBridge({ useDaemon: false });
    try {
      expect(legacyCliBridge.getTransport()).toBe("cli");
      const pingRes = await legacyCliBridge.ping();
      expect(pingRes.message).toBe("pong");
    } finally {
      await legacyCliBridge.dispose();
    }
  });

  it("recognizes handwriting strokes via DotnetBridge", async () => {
    if (process.platform !== "win32") return;

    const sampleStrokes = [
      {
        points: [
          { x: 400, y: 68 }, { x: 399, y: 66 }, { x: 398, y: 64 }, { x: 397, y: 63 },
          { x: 395, y: 61 }, { x: 389, y: 57 }, { x: 378, y: 54 }, { x: 361, y: 50 },
          { x: 327, y: 46 }, { x: 303, y: 46 }, { x: 284, y: 50 }, { x: 271, y: 57 },
          { x: 262, y: 68 }, { x: 257, y: 81 }, { x: 255, y: 85 }, { x: 253, y: 95 },
          { x: 254, y: 101 }, { x: 257, y: 106 }, { x: 263, y: 113 }, { x: 269, y: 118 },
          { x: 283, y: 122 }, { x: 294, y: 124 }, { x: 303, y: 124 }, { x: 309, y: 124 },
          { x: 317, y: 122 }, { x: 325, y: 114 }, { x: 335, y: 104 }, { x: 343, y: 93 },
          { x: 350, y: 83 }, { x: 355, y: 77 }, { x: 358, y: 73 }, { x: 360, y: 70 },
          { x: 360, y: 68 }, { x: 360, y: 67 }, { x: 361, y: 71 }, { x: 363, y: 78 },
          { x: 365, y: 85 }, { x: 368, y: 97 }, { x: 369, y: 105 }, { x: 373, y: 115 },
          { x: 376, y: 121 }, { x: 379, y: 124 }, { x: 383, y: 127 }, { x: 387, y: 130 },
          { x: 392, y: 132 }, { x: 399, y: 132 }, { x: 405, y: 130 }, { x: 414, y: 121 },
          { x: 421, y: 112 }, { x: 429, y: 106 }
        ]
      }
    ];

    const result = await dotnetBridge.handwriting.recognize(sampleStrokes, "en-US");
    expect(result).toBeDefined();
    expect(result.text).toBe("a");
    expect(result.lines).toHaveLength(1);
    expect(result.candidates).toContain("a");
  });

  it("lists installed handwriting recognizers", async () => {
    if (process.platform !== "win32") return;

    const recognizers = await dotnetBridge.handwriting.getInstalledRecognizers();
    expect(Array.isArray(recognizers)).toBe(true);
    expect(recognizers.length).toBeGreaterThan(0);
  });

  it("recognizes Chinese handwriting strokes with languageTag zh and auto", async () => {
    if (process.platform !== "win32") return;

    const strokeShi = [
      { points: [{ x: 100, y: 200 }, { x: 300, y: 200 }] },
      { points: [{ x: 200, y: 100 }, { x: 200, y: 300 }] },
    ];

    const resultZh = await dotnetBridge.handwriting.recognize(strokeShi, "zh");
    expect(resultZh).toBeDefined();
    expect(resultZh.text).toBe("十");
    expect(resultZh.candidates).toContain("十");

    const resultAuto = await dotnetBridge.handwriting.recognize(strokeShi, "auto");
    expect(resultAuto).toBeDefined();
    expect(resultAuto.text).toBe("十");
  });
});
