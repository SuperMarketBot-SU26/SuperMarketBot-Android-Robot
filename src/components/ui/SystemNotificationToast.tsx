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
        return <AlertCircle size={18} color="#ef4444" />;
      case 'warning':
        return <AlertCircle size={18} color="#f59e0b" />;
      case 'info':
        return <Info size={18} color="#3b82f6" />;
      default:
        return <CheckCircle2 size={18} color="#22c55e" />;
    }
  };

  const getIconBgColor = () => {
    switch (type) {
      case 'error':
        return '#fee2e2';
      case 'warning':
        return '#fef3c7';
      case 'info':
        return '#dbeafe';
      default:
        return '#dcfce7'; // light green for success
    }
  };

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
        backgroundColor="#f8fafc"
        borderRadius={16}
        paddingHorizontal="$3.5"
        paddingVertical="$3"
        borderWidth={1}
        borderColor="#e2e8f0"
        style={{ elevation: 15 }}
        shadowColor="#000"
        shadowOffset={{ width: 0, height: 8 }}
        shadowOpacity={0.12}
        shadowRadius={15}
        maxWidth={320}
        minWidth={250}
      >
        <XStack alignItems="center" gap="$3">
          {/* Icon Badge */}
          <View
            width={38}
            height={38}
            borderRadius={10}
            backgroundColor={getIconBgColor()}
            justifyContent="center"
            alignItems="center"
          >
            {getStatusIcon()}
          </View>

          {/* Text Content */}
          <YStack flex={1} gap="$0.5">
            <Text
              fontSize={11}
              fontWeight="bold"
              color="#64748b"
              letterSpacing={0.5}
              textTransform="uppercase"
            >
              {notification.title || (type === 'success' ? 'THÀNH CÔNG' : 'THÔNG BÁO')}
            </Text>
            <Text fontSize={14} fontWeight="600" color="#334155" numberOfLines={2}>
              {notification.message}
            </Text>
          </YStack>

          {/* Close button */}
          <Pressable onPress={onDismiss} hitSlop={12}>
            <View
              width={24}
              height={24}
              borderRadius={12}
              backgroundColor="#f1f5f9"
              justifyContent="center"
              alignItems="center"
            >
              <X size={14} color="#94a3b8" />
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
