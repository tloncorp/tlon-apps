import { Button, Text } from '@tloncorp/ui';
import React, {
  ReactNode,
  createContext,
  useCallback,
  useContext,
  useState,
} from 'react';
import { Alert, Platform } from 'react-native';
import { YStack } from 'tamagui';

import { ActionSheet } from './ActionSheet';

export type ConfirmationOptions = {
  title: string;
  message: string;
  confirmLabel?: string;
  cancelLabel?: string;
  onConfirm: () => void;
  onCancel?: () => void;
  variant?: 'default' | 'danger' | 'warning';
};

type ConfirmationContextType = {
  showConfirmation: (options: ConfirmationOptions) => void;
  hideConfirmation: () => void;
};

const ConfirmationContext = createContext<ConfirmationContextType | undefined>(
  undefined
);

export const ConfirmationProvider: React.FC<{ children: ReactNode }> = ({
  children,
}) => {
  const [confirmationState, setConfirmationState] = useState<{
    isOpen: boolean;
    options: ConfirmationOptions | null;
  }>({
    isOpen: false,
    options: null,
  });

  const hideConfirmation = useCallback(() => {
    setConfirmationState({
      isOpen: false,
      options: null,
    });
  }, []);

  const handleConfirm = useCallback(() => {
    if (confirmationState.options?.onConfirm) {
      confirmationState.options.onConfirm();
    }
    hideConfirmation();
  }, [confirmationState.options, hideConfirmation]);

  const handleCancel = useCallback(() => {
    if (confirmationState.options?.onCancel) {
      confirmationState.options.onCancel();
    }
    hideConfirmation();
  }, [confirmationState, hideConfirmation]);

  const showConfirmation = (options: ConfirmationOptions) => {
    setConfirmationState({
      isOpen: true,
      options,
    });
    Alert.alert(options.title, options.message, [
      {
        text: options.cancelLabel || 'Cancel',
        onPress: () => {
          options.onCancel?.();
          hideConfirmation();
        },
      },
      {
        text: options.confirmLabel || 'Confirm',
        onPress: () => {
          options.onConfirm?.();
          hideConfirmation();
        },
      },
    ]);
  };

  const WebConfirmationModal = () => {
    if (
      !confirmationState.isOpen ||
      !confirmationState.options ||
      Platform.OS !== 'web'
    ) {
      return null;
    }

    const {
      title,
      message,
      confirmLabel = 'Confirm',
      cancelLabel = 'Cancel',
      variant = 'default',
    } = confirmationState.options;

    return (
      <ActionSheet
        mode="dialog"
        open={confirmationState.isOpen}
        onOpenChange={handleCancel}
        dialogContentProps={{ maxWidth: 300 }}
      >
        <ActionSheet.Content padding="$2xl" gap="$4xl">
          <YStack gap="$2xl">
            <Text size="$label/2xl">{title}</Text>
            <Text size="$label/l">{message}</Text>
          </YStack>
          <ActionSheet.ContentBlock
            flexDirection="row"
            gap="$m"
            width="100%"
            justifyContent="flex-end"
          >
            <Button secondary onPress={handleCancel} paddingHorizontal="$xl">
              <Button.Text>{cancelLabel}</Button.Text>
            </Button>
            <Button hero onPress={handleConfirm} paddingHorizontal="$xl">
              <Button.Text>{confirmLabel}</Button.Text>
            </Button>
          </ActionSheet.ContentBlock>
        </ActionSheet.Content>
      </ActionSheet>
    );
  };

  return (
    <ConfirmationContext.Provider
      value={{
        showConfirmation,
        hideConfirmation,
      }}
    >
      {children}
      <WebConfirmationModal />
    </ConfirmationContext.Provider>
  );
};

// Custom hook to use the confirmation dialog
export const useConfirmation = () => {
  const context = useContext(ConfirmationContext);

  if (context === undefined) {
    throw new Error(
      'useConfirmation must be used within a ConfirmationProvider'
    );
  }

  return context;
};
