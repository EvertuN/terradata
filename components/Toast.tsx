import React, { useEffect } from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import { Check, AlertCircle, Info, X } from 'lucide-react';

export interface ToastProps {
  message: string;
  type?: 'info' | 'success' | 'warning' | 'error';
  onClose: () => void;
  duration?: number;
}

export const Toast: React.FC<ToastProps> = ({
  message,
  type = 'info',
  onClose,
  duration = 3200,
}) => {
  useEffect(() => {
    const timer = setTimeout(() => {
      onClose();
    }, duration);
    return () => clearTimeout(timer);
  }, [duration, onClose]);

  const renderIcon = () => {
    switch (type) {
      case 'success':
        return (
          <View style={[styles.iconCircle, { backgroundColor: '#eef9f2' }]}>
            <Check size={12} color="#10b981" />
          </View>
        );
      case 'warning':
      case 'error':
        return (
          <View
            style={[
              styles.iconCircle,
              { backgroundColor: type === 'error' ? '#fdf2f4' : '#fff7ed' },
            ]}
          >
            <AlertCircle size={12} color={type === 'error' ? '#f43f5e' : '#f97316'} />
          </View>
        );
      default:
        return (
          <View style={[styles.iconCircle, { backgroundColor: '#eef5ff' }]}>
            <Info size={12} color="#0071e3" />
          </View>
        );
    }
  };

  return (
    <View style={styles.container}>
      {renderIcon()}
      <Text style={styles.text}>{message}</Text>
      <TouchableOpacity onPress={onClose} style={styles.closeBtn} activeOpacity={0.7}>
        <X size={13} color="#86868b" />
      </TouchableOpacity>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    position: 'absolute',
    bottom: 24,
    right: 24,
    zIndex: 9999,
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(255, 255, 255, 0.95)',
    paddingVertical: 8,
    paddingHorizontal: 14,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: 'rgba(0, 0, 0, 0.06)',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.08,
    shadowRadius: 20,
    elevation: 8,
    maxWidth: 340,
    gap: 8,
  },
  iconCircle: {
    width: 22,
    height: 22,
    borderRadius: 11,
    alignItems: 'center',
    justifyContent: 'center',
  },
  text: {
    color: '#1d1d1f',
    fontSize: 13,
    fontWeight: '500',
    flex: 1,
  },
  closeBtn: {
    padding: 2,
  },
});
