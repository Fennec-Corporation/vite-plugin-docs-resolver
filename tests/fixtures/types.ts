/**
 * Visual styling variant for buttons.
 */
export type ButtonVariant = 'primary' | 'secondary' | 'quiet';

/**
 * Base interactive element props.
 */
export interface BaseProps {
  /**
   * Unique element identifier.
   */
  id?: string;

  /**
   * Whether the element is disabled.
   * @default false
   */
  isDisabled?: boolean;
}
