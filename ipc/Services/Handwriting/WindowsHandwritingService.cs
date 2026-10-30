using System;
using System.Collections.Generic;
using System.Linq;
using System.Text;
using System.Threading.Tasks;
using Windows.Foundation;
using Windows.UI.Input.Inking;
using Windows.UI.Input.Inking.Analysis;
using EchoLingo.Ipc.Protocol;

namespace EchoLingo.Ipc.Services.Handwriting;

public class WindowsHandwritingService : IHandwritingService
{
    public async Task<HandwritingRecognizeResult> RecognizeAsync(HandwritingRecognizeRequest request)
    {
        if (request?.Strokes == null || request.Strokes.Count == 0)
        {
            return new HandwritingRecognizeResult
            {
                Text = string.Empty,
                Lines = new List<OcrLineDto>(),
                Candidates = new List<string>(),
                Confidence = 1.0
            };
        }

        // 1. Try InkRecognizerContainer first (supports CJK, Chinese, Japanese, Korean, Latin language selection)
        try
        {
            var container = new InkRecognizerContainer();
            var recognizers = container.GetRecognizers();

            var strokeContainer = new InkStrokeContainer();
            var strokeBuilder = new InkStrokeBuilder();

            foreach (var strokeDto in request.Strokes)
            {
                if (strokeDto.Points == null || strokeDto.Points.Count < 2) continue;

                var points = strokeDto.Points.Select(p => new Point(p.X, p.Y)).ToList();
                var stroke = strokeBuilder.CreateStroke(points);
                strokeContainer.AddStroke(stroke);
            }

            var isAuto = string.IsNullOrWhiteSpace(request.LanguageTag) ||
                         request.LanguageTag.Equals("auto", StringComparison.OrdinalIgnoreCase);

            if (!isAuto)
            {
                var selectedRecognizer = SelectRecognizer(recognizers, request.LanguageTag);
                if (selectedRecognizer != null)
                {
                    container.SetDefaultRecognizer(selectedRecognizer);
                }

                var result = await RecognizeWithContainerAsync(container, strokeContainer, request.LanguageTag);
                if (result != null) return result;
            }
            else
            {
                // Auto-detect mode:
                // 1. Recognize with default recognizer (system default, e.g. English)
                var defaultResult = await RecognizeWithContainerAsync(container, strokeContainer, "en");

                // 2. Check if a CJK recognizer (Chinese, Japanese, Korean) is installed
                var cjkRecognizer = recognizers.FirstOrDefault(r =>
                    r.Name.Contains("中文") || r.Name.Contains("Chinese") ||
                    r.Name.Contains("日本語") || r.Name.Contains("Japanese") ||
                    r.Name.Contains("한국어") || r.Name.Contains("Korean"));

                if (cjkRecognizer != null)
                {
                    var cjkContainer = new InkRecognizerContainer();
                    cjkContainer.SetDefaultRecognizer(cjkRecognizer);
                    var cjkTag = (cjkRecognizer.Name.Contains("中文") || cjkRecognizer.Name.Contains("Chinese")) ? "zh" :
                                 (cjkRecognizer.Name.Contains("日本語") || cjkRecognizer.Name.Contains("Japanese")) ? "ja" : "ko";

                    var cjkResult = await RecognizeWithContainerAsync(cjkContainer, strokeContainer, cjkTag);

                    if (cjkResult != null && cjkResult.Text.Any(IsCjk))
                    {
                        // If default English result is empty, whitespace, or just symbols/punctuation (+, ^, #, ~, /, \, etc.),
                        // the strokes represent CJK characters that English couldn't understand.
                        if (defaultResult == null ||
                            string.IsNullOrWhiteSpace(defaultResult.Text) ||
                            IsSymbolOrPunctuation(defaultResult.Text))
                        {
                            return cjkResult;
                        }

                        // Otherwise merge CJK candidates into defaultResult candidates so user has options
                        foreach (var cand in cjkResult.Candidates)
                        {
                            if (!defaultResult.Candidates.Contains(cand))
                            {
                                defaultResult.Candidates.Add(cand);
                            }
                        }
                    }
                }

                if (defaultResult != null) return defaultResult;
            }
        }
        catch
        {
            // Fall through to InkAnalyzer
        }

        // 2. Fallback to InkAnalyzer (layout & structure analysis)
        try
        {
            var analyzer = new InkAnalyzer();
            var strokeBuilder = new InkStrokeBuilder();

            foreach (var strokeDto in request.Strokes)
            {
                if (strokeDto.Points == null || strokeDto.Points.Count < 2) continue;

                var points = strokeDto.Points.Select(p => new Point(p.X, p.Y)).ToList();
                var stroke = strokeBuilder.CreateStroke(points);
                analyzer.AddDataForStroke(stroke);
                analyzer.SetStrokeDataKind(stroke.Id, InkAnalysisStrokeKind.Writing);
            }

            var status = await analyzer.AnalyzeAsync();
            var sb = new StringBuilder();
            var lines = new List<OcrLineDto>();
            var allCandidates = new HashSet<string>(StringComparer.OrdinalIgnoreCase);

            var wordsList = new List<OcrWordDto>();
            var wordNodes = analyzer.AnalysisRoot.FindNodes(InkAnalysisNodeKind.InkWord);
            foreach (var node in wordNodes)
            {
                if (node is InkAnalysisInkWord w)
                {
                    var wText = w.RecognizedText?.Trim() ?? string.Empty;
                    wordsList.Add(new OcrWordDto
                    {
                        Text = wText,
                        Confidence = 0.95,
                        BoundingBox = new BoundingBoxDto
                        {
                            X = (int)w.BoundingRect.X,
                            Y = (int)w.BoundingRect.Y,
                            Width = (int)w.BoundingRect.Width,
                            Height = (int)w.BoundingRect.Height
                        }
                    });

                    if (w.TextAlternates != null)
                    {
                        foreach (var alt in w.TextAlternates)
                        {
                            if (!string.IsNullOrWhiteSpace(alt)) allCandidates.Add(alt);
                        }
                    }
                }
            }

            var lineNodes = analyzer.AnalysisRoot.FindNodes(InkAnalysisNodeKind.Line);
            foreach (var node in lineNodes)
            {
                if (node is not InkAnalysisLine line) continue;

                var lineText = line.RecognizedText?.Trim() ?? string.Empty;
                if (!string.IsNullOrEmpty(lineText))
                {
                    if (sb.Length > 0) sb.AppendLine();
                    sb.Append(lineText);
                }

                var words = new List<OcrWordDto>();
                foreach (var childNode in line.Children)
                {
                    if (childNode is InkAnalysisInkWord word)
                    {
                        var wordText = word.RecognizedText?.Trim() ?? string.Empty;
                        words.Add(new OcrWordDto
                        {
                            Text = wordText,
                            Confidence = 0.95,
                            BoundingBox = new BoundingBoxDto
                            {
                                X = (int)word.BoundingRect.X,
                                Y = (int)word.BoundingRect.Y,
                                Width = (int)word.BoundingRect.Width,
                                Height = (int)word.BoundingRect.Height
                            }
                        });

                        var candidates = word.TextAlternates;
                        if (candidates != null)
                        {
                            foreach (var cand in candidates)
                            {
                                if (!string.IsNullOrWhiteSpace(cand)) allCandidates.Add(cand);
                            }
                        }
                    }
                }

                lines.Add(new OcrLineDto
                {
                    Text = lineText,
                    Confidence = 0.95,
                    Words = words
                });
            }

            // Fallback: If no lines were detected but words were found
            if (sb.Length == 0 && wordsList.Count > 0)
            {
                var fallbackText = string.Join(" ", wordsList.Select(w => w.Text).Where(t => !string.IsNullOrEmpty(t)));
                sb.Append(fallbackText);
                lines.Add(new OcrLineDto
                {
                    Text = fallbackText,
                    Confidence = 0.95,
                    Words = wordsList
                });
            }

            try
            {
                analyzer.ClearDataForAllStrokes();
            }
            catch
            {
                // Ignore cleanup error
            }

            return new HandwritingRecognizeResult
            {
                Text = sb.ToString(),
                Lines = lines,
                Candidates = allCandidates.Take(10).ToList(),
                Confidence = 0.95
            };
        }
        catch (Exception ex)
        {
            return new HandwritingRecognizeResult
            {
                Text = string.Empty,
                Error = $"Windows Handwriting analysis failed: {ex.Message}"
            };
        }
    }

