import type { CSSProperties, ReactNode } from 'react';

/**
 * Common base properties shared across UI components.
 */
export interface BaseProps {
  /**
   * Unique identifier for the element.
   */
  id?: string;

  /**
   * Additional CSS classes to apply.
   */
  className?: string;

  /**
   * Inline styles to apply to the element.
   */
  style?: CSSProperties;

  /**
   * Accessible label for assistive technologies.
   */
  'aria-label'?: string;

  /**
   * Whether the button is disabled.
   * @default false
   */
  isDisabled?: boolean;

  /**
   * Content to render inside the button.
   */
  children?: ReactNode;
}

/**
 * Visual styling variant for buttons.
 */
export type ButtonVariant = 'cta' | 'primary' | 'secondary' | 'negative' | 'overBackground';
