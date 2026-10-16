using System;
using System.Collections.Generic;
using System.IO;
using System.Threading.Tasks;
using Windows.Globalization;
using Windows.Graphics.Imaging;
using Windows.Media.Ocr;
using Windows.Storage;
using EchoLingo.Ipc.Protocol;

namespace EchoLingo.Ipc.Services.Ocr;

public class WindowsOcrService : IOcrService
{
    public List<OcrLanguageDto> GetAvailableLanguages()
    {
        var list = new List<OcrLanguageDto>();
        try
        {
            var langs = OcrEngine.AvailableRecognizerLanguages;
            foreach (var lang in langs)
            {
                list.Add(new OcrLanguageDto
                {
                    LanguageTag = lang.LanguageTag,
                    DisplayName = lang.DisplayName
                });
            }
        }
        catch (Exception ex)
        {
            Console.Error.WriteLine($"[WindowsOcrService] Error listing languages: {ex.Message}");
        }
        return list;
    }

    public async Task<OcrRecognizeResult> RecognizeAsync(string imagePath, string? languageTag)
    {
        if (string.IsNullOrWhiteSpace(imagePath) || !File.Exists(imagePath))
        {
            return new OcrRecognizeResult
            {
                Text = string.Empty,
                Error = $"Image file not found: {imagePath}"
            };
        }

        try
        {
            var file = await StorageFile.GetFileFromPathAsync(Path.GetFullPath(imagePath));
            using var stream = await file.OpenAsync(FileAccessMode.Read);
            var decoder = await BitmapDecoder.CreateAsync(stream);
            using var bitmap = await decoder.GetSoftwareBitmapAsync();

            OcrEngine? engine = null;
            if (!string.IsNullOrWhiteSpace(languageTag) && !languageTag.Equals("auto", StringComparison.OrdinalIgnoreCase))
            {
                var lang = new Language(languageTag);
                if (OcrEngine.IsLanguageSupported(lang))
                {
                    engine = OcrEngine.TryCreateFromLanguage(lang);
                }
            }

            engine ??= OcrEngine.TryCreateFromUserProfileLanguages();

            if (engine == null)
            {
                var available = OcrEngine.AvailableRecognizerLanguages;
                if (available.Count > 0)
                {
                    engine = OcrEngine.TryCreateFromLanguage(available[0]);
                }
            }

            if (engine == null)
            {
                return new OcrRecognizeResult
                {
                    Text = string.Empty,
                    Error = "No supported Windows OCR engine found."
                };
            }

            var ocrResult = await engine.RecognizeAsync(bitmap);
            var lines = new List<OcrLineDto>();

            foreach (var line in ocrResult.Lines)
            {
                var words = new List<OcrWordDto>();
                foreach (var word in line.Words)
                {
                    words.Add(new OcrWordDto
                    {
                        Text = word.Text,
                        Confidence = 0.95,
                        BoundingBox = new BoundingBoxDto
                        {
                            X = (int)word.BoundingRect.X,
                            Y = (int)word.BoundingRect.Y,
                            Width = (int)word.BoundingRect.Width,
                            Height = (int)word.BoundingRect.Height
                        }
                    });
                }

                lines.Add(new OcrLineDto
                {
                    Text = line.Text,
                    Confidence = 0.95,
                    Words = words
                });
            }

            return new OcrRecognizeResult
            {
                Text = ocrResult.Text,
                Lines = lines,
                DetectedLanguage = engine.RecognizerLanguage.LanguageTag
            };
        }
        catch (Exception ex)
        {
            return new OcrRecognizeResult
            {
                Text = string.Empty,
                Error = ex.Message
            };
        }
    }
}

