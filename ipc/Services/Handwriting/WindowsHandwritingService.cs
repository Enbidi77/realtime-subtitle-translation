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
}