    public List<string> GetInstalledRecognizers()
    {
        var list = new List<string>();
        try
        {
            var container = new InkRecognizerContainer();
            foreach (var r in container.GetRecognizers())
            {
                list.Add(r.Name);
            }
        }
        catch { }
        return list;
    }

    private static InkRecognizer? SelectRecognizer(IReadOnlyList<InkRecognizer> recognizers, string? languageTag)
    {
        if (recognizers == null || recognizers.Count == 0) return null;
        if (string.IsNullOrWhiteSpace(languageTag) || languageTag.Equals("auto", StringComparison.OrdinalIgnoreCase))
        {
            return null;
        }

        var tag = languageTag.Trim().ToLowerInvariant();

        // Chinese (Simplified or Traditional)
        if (tag.StartsWith("zh") || tag.Contains("chinese"))
        {
            // Traditional Chinese preference
            if (tag.Contains("tw") || tag.Contains("hk") || tag.Contains("hant") || tag.Contains("trad"))
            {
                var match = recognizers.FirstOrDefault(r =>
                    r.Name.Contains("繁體") || r.Name.Contains("Traditional") || r.Name.Contains("CHT") || r.Name.Contains("Hong Kong") || r.Name.Contains("Taiwan"));
                if (match != null) return match;
            }

            // Simplified Chinese preference
            if (tag.Contains("cn") || tag.Contains("hans") || tag.Contains("simp"))
            {
                var match = recognizers.FirstOrDefault(r =>
                    r.Name.Contains("简体") || r.Name.Contains("Simplified") || r.Name.Contains("CHS") || r.Name.Contains("China"));
                if (match != null) return match;
            }

            // Any Chinese recognizer
            return recognizers.FirstOrDefault(r => r.Name.Contains("中文") || r.Name.Contains("Chinese"));
        }

        // Japanese
        if (tag.StartsWith("ja") || tag.Contains("japanese"))
        {
            return recognizers.FirstOrDefault(r => r.Name.Contains("日本語") || r.Name.Contains("Japanese"));
        }

        // Korean
        if (tag.StartsWith("ko") || tag.Contains("korean"))
        {
            return recognizers.FirstOrDefault(r => r.Name.Contains("한국어") || r.Name.Contains("Korean"));
        }

        // English
        if (tag.StartsWith("en"))
        {
            return recognizers.FirstOrDefault(r => r.Name.Contains("English"));
        }

        // French
        if (tag.StartsWith("fr"))
        {
            return recognizers.FirstOrDefault(r => r.Name.Contains("Français") || r.Name.Contains("French"));
        }

        // German
        if (tag.StartsWith("de"))
        {
            return recognizers.FirstOrDefault(r => r.Name.Contains("Deutsch") || r.Name.Contains("German"));
        }

        // Spanish
        if (tag.StartsWith("es"))
        {
            return recognizers.FirstOrDefault(r => r.Name.Contains("Español") || r.Name.Contains("Spanish"));
        }

        // Russian
        if (tag.StartsWith("ru"))
        {
            return recognizers.FirstOrDefault(r => r.Name.Contains("Русский") || r.Name.Contains("Russian"));
        }

        // Vietnamese
        if (tag.StartsWith("vi"))
        {
            return recognizers.FirstOrDefault(r => r.Name.Contains("Tiếng Việt") || r.Name.Contains("Vietnamese"));
        }

        return null;
    }

