using System;
using System.Collections.Generic;
using System.IO;
using System.Linq;
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

    private static bool IsChineseLanguage(string tag)
    {
        if (string.IsNullOrWhiteSpace(tag)) return false;
        var lower = tag.ToLowerInvariant();
        return lower.StartsWith("zh") || lower.Contains("chinese") || lower.Contains("chi_") || lower.Contains("hant") || lower.Contains("hans");
    }

    private static List<string> GetLanguageCandidates(string tag)
    {
        var lower = tag.ToLowerInvariant().Replace('_', '-');
        var list = new List<string>();

        if (lower.Contains("hans") || lower == "zh-cn" || lower == "zh-sg" || lower == "chi_sim" || lower == "zh")
        {
            // Simplified Chinese priority, with Traditional Chinese fallback
            list.AddRange(new[] { "zh-Hans-CN", "zh-CN", "zh-Hans", "zh-SG", "zh-Hant-TW", "zh-TW", "zh-Hant", "zh-HK", "zh-MO" });
        }
        else if (lower.Contains("hant") || lower == "zh-tw" || lower == "zh-hk" || lower == "zh-mo" || lower == "chi_tra")
        {
            // Traditional Chinese priority, with Simplified Chinese fallback
            list.AddRange(new[] { "zh-Hant-TW", "zh-TW", "zh-Hant", "zh-HK", "zh-MO", "zh-Hans-CN", "zh-CN", "zh-Hans" });
        }
        else if (lower.StartsWith("zh"))
        {
            list.AddRange(new[] { "zh-Hans-CN", "zh-Hant-TW", "zh-CN", "zh-TW", "zh-Hans", "zh-Hant", "zh-HK" });
        }
        else if (lower.StartsWith("ja") || lower == "jpn")
        {
            list.AddRange(new[] { "ja-JP", "ja" });
        }
        else if (lower.StartsWith("ko") || lower == "kor")
        {
            list.AddRange(new[] { "ko-KR", "ko" });
        }
        else if (lower.StartsWith("vi") || lower == "vie")
        {
            list.AddRange(new[] { "vi-VN", "vi" });
        }
        else if (lower.StartsWith("en") || lower == "eng")
        {
            list.AddRange(new[] { "en-US", "en-GB", "en-CA", "en-AU", "en" });
        }
        else if (lower.StartsWith("fr") || lower == "fra" || lower == "fre")
        {
            list.AddRange(new[] { "fr-FR", "fr-CA", "fr" });
        }
        else if (lower.StartsWith("de") || lower == "deu" || lower == "ger")
        {
            list.AddRange(new[] { "de-DE", "de-AT", "de-CH", "de" });
        }
        else if (lower.StartsWith("es") || lower == "spa")
        {
            list.AddRange(new[] { "es-ES", "es-MX", "es" });
        }
        else if (lower.StartsWith("ru") || lower == "rus")
        {
            list.AddRange(new[] { "ru-RU", "ru" });
        }
        else if (lower.StartsWith("pt") || lower == "por")
        {
            list.AddRange(new[] { "pt-BR", "pt-PT", "pt" });
        }
        else if (lower.StartsWith("it") || lower == "ita")
        {
            list.AddRange(new[] { "it-IT", "it" });
        }

        return list;
    }

    private static (OcrEngine? Engine, string? Error) ResolveEngine(string? languageTag)
    {
        var available = OcrEngine.AvailableRecognizerLanguages;
        if (available.Count == 0)
        {
            return (null, "No supported Windows OCR language engines are installed on this system.");
        }

        // 1. Explicit language requested
        if (!string.IsNullOrWhiteSpace(languageTag) && !languageTag.Equals("auto", StringComparison.OrdinalIgnoreCase))
        {
            var clean = languageTag.Trim();

            // 1a. Direct check via WinRT Language
            try
            {
                var directLang = new Language(clean);
                if (OcrEngine.IsLanguageSupported(directLang))
                {
                    var directEngine = OcrEngine.TryCreateFromLanguage(directLang);
                    if (directEngine != null) return (directEngine, null);
                }
            }
            catch { /* Ignore invalid tag format */ }

            // 1b. Exact case-insensitive match on AvailableRecognizerLanguages
            foreach (var avail in available)
            {
                if (avail.LanguageTag.Equals(clean, StringComparison.OrdinalIgnoreCase) ||
                    avail.DisplayName.Equals(clean, StringComparison.OrdinalIgnoreCase))
                {
                    var eng = OcrEngine.TryCreateFromLanguage(avail);
                    if (eng != null) return (eng, null);
                }
            }

            // 1c. Intelligent candidate expansion based on language code/script
            var candidates = GetLanguageCandidates(clean);
            foreach (var cand in candidates)
            {
                // Check if candidate matches any available recognizer
                foreach (var avail in available)
                {
                    if (avail.LanguageTag.Equals(cand, StringComparison.OrdinalIgnoreCase) ||
                        avail.LanguageTag.StartsWith(cand + "-", StringComparison.OrdinalIgnoreCase) ||
                        cand.StartsWith(avail.LanguageTag, StringComparison.OrdinalIgnoreCase))
                    {
                        var eng = OcrEngine.TryCreateFromLanguage(avail);
                        if (eng != null) return (eng, null);
                    }
                }

                // Also try IsLanguageSupported with candidate
                try
                {
                    var candLang = new Language(cand);
                    if (OcrEngine.IsLanguageSupported(candLang))
                    {
                        var eng = OcrEngine.TryCreateFromLanguage(candLang);
                        if (eng != null) return (eng, null);
                    }
                }
                catch { }
            }

            // 1d. Prefix / language family match on available languages (e.g. "zh-Hans" -> any "zh-")
            var basePrefix = clean.Split(new[] { '-', '_' }, StringSplitOptions.RemoveEmptyEntries)[0];
            foreach (var avail in available)
            {
                if (avail.LanguageTag.StartsWith(basePrefix + "-", StringComparison.OrdinalIgnoreCase) ||
                    avail.LanguageTag.Equals(basePrefix, StringComparison.OrdinalIgnoreCase))
                {
                    var eng = OcrEngine.TryCreateFromLanguage(avail);
                    if (eng != null) return (eng, null);
                }
            }

            // 1e. If Chinese was requested and ANY Chinese recognizer exists, use it!
            if (IsChineseLanguage(clean))
            {
                foreach (var avail in available)
                {
                    if (IsChineseLanguage(avail.LanguageTag))
                    {
                        var eng = OcrEngine.TryCreateFromLanguage(avail);
                        if (eng != null) return (eng, null);
                    }
                }
            }

            // 1f. If a specific non-Latin/distinct language was requested and not installed,
            // DO NOT silently fall back to an unrelated Latin/English recognizer!
            // Silently running English for Chinese/Japanese/Korean text causes garbage output (e.g. _EikäÜ,).
            var availableList = string.Join(", ", available.Select(l => $"{l.DisplayName} ({l.LanguageTag})"));
            return (null, $"Windows OCR does not have a language pack installed for '{clean}'. Available Windows OCR languages: {availableList}. Please install the language pack in Windows Settings (Time & Language -> Language & Region -> Add a language) or switch to Tesseract OCR.");
        }

        // 2. Auto / Default mode: User profile languages
        var userEngine = OcrEngine.TryCreateFromUserProfileLanguages();
        if (userEngine != null) return (userEngine, null);

        // 3. Fallback to first available recognizer
        var fallback = OcrEngine.TryCreateFromLanguage(available[0]);
        if (fallback != null) return (fallback, null);

        return (null, "No supported Windows OCR engine could be initialized.");
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

            var (engine, error) = ResolveEngine(languageTag);
            if (engine == null)
            {
                return new OcrRecognizeResult
                {
                    Text = string.Empty,
                    Error = error ?? "No supported Windows OCR engine found."
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

