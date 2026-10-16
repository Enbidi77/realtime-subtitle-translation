using System.Collections.Generic;
using System.Threading.Tasks;
using EchoLingo.Ipc.Protocol;

namespace EchoLingo.Ipc.Services.Ocr;

public interface IOcrService
{
    List<OcrLanguageDto> GetAvailableLanguages();
    Task<OcrRecognizeResult> RecognizeAsync(string imagePath, string? languageTag);
}

