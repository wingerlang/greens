type NotificationType = "success" | "error" | "info";

interface Notification {
  id: string;
  type: NotificationType;
  message: string;
  duration?: number;
}

type NotificationListener = (notification: Notification) => void;

class NotificationService {
  private listeners: NotificationListener[] = [];

  subscribe(listener: NotificationListener) {
    this.listeners.push(listener);
    return () => {
      this.listeners = this.listeners.filter((l) => l !== listener);
    };
  }

  notify(type: NotificationType, message: string, duration: number = 3000) {
    const notification: Notification = {
      id: Math.random().toString(36).substring(7),
      type,
      message,
      duration,
    };
    this.listeners.forEach((listener) => listener(notification));
  }
}

export const notificationService = new NotificationService();
