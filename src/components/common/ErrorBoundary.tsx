import React, { Component, ReactNode } from 'react';

interface ErrorBoundaryProps {
  children: ReactNode;
}

interface ErrorBoundaryState {
  hasError: boolean;
  error: Error | null;
}

/**
 * Error Boundary to catch uncaught React component errors
 * Prevents entire app from crashing when a component throws an error
 */
export class ErrorBoundary extends (React.Component as new (props: ErrorBoundaryProps) => {
  props: ErrorBoundaryProps;
  state: ErrorBoundaryState;
  setState: (state: Partial<ErrorBoundaryState>) => void;
}) {
  state: ErrorBoundaryState = { hasError: false, error: null };

  constructor(props: ErrorBoundaryProps) {
    super(props);
  }

  static getDerivedStateFromError(error: Error): ErrorBoundaryState {
    console.error('[ErrorBoundary] Error caught:', error.message);
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, errorInfo: any) {
    console.error('[ErrorBoundary] Error details:', error, errorInfo);
  }

  render() {
    if (this.state.hasError) {
      return (
        <div className="min-h-screen bg-rose-50 dark:bg-rose-950 flex items-center justify-center p-4">
          <div className="bg-white dark:bg-slate-900 border border-rose-300 dark:border-rose-800 rounded-2xl p-8 max-w-md text-center space-y-4">
            <h1 className="text-2xl font-bold text-rose-600 dark:text-rose-400">Something went wrong</h1>
            <p className="text-slate-600 dark:text-slate-400">
              An unexpected error occurred. You can safely try again without losing your session.
            </p>
            <pre className="bg-rose-100 dark:bg-rose-900/50 p-4 rounded text-left text-xs overflow-auto max-h-48 text-rose-900 dark:text-rose-200">
              {this.state.error?.toString()}
            </pre>
            <button
              onClick={() => this.setState({ hasError: false, error: null })}
              className="w-full px-4 py-2 rounded-lg bg-rose-600 hover:bg-rose-700 text-white font-semibold transition-colors"
            >
              Try Again
            </button>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}
