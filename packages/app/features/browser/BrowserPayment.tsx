import type { WalletView } from '@tloncorp/api/client/browserWallet';
import { Button, Icon, Text } from '@tloncorp/ui';
import { useState, type ReactNode } from 'react';
import { Spinner, ScrollView, XStack, YStack } from 'tamagui';

import { Platform, useWindowDimensions } from 'react-native';
import { BottomSheetScrollView } from '../../ui/components/BottomSheetWrapper';
import { ActionSheet } from '../../ui/components/ActionSheet';
import {
  displayPaymentAmount,
  walletFinished,
  paymentStatusCopy,
  paymentStatus,
} from './browserPaymentPresentation';

function PaymentHeader({ view }: { view: WalletView }) {
  const status = paymentStatus(view);
  return (
    <XStack gap="$m" alignItems="center">
      <YStack
        backgroundColor="$secondaryBackground"
        borderRadius="$m"
        padding="$m"
      >
        <Icon type="Lock" customSize={['$l', '$l']} />
      </YStack>
      <YStack flex={1} gap="$xs">
        <Text size="$label/l">
          {view.kind === 'connect' ? 'Wallet connection' : 'Payment Request'}
        </Text>
        <Text size="$label/s" color="$secondaryText">
          {view.purchase?.merchant ?? 'Stripe Link'}
        </Text>
      </YStack>
      <YStack
        borderRadius="$m"
        backgroundColor="$secondaryBackground"
        paddingHorizontal="$s"
        paddingVertical="$xs"
      >
        <Text size="$label/s" color="$secondaryText">
          {status}
        </Text>
      </YStack>
    </XStack>
  );
}

function SavedPaymentSummary({ view }: { view: WalletView }) {
  if (!view.saved_payment) return null;
  return (
    <YStack gap="$s">
      <Text size="$label/m">
        {view.saved_payment.method} · saved on this site
      </Text>
      {view.saved_payment.destination ? (
        <Text size="$label/m" color="$secondaryText">
          {view.saved_payment.destination}
        </Text>
      ) : null}
    </YStack>
  );
}

function AmountRow({
  label,
  amount,
  currency,
  total = false,
}: {
  label: string;
  amount: number;
  currency: string;
  total?: boolean;
}) {
  return (
    <XStack gap="$l" justifyContent="space-between" alignItems="flex-start">
      <Text
        flex={1}
        size={total ? '$label/l' : '$label/m'}
        color={total ? '$primaryText' : '$secondaryText'}
      >
        {label}
      </Text>
      <Text size={total ? '$label/l' : '$label/m'}>
        {displayPaymentAmount(amount, currency)}
      </Text>
    </XStack>
  );
}

function PaymentTotals({ view }: { view: WalletView }) {
  const purchase = view.purchase;
  if (!purchase) return null;
  const { order, currency } = purchase;
  return (
    <YStack gap="$m">
      {order ? (
        <>
          <AmountRow
            label="Subtotal"
            amount={order.subtotal}
            currency={currency}
          />
          {order.discount ? (
            <AmountRow
              label="Discount"
              amount={-order.discount}
              currency={currency}
            />
          ) : null}
          {order.shipping ? (
            <AmountRow
              label={`Shipping · ${order.shipping.method}`}
              amount={order.shipping.amount}
              currency={currency}
            />
          ) : null}
          {order.tax ? (
            <AmountRow
              label={order.tax.estimated ? 'Estimated tax' : 'Tax'}
              amount={order.tax.amount}
              currency={currency}
            />
          ) : null}
          {order.fees ? (
            <AmountRow label="Fees" amount={order.fees} currency={currency} />
          ) : null}
        </>
      ) : null}
      <YStack borderTopWidth={1} borderColor="$border" paddingTop="$m">
        <AmountRow
          label="Total"
          amount={purchase.amount}
          currency={currency}
          total
        />
      </YStack>
    </YStack>
  );
}

