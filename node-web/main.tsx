import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import AuthenticatedStudio from '../components/authenticated-studio';
import '../public/style.css';
import {initializeAnalytics} from '../client/analytics';
void initializeAnalytics();
createRoot(document.getElementById('root')!).render(<StrictMode><AuthenticatedStudio/></StrictMode>);
