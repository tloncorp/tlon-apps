import bigInt, { BigInteger } from 'big-integer';
import React from 'react';
import VirtualScroller, {
  VirtualScrollerProps,
} from '../../components/VirtualScroller/VirtualScroller';

type SelectOptionScrollerProps = Omit<
  VirtualScrollerProps<BigInteger, React.ReactNode>,
  'keyEq' | 'keyToString' | 'keyBunt'
>;

const keyEq = (a: BigInteger, b: BigInteger) => a.eq(b);
const keyToString = (a: BigInteger) => a.toString();

const SelectOptionScroller = React.forwardRef<
  VirtualScroller<BigInteger, React.ReactNode>,
  SelectOptionScrollerProps
>((props, ref) => (
  <VirtualScroller
    ref={ref}
    {...props}
    keyEq={keyEq}
    keyToString={keyToString}
    keyBunt={bigInt.zero}
  />
));

export default SelectOptionScroller;
