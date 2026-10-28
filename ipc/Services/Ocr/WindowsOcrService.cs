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
        else if (lower.StartsWith("id") || lower == "ind")
        {
            list.AddRange(new[] { "id-ID", "id" });
        }
        else if (lower.StartsWith("ms") || lower == "msa" || lower == "may")
        {
            list.AddRange(new[] { "ms-MY", "ms-BN", "ms" });
        }
        else if (lower.StartsWith("th") || lower == "tha")
        {
            list.AddRange(new[] { "th-TH", "th" });
        }
        else if (lower.StartsWith("fil") || lower.StartsWith("tl") || lower == "tgl")
        {
            list.AddRange(new[] { "fil-PH", "tl-PH", "fil", "tl" });
        }
        else if (lower.StartsWith("hi") || lower == "hin")
        {
            list.AddRange(new[] { "hi-IN", "hi" });
        }
        else if (lower.StartsWith("ar") || lower == "ara")
        {
            list.AddRange(new[] { "ar-SA", "ar-EG", "ar-AE", "ar" });
        }
        else if (lower.StartsWith("nl") || lower == "nld" || lower == "dut")
        {
            list.AddRange(new[] { "nl-NL", "nl-BE", "nl" });
        }
        else if (lower.StartsWith("pl") || lower == "pol")
        {
            list.AddRange(new[] { "pl-PL", "pl" });
        }
        else if (lower.StartsWith("tr") || lower == "tur")
        {
            list.AddRange(new[] { "tr-TR", "tr" });
        }
        else if (lower.StartsWith("uk") || lower == "ukr")
        {
            list.AddRange(new[] { "uk-UA", "uk" });
        }
        else if (lower.StartsWith("sv") || lower == "swe")
        {
            list.AddRange(new[] { "sv-SE", "sv-FI", "sv" });
        }
        else if (lower.StartsWith("cs") || lower == "ces" || lower == "cze")
        {
            list.AddRange(new[] { "cs-CZ", "cs" });
        }
        else if (lower.StartsWith("da") || lower == "dan")
        {
            list.AddRange(new[] { "da-DK", "da" });
        }
        else if (lower.StartsWith("fi") || lower == "fin")
        {
            list.AddRange(new[] { "fi-FI", "fi" });
        }
        else if (lower.StartsWith("el") || lower == "ell" || lower == "gre")
        {
            list.AddRange(new[] { "el-GR", "el" });
        }
        else if (lower.StartsWith("he") || lower == "heb")
        {
            list.AddRange(new[] { "he-IL", "he" });
        }
        else if (lower.StartsWith("hu") || lower == "hun")
        {
            list.AddRange(new[] { "hu-HU", "hu" });
        }
        else if (lower.StartsWith("no") || lower.StartsWith("nb") || lower.StartsWith("nn") || lower == "nor")
        {
            list.AddRange(new[] { "nb-NO", "nn-NO", "no" });
        }
        else if (lower.StartsWith("ro") || lower == "ron" || lower == "rum")
        {
            list.AddRange(new[] { "ro-RO", "ro" });
        }
        else if (lower.StartsWith("sk") || lower == "slk" || lower == "slo")
        {
            list.AddRange(new[] { "sk-SK", "sk" });
        }
        else if (lower.StartsWith("bg") || lower == "bul")
        {
            list.AddRange(new[] { "bg-BG", "bg" });
        }
        else if (lower.StartsWith("hr") || lower == "hrv")
        {
            list.AddRange(new[] { "hr-HR", "hr" });
        }
        else if (lower.StartsWith("sr") || lower == "srp")
        {
            list.AddRange(new[] { "sr-Cyrl-RS", "sr-Latn-RS", "sr-RS", "sr" });
        }
        else if (lower.StartsWith("sl") || lower == "slv")
        {
            list.AddRange(new[] { "sl-SI", "sl" });
        }
        else if (lower.StartsWith("lt") || lower == "lit")
        {
            list.AddRange(new[] { "lt-LT", "lt" });
        }
        else if (lower.StartsWith("lv") || lower == "lav")
        {
            list.AddRange(new[] { "lv-LV", "lv" });
        }
        else if (lower.StartsWith("et") || lower == "est")
        {
            list.AddRange(new[] { "et-EE", "et" });
        }
        else if (lower.StartsWith("ca") || lower == "cat")
        {
            list.AddRange(new[] { "ca-ES", "ca" });
        }
        else if (lower.StartsWith("bn") || lower == "ben")
        {
            list.AddRange(new[] { "bn-IN", "bn-BD", "bn" });
        }
        else if (lower.StartsWith("ta") || lower == "tam")
        {
            list.AddRange(new[] { "ta-IN", "ta-LK", "ta" });
        }
        else if (lower.StartsWith("te") || lower == "tel")
        {
            list.AddRange(new[] { "te-IN", "te" });
        }
        else if (lower.StartsWith("ur") || lower == "urd")
        {
            list.AddRange(new[] { "ur-PK", "ur-IN", "ur" });
        }
        else if (lower.StartsWith("fa") || lower == "fas" || lower == "per")
        {
            list.AddRange(new[] { "fa-IR", "fa" });
        }
        else if (lower.StartsWith("sw") || lower == "swa")
        {
            list.AddRange(new[] { "sw-KE", "sw-TZ", "sw" });
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

