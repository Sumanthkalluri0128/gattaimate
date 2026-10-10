import { Component, type ReactNode } from "react";

type State = { failed: boolean };

/** Catches render errors and failed lazy-chunk loads so the app never shows a blank screen. */
export default class ErrorBoundary extends Component<{ children: ReactNode; resetKey: string }, State> {
  state: State = { failed: false };
  static getDerivedStateFromError(): State { return { failed: true }; }
  componentDidUpdate(previous: { resetKey: string }) {
    if (previous.resetKey !== this.props.resetKey && this.state.failed) this.setState({ failed: false });
  }
  render() {
    if (!this.state.failed) return this.props.children;
    return (
      <div className="page">
        <div className="notice notice-error" role="alert">
          Something went wrong loading this page. Check your connection and <button className="link-button" onClick={() => window.location.reload()}>reload</button>, or go back <a href="#/">home</a>.
        </div>
      </div>
    );
  }
}
