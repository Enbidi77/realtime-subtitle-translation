import React, { useState } from 'react';
import { useSettingsStore } from '@/stores/settings-store.js';
import { useI18n } from '@/app/i18n/index.js';
import { GlassModal } from '@/components/ui/GlassModal.js';
import { GlassButton } from '@/components/ui/GlassButton.js';
import { CloseBehavior } from '@echo-lingo/contracts';
import { Minimize2, Power, Check } from 'lucide-react';

export interface ExitConfirmationModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export const ExitConfirmationModal: React.FC<ExitConfirmationModalProps> = ({
  isOpen,
  onClose,
}) => {
  const { t } = useI18n();
  const updateSettings = useSettingsStore((s) => s.updateSettings);
  const [selectedAction, setSelectedAction] = useState<Exclude<CloseBehavior, 'ask'>>('minimize-to-tray');
  const [rememberChoice, setRememberChoice] = useState(false);

  const handleConfirm = () => {
    if (rememberChoice) {
      updateSettings({ closeBehavior: selectedAction });
    }

    if (selectedAction === 'minimize-to-tray') {
      window.electronAPI?.app.minimizeToTray();
    } else {
      window.electronAPI?.app.quit();
    }

    onClose();
  };

  return (
    <GlassModal
      isOpen={isOpen}
      onClose={onClose}
      title={t('settings.exitModal.title', 'Closing EchoLingo')}
      description={t('settings.exitModal.desc', 'Choose what happens when you close the application:')}
      maxWidth="md"
    >
      <div className="space-y-4 pt-2">
        {/* Option 1: Minimize to Tray */}
        <div
          onClick={() => setSelectedAction('minimize-to-tray')}
          className={`group flex items-start gap-3.5 p-3.5 rounded-xl border cursor-pointer transition-all duration-150 ${
            selectedAction === 'minimize-to-tray'
              ? 'bg-primary/10 border-primary/50 shadow-sm shadow-primary/10'
              : 'bg-glass-subtle hover:bg-glass border-glass-border hover:border-white/20'
          }`}
        >
          <div
            className={`mt-0.5 flex items-center justify-center w-7 h-7 rounded-lg transition-colors ${
              selectedAction === 'minimize-to-tray'
                ? 'bg-primary text-white'
                : 'bg-glass-subtle text-muted-foreground group-hover:text-foreground'
            }`}
          >
            <Minimize2 className="w-4 h-4" />
          </div>

          <div className="flex-1 space-y-1">
            <div className="flex items-center justify-between">
              <span className="text-xs font-semibold text-foreground">
                {t('settings.exitModal.minimizeTitle', 'Minimize to System Tray (Recommended)')}
              </span>
              <div
                className={`w-4 h-4 rounded-full border flex items-center justify-center transition-colors ${
                  selectedAction === 'minimize-to-tray'
                    ? 'border-primary bg-primary text-white'
                    : 'border-muted-foreground/40'
                }`}
              >
                {selectedAction === 'minimize-to-tray' && <Check className="w-2.5 h-2.5 stroke-[3]" />}
              </div>
            </div>
            <p className="text-[11px] text-muted-foreground leading-relaxed">
              {t(
                'settings.exitModal.minimizeDesc',
                'Keeps EchoLingo active in your notification area. Global shortcuts and subtitle overlay stay available.'
              )}
            </p>
          </div>
        </div>

        {/* Option 2: Quit Application */}
        <div
          onClick={() => setSelectedAction('quit')}
          className={`group flex items-start gap-3.5 p-3.5 rounded-xl border cursor-pointer transition-all duration-150 ${
            selectedAction === 'quit'
              ? 'bg-destructive/10 border-destructive/50 shadow-sm shadow-destructive/10'
              : 'bg-glass-subtle hover:bg-glass border-glass-border hover:border-white/20'
          }`}
        >
          <div
            className={`mt-0.5 flex items-center justify-center w-7 h-7 rounded-lg transition-colors ${
              selectedAction === 'quit'
                ? 'bg-destructive text-white'
                : 'bg-glass-subtle text-muted-foreground group-hover:text-destructive'
            }`}
          >
            <Power className="w-4 h-4" />
          </div>

          <div className="flex-1 space-y-1">
            <div className="flex items-center justify-between">
              <span className="text-xs font-semibold text-foreground">
                {t('settings.exitModal.quitTitle', 'Quit Application Completely')}
              </span>
              <div
                className={`w-4 h-4 rounded-full border flex items-center justify-center transition-colors ${
                  selectedAction === 'quit'
                    ? 'border-destructive bg-destructive text-white'
                    : 'border-muted-foreground/40'
                }`}
              >
                {selectedAction === 'quit' && <Check className="w-2.5 h-2.5 stroke-[3]" />}
              </div>
            </div>
            <p className="text-[11px] text-muted-foreground leading-relaxed">
              {t(
                'settings.exitModal.quitDesc',
                'Stop all active sessions, speech recognition, and close all windows.'
              )}
            </p>
          </div>
        </div>

        {/* Remember choice checkbox */}
        <label className="flex items-center gap-2 pt-2 px-1 text-xs text-muted-foreground cursor-pointer select-none">
          <input
            type="checkbox"
            checked={rememberChoice}
            onChange={(e) => setRememberChoice(e.target.checked)}
            className="rounded accent-primary w-3.5 h-3.5"
          />
          <span>{t('settings.exitModal.rememberChoice', 'Remember my choice (You can change this anytime in Settings)')}</span>
        </label>

        {/* Modal Actions */}
        <div className="flex items-center justify-end gap-2.5 pt-3 border-t border-glass-border">
          <GlassButton variant="ghost" size="sm" onClick={onClose}>
            <span>{t('settings.exitModal.cancel', 'Cancel')}</span>
          </GlassButton>
          <GlassButton
            variant={selectedAction === 'quit' ? 'destructive' : 'primary'}
            size="sm"
            onClick={handleConfirm}
          >
            <span>{t('settings.exitModal.confirm', 'Confirm')}</span>
          </GlassButton>
        </div>
      </div>
    </GlassModal>
  );
};

