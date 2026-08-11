/** Hands-free scrolling of a sheet, at a speed the player sets in pixels per second. */

export const MIN_SPEED = 4;
export const MAX_SPEED = 120;

/** A dropped frame must not make the sheet jump. */
const MAX_FRAME_SECONDS = 0.1;
const BOTTOM_EPSILON = 0.5;

export const createAutoScroll = ({ container, onStateChange }) => {
  let speed = 20;
  let running = false;
  let position = 0;
  let lastFrame = 0;
  let frame = null;

  const remaining = () => container.scrollHeight - container.clientHeight - container.scrollTop;

  const stop = () => {
    if (!running) return;
    running = false;
    cancelAnimationFrame(frame);
    onStateChange(false);
  };

  const step = (now) => {
    if (!running) return;

    const elapsed = Math.min((now - lastFrame) / 1000, MAX_FRAME_SECONDS);
    lastFrame = now;
    position += speed * elapsed;
    container.scrollTop = position;

    if (remaining() <= BOTTOM_EPSILON) {
      stop();
      return;
    }
    frame = requestAnimationFrame(step);
  };

  const start = () => {
    if (running || remaining() <= BOTTOM_EPSILON) return;
    running = true;
    position = container.scrollTop;
    lastFrame = performance.now();
    frame = requestAnimationFrame(step);
    onStateChange(true);
  };

  return {
    start,
    stop,
    toggle: () => (running ? stop() : start()),
    isRunning: () => running,
    setSpeed: (value) => {
      speed = Math.min(MAX_SPEED, Math.max(MIN_SPEED, Number(value) || MIN_SPEED));
    },
    /** Re-reads the scroll position after the user moved it themselves. */
    sync: () => {
      position = container.scrollTop;
    },
  };
};
