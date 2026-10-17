import { createRoot } from "react-dom/client";
import TacticalApp from "./tactics/ui/TacticalApp";
import "./styles/main.css";
const root = createRoot(document.getElementById("root")!);
if (import.meta.env.DEV && location.hash === "#animation-lab") {
  void import("./tactics/dev/AnimationLab").then(({ default: Lab }) =>
    root.render(<Lab />),
  );
} else root.render(<TacticalApp />);
