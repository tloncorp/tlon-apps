import cn from 'classnames';
import _ from 'lodash';
import { forwardRef } from 'react';

interface TextInputProps extends React.InputHTMLAttributes<HTMLInputElement> {
  disableGrammar?: boolean;
}

const baseClass =
  'w-full rounded-lg border border-gray-100 dark:bg-gray-100 dark:placeholder:text-gray-500 px-4 py-3.5 text-lg outline-none text-black';

const LargeTextInput = forwardRef<HTMLInputElement, TextInputProps>(
  (props: TextInputProps, ref) => {
    const rest = _.omit(props, ['disableGrammar']);
    return (
      <input
        ref={ref}
        autoComplete=""
        className={cn(baseClass, props.className)}
        autoCorrect={props.disableGrammar ? 'off' : undefined}
        autoCapitalize={props.disableGrammar ? 'off' : undefined}
        spellCheck={props.disableGrammar ? 'false' : undefined}
        {...rest}
      />
    );
  }
);

export default LargeTextInput;
