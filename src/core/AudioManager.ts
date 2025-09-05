import { Audio } from 'expo-av';

export interface AudioSettings {
  soundEnabled: boolean;
  musicEnabled: boolean;
  soundVolume: number; // 0-1
  musicVolume: number; // 0-1
}

export type SoundType =
  | 'button_press'
  | 'beacon_place'
  | 'probe_launch'
  | 'resource_gain'
  | 'notification'
  | 'error';

/**
 * Manages audio playback based on user settings
 * Provides centralized control for sound effects and music
 */
export class AudioManager {
  private static instance: AudioManager | null = null;
  private settings: AudioSettings = {
    soundEnabled: true,
    musicEnabled: true,
    soundVolume: 1.0,
    musicVolume: 0.7,
  };

  // Preloaded sound objects for performance
  private sounds: Map<SoundType, Audio.Sound> = new Map();
  private musicSound: Audio.Sound | null = null;
  private isInitialized = false;
  private isMusicPlaying = false;

  private constructor() {}

  static getInstance(): AudioManager {
    if (!AudioManager.instance) {
      AudioManager.instance = new AudioManager();
    }
    return AudioManager.instance;
  }

  async initialize(): Promise<void> {
    try {
      console.log('[AudioManager] Initializing...');

      // Configure audio mode for mobile devices (if available)
      try {
        if (Audio.setAudioModeAsync) {
          await Audio.setAudioModeAsync({
            allowsRecordingIOS: false,
            playsInSilentModeIOS: true,
            shouldDuckAndroid: true,
            staysActiveInBackground: false,
            playThroughEarpieceAndroid: false,
          });
        }
      } catch (audioModeError) {
        console.warn(
          '[AudioManager] Audio mode configuration not available:',
          audioModeError
        );
      }

      // For now, we'll just initialize without preloading sounds
      // In a real implementation, you would load sound files here:
      // await this.preloadSounds();

      this.isInitialized = true;
      console.log('[AudioManager] Initialized successfully');
    } catch (error) {
      console.error('[AudioManager] Failed to initialize:', error);
    }
  }

  /**
   * Update audio settings (called from Settings context)
   */
  updateSettings(newSettings: Partial<AudioSettings>): void {
    const prevSettings = { ...this.settings };
    this.settings = { ...this.settings, ...newSettings };

    console.log('[AudioManager] Settings updated:', newSettings);

    // Handle music playback based on setting changes
    if (prevSettings.musicEnabled && !this.settings.musicEnabled) {
      this.stopBackgroundMusic();
    } else if (!prevSettings.musicEnabled && this.settings.musicEnabled) {
      this.startBackgroundMusic();
    }

    // Update volume if music is playing
    if (this.musicSound && this.isMusicPlaying) {
      this.musicSound.setVolumeAsync(this.settings.musicVolume);
    }
  }

  /**
   * Play a sound effect if sound is enabled
   */
  async playSound(type: SoundType): Promise<void> {
    if (!this.isInitialized || !this.settings.soundEnabled) {
      return;
    }

    try {
      // For development, we'll just log the sound instead of playing actual files
      console.log(
        `[AudioManager] Playing sound: ${type} (volume: ${this.settings.soundVolume})`
      );

      // In a real implementation, you would play the actual sound:
      /*
      const sound = this.sounds.get(type);
      if (sound) {
        await sound.setVolumeAsync(this.settings.soundVolume);
        await sound.replayAsync();
      }
      */
    } catch (error) {
      console.error(`[AudioManager] Failed to play sound ${type}:`, error);
    }
  }

  /**
   * Start playing background music if enabled
   */
  async startBackgroundMusic(): Promise<void> {
    if (
      !this.isInitialized ||
      !this.settings.musicEnabled ||
      this.isMusicPlaying
    ) {
      return;
    }

    try {
      console.log('[AudioManager] Starting background music');

      // In a real implementation, you would load and play music:
      /*
      if (!this.musicSound) {
        const { sound } = await Audio.Sound.createAsync(
          require('../../assets/audio/background_music.mp3'),
          {
            isLooping: true,
            volume: this.settings.musicVolume,
          }
        );
        this.musicSound = sound;
      }
      
      await this.musicSound.playAsync();
      */

      this.isMusicPlaying = true;
    } catch (error) {
      console.error('[AudioManager] Failed to start background music:', error);
    }
  }

  /**
   * Stop background music
   */
  async stopBackgroundMusic(): Promise<void> {
    if (!this.musicSound || !this.isMusicPlaying) {
      return;
    }

    try {
      console.log('[AudioManager] Stopping background music');
      await this.musicSound.pauseAsync();
      this.isMusicPlaying = false;
    } catch (error) {
      console.error('[AudioManager] Failed to stop background music:', error);
    }
  }

  /**
   * Get current settings
   */
  getSettings(): AudioSettings {
    return { ...this.settings };
  }

  /**
   * Clean up resources
   */
  async shutdown(): Promise<void> {
    try {
      console.log('[AudioManager] Shutting down...');

      if (this.musicSound) {
        await this.musicSound.unloadAsync();
        this.musicSound = null;
      }

      // Unload all sound effects
      for (const [type, sound] of this.sounds.entries()) {
        await sound.unloadAsync();
        this.sounds.delete(type);
      }

      this.isInitialized = false;
      this.isMusicPlaying = false;

      console.log('[AudioManager] Shutdown complete');
    } catch (error) {
      console.error('[AudioManager] Error during shutdown:', error);
    }
  }

  /**
   * Convenience methods for common sounds
   */
  playButtonSound = () => this.playSound('button_press');
  playBeaconPlaceSound = () => this.playSound('beacon_place');
  playProbeLaunchSound = () => this.playSound('probe_launch');
  playResourceGainSound = () => this.playSound('resource_gain');
  playNotificationSound = () => this.playSound('notification');
  playErrorSound = () => this.playSound('error');
}
