import { useMemo } from 'react';
import { useSettings } from '../contexts/SettingsContext';
import { createSettingsFormatter, FormattingSettings } from '../utils/SettingsAwareFormatter';

/**
 * Hook that provides a settings-aware formatter
 * Automatically updates when settings change
 */
export const useSettingsFormatter = () => {
  const { settings } = useSettings();

  const formattingSettings: FormattingSettings = useMemo(() => ({
    scientificNotationEnabled: settings.scientificNotationEnabled,
    largeTextEnabled: settings.largeTextEnabled,
    reduceAnimationsEnabled: settings.reduceAnimationsEnabled,
  }), [
    settings.scientificNotationEnabled,
    settings.largeTextEnabled,
    settings.reduceAnimationsEnabled,
  ]);

  const formatter = useMemo(() => 
    createSettingsFormatter(formattingSettings), 
    [formattingSettings]
  );

  return formatter;
};