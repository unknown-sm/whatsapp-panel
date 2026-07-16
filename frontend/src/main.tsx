import React from "react";
import ReactDOM from "react-dom/client";
import { BrowserRouter } from "react-router-dom";
import App from "./App";
import { injectAccent } from "./lib/branding";
import "./index.css";

const DEFAULT_ACCENT = "#3f5972";
injectAccent(DEFAULT_ACCENT);

ReactDOM.createRoot(document.getElementById("root")!).render(
  <React.StrictMode>
    <BrowserRouter>
      <App />
    </BrowserRouter>
  </React.StrictMode>
);