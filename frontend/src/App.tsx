import { BrowserRouter, Routes, Route } from 'react-router-dom';
import { Layout } from './components/Layout';
import { Dashboard } from './pages/Dashboard';
import { Documents } from './pages/Documents';
import { DocumentViewer } from './pages/DocumentViewer';
import { Batches } from './pages/Batches';
import { Stores } from './pages/Stores';

function App() {
  return (
    <BrowserRouter>
      <Layout>
        <Routes>
          <Route path="/" element={<Dashboard />} />
          <Route path="/documents" element={<Documents />} />
          <Route path="/documents/:id" element={<DocumentViewer />} />
          <Route path="/batches" element={<Batches />} />
          <Route path="/stores" element={<Stores />} />
          <Route path="/settings" element={<SettingsPlaceholder />} />
        </Routes>
      </Layout>
    </BrowserRouter>
  );
}

function SettingsPlaceholder() {
  return (
    <div className="space-y-4">
      <h1 className="text-2xl font-bold text-gray-900">Settings</h1>
      <div className="bg-white rounded-lg shadow p-6">
        <p className="text-gray-500">Settings page coming soon.</p>
      </div>
    </div>
  );
}

export default App;
