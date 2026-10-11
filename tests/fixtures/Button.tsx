import React from 'react';
import type { BaseProps, ButtonVariant } from './types';

/**
 * Button component properties.
 */
export interface ButtonProps extends BaseProps {
  /**
   * Button visual variant.
   * @default 'primary'
   */
  variant?: ButtonVariant;

  /**
   * Button text content.
   */
  label: string;

  /**
   * Click event handler.
   * @param event Click event payload
   */
  onPress?: (event: { timeStamp: number }) => void;
}

/**
 * Primary UI button component.
 * @example
 * ```tsx
 * <Button label="Submit" variant="primary" />
 * ```
 */
export const Button = React.forwardRef<HTMLButtonElement, ButtonProps>((props, ref) => {
  return (
    <button ref={ref} disabled={props.isDisabled}>
      {props.label}
    </button>
  );
});

export default Button;
