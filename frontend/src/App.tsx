import "./App.css";
import { BrowserRouter, Link, Route, Routes } from "react-router-dom";
import { Receiver } from "./components/Recevier";
import { Sender } from "./components/Sender";

function App() {
  console.log("working");
  return (
    <BrowserRouter>
      <Routes>
        <Route
          path="/"
          element={
            <div>
              <Link to={"/sender"}>I am Sender</Link> <br />
              <Link to={"/receiver"}>I am Receiver</Link>
            </div>
          }
        />
        <Route path="/sender" element={<Sender />} />
        <Route path="/receiver" element={<Receiver />} />
      </Routes>
    </BrowserRouter>
  );
}

export default App;
