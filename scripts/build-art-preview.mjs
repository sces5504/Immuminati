import { build } from "vite";
process.env.VITE_ART_PREVIEW = "tripo";
await build({ base: "./" });
