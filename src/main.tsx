import { createRoot } from "react-dom/client";
import App from "./ui/App";
import "./styles/main.css";
const root = createRoot(document.getElementById("root")!);
if (import.meta.env.DEV && location.hash === "#animation-lab") {
  void import("./dev/AnimationLab").then(({ default: Lab }) =>
    root.render(<Lab />),
  );
} else root.render(<App />);
