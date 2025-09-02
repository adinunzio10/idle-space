import { useEffect, useCallback } from 'react';
import { useSettings } from '../contexts/SettingsContext';
import { AudioManager, SoundType } from '../core/AudioManager';

/**
 * Hook that manages audio integration with settings
 * Automatically updates AudioManager when settings change
 */
export const useAudio = () => {
  const { settings } = useSettings();
  const audioManager = AudioManager.getInstance();

  // Update audio manager settings when app settings change
  useEffect(() => {
    audioManager.updateSettings({
      soundEnabled: settings.soundEnabled,
      musicEnabled: settings.musicEnabled,
      soundVolume: 1.0,
      musicVolume: 0.7,
    });
  }, [audioManager, settings.soundEnabled, settings.musicEnabled]);

  // Convenience function to play sounds
  const playSound = useCallback(
    (type: SoundType) => {
      audioManager.playSound(type);
    },
    [audioManager]
  );

  return {
    playSound,
    audioManager,
    // Convenience methods
    playButtonSound: audioManager.playButtonSound,
    playBeaconPlaceSound: audioManager.playBeaconPlaceSound,
    playProbeLaunchSound: audioManager.playProbeLaunchSound,
    playResourceGainSound: audioManager.playResourceGainSound,
    playNotificationSound: audioManager.playNotificationSound,
    playErrorSound: audioManager.playErrorSound,
  };
};
