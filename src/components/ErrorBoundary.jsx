import React from 'react';

export default class ErrorBoundary extends React.Component {
  constructor(props) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error) {
    return { hasError: true, error };
  }

  componentDidCatch(error, errorInfo) {
    console.error('ErrorBoundary caught an error:', error, errorInfo);
  }

  render() {
    if (this.state.hasError) {
      return (
        <div className="min-h-screen bg-neo-dots flex flex-col items-center justify-center p-6 text-black">
          <div className="bg-white border-3 border-black shadow-neo-lg p-6 max-w-md w-full text-center">
            <span className="text-4xl mb-3 block">⚠️</span>
            <h2 className="font-display font-black text-xl uppercase mb-2">Something went wrong</h2>
            <p className="font-mono text-xs text-zinc-600 mb-5">
              An unexpected error occurred while loading this page.
            </p>
            <div className="flex gap-3 justify-center">
              <button
                onClick={() => window.location.reload()}
                className="bg-neo-yellow border-2 border-black px-4 py-2 font-mono font-black text-xs uppercase shadow-neo-sm hover:translate-y-0.5 transition-all cursor-pointer"
              >
                Reload Page
              </button>
              <a
                href="/"
                className="bg-white border-2 border-black px-4 py-2 font-mono font-black text-xs uppercase shadow-neo-sm hover:bg-zinc-100 transition-all cursor-pointer"
              >
                Go Home
              </a>
            </div>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}
