using System;
using System.Collections.Generic;
using System.Text.Json;
using System.Text.Json.Serialization;

namespace EchoLingo.Ipc.Protocol;

public class IpcRequest
{
    [JsonPropertyName("id")]
    public string? Id { get; set; }

    [JsonPropertyName("command")]
    public string Command { get; set; } = string.Empty;

    [JsonPropertyName("payload")]
    public JsonElement? Payload { get; set; }
}

public class IpcResponse
{
    [JsonPropertyName("id")]
    public string? Id { get; set; }

    [JsonPropertyName("success")]
    public bool Success { get; set; }

    [JsonPropertyName("result")]
    public object? Result { get; set; }

    [JsonPropertyName("error")]
    public string? Error { get; set; }

    public static IpcResponse Ok(string? id, object? result) =>
        new() { Id = id, Success = true, Result = result };

    public static IpcResponse Fail(string? id, string error) =>
        new() { Id = id, Success = false, Error = error };
}

public class SpeechTranscribeRequest
{
    [JsonPropertyName("wavPath")]
    public string WavPath { get; set; } = string.Empty;

    [JsonPropertyName("targetLang")]
    public string? TargetLang { get; set; }
}

public class SpeechTranscribeResult
{
    [JsonPropertyName("text")]
    public string Text { get; set; } = string.Empty;

    [JsonPropertyName("confidence")]
    public double Confidence { get; set; }

    [JsonPropertyName("culture")]
    public string? Culture { get; set; }

    [JsonPropertyName("error")]
    public string? Error { get; set; }
}

public class SapiRecognizerItem
{
    [JsonPropertyName("id")]
    public string Id { get; set; } = string.Empty;

    [JsonPropertyName("name")]
    public string Name { get; set; } = string.Empty;

    [JsonPropertyName("culture")]
    public string Culture { get; set; } = string.Empty;

    [JsonPropertyName("description")]
    public string Description { get; set; } = string.Empty;
}

public class OcrRecognizeRequest
{
    [JsonPropertyName("imagePath")]
    public string ImagePath { get; set; } = string.Empty;

    [JsonPropertyName("languageTag")]
    public string? LanguageTag { get; set; }
}

public class BoundingBoxDto
{
    [JsonPropertyName("x")]
    public int X { get; set; }

    [JsonPropertyName("y")]
    public int Y { get; set; }

    [JsonPropertyName("width")]
    public int Width { get; set; }

    [JsonPropertyName("height")]
    public int Height { get; set; }
}

public class OcrWordDto
{
    [JsonPropertyName("text")]
    public string Text { get; set; } = string.Empty;

    [JsonPropertyName("confidence")]
    public double Confidence { get; set; } = 0.95;

    [JsonPropertyName("boundingBox")]
    public BoundingBoxDto BoundingBox { get; set; } = new();
}

public class OcrLineDto
{
    [JsonPropertyName("text")]
    public string Text { get; set; } = string.Empty;

    [JsonPropertyName("confidence")]
    public double Confidence { get; set; } = 0.95;

    [JsonPropertyName("words")]
    public List<OcrWordDto> Words { get; set; } = new();
}

public class OcrRecognizeResult
{
    [JsonPropertyName("text")]
    public string Text { get; set; } = string.Empty;

    [JsonPropertyName("lines")]
    public List<OcrLineDto> Lines { get; set; } = new();

    [JsonPropertyName("detectedLanguage")]
    public string? DetectedLanguage { get; set; }

    [JsonPropertyName("error")]
    public string? Error { get; set; }
}

public class OcrLanguageDto
{
    [JsonPropertyName("languageTag")]
    public string LanguageTag { get; set; } = string.Empty;

    [JsonPropertyName("displayName")]
    public string DisplayName { get; set; } = string.Empty;
}

public class HandwritingStrokePointDto
{
    [JsonPropertyName("x")]
    public double X { get; set; }

    [JsonPropertyName("y")]
    public double Y { get; set; }

    [JsonPropertyName("pressure")]
    public float? Pressure { get; set; }

    [JsonPropertyName("timestamp")]
    public long? Timestamp { get; set; }
}

public class HandwritingStrokeDto
{
    [JsonPropertyName("points")]
    public List<HandwritingStrokePointDto> Points { get; set; } = new();
}

public class HandwritingRecognizeRequest
{
    [JsonPropertyName("strokes")]
    public List<HandwritingStrokeDto> Strokes { get; set; } = new();

    [JsonPropertyName("languageTag")]
    public string? LanguageTag { get; set; }
}

public class HandwritingRecognizeResult
{
    [JsonPropertyName("text")]
    public string Text { get; set; } = string.Empty;

    [JsonPropertyName("lines")]
    public List<OcrLineDto> Lines { get; set; } = new();

    [JsonPropertyName("candidates")]
    public List<string> Candidates { get; set; } = new();

    [JsonPropertyName("confidence")]
    public double Confidence { get; set; } = 0.95;

    [JsonPropertyName("detectedLanguage")]
    public string? DetectedLanguage { get; set; }

    [JsonPropertyName("error")]
    public string? Error { get; set; }
}

