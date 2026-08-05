import { mount } from "svelte";
import "./app.css";
import App from "./App.svelte";

// iOS Safari only fires :active on elements when a touchstart listener exists
// somewhere in the ancestor chain. A passive no-op on the document enables the
// pseudo-class globally so press animations (badge slots, buttons, pickers) fire
// on the first tap rather than the second.
document.addEventListener("touchstart", () => {}, { passive: true });

export default mount(App, { target: document.getElementById("app")! });
