import { Excalidraw } from "@excalidraw/excalidraw";
import "@excalidraw/excalidraw/index.css";
import './App.css'

function App() {
  return (
    <div className="excalidraw-container" style={{ height: "100vh", width: "100vw" }}>
      <Excalidraw />
    </div>
  );
}

export default App;
