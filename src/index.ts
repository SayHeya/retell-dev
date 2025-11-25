/**
 * Retell CLI - Main Library Entry Point
 *
 * This module re-exports the core functionality from @heya/retell.controllers
 * for programmatic use. For CLI usage, run `retell` command directly.
 */

export const version = '1.0.0';

// Re-export everything from the controllers package
export * from '@heya/retell.controllers';
