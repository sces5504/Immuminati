import { placeholderProvider, type VisualProvider } from "./visuals";
// A future art package can override ONE visualId while delegating the remainder.
// Its sprite/rig must use the same centre anchor, world radius and action progress.
export const exampleProvider: VisualProvider = {
  render(pose) {
    if (pose.visualId === "cell.macrophage.v1")
      return (
        <g data-art-adapter="example" style={{ filter: "hue-rotate(40deg)" }}>
          {placeholderProvider.render(pose)}
        </g>
      );
    return placeholderProvider.render(pose);
  },
};
