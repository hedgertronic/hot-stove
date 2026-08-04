/** Reference-counted body scroll lock.
 *
 * `lockScroll()` sets `overflow: hidden` on `document.body` on the first call
 * and increments a reference counter. It returns a release function that
 * decrements the counter and clears the inline styles when the count reaches
 * zero — so nested or stacked modals each hold their own lock and only the
 * last one to release actually unlocks the page.
 *
 * Release is idempotent: calling the returned function more than once is a
 * no-op and will not drive the count negative.
 *
 * The scrollbar gutter: when a visible scrollbar disappears because `overflow`
 * becomes `hidden`, the page content widens by the scrollbar's width and the
 * layout shifts. We compensate by adding that width to `body`'s right padding
 * for the duration of the lock. The guard `scrollbarWidth > 0 && < 40`
 * prevents the jsdom artifact (innerWidth 1024, clientWidth 0 → bogus 1024px)
 * and any other measurement noise from inflating the padding.
 *
 * iOS Safari note: `overflow: hidden` on `body` is imperfect on iOS Safari
 * ≤15 — momentum scrolling can still propagate to the page behind a modal.
 * The Sheet component adds `overscroll-behavior: contain` on the sheet element
 * itself, which blocks rubber-banding on iOS Safari 16+ (and on all other
 * modern browsers). Supporting iOS Safari ≤15 would require a `position: fixed`
 * body lock with saved scroll position restoration, which is fragile; the
 * current approach covers all browsers at iOS Safari 16+ and is a no-op for
 * the legacy tail. */

let count = 0;

export function lockScroll(): () => void {
  if (typeof document === "undefined") return () => {};

  if (count === 0) {
    const body = document.body;

    // Scrollbar compensation: add the scrollbar's width to body's right padding
    // so the layout does not shift when the scrollbar disappears.
    const scrollbarWidth = window.innerWidth - document.documentElement.clientWidth;
    if (scrollbarWidth > 0 && scrollbarWidth < 40) {
      const current = parseFloat(getComputedStyle(body).paddingRight) || 0;
      body.style.paddingRight = `${current + scrollbarWidth}px`;
    }

    body.style.overflow = "hidden";
  }

  count++;

  let released = false;
  return () => {
    if (released) return;
    released = true;
    count = Math.max(0, count - 1);
    if (count === 0) {
      // Clear rather than restore a snapshot. This module is the only writer
      // of these inline styles, so the correct end state is always "no inline
      // style" — and a snapshot taken while a stale lock was still applied
      // (dev-server HMR replaces this module mid-lock, resetting `count` while
      // the body still says `overflow: hidden`) would faithfully "restore" the
      // leak forever. Clearing is self-healing: the first full release after
      // any such leak unlocks the page.
      document.body.style.removeProperty("overflow");
      document.body.style.removeProperty("padding-right");
    }
  };
}
