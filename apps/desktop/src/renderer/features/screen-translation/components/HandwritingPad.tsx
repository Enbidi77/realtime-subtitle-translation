import React, { useRef, useState, useEffect, useCallback } from 'react';
import {
  OcrProviderCapability,
  OcrProviderId,
  OcrResponse,
  TranslationResult,
  HandwritingStroke,
} from '@echo-lingo/contracts';
import { OCR_PROFILE_PRESETS, OCR_SUPPORTED_LANGUAGES, TARGET_LANGUAGES } from '@echo-lingo/config';
import {
  GlassButton,
  GlassCard,
  GlassBadge,
  GlassSelect,
} from '@/components/ui/index.js';
import { useSettingsStore } from '@/stores/settings-store.js';
import { useI18n } from '@/app/i18n/index.js';
import {
  PenTool,
  Eraser,
  Undo2,
  Trash2,
  Upload,
  Copy,
  Check,
  Volume2,
  Sparkles,
  RefreshCw,
  BookmarkPlus,
  SlidersHorizontal,
  Info,
} from 'lucide-react';

interface HandwritingPadProps {
  ocrProviders: OcrProviderCapability[];
  ocrLanguage?: string;
  onOcrLanguageChange?: (lang: string) => void;
  targetLanguage?: string;
  onTargetLanguageChange?: (lang: string) => void;
  selectedProvider?: OcrProviderId;
  onProviderChange?: (provider: OcrProviderId) => void;
  onSavedToHistory?: () => void;
}

