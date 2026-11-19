import React from 'react';
import { AlertTriangle } from 'lucide-react';

interface ErrorBoundaryState {
  hasError: boolean;
  message: string;
}

export class ErrorBoundary extends React.Component<
  { children: React.ReactNode },
  ErrorBoundaryState
> {
  constructor(props: { children: React.ReactNode }) {
    super(props);
    this.state = { hasError: false, message: '' };
  }

  static getDerivedStateFromError(error: Error): ErrorBoundaryState {
    return {
      hasError: true,
      message: error?.message || 'An unexpected application error occurred.',
    };
  }

  componentDidCatch(error: Error, info: React.ErrorInfo) {
    console.error('ErrorBoundary caught error:', error, info);
  }

  render() {
    if (this.state.hasError) {
      return (
        <div className="min-h-screen flex items-center justify-center bg-[#0B0F14] text-slate-100 p-6">
          <div className="max-w-lg w-full p-8 rounded-xl border border-red-500/40 bg-[#121821] space-y-4">
            <div className="w-11 h-11 rounded-lg bg-red-500/10 border border-red-500/30 flex items-center justify-center text-red-400">
              <AlertTriangle className="w-5 h-5" />
            </div>
            <h1 className="font-mono text-xl font-bold text-white">
              Something went wrong
            </h1>
            <p className="text-xs font-mono text-slate-300 break-words bg-[#0B0F14] p-3 rounded-lg border border-slate-800 max-h-40 overflow-y-auto">
              {this.state.message}
            </p>
            <button
              type="button"
              onClick={() => window.location.reload()}
              className="px-4 py-2 rounded-lg text-xs font-semibold bg-[#00EA64] text-[#0B0F14] hover:bg-[#00d35a]"
            >
              Reload Application
            </button>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}
