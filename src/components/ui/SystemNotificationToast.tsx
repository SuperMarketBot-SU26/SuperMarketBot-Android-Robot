import React, { useEffect } from 'react';
import { View, Text, XStack, YStack } from 'tamagui';
import Animated, { FadeInRight, FadeOutRight, LinearTransition } from 'react-native-reanimated';
import { Bot, CheckCircle2, AlertCircle, Info, X } from 'lucide-react-native';
import { Pressable, StyleSheet } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

export type NotificationType = 'success' | 'error' | 'info' | 'warning';

export interface NotificationOptions {
  message: string;
  title?: string;
  type?: NotificationType;
  duration?: number;
}

export interface NotificationState extends NotificationOptions {
  visible: boolean;
}

interface SystemNotificationToastProps {
  notification: NotificationState;
  onDismiss: () => void;
}

export function SystemNotificationToast({ notification, onDismiss }: SystemNotificationToastProps) {
  const insets = useSafeAreaInsets();

  useEffect(() => {
    if (notification.visible) {
      const timer = setTimeout(() => {
        onDismiss();
      }, notification.duration || 3000);
      return () => clearTimeout(timer);
    }
  }, [notification.visible, notification.duration, notification.message, onDismiss]);

  if (!notification.visible) return null;

  const type = notification.type || 'success';

  const getStatusIcon = () => {
    switch (type) {
      case 'error':
        return <AlertCircle size={12} color="#F87171" />;
      case 'warning':
        return <AlertCircle size={12} color="#FBBF24" />;
      case 'info':
        return <Info size={12} color="#60A5FA" />;
      default:
        return <CheckCircle2 size={12} color="#4ADE80" />;
    }
  };

  const getAccentColor = () => {
    switch (type) {
      case 'error':
        return '#EF4444';
      case 'warning':
        return '#F59E0B';
      case 'info':
        return '#3B82F6';
      default:
        return '#22C55E';
    }
  };

  const accentColor = getAccentColor();

  return (
    <Animated.View
      entering={FadeInRight.springify().damping(16).stiffness(150)}
      exiting={FadeOutRight.duration(200)}
      layout={LinearTransition}
      style={[
        styles.container,
        {
          top: Math.max(insets.top + 12, 20),
          right: Math.max(insets.right + 12, 16),
        },
      ]}
      pointerEvents="box-none"
    >
      <View
        backgroundColor="#0F291E"
        borderRadius={16}
        paddingHorizontal="$3"
        paddingVertical="$2.5"
        borderWidth={1.5}
        borderColor={accentColor}
        style={{ elevation: 10 }}
        shadowColor="#000"
        shadowOffset={{ width: 0, height: 6 }}
        shadowOpacity={0.35}
        shadowRadius={10}
        maxWidth={280}
      >
        <XStack alignItems="center" gap="$2.5">
          {/* Robot Avatar Badge */}
          <View
            width={34}
            height={34}
            borderRadius={17}
            backgroundColor="#1A3E2F"
            borderWidth={1}
            borderColor={accentColor}
            justifyContent="center"
            alignItems="center"
            position="relative"
          >
            <Bot size={18} color={accentColor} />
            <View
              position="absolute"
              bottom={-2}
              right={-2}
              backgroundColor="#0F291E"
              borderRadius={6}
              padding={1}
            >
              {getStatusIcon()}
            </View>
          </View>

          {/* Text Content */}
          <YStack flex={1} gap="$0.5">
            <XStack alignItems="center" gap="$1">
              <View width={5} height={5} borderRadius={2.5} backgroundColor={accentColor} />
              <Text
                fontSize={9}
                fontWeight="900"
                color={accentColor}
                letterSpacing={0.6}
                textTransform="uppercase"
              >
                {notification.title || 'THÔNG BÁO HỆ THỐNG'}
              </Text>
            </XStack>
            <Text fontSize={12} fontWeight="600" color="#FFFFFF" numberOfLines={2}>
              {notification.message}
            </Text>
          </YStack>

          {/* Close button */}
          <Pressable onPress={onDismiss} hitSlop={8}>
            <View
              width={22}
              height={22}
              borderRadius={11}
              backgroundColor="#16382A"
              justifyContent="center"
              alignItems="center"
            >
              <X size={12} color="#8BA396" />
            </View>
          </Pressable>
        </XStack>
      </View>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  container: {
    position: 'absolute',
    zIndex: 99999,
  },
});