export const HandwritingPad: React.FC<HandwritingPadProps> = ({
  ocrProviders,
  ocrLanguage,
  onOcrLanguageChange,
  targetLanguage,
  onTargetLanguageChange,
  selectedProvider,
  onProviderChange,
  onSavedToHistory,
}) => {
  const { t } = useI18n();
  const { settings } = useSettingsStore();

  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const containerRef = useRef<HTMLDivElement | null>(null);

  // Drawing state
  const [tool, setTool] = useState<'pen' | 'eraser'>('pen');
  const [brushSize, setBrushSize] = useState<number>(3);
  const [brushColor, setBrushColor] = useState<string>('#ffffff');
  const [isDrawing, setIsDrawing] = useState<boolean>(false);
  const [strokes, setStrokes] = useState<HandwritingStroke[]>([]);
  const currentStrokeRef = useRef<{ x: number; y: number; pressure?: number; timestamp?: number }[]>([]);

  // Image load state
  const [loadedImage, setLoadedImage] = useState<HTMLImageElement | null>(null);

  // Engine & Language Settings (kept in sync with parent ScreenTranslationView)
  const [providerId, setProviderId] = useState<OcrProviderId>(
    selectedProvider || settings.screenTranslation?.ocrProvider || 'windows-native'
  );
  const [sourceLang, setSourceLang] = useState<string>(
    ocrLanguage || settings.screenTranslation?.ocrLanguage || 'auto'
  );
  const [targetLang, setTargetLang] = useState<string>(
    targetLanguage || settings.targetLanguages?.[0] || 'vi'
  );
  const [profile, setProfile] = useState<'handwritten' | 'high-contrast' | 'none'>('handwritten');

  useEffect(() => {
    if (ocrLanguage && ocrLanguage !== sourceLang) {
      setSourceLang(ocrLanguage);
    }
  }, [ocrLanguage]);

  useEffect(() => {
    if (targetLanguage && targetLanguage !== targetLang) {
      setTargetLang(targetLanguage);
    }
  }, [targetLanguage]);

  useEffect(() => {
    if (selectedProvider && selectedProvider !== providerId) {
      setProviderId(selectedProvider);
    }
  }, [selectedProvider]);

  const handleProviderSelect = (newProvider: OcrProviderId) => {
    setProviderId(newProvider);
    onProviderChange?.(newProvider);
  };

  const handleSourceLangSelect = (newLang: string) => {
    setSourceLang(newLang);
    onOcrLanguageChange?.(newLang);
  };

  const handleTargetLangSelect = (newTarget: string) => {
    setTargetLang(newTarget);
    onTargetLanguageChange?.(newTarget);
  };

  // Recognition and Translation Results
  const [isProcessing, setIsProcessing] = useState<boolean>(false);
  const [recognizedText, setRecognizedText] = useState<string>('');
  const [translatedText, setTranslatedText] = useState<string>('');
  const [ocrConfidence, setOcrConfidence] = useState<number | null>(null);
  const [durationMs, setDurationMs] = useState<number | null>(null);
  const [detectedLanguage, setDetectedLanguage] = useState<string | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  // Clipboard & action feedbacks
  const [copiedOriginal, setCopiedOriginal] = useState<boolean>(false);
  const [copiedTranslated, setCopiedTranslated] = useState<boolean>(false);
  const [savedHistory, setSavedHistory] = useState<boolean>(false);

  // Setup / resize canvas
  const redrawCanvas = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const dpr = window.devicePixelRatio || 1;
    const rect = canvas.getBoundingClientRect();
    if (rect.width === 0 || rect.height === 0) return;

    if (canvas.width !== rect.width * dpr || canvas.height !== rect.height * dpr) {
      canvas.width = rect.width * dpr;
      canvas.height = rect.height * dpr;
    }

    ctx.save();
    ctx.scale(dpr, dpr);

    // Background: Dark slate blackboard style with subtle grid pattern
    ctx.fillStyle = '#0f172a';
    ctx.fillRect(0, 0, rect.width, rect.height);

    // Draw faint guide lines (notebook style)
    ctx.strokeStyle = 'rgba(255, 255, 255, 0.04)';
    ctx.lineWidth = 1;
    const lineSpacing = 36;
    for (let y = lineSpacing; y < rect.height; y += lineSpacing) {
      ctx.beginPath();
      ctx.moveTo(0, y);
      ctx.lineTo(rect.width, y);
      ctx.stroke();
    }

    // Draw loaded image if present
    if (loadedImage) {
      const imgRatio = loadedImage.width / loadedImage.height;
      const canvasRatio = rect.width / rect.height;
      let drawW = rect.width;
      let drawH = rect.height;
      let drawX = 0;
      let drawY = 0;

      if (imgRatio > canvasRatio) {
        drawW = rect.width;
        drawH = rect.width / imgRatio;
        drawY = (rect.height - drawH) / 2;
      } else {
        drawH = rect.height;
        drawW = rect.height * imgRatio;
        drawX = (rect.width - drawW) / 2;
      }

      ctx.drawImage(loadedImage, drawX, drawY, drawW, drawH);
    }

    // Draw all strokes
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';

    for (const stroke of strokes) {
      if (!stroke.points || stroke.points.length === 0) continue;

      ctx.strokeStyle = brushColor;
      ctx.lineWidth = brushSize;

      if (stroke.points.length === 1) {
        ctx.fillStyle = brushColor;
        ctx.beginPath();
        ctx.arc(stroke.points[0].x, stroke.points[0].y, brushSize / 2, 0, Math.PI * 2);
        ctx.fill();
        continue;
      }

      ctx.beginPath();
      ctx.moveTo(stroke.points[0].x, stroke.points[0].y);

      for (let i = 1; i < stroke.points.length - 1; i++) {
        const xc = (stroke.points[i].x + stroke.points[i + 1].x) / 2;
        const yc = (stroke.points[i].y + stroke.points[i + 1].y) / 2;
        ctx.quadraticCurveTo(stroke.points[i].x, stroke.points[i].y, xc, yc);
      }

      const lastPoint = stroke.points[stroke.points.length - 1];
      ctx.lineTo(lastPoint.x, lastPoint.y);
      ctx.stroke();
    }

    ctx.restore();
  }, [brushColor, brushSize, loadedImage, strokes]);

  useEffect(() => {
    redrawCanvas();
  }, [redrawCanvas]);

  useEffect(() => {
    const handleResize = () => {
      redrawCanvas();
    };
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, [redrawCanvas]);

  // Pointer / Mouse events
  const getCanvasCoords = (e: React.PointerEvent<HTMLCanvasElement>) => {
    const canvas = canvasRef.current;
    if (!canvas) return { x: 0, y: 0 };
    const rect = canvas.getBoundingClientRect();
    return {
      x: e.clientX - rect.left,
      y: e.clientY - rect.top,
      pressure: e.pressure > 0 ? e.pressure : 0.5,
      timestamp: Date.now(),
    };
  };

  const handlePointerDown = (e: React.PointerEvent<HTMLCanvasElement>) => {
    (e.target as HTMLElement).setPointerCapture(e.pointerId);
    setIsDrawing(true);
    const pt = getCanvasCoords(e);
    currentStrokeRef.current = [pt];
  };

  const handlePointerMove = (e: React.PointerEvent<HTMLCanvasElement>) => {
    if (!isDrawing) return;
    const pt = getCanvasCoords(e);
    currentStrokeRef.current.push(pt);

    // Live stroke segment drawing for zero-latency feel
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const dpr = window.devicePixelRatio || 1;
    const points = currentStrokeRef.current;
    if (points.length >= 2) {
      ctx.save();
      ctx.scale(dpr, dpr);
      ctx.lineCap = 'round';
      ctx.lineJoin = 'round';
      ctx.strokeStyle = tool === 'eraser' ? '#0f172a' : brushColor;
      ctx.lineWidth = tool === 'eraser' ? brushSize * 4 : brushSize;

      const p1 = points[points.length - 2];
      const p2 = points[points.length - 1];

      ctx.beginPath();
      ctx.moveTo(p1.x, p1.y);
      ctx.lineTo(p2.x, p2.y);
      ctx.stroke();
      ctx.restore();
    }
  };

  const handlePointerUp = (e: React.PointerEvent<HTMLCanvasElement>) => {
    if (!isDrawing) return;
    setIsDrawing(false);
    try {
      (e.target as HTMLElement).releasePointerCapture(e.pointerId);
    } catch {
      // ignore
    }

    if (currentStrokeRef.current.length > 0) {
      const newStroke: HandwritingStroke = {
        points: [...currentStrokeRef.current],
      };
      setStrokes((prev) => [...prev, newStroke]);
      currentStrokeRef.current = [];
    }
  };

  const handleClear = () => {
    setStrokes([]);
    setLoadedImage(null);
    setRecognizedText('');
    setTranslatedText('');
    setOcrConfidence(null);
    setDurationMs(null);
    setErrorMessage(null);
    setSavedHistory(false);
  };

  const handleUndo = () => {
    setStrokes((prev) => prev.slice(0, -1));
  };

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (event) => {
      const img = new Image();
      img.onload = () => {
        setLoadedImage(img);
        setStrokes([]);
      };
      img.src = event.target?.result as string;
    };
    reader.readAsDataURL(file);
  };

  const handleDrop = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    const file = e.dataTransfer.files?.[0];
    if (file && file.type.startsWith('image/')) {
      const reader = new FileReader();
      reader.onload = (event) => {
        const img = new Image();
        img.onload = () => {
          setLoadedImage(img);
          setStrokes([]);
        };
        img.src = event.target?.result as string;
      };
      reader.readAsDataURL(file);
    }
  };

  // Convert canvas to white-on-black or black-on-white PNG data URL
  const getCanvasDataUrl = (): string | null => {
    const canvas = canvasRef.current;
    if (!canvas) return null;

    // Create an export canvas with white background and dark strokes for maximum OCR accuracy
    const exportCanvas = document.createElement('canvas');
    exportCanvas.width = canvas.width;
    exportCanvas.height = canvas.height;
    const expCtx = exportCanvas.getContext('2d');
    if (!expCtx) return canvas.toDataURL('image/png');

    const dpr = window.devicePixelRatio || 1;
    expCtx.scale(dpr, dpr);

    const rect = canvas.getBoundingClientRect();

    if (loadedImage) {
      // If user imported a real image, draw the image directly
      expCtx.fillStyle = '#ffffff';
      expCtx.fillRect(0, 0, rect.width, rect.height);
      const imgRatio = loadedImage.width / loadedImage.height;
      const canvasRatio = rect.width / rect.height;
      let drawW = rect.width;
      let drawH = rect.height;
      let drawX = 0;
      let drawY = 0;

      if (imgRatio > canvasRatio) {
        drawW = rect.width;
        drawH = rect.width / imgRatio;
        drawY = (rect.height - drawH) / 2;
      } else {
        drawH = rect.height;
        drawW = rect.height * imgRatio;
        drawX = (rect.width - drawW) / 2;
      }
      expCtx.drawImage(loadedImage, drawX, drawY, drawW, drawH);
    } else {
      // For hand-drawn canvas: white background, black ink
      expCtx.fillStyle = '#ffffff';
      expCtx.fillRect(0, 0, rect.width, rect.height);
    }

    // Render strokes with black ink for standard OCR engines
    expCtx.lineCap = 'round';
    expCtx.lineJoin = 'round';

    for (const stroke of strokes) {
      if (!stroke.points || stroke.points.length === 0) continue;

      expCtx.strokeStyle = '#000000';
      expCtx.lineWidth = brushSize * 1.5;

      if (stroke.points.length === 1) {
        expCtx.fillStyle = '#000000';
        expCtx.beginPath();
        expCtx.arc(stroke.points[0].x, stroke.points[0].y, brushSize, 0, Math.PI * 2);
        expCtx.fill();
        continue;
      }

      expCtx.beginPath();
      expCtx.moveTo(stroke.points[0].x, stroke.points[0].y);

      for (let i = 1; i < stroke.points.length - 1; i++) {
        const xc = (stroke.points[i].x + stroke.points[i + 1].x) / 2;
        const yc = (stroke.points[i].y + stroke.points[i + 1].y) / 2;
        expCtx.quadraticCurveTo(stroke.points[i].x, stroke.points[i].y, xc, yc);
      }

      const lastPoint = stroke.points[stroke.points.length - 1];
      expCtx.lineTo(lastPoint.x, lastPoint.y);
      expCtx.stroke();
    }

    return exportCanvas.toDataURL('image/png');
  };

  // Recognize & Translate Action
  const handleRecognize = async () => {
    if (strokes.length === 0 && !loadedImage) {
      setErrorMessage(t('ocr.handwriting.emptyCanvas', 'Please write something or upload a handwritten image first.'));
      return;
    }

    setIsProcessing(true);
    setErrorMessage(null);
    setSavedHistory(false);
    const start = Date.now();

    try {
      const imageDataUrl = getCanvasDataUrl();
      if (!imageDataUrl) {
        throw new Error('Failed to capture drawing buffer');
      }

      // 1. Recognize handwriting
      const ocrResp: OcrResponse = await window.electronAPI.screenTranslation.recognizeHandwriting({
        strokes: strokes.length > 0 ? strokes : undefined,
        imageBuffer: imageDataUrl,
        language: sourceLang,
        providerId,
        preprocessOptions: OCR_PROFILE_PRESETS[profile] || OCR_PROFILE_PRESETS.handwritten,
      });

      const recognized = ocrResp.text?.trim() || '';
      setRecognizedText(recognized);
      setOcrConfidence(ocrResp.confidence);
      setDetectedLanguage(ocrResp.language || sourceLang);

      if (!recognized) {
        setErrorMessage(
          t(
            'ocr.handwriting.noTextDetected',
            'No handwritten text could be identified. Try writing more distinctly or switching OCR engine.'
          )
        );
        setIsProcessing(false);
        return;
      }

      // 2. Translate recognized text
      const effectiveSource =
        sourceLang && sourceLang !== 'auto'
          ? sourceLang
          : ocrResp.language && ocrResp.language !== 'auto'
          ? ocrResp.language
          : 'auto';

      const transResult: TranslationResult = await window.electronAPI.translation.translate({
        text: recognized,
        sourceLanguage: effectiveSource,
        targetLanguage: targetLang,
        priority: 'high',
      });

      setTranslatedText(transResult.translatedText);
      setDurationMs(Date.now() - start);
    } catch (err: any) {
      setErrorMessage(err?.message || 'Handwriting recognition failed');
    } finally {
      setIsProcessing(false);
    }
  };

  // Retranslate if user edited recognized text manually
  const handleRetranslate = async () => {
    if (!recognizedText.trim()) return;
    setIsProcessing(true);
    try {
      const transResult = await window.electronAPI.translation.translate({
        text: recognizedText.trim(),
        sourceLanguage: sourceLang,
        targetLanguage: targetLang,
        priority: 'high',
      });
      setTranslatedText(transResult.translatedText);
    } catch (err: any) {
      setErrorMessage(err?.message || 'Translation failed');
    } finally {
      setIsProcessing(false);
    }
  };

  // Save to database history
  const handleSaveToHistory = async () => {
    if (!recognizedText.trim() || !translatedText.trim()) return;

    try {
      const imageData = getCanvasDataUrl() || undefined;
      await window.electronAPI.screenTranslation.insertHistoryItem({
        id: 'hw_' + Date.now(),
        createdAt: Date.now(),
        ocrProvider: providerId,
        ocrLanguage: sourceLang,
        sourceLanguage: detectedLanguage || sourceLang,
        targetLanguage: targetLang,
        originalText: recognizedText,
        translatedText: translatedText,
        confidence: ocrConfidence ?? 0.95,
        durationMs: durationMs ?? 0,
        sessionType: 'single',
        imageData,
      });
      setSavedHistory(true);
      onSavedToHistory?.();
    } catch {
      // ignore
      setSavedHistory(true);
    }
  };

  const copyToClipboard = (text: string, type: 'original' | 'translated') => {
    navigator.clipboard.writeText(text);
    if (type === 'original') {
      setCopiedOriginal(true);
      setTimeout(() => setCopiedOriginal(false), 2000);
    } else {
      setCopiedTranslated(true);
      setTimeout(() => setCopiedTranslated(false), 2000);
    }
  };

  const handleSpeak = (text: string, lang: string) => {
    if (!('speechSynthesis' in window)) return;
    window.speechSynthesis.cancel();
    const utterance = new SpeechSynthesisUtterance(text);
    if (lang && lang !== 'auto') utterance.lang = lang;
    window.speechSynthesis.speak(utterance);
  };

  return (
    <div className="space-y-4">
      {/* Top Banner & Quick Controls */}
      <GlassCard className="p-4 bg-card/40 backdrop-blur-md border-border/50">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-indigo-500/20 to-purple-500/20 border border-indigo-500/30 flex items-center justify-center text-indigo-400 shadow-sm">
              <PenTool className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-sm font-semibold text-foreground flex items-center gap-2">
                {t('ocr.handwriting.title', 'Handwriting Recognition & Digital Ink Pad')}
                <GlassBadge variant="accent" className="text-[10px] bg-primary/20 text-primary border-primary/30">
                  {t('ocr.handwriting.badge', 'AI Neural HTR')}
                </GlassBadge>
              </h3>
              <p className="text-xs text-muted-foreground">
                {t(
                  'ocr.handwriting.subtitle',
                  'Draw with stylus/mouse, drop handwritten photos, or notes to recognize and translate instantly.'
                )}
              </p>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            {/* Engine Selector */}
            <div className="w-48">
              <label className="text-[10px] font-medium text-muted-foreground block mb-0.5">
                {t('ocr.handwriting.engine', 'OCR Engine')}
              </label>
              <GlassSelect
                value={providerId}
                onChange={(e) => handleProviderSelect(e.target.value as OcrProviderId)}
                className="text-xs h-8"
              >
                {ocrProviders.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.name} {p.isLocal ? '(Offline)' : '(Cloud)'}
                  </option>
                ))}
              </GlassSelect>
            </div>

            {/* Source Language */}
            <div className="w-44">
              <label className="text-[10px] font-medium text-muted-foreground block mb-0.5">
                {t('ocr.handwriting.sourceLang', 'Language')}
              </label>
              <GlassSelect
                value={sourceLang}
                onChange={(e) => handleSourceLangSelect(e.target.value)}
                className="text-xs h-8"
              >
                {OCR_SUPPORTED_LANGUAGES.map((l) => (
                  <option key={l.code} value={l.code}>
                    {l.name} {l.nativeName && l.nativeName !== l.name ? `(${l.nativeName})` : ''}
                  </option>
                ))}
              </GlassSelect>
            </div>

            {/* Target Language */}
            <div className="w-40">
              <label className="text-[10px] font-medium text-muted-foreground block mb-0.5">
                {t('ocr.handwriting.targetLang', 'Translate To')}
              </label>
              <GlassSelect
                value={targetLang}
                onChange={(e) => handleTargetLangSelect(e.target.value)}
                className="text-xs h-8"
              >
                {TARGET_LANGUAGES.map((l) => (
                  <option key={l.code} value={l.code}>
                    {l.name} {l.nativeName && l.nativeName !== l.name ? `(${l.nativeName})` : ''}
                  </option>
                ))}
              </GlassSelect>
            </div>

            {/* Preprocess Profile */}
            <div className="w-36">
              <label className="text-[10px] font-medium text-muted-foreground block mb-0.5">
                {t('ocr.handwriting.preset', 'Enhancement')}
              </label>
              <GlassSelect
                value={profile}
                onChange={(e) => setProfile(e.target.value as any)}
                className="text-xs h-8"
              >
                <option value="handwritten">{t('ocr.presets.handwritten', 'Adaptive Ink Filter')}</option>
                <option value="high-contrast">{t('ocr.presets.highContrast', 'High Contrast')}</option>
                <option value="none">{t('ocr.presets.none', 'No Enhancement')}</option>
              </GlassSelect>
            </div>
          </div>
        </div>
      </GlassCard>

      {/* Main Interactive Canvas & Drawing Toolbar */}
      <GlassCard className="p-3 bg-card/30 backdrop-blur-md border-border/40 overflow-hidden">
        {/* Canvas Toolbar */}
        <div className="flex flex-wrap items-center justify-between gap-2 pb-3 border-b border-border/40">
          <div className="flex items-center gap-1.5">
            <GlassButton
              size="sm"
              variant={tool === 'pen' ? 'primary' : 'ghost'}
              onClick={() => setTool('pen')}
              className="h-8 px-2.5 text-xs flex items-center gap-1.5"
            >
              <PenTool className="w-3.5 h-3.5" />
              {t('ocr.handwriting.tools.pen', 'Pen')}
            </GlassButton>

            <GlassButton
              size="sm"
              variant={tool === 'eraser' ? 'primary' : 'ghost'}
              onClick={() => setTool('eraser')}
              className="h-8 px-2.5 text-xs flex items-center gap-1.5"
            >
              <Eraser className="w-3.5 h-3.5" />
              {t('ocr.handwriting.tools.eraser', 'Eraser')}
            </GlassButton>

            <div className="h-4 w-px bg-border/40 mx-1" />

            {/* Brush Width */}
            <div className="flex items-center gap-1 bg-background/40 p-1 rounded-lg border border-border/30">
              {[2, 4, 7].map((size) => (
                <button
                  key={size}
                  type="button"
                  onClick={() => setBrushSize(size)}
                  className={`w-6 h-6 rounded flex items-center justify-center transition-colors ${
                    brushSize === size ? 'bg-primary text-primary-foreground' : 'text-muted-foreground hover:bg-muted'
                  }`}
                  title={`${size}px`}
                >
                  <div
                    className="rounded-full bg-current"
                    style={{ width: `${Math.max(3, size)}px`, height: `${Math.max(3, size)}px` }}
                  />
                </button>
              ))}
            </div>

            <div className="h-4 w-px bg-border/40 mx-1" />

            {/* Brush Colors */}
            <div className="flex items-center gap-1.5 bg-background/40 p-1 rounded-lg border border-border/30">
              {['#ffffff', '#60a5fa', '#34d399', '#f87171', '#fbbf24'].map((color) => (
                <button
                  key={color}
                  type="button"
                  onClick={() => {
                    setBrushColor(color);
                    setTool('pen');
                  }}
                  className={`w-5 h-5 rounded-full border transition-transform ${
                    brushColor === color && tool === 'pen' ? 'scale-125 border-primary shadow-sm' : 'border-transparent'
                  }`}
                  style={{ backgroundColor: color }}
                />
              ))}
            </div>
          </div>

          <div className="flex items-center gap-2">
            <GlassButton
              size="sm"
              variant="ghost"
              onClick={handleUndo}
              disabled={strokes.length === 0}
              className="h-8 px-2.5 text-xs flex items-center gap-1.5"
            >
              <Undo2 className="w-3.5 h-3.5" />
              {t('ocr.handwriting.tools.undo', 'Undo')}
            </GlassButton>

            <GlassButton
              size="sm"
              variant="ghost"
              onClick={handleClear}
              className="h-8 px-2.5 text-xs text-rose-400 hover:text-rose-300 flex items-center gap-1.5"
            >
              <Trash2 className="w-3.5 h-3.5" />
              {t('ocr.handwriting.tools.clear', 'Clear')}
            </GlassButton>

            <label className="cursor-pointer">
              <input
                type="file"
                accept="image/*"
                onChange={handleFileUpload}
                className="hidden"
              />
              <span className="inline-flex items-center gap-1.5 h-8 px-2.5 text-xs font-medium rounded-lg bg-background/50 hover:bg-background/80 border border-border/40 text-foreground transition-colors">
                <Upload className="w-3.5 h-3.5" />
                {t('ocr.handwriting.tools.upload', 'Upload Note')}
              </span>
            </label>

            <GlassButton
              size="sm"
              variant="primary"
              onClick={handleRecognize}
              disabled={isProcessing || (strokes.length === 0 && !loadedImage)}
              className="h-8 px-4 text-xs font-medium bg-gradient-to-r from-primary to-indigo-600 hover:from-primary/90 hover:to-indigo-500 shadow-md shadow-primary/20 flex items-center gap-2"
            >
              {isProcessing ? (
                <>
                  <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                  {t('ocr.handwriting.recognizing', 'Recognizing...')}
                </>
              ) : (
                <>
                  <Sparkles className="w-3.5 h-3.5" />
                  {t('ocr.handwriting.recognizeBtn', 'Recognize & Translate')}
                </>
              )}
            </GlassButton>
          </div>
        </div>

        {/* HTML5 Touch/Stylus Drawing Canvas */}
        <div
          ref={containerRef}
          onDrop={handleDrop}
          onDragOver={(e) => e.preventDefault()}
          className="relative w-full h-[280px] rounded-xl overflow-hidden mt-3 border border-border/40 shadow-inner cursor-crosshair select-none touch-none"
        >
          <canvas
            ref={canvasRef}
            onPointerDown={handlePointerDown}
            onPointerMove={handlePointerMove}
            onPointerUp={handlePointerUp}
            onPointerLeave={handlePointerUp}
            className="w-full h-full block"
          />

          {strokes.length === 0 && !loadedImage && (
            <div className="absolute inset-0 pointer-events-none flex flex-col items-center justify-center text-center p-6 bg-slate-950/20 backdrop-blur-[1px]">
              <PenTool className="w-8 h-8 text-muted-foreground/30 mb-2 stroke-[1.5]" />
              <p className="text-xs font-medium text-muted-foreground/60">
                {t('ocr.handwriting.canvasHint', 'Write here with your mouse, stylus pen, or drag & drop a photo of handwritten notes.')}
              </p>
              <p className="text-[11px] text-muted-foreground/40 mt-1">
                {t('ocr.handwriting.canvasSubhint', 'Supports cursive English, Vietnamese diacritics, CJK characters, and math symbols.')}
              </p>
            </div>
          )}
        </div>
      </GlassCard>

      {/* Error notification */}
      {errorMessage && (
        <div className="p-3 rounded-xl bg-destructive/15 border border-destructive/30 text-destructive text-xs flex items-center gap-2">
          <Info className="w-4 h-4 shrink-0" />
          <span>{errorMessage}</span>
        </div>
      )}

      {/* Result Cards: Recognized Text & Live Translation */}
      {(recognizedText || translatedText || isProcessing) && (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {/* Recognized Handwritten Text */}
          <GlassCard className="p-4 bg-card/40 backdrop-blur-md border-border/50 flex flex-col justify-between">
            <div>
              <div className="flex items-center justify-between gap-2 pb-2 mb-3 border-b border-border/30">
                <div className="flex items-center gap-2">
                  <span className="text-xs font-semibold text-foreground">
                    {t('ocr.handwriting.recognizedLabel', 'Recognized Handwriting')}
                  </span>
                  {ocrConfidence !== null && (
                    <GlassBadge
                      variant={ocrConfidence > 0.8 ? 'success' : 'warning'}
                      className="text-[10px]"
                    >
                      {Math.round(ocrConfidence * 100)}% {t('ocr.confidence', 'confidence')}
                    </GlassBadge>
                  )}
                  {durationMs !== null && (
                    <span className="text-[10px] text-muted-foreground">
                      {durationMs}ms
                    </span>
                  )}
                </div>

                <div className="flex items-center gap-1">
                  <button
                    type="button"
                    onClick={() => handleSpeak(recognizedText, detectedLanguage || sourceLang)}
                    disabled={!recognizedText}
                    className="p-1.5 rounded-lg text-muted-foreground hover:text-foreground hover:bg-muted/50 transition-colors"
                    title={t('common.speak', 'Read aloud')}
                  >
                    <Volume2 className="w-3.5 h-3.5" />
                  </button>
                  <button
                    type="button"
                    onClick={() => copyToClipboard(recognizedText, 'original')}
                    disabled={!recognizedText}
                    className="p-1.5 rounded-lg text-muted-foreground hover:text-foreground hover:bg-muted/50 transition-colors"
                    title={t('common.copy', 'Copy')}
                  >
                    {copiedOriginal ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
                  </button>
                </div>
              </div>

              <textarea
                value={recognizedText}
                onChange={(e) => setRecognizedText(e.target.value)}
                placeholder={t('ocr.handwriting.recognizedPlaceholder', 'Recognized text will appear here. You can freely edit or correct it...')}
                rows={4}
                className="w-full bg-background/50 border border-border/30 rounded-lg p-3 text-sm font-sans text-foreground resize-none focus:outline-none focus:ring-1 focus:ring-primary/50"
              />
            </div>

            <div className="pt-2 flex justify-end">
              <GlassButton
                size="sm"
                variant="ghost"
                onClick={handleRetranslate}
                disabled={isProcessing || !recognizedText.trim()}
                className="text-xs h-7 px-2.5 text-muted-foreground hover:text-foreground flex items-center gap-1.5"
              >
                <RefreshCw className="w-3 h-3" />
                {t('ocr.handwriting.retranslate', 'Re-translate')}
              </GlassButton>
            </div>
          </GlassCard>

          {/* Translated Text */}
          <GlassCard className="p-4 bg-card/40 backdrop-blur-md border-border/50 flex flex-col justify-between">
            <div>
              <div className="flex items-center justify-between gap-2 pb-2 mb-3 border-b border-border/30">
                <div className="flex items-center gap-2">
                  <span className="text-xs font-semibold text-foreground">
                    {t('ocr.handwriting.translationLabel', 'Live Translation')}
                  </span>
                  <GlassBadge variant="accent" className="text-[10px] bg-indigo-500/20 text-indigo-400 border-indigo-500/30">
                    {targetLang.toUpperCase()}
                  </GlassBadge>
                </div>

                <div className="flex items-center gap-1">
                  <button
                    type="button"
                    onClick={() => handleSpeak(translatedText, targetLang)}
                    disabled={!translatedText}
                    className="p-1.5 rounded-lg text-muted-foreground hover:text-foreground hover:bg-muted/50 transition-colors"
                    title={t('common.speak', 'Read aloud')}
                  >
                    <Volume2 className="w-3.5 h-3.5" />
                  </button>
                  <button
                    type="button"
                    onClick={() => copyToClipboard(translatedText, 'translated')}
                    disabled={!translatedText}
                    className="p-1.5 rounded-lg text-muted-foreground hover:text-foreground hover:bg-muted/50 transition-colors"
                    title={t('common.copy', 'Copy')}
                  >
                    {copiedTranslated ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
                  </button>
                </div>
              </div>

              <div className="w-full bg-background/50 border border-border/30 rounded-lg p-3 text-sm font-sans text-foreground min-h-[96px] whitespace-pre-wrap select-text">
                {translatedText || (
                  <span className="text-muted-foreground/50 italic">
                    {isProcessing ? t('ocr.handwriting.translating', 'Translating recognized handwriting...') : t('ocr.handwriting.translatedPlaceholder', 'Translation will be displayed here.')}
                  </span>
                )}
              </div>
            </div>

            <div className="pt-2 flex justify-end">
              <GlassButton
                size="sm"
                variant="ghost"
                onClick={handleSaveToHistory}
                disabled={savedHistory || !translatedText.trim()}
                className="text-xs h-7 px-2.5 text-primary hover:text-primary/90 flex items-center gap-1.5"
              >
                {savedHistory ? (
                  <>
                    <Check className="w-3 h-3 text-emerald-400" />
                    {t('ocr.handwriting.savedToHistory', 'Saved to History')}
                  </>
                ) : (
                  <>
                    <BookmarkPlus className="w-3 h-3" />
                    {t('ocr.handwriting.saveToHistory', 'Save to History')}
                  </>
                )}
              </GlassButton>
            </div>
          </GlassCard>
        </div>
      )}
    </div>
  );
};
