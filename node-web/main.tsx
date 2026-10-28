import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import MusicStudio from '../components/music-studio';
import '../public/style.css';
createRoot(document.getElementById('root')!).render(<StrictMode><MusicStudio/></StrictMode>);
