import type { WalletView } from '@tloncorp/api/client/browserWallet';
import { Button, Icon, Text } from '@tloncorp/ui';
import { useState, type ReactNode } from 'react';
import { Spinner, ScrollView, XStack, YStack } from 'tamagui';

import { Platform, useWindowDimensions } from 'react-native';
import { BottomSheetScrollView } from '../../ui/components/BottomSheetWrapper';
import { ActionSheet } from '../../ui/components/ActionSheet';
import {
  A2UICardButton,
  A2UI_INNER_CARD,
  A2UI_SPACE,
} from '../../ui/components/PostContent/a2uiCardParts';
import { BrowserCardFrame, BrowserCardText } from './BrowserCardFrame';
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
        width={36}
        height={36}
        alignItems="center"
        justifyContent="center"
      >
        <Icon type="Lock" size="$m" />
      </YStack>
      <YStack flex={1} minWidth={0} gap="$xs">
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

function SavedPaymentSummary({
  view,
  card = false,
}: {
  view: WalletView;
  card?: boolean;
}) {
  if (!view.saved_payment) return null;
  if (card)
    return (
      <YStack>
        <BrowserCardText type="label" color="$primaryText">
          {view.saved_payment.method} · saved on this site
        </BrowserCardText>
        {view.saved_payment.destination ? (
          <BrowserCardText type="note" marginTop={A2UI_SPACE.line}>
            {view.saved_payment.destination}
          </BrowserCardText>
        ) : null}
      </YStack>
    );
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
  card = false,
}: {
  label: string;
  amount: number;
  currency: string;
  total?: boolean;
  card?: boolean;
}) {
  if (card) {
    return (
      <XStack gap={12} justifyContent="space-between" alignItems="flex-start">
        <BrowserCardText type="note" flex={1}>
          {label}
        </BrowserCardText>
        <BrowserCardText type="note" color="$primaryText">
          {displayPaymentAmount(amount, currency)}
        </BrowserCardText>
      </XStack>
    );
  }
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

function PaymentTotals({
  view,
  card = false,
}: {
  view: WalletView;
  card?: boolean;
}) {
  const purchase = view.purchase;
  if (!purchase) return null;
  const { order, currency } = purchase;
  return (
    <YStack gap={card ? A2UI_SPACE.line : '$m'}>
      {order ? (
        <>
          <AmountRow
            label="Subtotal"
            amount={order.subtotal}
            currency={currency}
            card={card}
          />
          {order.discount ? (
            <AmountRow
              label="Discount"
              amount={-order.discount}
              currency={currency}
              card={card}
            />
          ) : null}
          {order.shipping ? (
            <AmountRow
              label={`Shipping · ${order.shipping.method}`}
              amount={order.shipping.amount}
              currency={currency}
              card={card}
            />
          ) : null}
          {order.tax ? (
            <AmountRow
              label={order.tax.estimated ? 'Estimated tax' : 'Tax'}
              amount={order.tax.amount}
              currency={currency}
              card={card}
            />
          ) : null}
          {order.fees ? (
            <AmountRow
              label="Fees"
              amount={order.fees}
              currency={currency}
              card={card}
            />
          ) : null}
        </>
      ) : null}
      {/* The card shows the amount above these rows, so it leaves out the
          total. */}
      {card ? null : (
        <YStack borderTopWidth={1} borderColor="$border" paddingTop="$m">
          <AmountRow
            label="Total"
            amount={purchase.amount}
            currency={currency}
            total
          />
        </YStack>
      )}
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
  const finished = walletFinished.has(view.status);
  const canOpenLink =
    !!view.action && !finished && view.status !== 'review' && !error;
  return (
    <BrowserCardFrame
      icon="Lock"
      kicker="Tlon wallet"
      status={paymentStatus(view)}
    >
      <BrowserCardText
        type="title"
        color="$primaryText"
        marginTop={A2UI_SPACE.afterKicker}
      >
        {view.kind === 'connect' ? 'Wallet connection' : 'Payment Request'}
      </BrowserCardText>
      <BrowserCardText
        type="note"
        numberOfLines={1}
        marginTop={A2UI_SPACE.line}
      >
        {purchase?.merchant ?? 'Stripe Link'}
      </BrowserCardText>
      {purchase ? (
        // The inner card holds what the request is about.
        <YStack
          marginTop={A2UI_SPACE.afterTitle}
          borderWidth={1}
          borderColor="$border"
          borderRadius={A2UI_INNER_CARD.radius}
          paddingHorizontal={A2UI_INNER_CARD.paddingX}
          paddingVertical={A2UI_INNER_CARD.paddingY}
        >
          <BrowserCardText type="title" color="$primaryText">
            {displayPaymentAmount(purchase.amount, purchase.currency)}
          </BrowserCardText>
          {order ? (
            <>
              <BrowserCardText type="note" marginTop={A2UI_SPACE.line}>
                {count} {count === 1 ? 'item' : 'items'}
              </BrowserCardText>
              <BrowserCardText
                type="note"
                numberOfLines={2}
                marginTop={A2UI_SPACE.line}
              >
                {order.items
                  .map(
                    (item) =>
                      item.name +
                      (item.quantity > 1 ? ` ×${item.quantity}` : '')
                  )
                  .join(', ')}
              </BrowserCardText>
              <YStack marginTop={A2UI_SPACE.block}>
                <PaymentTotals view={view} card />
              </YStack>
            </>
          ) : (
            <BrowserCardText
              type="note"
              numberOfLines={3}
              marginTop={A2UI_SPACE.line}
            >
              {purchase.description}
            </BrowserCardText>
          )}
        </YStack>
      ) : null}
      {view.saved_payment ? (
        <YStack marginTop={purchase ? A2UI_SPACE.block : A2UI_SPACE.afterTitle}>
          <SavedPaymentSummary view={view} card />
        </YStack>
      ) : null}
      {finished ? (
        <BrowserCardText type="body" marginTop={A2UI_SPACE.block}>
          {copy.description}
        </BrowserCardText>
      ) : null}
      <XStack gap={8} paddingTop={A2UI_SPACE.beforeButtons}>
        <A2UICardButton
          tone="secondary"
          label="View details"
          onPress={onOpen}
        />
        {!finished ? (
          <A2UICardButton
            tone="primary"
            label={view.kind === 'connect' ? 'Connect Link' : 'Review payment'}
            onPress={canOpenLink && onOpenLink ? onOpenLink : onOpen}
          />
        ) : null}
      </XStack>
      {!finished ? (
        <BrowserCardText type="note" marginTop={A2UI_SPACE.block}>
          {error
            ? 'Unable to refresh. Open details to check status.'
            : canOpenLink
              ? 'Opens Stripe Link to approve this amount.'
              : copy.description}
        </BrowserCardText>
      ) : null}
    </BrowserCardFrame>
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
          <YStack gap="$xs">
            <Text size="$title/l">
              {displayPaymentAmount(purchase.amount, purchase.currency)}
            </Text>
            <Text size="$label/m" color="$secondaryText">
              {new URL(purchase.page_url).hostname}
            </Text>
          </YStack>
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
      <Text size="$label/m" color="$secondaryText">
        {paymentStatusCopy(view).description}
      </Text>
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
  const isWeb = Platform.OS === 'web';
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
      dialogContentProps={{ maxWidth: 520, maxHeight: detailsHeight }}
    >
      <YStack
        height={isWeb ? undefined : detailsHeight}
        maxHeight={detailsHeight}
        flexShrink={1}
      >
        <ActionSheet.SimpleHeader title="Payment details" />
        <PaymentScroll style={isWeb ? { flexShrink: 1 } : { flex: 1 }}>
          <YStack padding="$xl">
            <BrowserPaymentDetails view={props.view} error={props.error} />
          </YStack>
        </PaymentScroll>
        <YStack
          padding="$xl"
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
