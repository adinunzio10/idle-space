import { Platform, Alert as RNAlert } from 'react-native';

interface AlertButton {
  text: string;
  onPress?: () => void;
  style?: 'default' | 'cancel' | 'destructive';
}

export class WebCompatibleAlert {
  static alert(
    title: string,
    message?: string,
    buttons?: AlertButton[],
    options?: { cancelable?: boolean }
  ): void {
    if (Platform.OS !== 'web') {
      // Use React Native Alert on native platforms
      RNAlert.alert(title, message, buttons, options);
      return;
    }

    // Web implementation using browser confirm/alert
    if (!buttons || buttons.length === 0) {
      // Simple alert
      window.alert(`${title}\n${message || ''}`);
      return;
    }

    if (buttons.length === 1) {
      // Single button - use alert
      window.alert(`${title}\n${message || ''}`);
      if (buttons[0].onPress) {
        buttons[0].onPress();
      }
      return;
    }

    if (buttons.length === 2) {
      // Two buttons - use confirm
      const confirmText = `${title}\n${message || ''}`;
      const result = window.confirm(confirmText);

      // Find the non-cancel button
      const confirmButton =
        buttons.find(b => b.style !== 'cancel') || buttons[1];
      const cancelButton =
        buttons.find(b => b.style === 'cancel') || buttons[0];

      if (result && confirmButton.onPress) {
        confirmButton.onPress();
      } else if (!result && cancelButton.onPress) {
        cancelButton.onPress();
      }
      return;
    }

    const buttonText = buttons.map(b => b.text).join(' / ');
    const confirmText = `${title}\n${message || ''}\n\nOptions: ${buttonText}`;

    if (window.confirm(confirmText)) {
      const primaryButton =
        buttons.find(b => b.style !== 'cancel') || buttons[0];
      if (primaryButton.onPress) {
        primaryButton.onPress();
      }
    }
  }

  static prompt(
    title: string,
    message?: string,
    defaultValue?: string
  ): Promise<string | null> {
    if (Platform.OS !== 'web') {
      // For native platforms, we'd need to implement a proper prompt
      return Promise.resolve(
        window.prompt(`${title}\n${message || ''}`, defaultValue)
      );
    }

    // Web implementation
    return Promise.resolve(
      window.prompt(`${title}\n${message || ''}`, defaultValue)
    );
  }
}

// Export a drop-in replacement for Alert
export const Alert = WebCompatibleAlert;
