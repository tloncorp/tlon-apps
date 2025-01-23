import { ComponentPropsWithRef, ElementType } from 'react';

/**
 * Utility to make it easier to type props when you're forwarding most props
 * to the inner component, e.g. forwarding Tamagui style props.
 *
 * ```tsx
 * function MyButton({
 *   children,
 *   name,
 *   ...forwardedProps
 * }: ForwardingProps<
 *   typeof Button, // the inner component type
 *   { myProp: string }, // custom props that should be included in props
 *   'disabled' | 'onClick'  // which inner props should *not* be exposed?
 * >) {
 *   return <Button {...forwardedProps}> ... </Button>;
 * }
 * ```
 */
export type ForwardingProps<
  E extends ElementType,
  CustomProps extends Record<string, unknown>,
  OmitKeys extends keyof ComponentPropsWithRef<E> = never,
> = CustomProps & Omit<ComponentPropsWithRef<E>, keyof CustomProps | OmitKeys>;
