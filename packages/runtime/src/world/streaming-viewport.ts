/**
 * SuperGravity Streaming Viewport Controller
 *
 * Closed-loop state machine eliminating forced reflows and scroll fighting
 * during high-frequency token streaming and user history inspection.
 */

export type ViewportState = 'IDLE' | 'AUTO_ANCHORED' | 'USER_DETACHED' | 'CONVERGING';

export interface ViewportControllerOptions {
  anchorThreshold?: number; // px from bottom considered anchored
  dampingFactor?: number;    // convergence smoothing factor (0.1 - 0.5)
}

export class StreamingViewportController {
  #state: ViewportState = 'IDLE';
  #scroller: HTMLElement | null = null;
  #content: HTMLElement | null = null;
  #resizeObserver: ResizeObserver | null = null;
  #rafId: number | null = null;
  #cachedContentHeight = 0;
  #cachedViewportHeight = 0;
  #anchorThreshold: number;
  #dampingFactor: number;
  #wheelHandler: ((e: WheelEvent) => void) | null = null;

  constructor(options: ViewportControllerOptions = {}) {
    this.#anchorThreshold = options.anchorThreshold ?? 36;
    this.#dampingFactor = options.dampingFactor ?? 0.28;
  }

  get state(): ViewportState {
    return this.#state;
  }

  get isAnchored(): boolean {
    return this.#state === 'AUTO_ANCHORED';
  }

  attach(scrollerEl: HTMLElement, contentEl: HTMLElement): void {
    this.dispose();

    this.#scroller = scrollerEl;
    this.#content = contentEl;

    // Use ResizeObserver to receive browser-computed dimensions with zero synchronous reflow
    if (typeof ResizeObserver !== 'undefined') {
      this.#resizeObserver = new ResizeObserver((entries) => {
        for (const entry of entries) {
          const height = entry.borderBoxSize?.[0]?.blockSize ?? entry.contentRect.height;
          if (entry.target === this.#content) {
            this.#cachedContentHeight = height;
          } else if (entry.target === this.#scroller) {
            this.#cachedViewportHeight = height;
          }
        }

        if (this.#state === 'AUTO_ANCHORED') {
          this.#scheduleFrameScroll(false);
        } else if (this.#state === 'CONVERGING') {
          this.#scheduleFrameScroll(true);
        }
      });

      this.#resizeObserver.observe(this.#scroller);
      this.#resizeObserver.observe(this.#content);
    }

    // Physical wheel intent detection: user gesture outranks automated scrolling
    this.#wheelHandler = (e: WheelEvent): void => {
      if (e.deltaY < 0 && (this.#state === 'AUTO_ANCHORED' || this.#state === 'CONVERGING')) {
        this.#transitionTo('USER_DETACHED');
      } else if (e.deltaY > 0 && this.#state === 'USER_DETACHED') {
        this.#checkReanchor();
      }
    };

    this.#scroller.addEventListener('wheel', this.#wheelHandler, { passive: true });
  }

  onStreamStart(): void {
    this.#transitionTo('AUTO_ANCHORED');
  }

  onStreamEnd(): void {
    this.#transitionTo('IDLE');
  }

  scrollToBottomSmooth(): void {
    this.#transitionTo('CONVERGING');
    this.#scheduleFrameScroll(true);
  }

  scrollToBottomInstant(): void {
    this.#transitionTo('AUTO_ANCHORED');
    this.#scheduleFrameScroll(false);
  }

  #checkReanchor(): void {
    if (!this.#scroller) return;
    const maxScroll = Math.max(0, this.#cachedContentHeight - this.#cachedViewportHeight);
    if (maxScroll - this.#scroller.scrollTop <= this.#anchorThreshold) {
      this.#transitionTo('AUTO_ANCHORED');
    }
  }

  #transitionTo(nextState: ViewportState): void {
    if (this.#state === nextState) return;
    this.#state = nextState;

    if (nextState === 'USER_DETACHED' || nextState === 'IDLE') {
      if (this.#rafId !== null) {
        cancelAnimationFrame(this.#rafId);
        this.#rafId = null;
      }
    }
  }

  #scheduleFrameScroll(useDamping: boolean): void {
    if (this.#rafId !== null) return;

    if (typeof requestAnimationFrame === 'undefined') {
      if (this.#scroller) {
        const targetTop = Math.max(0, this.#cachedContentHeight - this.#cachedViewportHeight);
        this.#scroller.scrollTop = targetTop;
      }
      return;
    }

    this.#rafId = requestAnimationFrame(() => {
      this.#rafId = null;
      if (!this.#scroller) return;

      const targetTop = Math.max(0, this.#cachedContentHeight - this.#cachedViewportHeight);
      if (!useDamping) {
        // Fast snap alignment on new token line to avoid lag
        this.#scroller.scrollTop = targetTop;
        return;
      }

      // Damped smooth convergence
      const currentTop = this.#scroller.scrollTop;
      const delta = targetTop - currentTop;
      if (Math.abs(delta) <= 1.5) {
        this.#scroller.scrollTop = targetTop;
        this.#transitionTo('AUTO_ANCHORED');
      } else {
        this.#scroller.scrollTop = currentTop + delta * this.#dampingFactor;
        this.#scheduleFrameScroll(true);
      }
    });
  }

  dispose(): void {
    if (this.#resizeObserver) {
      this.#resizeObserver.disconnect();
      this.#resizeObserver = null;
    }
    if (this.#rafId !== null) {
      cancelAnimationFrame(this.#rafId);
      this.#rafId = null;
    }
    if (this.#scroller && this.#wheelHandler) {
      this.#scroller.removeEventListener('wheel', this.#wheelHandler);
      this.#wheelHandler = null;
    }
    this.#scroller = null;
    this.#content = null;
    this.#state = 'IDLE';
  }
}
