import React, { createContext, useContext, useState, useCallback } from 'react';
import {
  SystemNotificationToast,
  NotificationOptions,
  NotificationState,
  NotificationType,
} from '../components/ui/SystemNotificationToast';

interface NotificationContextType {
  showNotification: (options: NotificationOptions) => void;
  showToast: (message: string, type?: NotificationType, duration?: number) => void;
  hideNotification: () => void;
}

const NotificationContext = createContext<NotificationContextType | undefined>(undefined);

export function NotificationProvider({ children }: { children: React.ReactNode }) {
  const [notification, setNotification] = useState<NotificationState>({
    visible: false,
    message: '',
  });

  const hideNotification = useCallback(() => {
    setNotification((prev) => ({ ...prev, visible: false }));
  }, []);

  const showNotification = useCallback((options: NotificationOptions) => {
    setNotification({
      visible: true,
      message: options.message,
      title: options.title,
      type: options.type || 'success',
      duration: options.duration || 3000,
    });
  }, []);

  const showToast = useCallback(
    (message: string, type: NotificationType = 'success', duration = 3000) => {
      showNotification({ message, type, duration });
    },
    [showNotification]
  );

  return (
    <NotificationContext.Provider value={{ showNotification, showToast, hideNotification }}>
      {children}
      <SystemNotificationToast notification={notification} onDismiss={hideNotification} />
    </NotificationContext.Provider>
  );
}

export function useNotification() {
  const context = useContext(NotificationContext);
  if (!context) {
    throw new Error('useNotification must be used within a NotificationProvider');
  }
  return context;
}
