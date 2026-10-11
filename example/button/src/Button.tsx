import React, { forwardRef, type ReactNode } from 'react';
import type { BaseProps, ButtonVariant } from './types';

/**
 * Properties for the Button component.
 */
export interface ButtonProps extends BaseProps {
  /**
   * The visual style of the button.
   * @default 'primary'
   */
  variant?: ButtonVariant;

  /**
   * Whether the button should be an unbordered, quiet button.
   * @default false
   */
  isQuiet?: boolean;

  /**
   * An icon to display inside the button.
   */
  icon?: ReactNode;

  /**
   * Handler that is called when the press is released over the target.
   */
  onPress?: () => void;

  /**
   * Whether the element should receive focus on render.
   * @default false
   */
  autoFocus?: boolean;

  /**
   * The behavior of the button when used in an HTML form.
   * @default 'button'
   */
  type?: 'button' | 'submit' | 'reset';
}

/**
 * Buttons allow users to perform an action or to navigate to another page.
 */
export const Button = forwardRef<HTMLButtonElement, ButtonProps>(function Button(
  props: ButtonProps,
  ref
) {
  const {
    id,
    className = '',
    style,
    variant = 'primary',
    isQuiet = false,
    isDisabled = false,
    autoFocus = false,
    type = 'button',
    icon,
    onPress,
    children,
    'aria-label': ariaLabel,
  } = props;

  const quietClass = isQuiet ? 'btn-quiet' : '';
  const variantClass = `btn-${variant}`;

  return (
    <button
      ref={ref}
      id={id}
      type={type}
      autoFocus={autoFocus}
      disabled={isDisabled}
      aria-label={ariaLabel}
      onClick={onPress}
      style={style}
      className={`btn ${variantClass} ${quietClass} ${className}`.trim()}
    >
      {icon && <span className="btn-icon">{icon}</span>}
      {children && <span className="btn-label">{children}</span>}
    </button>
  );
});

Button.displayName = 'Button';
