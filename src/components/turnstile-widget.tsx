import { useEffect, useRef } from "react";

type TurnstileApi = {
  render(container: HTMLElement, options: {
    sitekey: string;
    action: string;
    callback(token: string): void;
    "expired-callback"(): void;
    "error-callback"(): void;
  }): string;
  remove(widgetId: string): void;
  reset(widgetId: string): void;
};

declare global {
  interface Window {
    turnstile?: TurnstileApi;
  }
}

const scriptUrl = "https://challenges.cloudflare.com/turnstile/v0/api.js?render=explicit";
let loader: Promise<TurnstileApi> | null = null;

function loadTurnstile(): Promise<TurnstileApi> {
  if (window.turnstile) return Promise.resolve(window.turnstile);
  if (loader) return loader;
  const request = new Promise<TurnstileApi>((resolve, reject) => {
    const existing = document.querySelector<HTMLScriptElement>(`script[src="${scriptUrl}"]`);
    const script = existing ?? document.createElement("script");
    const finish = () => window.turnstile
      ? resolve(window.turnstile)
      : reject(new Error("Turnstile did not initialize"));
    script.addEventListener("load", finish, { once: true });
    script.addEventListener("error", () => reject(new Error("Turnstile failed to load")), {
      once: true
    });
    if (!existing) {
      script.src = scriptUrl;
      script.async = true;
      script.defer = true;
      document.head.append(script);
    }
  }).catch((error: unknown) => {
    loader = null;
    throw error;
  });
  loader = request;
  return request;
}

type TurnstileWidgetProps = {
  siteKey: string;
  resetSignal: number;
  onToken(token: string | null): void;
  onUnavailable(): void;
};

export function TurnstileWidget({
  siteKey,
  resetSignal,
  onToken,
  onUnavailable
}: TurnstileWidgetProps) {
  const container = useRef<HTMLDivElement>(null);
  const widgetId = useRef<string | null>(null);
  const callbacks = useRef({ onToken, onUnavailable });

  useEffect(() => {
    callbacks.current = { onToken, onUnavailable };
  }, [onToken, onUnavailable]);

  useEffect(() => {
    let active = true;
    void loadTurnstile()
      .then((api) => {
        if (!active || !container.current) return;
        widgetId.current = api.render(container.current, {
          sitekey: siteKey,
          action: "checkout",
          callback: (token) => callbacks.current.onToken(token),
          "expired-callback": () => callbacks.current.onToken(null),
          "error-callback": () => {
            callbacks.current.onToken(null);
            callbacks.current.onUnavailable();
          }
        });
      })
      .catch(() => {
        if (active) callbacks.current.onUnavailable();
      });
    return () => {
      active = false;
      if (widgetId.current && window.turnstile) window.turnstile.remove(widgetId.current);
      widgetId.current = null;
    };
  }, [siteKey]);

  useEffect(() => {
    if (resetSignal > 0 && widgetId.current && window.turnstile) {
      window.turnstile.reset(widgetId.current);
    }
  }, [resetSignal]);

  return <div className="turnstile-widget" ref={container} aria-label="Verifikim sigurie" />;
}
