import { createRoot } from 'react-dom/client';
import App from './App';

/** Mounts the React application into the renderer document's root element. */
const container = document.getElementById('root') as HTMLElement;
const root = createRoot(container);
root.render(<App />);
