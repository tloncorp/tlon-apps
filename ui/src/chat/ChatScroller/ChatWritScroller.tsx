import bigInt, { BigInteger } from 'big-integer';
import React from 'react';
import { ChatWrit } from '../../types/chat';
import VirtualScroller, {
  VirtualScrollerProps,
} from '../../components/VirtualScroller/VirtualScroller';

type ChatWritScrollerProps = Omit<
  VirtualScrollerProps<BigInteger, ChatWrit>,
  'keyEq' | 'keyToString' | 'keyBunt'
>;

const keyEq = (a: BigInteger, b: BigInteger) => a.eq(b);
const keyToString = (a: BigInteger) => a.toString();

const ChatWritScroller = React.forwardRef<
  VirtualScroller<BigInteger, ChatWrit>,
  ChatWritScrollerProps
>((props, ref) => (
  <VirtualScroller
    ref={ref}
    {...props}
    keyEq={keyEq}
    keyToString={keyToString}
    keyBunt={bigInt.zero}
  />
));

export default ChatWritScroller;
