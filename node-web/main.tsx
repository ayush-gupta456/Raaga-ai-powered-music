import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import AuthenticatedStudio from '../components/authenticated-studio';
import '../public/style.css';
createRoot(document.getElementById('root')!).render(<StrictMode><AuthenticatedStudio/></StrictMode>);