export function BrowserPaymentCard({
  view,
  onOpen,
  onOpenLink,
  error,
}: {
  view: WalletView;
  onOpen(): void;
  onOpenLink?(): void;
  error?: string;
}) {
  const copy = paymentStatusCopy(view);
  const purchase = view.purchase;
  const order = purchase?.order;
  const count = order?.items.reduce((sum, item) => sum + item.quantity, 0);
  const canOpenLink =
    !!view.action &&
    !walletFinished.has(view.status) &&
    view.status !== 'review' &&
    !error;
  return (
    <YStack
      width="100%"
      maxWidth={400}
      borderWidth={1}
      borderColor="$border"
      borderRadius="$m"
      backgroundColor="$background"
      overflow="hidden"
    >
      <YStack padding="$l" gap="$l">
        <PaymentHeader view={view} />
        {view.saved_payment ? <SavedPaymentSummary view={view} /> : null}
        {purchase ? (
          <Text size="$title/l">
            {displayPaymentAmount(purchase.amount, purchase.currency)}
          </Text>
        ) : null}
        {order ? (
          <YStack gap="$s">
            <Text size="$label/m" color="$secondaryText">
              {count} {count === 1 ? 'item' : 'items'}
            </Text>
            <Text size="$label/m" color="$secondaryText" numberOfLines={2}>
              {order.items
                .map(
                  (item) =>
                    item.name + (item.quantity > 1 ? ` ×${item.quantity}` : '')
                )
                .join(', ')}
            </Text>
          </YStack>
        ) : purchase ? (
          <Text color="$secondaryText" numberOfLines={3}>
            {purchase.description}
          </Text>
        ) : null}
        {order ? <PaymentTotals view={view} /> : null}
      </YStack>
      <YStack borderTopWidth={1} borderColor="$border" padding="$m">
        <Button
          fill="text"
          intent="primary"
          label="View details"
          onPress={onOpen}
        />
      </YStack>
      <YStack borderTopWidth={1} borderColor="$border" padding="$l" gap="$m">
        {!walletFinished.has(view.status) ? (
          <>
            <Button
              fill="solid"
              intent="primary"
              label={
                view.kind === 'connect' ? 'Connect Link' : 'Review payment'
              }
              onPress={canOpenLink && onOpenLink ? onOpenLink : onOpen}
            />
            <Text size="$label/s" color="$secondaryText">
              {error
                ? 'Unable to refresh. Open details to check status.'
                : canOpenLink
                  ? 'Opens Stripe Link to approve this amount.'
                  : copy.description}
            </Text>
          </>
        ) : (
          <Text size="$label/m" color="$secondaryText">
            {copy.description}
          </Text>
        )}
      </YStack>
    </YStack>
  );
}

export type BrowserPaymentContentProps = {
  view?: WalletView;
  busy?: boolean;
  error?: string;
  preview?: ReactNode;
  onApprove(paymentMethodId?: string): void;
  onOpenLink(): void;
  onRetry(): void;
  onCancel(): void;
};

function BrowserPaymentDetails({
  view,
  error,
}: Pick<BrowserPaymentContentProps, 'view' | 'error'>) {
  if (!view) return !error ? <Spinner size="large" /> : null;
  const purchase = view.purchase;
  return (
    <YStack gap="$l">
      <PaymentHeader view={view} />
      {view.saved_payment ? <SavedPaymentSummary view={view} /> : null}
      {purchase ? (
        <>
          <Text size="$title/l">
            {displayPaymentAmount(purchase.amount, purchase.currency)}
          </Text>
          <Text size="$label/m" color="$secondaryText">
            {new URL(purchase.page_url).hostname}
          </Text>
          {purchase.order ? (
            <>
              <YStack borderTopWidth={1} borderColor="$border">
                {purchase.order.items.map((item, index) => (
                  <XStack
                    key={index}
                    gap="$l"
                    paddingVertical="$l"
                    borderBottomWidth={1}
                    borderColor="$border"
                  >
                    <YStack flex={1} gap="$xs">
                      <Text size="$label/l">{item.name}</Text>
                      {item.detail ? (
                        <Text color="$secondaryText">{item.detail}</Text>
                      ) : null}
                      <Text size="$label/s" color="$secondaryText">
                        Quantity {item.quantity}
                      </Text>
                    </YStack>
                    <Text>
                      {displayPaymentAmount(item.amount, purchase.currency)}
                    </Text>
                  </XStack>
                ))}
              </YStack>
              <PaymentTotals view={view} />
              {purchase.order.details?.map((detail, index) => (
                <YStack
                  key={index}
                  gap="$s"
                  borderTopWidth={1}
                  borderColor="$border"
                  paddingTop="$l"
                >
                  <Text size="$label/m" color="$secondaryText">
                    {detail.label}
                  </Text>
                  <Text>{detail.value}</Text>
                </YStack>
              ))}
            </>
          ) : (
            <Text>{purchase.description}</Text>
          )}
        </>
      ) : null}
      <Text color="$secondaryText">{paymentStatusCopy(view).description}</Text>
    </YStack>
  );
}

