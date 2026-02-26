import {
  getSignalAuthType,
  isSignalUnlocked,
  setupPasskeyAuth,
  setupPassphraseAuth,
  unlockSignal,
} from '@tloncorp/shared/store';
import { loadAuthType, loadCredentialId } from '@tloncorp/shared/api';
import { Button } from '@tloncorp/ui';
import { useCallback, useEffect, useState } from 'react';
import { useForm } from 'react-hook-form';

import { ActionSheet } from './ActionSheet';
import * as Form from './Form';

type Step = 'choose' | 'passkey' | 'passphrase';
type OpState = 'idle' | 'working' | 'error';

const MIN_PASSPHRASE_LENGTH = 20;

export function SignalAuthSheet({
  open,
  onOpenChange,
  onUnlocked,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onUnlocked?: () => void;
}) {
  const [step, setStep] = useState<Step>('choose');
  const [opState, setOpState] = useState<OpState>('idle');
  const [error, setError] = useState<string | null>(null);
  const [isReturning, setIsReturning] = useState(false);

  const { control, handleSubmit, reset } = useForm({
    defaultValues: {
      passphrase: '',
      confirm: '',
    },
  });

  // On open, detect returning user vs new
  useEffect(() => {
    if (!open) return;
    setOpState('idle');
    setError(null);
    reset();

    const detect = async () => {
      // In-memory auth type means we already set up this session
      const authType = getSignalAuthType();
      if (authType) {
        setIsReturning(true);
        setStep(authType);
        return;
      }

      // Check ship for stored auth type AND credential.
      // Both must exist — auth-type alone (e.g. leftover from a nuked desk)
      // without a credential means there's nothing to unlock.
      const [shipAuthType, credentialId] = await Promise.all([
        loadAuthType(),
        loadCredentialId(),
      ]);
      if (shipAuthType && credentialId) {
        setIsReturning(true);
        setStep(shipAuthType);
        return;
      }

      setIsReturning(false);
      setStep('choose');
    };

    detect();
  }, [open, reset]);

  const close = useCallback(() => {
    onOpenChange(false);
  }, [onOpenChange]);

  const handlePasskey = useCallback(async () => {
    setOpState('working');
    setError(null);
    try {
      if (isReturning) {
        const ok = await unlockSignal();
        if (!ok) {
          setError('Unlock failed. Try again.');
          setOpState('error');
          return;
        }
      } else {
        await setupPasskeyAuth();
      }
      setOpState('idle');
      close();
      onUnlocked?.();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Passkey operation failed');
      setOpState('error');
    }
  }, [isReturning, close, onUnlocked]);

  const handlePassphraseSubmit = useCallback(
    async (data: { passphrase: string; confirm: string }) => {
      if (!isReturning) {
        if (data.passphrase.length < MIN_PASSPHRASE_LENGTH) {
          setError(
            `Passphrase must be at least ${MIN_PASSPHRASE_LENGTH} characters.`
          );
          return;
        }
        if (data.passphrase !== data.confirm) {
          setError('Passphrases do not match.');
          return;
        }
      }

      setOpState('working');
      setError(null);
      try {
        if (isReturning) {
          const ok = await unlockSignal(data.passphrase);
          if (!ok) {
            setError('Wrong passphrase or no credential found.');
            setOpState('error');
            return;
          }
        } else {
          await setupPassphraseAuth(data.passphrase);
        }
        setOpState('idle');
        close();
        onUnlocked?.();
      } catch (e) {
        setError(
          e instanceof Error ? e.message : 'Passphrase operation failed'
        );
        setOpState('error');
      }
    },
    [isReturning, close, onUnlocked]
  );

  const busy = opState === 'working';

  const title =
    step === 'choose'
      ? 'Set up end-to-end encryption keys'
      : step === 'passkey'
        ? isReturning
          ? 'Unlock with device passkey'
          : 'Create Passkey'
        : isReturning
          ? 'Unlock with passphrase'
          : 'Create Passphrase';

  return (
    <ActionSheet moveOnKeyboardChange open={open} onOpenChange={onOpenChange}>
      <ActionSheet.SimpleHeader title={title} />
      <ActionSheet.Content>
        {step === 'choose' && (
          <>
            <ActionSheet.FormBlock>
              <Button
                preset="primary"
                onPress={() => setStep('passkey')}
                label="Use Passkey"
                centered
              />
            </ActionSheet.FormBlock>
            <ActionSheet.FormBlock>
              <Button
                preset="secondary"
                onPress={() => setStep('passphrase')}
                label="Use Passphrase"
                centered
              />
            </ActionSheet.FormBlock>
          </>
        )}

        {step === 'passkey' && (
          <ActionSheet.FormBlock>
            <Button
              preset="primary"
              onPress={handlePasskey}
              disabled={busy}
              label={
                busy
                  ? 'Working...'
                  : isReturning
                    ? 'Unlock with Passkey'
                    : 'Create Passkey'
              }
              centered
            />
          </ActionSheet.FormBlock>
        )}

        {step === 'passphrase' && (
          <>
            <ActionSheet.FormBlock>
              <Form.ControlledTextField
                control={control}
                name="passphrase"
                label="Passphrase"
                rules={{
                  required: 'Passphrase is required',
                  ...(isReturning
                    ? {}
                    : {
                        minLength: {
                          value: MIN_PASSPHRASE_LENGTH,
                          message: `Must be at least ${MIN_PASSPHRASE_LENGTH} characters`,
                        },
                      }),
                }}
                inputProps={{
                  placeholder: isReturning
                    ? 'Enter your passphrase'
                    : `Min ${MIN_PASSPHRASE_LENGTH} characters`,
                  secureTextEntry: true,
                  autoFocus: true,
                }}
              />
            </ActionSheet.FormBlock>
            {!isReturning && (
              <ActionSheet.FormBlock>
                <Form.ControlledTextField
                  control={control}
                  name="confirm"
                  label="Confirm"
                  rules={{ required: 'Please confirm your passphrase' }}
                  inputProps={{
                    placeholder: 'Confirm passphrase',
                    secureTextEntry: true,
                  }}
                />
              </ActionSheet.FormBlock>
            )}
            <ActionSheet.FormBlock>
              <Button
                preset="primary"
                onPress={handleSubmit(handlePassphraseSubmit)}
                disabled={busy}
                label={
                  busy
                    ? 'Deriving keys...'
                    : isReturning
                      ? 'Unlock'
                      : 'Create Identity'
                }
                centered
              />
            </ActionSheet.FormBlock>
          </>
        )}

        {step !== 'choose' && !isReturning && (
          <ActionSheet.FormBlock>
            <Button
              preset="secondary"
              onPress={() => {
                setStep('choose');
                setError(null);
                reset();
              }}
              disabled={busy}
              label="Use a different method"
              centered
            />
          </ActionSheet.FormBlock>
        )}

        {error && (
          <ActionSheet.FormBlock>
            <Form.FieldErrorMessage>{error}</Form.FieldErrorMessage>
          </ActionSheet.FormBlock>
        )}
      </ActionSheet.Content>
    </ActionSheet>
  );
}