    private static bool IsCjk(char c)
    {
        return (c >= 0x4E00 && c <= 0x9FFF) || // CJK Unified Ideographs
               (c >= 0x3400 && c <= 0x4DBF) || // CJK Extension A
               (c >= 0x20000 && c <= 0x2A6DF) || // CJK Extension B
               (c >= 0xF900 && c <= 0xFAFF) || // CJK Compatibility Ideographs
               (c >= 0x3040 && c <= 0x309F) || // Hiragana
               (c >= 0x30A0 && c <= 0x30FF) || // Katakana
               (c >= 0xAC00 && c <= 0xD7AF);   // Hangul
    }

    private static bool IsSymbolOrPunctuation(string text)
    {
        var trimmed = text.Trim();
        if (trimmed.Length == 0) return true;
        return trimmed.All(c => char.IsPunctuation(c) || char.IsSymbol(c) || char.IsWhiteSpace(c));
    }

    private static async Task<HandwritingRecognizeResult?> RecognizeWithContainerAsync(
        InkRecognizerContainer container,
        InkStrokeContainer strokeContainer,
        string? langTag)
    {
        var results = await container.RecognizeAsync(strokeContainer, InkRecognitionTarget.All);
        if (results == null || results.Count == 0) return null;

        var sb = new StringBuilder();
        var lines = new List<OcrLineDto>();
        var allCandidates = new HashSet<string>(StringComparer.OrdinalIgnoreCase);

        foreach (var res in results)
        {
            var candidates = res.GetTextCandidates();
            if (candidates != null && candidates.Count > 0)
            {
                var topCandidate = candidates[0].Trim();

                var isCjkTarget = !string.IsNullOrEmpty(langTag) &&
                    (langTag.StartsWith("zh", StringComparison.OrdinalIgnoreCase) ||
                     langTag.StartsWith("ja", StringComparison.OrdinalIgnoreCase) ||
                     langTag.StartsWith("ko", StringComparison.OrdinalIgnoreCase));

                if (isCjkTarget || IsSymbolOrPunctuation(topCandidate))
                {
                    var cjkCandidate = candidates.FirstOrDefault(c => c.Any(IsCjk));
                    if (!string.IsNullOrEmpty(cjkCandidate))
                    {
                        topCandidate = cjkCandidate.Trim();
                    }
                }

                if (!string.IsNullOrEmpty(topCandidate))
                {
                    if (sb.Length > 0 && !IsCjk(topCandidate[0]) && !IsCjk(sb[^1]))
                    {
                        sb.Append(' ');
                    }
                    sb.Append(topCandidate);
                }

                allCandidates.Add(topCandidate);

                foreach (var cand in candidates)
                {
                    if (!string.IsNullOrWhiteSpace(cand))
                    {
                        allCandidates.Add(cand.Trim());
                    }
                }

                var wordDto = new OcrWordDto
                {
                    Text = topCandidate,
                    Confidence = 0.95,
                    BoundingBox = new BoundingBoxDto
                    {
                        X = (int)res.BoundingRect.X,
                        Y = (int)res.BoundingRect.Y,
                        Width = (int)res.BoundingRect.Width,
                        Height = (int)res.BoundingRect.Height
                    }
                };

                lines.Add(new OcrLineDto
                {
                    Text = topCandidate,
                    Confidence = 0.95,
                    Words = new List<OcrWordDto> { wordDto }
                });
            }
        }

        if (sb.Length == 0) return null;

        return new HandwritingRecognizeResult
        {
            Text = sb.ToString(),
            Lines = lines,
            Candidates = allCandidates.Take(10).ToList(),
            Confidence = 0.95,
            DetectedLanguage = langTag
        };
    }
}