function BrowserPaymentActions({
  view,
  busy = false,
  error,
  preview,
  onApprove,
  onOpenLink,
  onRetry,
  onCancel,
}: BrowserPaymentContentProps) {
  const [selected, setSelected] = useState<string>();
  const methods = view?.payment_methods ?? [];
  const methodId =
    methods.length === 1
      ? methods[0].id
      : methods.find((method) => method.id === selected)?.id;
  const ended = view && walletFinished.has(view.status);
  return (
    <YStack gap="$m">
      {view?.status === 'review' ? preview : null}
      {error ? (
        <YStack gap="$m">
          <Text color="$negativeActionText">{error}</Text>
          <Button label="Check status" disabled={busy} onPress={onRetry} />
        </YStack>
      ) : null}
      {view?.status === 'review' && view.payment_source === 'site_saved' ? (
        <Button
          fill="solid"
          intent="primary"
          label={busy ? 'Authorizing…' : 'Authorize payment'}
          disabled={busy || !!error || !view.purchase || !view.saved_payment}
          onPress={() => onApprove()}
        />
      ) : view?.status === 'review' ? (
        <>
          <Text size="$label/l">Payment method</Text>
          {methods.length === 1 ? (
            <Text>{methods[0].display}</Text>
          ) : (
            methods.map((method) => (
              <Button
                key={method.id}
                fill={methodId === method.id ? 'solid' : 'outline'}
                intent="secondary"
                label={`${methodId === method.id ? '✓ ' : ''}${method.display}`}
                disabled={busy}
                onPress={() => setSelected(method.id)}
              />
            ))
          )}
          {!methods.length ? (
            <Text color="$secondaryText">
              No eligible payment methods are available. Check your payment
              methods in Link before requesting another payment.
            </Text>
          ) : null}
          <Text color="$secondaryText">
            Payment details go directly to the browser. They aren’t visible to
            your Tlonbot.
          </Text>
          <Button
            fill="solid"
            intent="primary"
            label={busy ? 'Requesting approval…' : 'Prepare Link approval'}
            disabled={busy || !!error || !methodId || !view.purchase}
            onPress={() => {
              if (methodId) onApprove(methodId);
            }}
          />
        </>
      ) : null}
      {view?.action && !ended && view.status !== 'review' ? (
        <Button
          fill="solid"
          intent="primary"
          label={busy ? 'Opening Link…' : 'Open Link'}
          disabled={busy || !!error}
          onPress={onOpenLink}
        />
      ) : null}
      {view?.status === 'authorizing' || view?.status === 'filling' ? (
        <Spinner />
      ) : null}
      {view && !ended ? (
        <Button
          fill="text"
          intent="secondary"
          label="Cancel request"
          disabled={busy}
          onPress={onCancel}
        />
      ) : null}
    </YStack>
  );
}

export function BrowserPaymentContent(props: BrowserPaymentContentProps) {
  return (
    <YStack padding="$l" gap="$l" width="100%">
      <BrowserPaymentDetails view={props.view} error={props.error} />
      <BrowserPaymentActions {...props} />
    </YStack>
  );
}

export function BrowserPaymentSheet({
  open,
  onClose,
  ...props
}: BrowserPaymentContentProps & { open: boolean; onClose(): void }) {
  const { height } = useWindowDimensions();
  const detailsHeight = height * 0.75;
  const PaymentScroll =
    Platform.OS === 'web' ? ScrollView : BottomSheetScrollView;
  return (
    <ActionSheet
      open={open}
      onOpenChange={(next: boolean) => {
        if (!next) onClose();
      }}
      title="Payment details"
      closeButton
      snapPoints={[85]}
      snapPointsMode="percent"
      dialogScrollEnabled={false}
      dialogContentProps={{ maxWidth: 560, height: detailsHeight }}
    >
      <YStack height={detailsHeight} flexShrink={1}>
        <ActionSheet.SimpleHeader title="Payment details" />
        <PaymentScroll style={{ flex: 1 }}>
          <YStack padding="$l">
            <BrowserPaymentDetails view={props.view} error={props.error} />
          </YStack>
        </PaymentScroll>
        <YStack
          padding="$l"
          borderTopWidth={1}
          borderColor="$border"
          backgroundColor="$background"
        >
          <BrowserPaymentActions {...props} />
        </YStack>
      </YStack>
    </ActionSheet>
  );
}
