import React, { useState } from 'react';
import { useSettingsStore } from '@/stores/settings-store.js';
import { useI18n } from '@/app/i18n/index.js';
import { GlassModal } from '@/components/ui/GlassModal.js';
import { GlassButton } from '@/components/ui/GlassButton.js';
import { GlassRadio, GlassRadioGroup, GlassCheckbox } from '@/components/ui/index.js';
import { CloseBehavior } from '@echo-lingo/contracts';
import { Minimize2, Power } from 'lucide-react';

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
        {/* Radio Option cards */}
        <GlassRadioGroup
          name="exitAction"
          value={selectedAction}
          onChange={(val) => setSelectedAction(val as Exclude<CloseBehavior, 'ask'>)}
          className="space-y-3"
        >
          <GlassRadio
            variant="card"
            value="minimize-to-tray"
            color="primary"
            cardLayout="horizontal"
            icon={<Minimize2 className="w-4 h-4" />}
            label={t('settings.exitModal.minimizeTitle', 'Minimize to System Tray (Recommended)')}
            description={t(
              'settings.exitModal.minimizeDesc',
              'Keeps EchoLingo active in your notification area. Global shortcuts and subtitle overlay stay available.'
            )}
          />

          <GlassRadio
            variant="card"
            value="quit"
            color="destructive"
            cardLayout="horizontal"
            icon={<Power className="w-4 h-4" />}
            label={t('settings.exitModal.quitTitle', 'Quit Application Completely')}
            description={t(
              'settings.exitModal.quitDesc',
              'Stop all active sessions, speech recognition, and close all windows.'
            )}
          />
        </GlassRadioGroup>

        {/* Remember choice checkbox */}
        <div className="pt-2 px-1">
          <GlassCheckbox
            checked={rememberChoice}
            onChange={(e) => setRememberChoice(e.target.checked)}
            size="sm"
            label={t('settings.exitModal.rememberChoice', 'Remember my choice (You can change this anytime in Settings)')}
            containerClassName="text-xs text-muted-foreground"
          />
        </div>

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
