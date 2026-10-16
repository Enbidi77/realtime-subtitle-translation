using System;
using System.Collections.Generic;
using System.IO;
using System.Speech.Recognition;
using System.Text;
using EchoLingo.Ipc.Protocol;

namespace EchoLingo.Ipc.Services.Speech;

public class SapiSpeechService : ISpeechService
{
    public List<SapiRecognizerItem> GetInstalledRecognizers()
    {
        var result = new List<SapiRecognizerItem>();
        try
        {
            var installed = SpeechRecognitionEngine.InstalledRecognizers();
            foreach (var rec in installed)
            {
                result.Add(new SapiRecognizerItem
                {
                    Id = rec.Id,
                    Name = rec.Name,
                    Culture = rec.Culture.Name,
                    Description = rec.Description
                });
            }
        }
        catch (Exception ex)
        {
            Console.Error.WriteLine($"[SapiSpeechService] Error listing recognizers: {ex.Message}");
        }
        return result;
    }

    public SpeechTranscribeResult Transcribe(string wavPath, string? targetLang)
    {
        if (string.IsNullOrWhiteSpace(wavPath) || !File.Exists(wavPath))
        {
            return new SpeechTranscribeResult
            {
                Text = string.Empty,
                Confidence = 0,
                Error = $"Audio file not found: {wavPath}"
            };
        }

        var installed = SpeechRecognitionEngine.InstalledRecognizers();
        if (installed.Count == 0)
        {
            return new SpeechTranscribeResult
            {
                Text = string.Empty,
                Confidence = 0,
                Error = "No speech recognizers installed in Windows System.Speech."
            };
        }

        RecognizerInfo? selected = null;
        if (!string.IsNullOrWhiteSpace(targetLang) && !targetLang.Equals("auto", StringComparison.OrdinalIgnoreCase))
        {
            foreach (var rec in installed)
            {
                if (rec.Culture.Name.StartsWith(targetLang, StringComparison.OrdinalIgnoreCase) ||
                    rec.Culture.TwoLetterISOLanguageName.Equals(targetLang, StringComparison.OrdinalIgnoreCase))
                {
                    selected = rec;
                    break;
                }
            }
        }

        selected ??= installed[0];

        try
        {
            using var engine = new SpeechRecognitionEngine(selected.Id);
            engine.LoadGrammar(new DictationGrammar());
            engine.SetInputToWaveFile(wavPath);

            var sb = new StringBuilder();
            double totalConfidence = 0;
            int count = 0;

            while (true)
            {
                RecognitionResult? result = null;
                try
                {
                    result = engine.Recognize(TimeSpan.FromSeconds(4));
                }
                catch (InvalidOperationException)
                {
                    // Audio stream end reached
                    break;
                }

                if (result == null) break;

                if (!string.IsNullOrWhiteSpace(result.Text))
                {
                    if (sb.Length > 0) sb.Append(" ");
                    sb.Append(result.Text);
                    totalConfidence += result.Confidence;
                    count++;
                }
            }

            engine.SetInputToNull();

            double avgConf = count > 0 ? Math.Round(totalConfidence / count, 2) : 0.85;
            return new SpeechTranscribeResult
            {
                Text = sb.ToString().Trim(),
                Confidence = avgConf,
                Culture = selected.Culture.Name
            };
        }
        catch (Exception ex)
        {
            return new SpeechTranscribeResult
            {
                Text = string.Empty,
                Confidence = 0,
                Culture = selected?.Culture.Name,
                Error = ex.Message
            };
        }
    }
}

