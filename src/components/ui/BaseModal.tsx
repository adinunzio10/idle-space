import React from 'react';
import { View, Text, TouchableOpacity, ScrollView, Dimensions } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Modal from 'react-native-modal';
import * as Haptics from 'expo-haptics';

interface BaseModalProps {
  isVisible: boolean;
  onClose: () => void;
  title?: string;
  children: React.ReactNode;
  showCloseButton?: boolean;
  animationType?: 'slide' | 'fade' | 'none';
  animationInTiming?: number;
  animationOutTiming?: number;
  backdropOpacity?: number;
  swipeDirection?: 'up' | 'down' | 'left' | 'right' | ('up' | 'down' | 'left' | 'right')[];
  onSwipeComplete?: () => void;
  maxHeight?: number;
  fullScreen?: boolean;
  testID?: string;
}

export const BaseModal: React.FC<BaseModalProps> = ({
  isVisible,
  onClose,
  title,
  children,
  showCloseButton = true,
  animationType = 'slide',
  animationInTiming = 300,
  animationOutTiming = 250,
  backdropOpacity = 0.5,
  swipeDirection = 'down',
  onSwipeComplete,
  maxHeight,
  fullScreen = false,
  testID
}) => {
  const insets = useSafeAreaInsets();
  const screenData = Dimensions.get('window');
  
  const handleClose = () => {
    // Haptic feedback on close
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    onClose();
  };
  
  const handleSwipeComplete = () => {
    if (onSwipeComplete) {
      onSwipeComplete();
    } else {
      handleClose();
    }
  };
  
  const handleBackdropPress = () => {
    handleClose();
  };
  
  const getModalStyle = () => {
    if (fullScreen) {
      return {
        margin: 0,
        justifyContent: 'flex-end' as const,
      };
    }
    
    return {
      justifyContent: 'center' as const,
      margin: 20,
    };
  };
  
  const getContentHeight = () => {
    if (fullScreen) {
      return screenData.height;
    }
    
    if (maxHeight) {
      return Math.min(maxHeight, screenData.height * 0.9);
    }
    
    return screenData.height * 0.70; // Default to 70% of screen height
  };
  
  return (
    <Modal
      isVisible={isVisible}
      onBackdropPress={handleBackdropPress}
      onBackButtonPress={handleClose}
      onSwipeComplete={handleSwipeComplete}
      swipeDirection={swipeDirection}
      style={getModalStyle()}
      backdropOpacity={backdropOpacity}
      animationIn={animationType === 'slide' ? 'slideInUp' : 'fadeIn'}
      animationOut={animationType === 'slide' ? 'slideOutDown' : 'fadeOut'}
      animationInTiming={animationInTiming}
      animationOutTiming={animationOutTiming}
      useNativeDriver={true}
      useNativeDriverForBackdrop={true}
      hideModalContentWhileAnimating={true}
      testID={testID}
    >
      <View 
        className="bg-surface rounded-xl overflow-hidden"
        style={{
          maxHeight: getContentHeight(),
          paddingTop: fullScreen ? insets.top : 0,
          paddingBottom: Math.max(insets.bottom, 10),
        }}
      >
        {/* Modal Header */}
        {(title || showCloseButton) && (
          <View className="flex-row justify-between items-center px-6 py-4 border-b border-text/10">
            <View className="flex-1">
              {title && (
                <Text className="text-text text-xl font-bold">{title}</Text>
              )}
            </View>
            
            {showCloseButton && (
              <TouchableOpacity
                onPress={handleClose}
                className="w-10 h-10 rounded-full bg-text/10 justify-center items-center ml-4"
                accessibilityLabel="Close Modal"
                accessibilityRole="button"
                testID={testID ? `${testID}-close-button` : 'modal-close-button'}
              >
                <Text className="text-text text-lg font-semibold">×</Text>
              </TouchableOpacity>
            )}
          </View>
        )}
        
        {/* Swipe Indicator */}
        {swipeDirection && !fullScreen && (
          <View className="items-center py-2">
            <View className="w-12 h-1 bg-text/30 rounded-full" />
          </View>
        )}
        
        {/* Modal Content */}
        <ScrollView
          className="flex-1"
          showsVerticalScrollIndicator={false}
          bounces={false}
          contentContainerStyle={{
            flexGrow: 1,
            paddingHorizontal: 24,
            paddingVertical: 16,
          }}
        >
          {children}
        </ScrollView>
      </View>
    </Modal>
  );
};