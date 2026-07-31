<script lang="ts">
  import type { Snippet } from "svelte";

  /** The modal shell every sheet shares: dimmed backdrop (tap to close),
   * bottom sheet on phones, centered cardstock modal at wide. Headers and
   * cancel buttons belong to the caller — they genuinely vary per sheet.
   * `tall` is the help sheet's variant (more height, wider gutters). */
  let {
    onclose,
    label,
    tall = false,
    children,
  }: { onclose: () => void; label: string; tall?: boolean; children: Snippet } = $props();
</script>

<div class="backdrop" onclick={onclose} role="presentation">
  <div
    class="sheet disp"
    class:tall
    onclick={(e) => e.stopPropagation()}
    onkeydown={(e) => e.key === "Escape" && onclose()}
    role="dialog"
    aria-label={label}
    tabindex="-1"
  >
    {@render children()}
  </div>
</div>

<style>
  .backdrop {
    position: fixed;
    inset: 0;
    background: rgba(36, 34, 28, 0.45);
    z-index: 50;
    display: flex;
    align-items: flex-end;
    justify-content: center;
  }
  .sheet {
    background: var(--ground);
    border: 3px solid var(--ink);
    border-bottom: 0;
    border-radius: 18px 18px 0 0;
    padding: 14px 14px calc(14px + env(safe-area-inset-bottom));
    width: 100%;
    max-width: 480px;
    max-height: 70vh;
    max-height: 70dvh;
    overflow-y: auto;
  }
  .sheet.tall {
    padding: 14px 16px calc(14px + env(safe-area-inset-bottom));
    max-height: 85vh;
    max-height: 85dvh;
  }
  /* Wide: a bottom sheet reads phone-y — center it as a cardstock modal. */
  @media (min-width: 760px) {
    .backdrop {
      align-items: center;
      padding: 24px;
    }
    .sheet {
      border-bottom: 3px solid var(--ink);
      border-radius: 18px;
      padding-bottom: 14px;
    }
  }
</style>
