import React, { createContext, useContext, useState, ReactNode } from 'react';
import CustomModal from '../components/ui/CustomModal';

interface ModalButton {
  text: string;
  onPress: () => void;
  style?: 'default' | 'cancel' | 'destructive';
}

interface ModalConfig {
  title: string;
  message: string;
  buttons?: ModalButton[];
  type?: 'info' | 'success' | 'warning' | 'error';
}

interface ModalContextType {
  showModal: (config: ModalConfig) => void;
  hideModal: () => void;
}

const ModalContext = createContext<ModalContextType | undefined>(undefined);

export const useModal = () => {
  const context = useContext(ModalContext);
  if (!context) {
    throw new Error('useModal must be used within a ModalProvider');
  }
  return context;
};

interface ModalProviderProps {
  children: ReactNode;
}

export const ModalProvider: React.FC<ModalProviderProps> = ({ children }) => {
  const [modalConfig, setModalConfig] = useState<ModalConfig | null>(null);
  const [isVisible, setIsVisible] = useState(false);

  const showModal = (config: ModalConfig) => {
    setModalConfig(config);
    setIsVisible(true);
  };

  const hideModal = () => {
    setIsVisible(false);
    setModalConfig(null);
  };

  const handleButtonPress = (onPress: () => void) => {
    hideModal();
    onPress();
  };

  return (
    <ModalContext.Provider value={{ showModal, hideModal }}>
      {children}
      {modalConfig && (
        <CustomModal
          visible={isVisible}
          title={modalConfig.title}
          message={modalConfig.message}
          type={modalConfig.type || 'info'}
          buttons={modalConfig.buttons?.map(button => ({
            ...button,
            onPress: () => handleButtonPress(button.onPress),
          }))}
          onClose={modalConfig.buttons && modalConfig.buttons.length === 0 ? hideModal : undefined}
        />
      )}
    </ModalContext.Provider>
  );
};

// Utility function to replace Alert.alert
export const showAlert = (
  title: string,
  message?: string,
  buttons?: { text: string; onPress?: () => void; style?: 'default' | 'cancel' | 'destructive' }[],
  options?: { cancelable?: boolean; type?: 'info' | 'success' | 'warning' | 'error' }
) => {
  const context = ModalContext as any;
  if (context._currentValue) {
    const modalButtons: ModalButton[] = [];

    if (buttons && buttons.length > 0) {
      buttons.forEach(button => {
        modalButtons.push({
          text: button.text,
          onPress: button.onPress || (() => {}),
          style: button.style || 'default',
        });
      });
    } else {
      // Default OK button
      modalButtons.push({
        text: 'OK',
        onPress: () => {},
        style: 'default',
      });
    }

    context._currentValue.showModal({
      title,
      message: message || '',
      buttons: modalButtons,
      type: options?.type || 'info',
    });
  } else {
    // Fallback to Alert.alert if context not available
    console.warn('Modal context not available, falling back to Alert.alert');
    const Alert = require('react-native').Alert;
    Alert.alert(title, message, buttons);
  }
};
