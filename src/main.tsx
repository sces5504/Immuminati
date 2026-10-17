import { createRoot } from "react-dom/client";
import App from "./rts/ui/App";
import Preview from "./rts/presentation/Preview";
import "./rts/ui/style.css";
const root = createRoot(document.getElementById("root")!);
function render() {
  root.render(location.hash === "#visual-lab" ? <Preview /> : <App />);
}
window.addEventListener("hashchange", render);
render();
