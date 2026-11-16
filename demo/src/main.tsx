import "./env";
import "@fontsource/cormorant-garamond/400.css";
import "@fontsource/cormorant-garamond/400-italic.css";
import "@fontsource/cormorant-garamond/500.css";
import "@fontsource/cormorant-garamond/600.css";
import "@fontsource-variable/jost";
import "./demo.css";
import { createRoot } from "react-dom/client";
import { App } from "./App";
import { ensureDemo } from "./setup";

const status = (msg: string) => {
  const el = document.getElementById("boot-msg");
  if (el) el.textContent = msg;
};

ensureDemo(status)
  .then(() => {
    createRoot(document.getElementById("root")!).render(<App />);
    document.getElementById("boot")?.remove();
  })
  .catch((e) => {
    console.error(e);
    status("Impossibile avviare la demo in questo browser. Prova con una versione aggiornata di Chrome, Safari o Firefox.");
  });
