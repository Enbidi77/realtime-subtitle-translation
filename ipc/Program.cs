using System;
using System.IO;
using System.Text;
using System.Text.Json;
using System.Threading.Tasks;
using EchoLingo.Ipc.Dispatcher;
using EchoLingo.Ipc.Protocol;
using EchoLingo.Ipc.Services.Ocr;
using EchoLingo.Ipc.Services.Speech;

namespace EchoLingo.Ipc;

public static class Program
{
    private static readonly JsonSerializerOptions _jsonOpts = new()
    {
        PropertyNamingPolicy = JsonNamingPolicy.CamelCase,
        WriteIndented = false
    };

    public static async Task<int> Main(string[] args)
    {
        // Ensure UTF-8 output encoding for international speech/OCR texts
        Console.OutputEncoding = Encoding.UTF8;
        Console.InputEncoding = Encoding.UTF8;

        var speechService = new SapiSpeechService();
        var ocrService = new WindowsOcrService();
        var dispatcher = new CommandDispatcher(speechService, ocrService);

        // 1. Daemon / stdio mode
        if (args.Length == 0 || args[0].Equals("--daemon", StringComparison.OrdinalIgnoreCase) ||
            args[0].Equals("--stdio", StringComparison.OrdinalIgnoreCase))
        {
            await RunDaemonModeAsync(dispatcher);
            return 0;
        }

        // 2. Backward compatibility with legacy SAPI CLI:
        //    Legacy CLI format:
        //    `sapi-recognizer.exe --list`
        //    `sapi-recognizer.exe <wavPath> [targetLang]`
        if (args[0].Equals("--list", StringComparison.OrdinalIgnoreCase))
        {
            var recognizers = speechService.GetInstalledRecognizers();
            Console.WriteLine(JsonSerializer.Serialize(recognizers, _jsonOpts));
            return 0;
        }

        if (args.Length >= 1 && (args[0].EndsWith(".wav", StringComparison.OrdinalIgnoreCase) ||
                                File.Exists(args[0])))
        {
            var wavPath = args[0];
            var lang = args.Length > 1 ? args[1] : null;
            var res = speechService.Transcribe(wavPath, lang);
            Console.WriteLine(JsonSerializer.Serialize(res, _jsonOpts));
            return string.IsNullOrEmpty(res.Error) ? 0 : 1;
        }

        // 3. Subcommand CLI mode
        var command = args[0].ToLowerInvariant();
        switch (command)
        {
            case "ping":
            {
                var response = await dispatcher.DispatchAsync(new IpcRequest { Command = "ping" });
                Console.WriteLine(JsonSerializer.Serialize(response.Result, _jsonOpts));
                return response.Success ? 0 : 1;
            }

            case "speech":
            {
                var action = args.Length > 1 ? args[1].ToLowerInvariant() : "recognizers";
                if (action == "recognizers" || action == "list" || action == "--list")
                {
                    var response = await dispatcher.DispatchAsync(new IpcRequest { Command = "speech:recognizers" });
                    Console.WriteLine(JsonSerializer.Serialize(response.Result, _jsonOpts));
                    return response.Success ? 0 : 1;
                }
                if (action == "transcribe")
                {
                    var wav = args.Length > 2 ? args[2] : "";
                    var lang = args.Length > 3 ? args[3] : "";
                    var payload = JsonSerializer.SerializeToElement(new SpeechTranscribeRequest
                    {
                        WavPath = wav,
                        TargetLang = lang
                    });
                    var response = await dispatcher.DispatchAsync(new IpcRequest
                    {
                        Command = "speech:transcribe",
                        Payload = payload
                    });
                    Console.WriteLine(JsonSerializer.Serialize(response.Result, _jsonOpts));
                    return response.Success ? 0 : 1;
                }
                break;
            }

            case "ocr":
            {
                var action = args.Length > 1 ? args[1].ToLowerInvariant() : "languages";
                if (action == "languages" || action == "list" || action == "--list")
                {
                    var response = await dispatcher.DispatchAsync(new IpcRequest { Command = "ocr:languages" });
                    Console.WriteLine(JsonSerializer.Serialize(response.Result, _jsonOpts));
                    return response.Success ? 0 : 1;
                }
                if (action == "recognize")
                {
                    var image = args.Length > 2 ? args[2] : "";
                    var lang = args.Length > 3 ? args[3] : "";
                    var payload = JsonSerializer.SerializeToElement(new OcrRecognizeRequest
                    {
                        ImagePath = image,
                        LanguageTag = lang
                    });
                    var response = await dispatcher.DispatchAsync(new IpcRequest
                    {
                        Command = "ocr:recognize",
                        Payload = payload
                    });
                    Console.WriteLine(JsonSerializer.Serialize(response.Result, _jsonOpts));
                    return response.Success ? 0 : 1;
                }
                break;
            }

            default:
            {
                Console.Error.WriteLine($"EchoLingo IPC Helper: Unknown command '{command}'");
                Console.WriteLine(JsonSerializer.Serialize(new
                {
                    error = $"Unknown command: {command}",
                    availableCommands = new[]
                    {
                        "ping",
                        "speech list",
                        "speech transcribe <wavPath> [lang]",
                        "ocr list",
                        "ocr recognize <imagePath> [lang]",
                        "--daemon"
                    }
                }, _jsonOpts));
                return 1;
            }
        }

        return 0;
    }

    private static async Task RunDaemonModeAsync(CommandDispatcher dispatcher)
    {
        // Ready banner on stderr so stdout is purely protocol JSON messages
        Console.Error.WriteLine("[EchoLingo.Ipc] Daemon ready, listening on stdio.");

        string? line;
        while ((line = await Console.In.ReadLineAsync()) != null)
        {
            if (string.IsNullOrWhiteSpace(line)) continue;

            if (line.Trim().Equals("exit", StringComparison.OrdinalIgnoreCase) ||
                line.Trim().Equals("quit", StringComparison.OrdinalIgnoreCase))
            {
                break;
            }

            try
            {
                var request = JsonSerializer.Deserialize<IpcRequest>(line, _jsonOpts);
                if (request == null)
                {
                    var errResponse = IpcResponse.Fail(null, "Failed to parse JSON request");
                    Console.WriteLine(JsonSerializer.Serialize(errResponse, _jsonOpts));
                    continue;
                }

                var response = await dispatcher.DispatchAsync(request);
                var json = JsonSerializer.Serialize(response, _jsonOpts);
                Console.WriteLine(json);
            }
            catch (Exception ex)
            {
                var errResponse = IpcResponse.Fail(null, $"Unhandled exception: {ex.Message}");
                Console.WriteLine(JsonSerializer.Serialize(errResponse, _jsonOpts));
            }
        }
    }
}

