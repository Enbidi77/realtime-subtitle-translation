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
});
