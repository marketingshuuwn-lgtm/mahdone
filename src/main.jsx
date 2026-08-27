import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './App.jsx';
import { ToastProvider } from './hooks/useToast.jsx';

/* 1. Base */
import './index.css';

/* 2. Feature modules */
import './styles/trello.css';
import './styles/workspaces.css';
import './styles/workspace-surface.css';
import './styles/archive.css';
import './styles/break-space.css';
import './styles/task-notes.css';
import './styles/notepad.css';
import './styles/nav-data.css';
import './styles/task-modal-draft.css';
import './styles/task-status.css';
import './styles/task-row-layers.css';
import './styles/planner.css';
import './styles/task-search.css';
import './styles/today.css';

/* 3. Design system */
import './styles/design-system.css';

/* 4. Shell */
import './styles/layout-shell.css';

/* 5. Navigation rail */
import './styles/sidebar-rail.css';

/* 6. Matrix / TaskRow */
import './styles/matrix-stack.css';

/* 7. Feature polish */
import './styles/settings-tabs.css';
import './styles/kpi-motion.css';
import './styles/shortcuts-help.css';
import './styles/ux-motion.css';

/* 8. Radical work surface (loaded last to replace legacy shell on the daily workspace) */
import './styles/work-surface.css';

ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <ToastProvider>
      <App />
    </ToastProvider>
  </React.StrictMode>
);
