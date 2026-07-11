import React from "react";
import ReactDOM from "react-dom/client";
import { BrowserRouter, Routes, Route } from "react-router-dom";
import App from "./App.jsx";
import BuyerAppMock from "./components/BuyerAppMock.jsx";
import "./styles.css";

ReactDOM.createRoot(document.getElementById("root")).render(
  <React.StrictMode>
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<App />} />
        <Route path="/buyer" element={<BuyerAppMock />} />
      </Routes>
    </BrowserRouter>
  </React.StrictMode>
);
