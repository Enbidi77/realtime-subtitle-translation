using System;
using System.Collections.Concurrent;
using System.Collections.Generic;
using System.Text.Json;
using System.Threading.Tasks;
using EchoLingo.Ipc.Protocol;
using EchoLingo.Ipc.Services.Handwriting;
using EchoLingo.Ipc.Services.Ocr;
using EchoLingo.Ipc.Services.Speech;

namespace EchoLingo.Ipc.Dispatcher;

public class CommandDispatcher
{
    private readonly ConcurrentDictionary<string, Func<JsonElement?, Task<object?>>> _handlers = new(StringComparer.OrdinalIgnoreCase);
    private readonly ISpeechService _speechService;
    private readonly IOcrService _ocrService;
    private readonly IHandwritingService _handwritingService;
    private static readonly JsonSerializerOptions _jsonOpts = new()
    {
        PropertyNameCaseInsensitive = true
    };

    public CommandDispatcher(
        ISpeechService speechService,
        IOcrService ocrService,
        IHandwritingService handwritingService)
    {
        _speechService = speechService;
        _ocrService = ocrService;
        _handwritingService = handwritingService;
        RegisterDefaultHandlers();
    }

    public void Register(string command, Func<JsonElement?, Task<object?>> handler)
    {
        _handlers[command] = handler;
    }

    public async Task<IpcResponse> DispatchAsync(IpcRequest request)
    {
        if (string.IsNullOrWhiteSpace(request.Command))
        {
            return IpcResponse.Fail(request.Id, "Command cannot be empty");
        }

        if (!_handlers.TryGetValue(request.Command, out var handler))
        {
            return IpcResponse.Fail(request.Id, $"Unknown command: '{request.Command}'");
        }

        try
        {
            var result = await handler(request.Payload);
            return IpcResponse.Ok(request.Id, result);
        }
        catch (Exception ex)
        {
            return IpcResponse.Fail(request.Id, ex.Message);
        }
    }

    private void RegisterDefaultHandlers()
    {
        // System
        Register("ping", _ => Task.FromResult<object?>(new
        {
            message = "pong",
            version = "1.0.0",
            timestamp = DateTimeOffset.UtcNow.ToUnixTimeMilliseconds(),
            platform = "win32"
        }));

        // Speech
        Register("speech:recognizers", _ =>
        {
            var list = _speechService.GetInstalledRecognizers();
            return Task.FromResult<object?>(list);
        });

        Register("speech:transcribe", payload =>
        {
            if (payload == null || payload.Value.ValueKind != JsonValueKind.Object)
            {
                throw new ArgumentException("Payload must be an object with 'wavPath'");
            }
            var req = payload.Value.Deserialize<SpeechTranscribeRequest>(_jsonOpts)
                      ?? throw new ArgumentException("Invalid speech transcription payload");
            var result = _speechService.Transcribe(req.WavPath, req.TargetLang);
            return Task.FromResult<object?>(result);
        });

        // OCR
        Register("ocr:languages", _ =>
        {
            var langs = _ocrService.GetAvailableLanguages();
            return Task.FromResult<object?>(langs);
        });

        Register("ocr:recognize", async payload =>
        {
            if (payload == null || payload.Value.ValueKind != JsonValueKind.Object)
            {
                throw new ArgumentException("Payload must be an object with 'imagePath'");
            }
            var req = payload.Value.Deserialize<OcrRecognizeRequest>(_jsonOpts)
                      ?? throw new ArgumentException("Invalid OCR recognize payload");
            var result = await _ocrService.RecognizeAsync(req.ImagePath, req.LanguageTag);
            return result;
        });

        // Handwriting
        Register("handwriting:recognize", async payload =>
        {
            if (payload == null || payload.Value.ValueKind != JsonValueKind.Object)
            {
                throw new ArgumentException("Payload must be an object with 'strokes'");
            }
            var req = payload.Value.Deserialize<HandwritingRecognizeRequest>(_jsonOpts)
                      ?? throw new ArgumentException("Invalid handwriting recognize payload");
            var result = await _handwritingService.RecognizeAsync(req);
            return result;
        });
    }
}

