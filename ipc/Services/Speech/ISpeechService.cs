using System.Collections.Generic;
using EchoLingo.Ipc.Protocol;

namespace EchoLingo.Ipc.Services.Speech;

public interface ISpeechService
{
    List<SapiRecognizerItem> GetInstalledRecognizers();
    SpeechTranscribeResult Transcribe(string wavPath, string? targetLang);
}

