import { describe, it, expect, afterAll } from "vitest";
import * as path from "node:path";
import { DotnetBinaryLocator } from "../binary-locator";
import { dotnetBridge, DotnetBridge } from "../dotnet-bridge";

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

  it("successfully executes ping command via daemon or cli", async () => {
    if (process.platform !== "win32") return;

    const result = await dotnetBridge.ping();
    expect(result).toBeDefined();
    expect(result.message).toBe("pong");
    expect(result.version).toBe("1.0.0");
    expect(result.platform).toBe("win32");
  });

  it("successfully lists installed SAPI speech recognizers", async () => {
    if (process.platform !== "win32") return;

    const recognizers = await dotnetBridge.speech.getInstalledRecognizers();
    expect(Array.isArray(recognizers)).toBe(true);
    // On Windows with speech installed, should return at least 1 or empty array without crashing
    if (recognizers.length > 0) {
      expect(recognizers[0]).toHaveProperty("id");
      expect(recognizers[0]).toHaveProperty("culture");
    }
  });

  it("successfully lists available WinRT OCR languages", async () => {
    if (process.platform !== "win32") return;

    const languages = await dotnetBridge.ocr.getAvailableLanguages();
    expect(Array.isArray(languages)).toBe(true);
    if (languages.length > 0) {
      expect(languages[0]).toHaveProperty("languageTag");
      expect(languages[0]).toHaveProperty("displayName");
    }
  });

  it("handles CLI fallback mode without daemon", async () => {
    if (process.platform !== "win32") return;

    const cliBridge = new DotnetBridge({ useDaemon: false });
    const pingRes = await cliBridge.ping();
    expect(pingRes.message).toBe("pong");
    await cliBridge.dispose();
  });
});
