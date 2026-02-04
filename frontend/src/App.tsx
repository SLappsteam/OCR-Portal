import { BrowserRouter, Routes, Route } from 'react-router-dom';
import { AuthProvider } from './contexts/AuthContext';
import { ProtectedRoute } from './components/ProtectedRoute';
import { Layout } from './components/Layout';
import { Dashboard } from './pages/Dashboard';
import { Documents } from './pages/Documents';
import { Batches } from './pages/Batches';
import { BatchViewer } from './pages/BatchViewer';
import { Stores } from './pages/Stores';
import { Settings } from './pages/Settings';
import { Login } from './pages/Login';

function App() {
  return (
    <BrowserRouter>
      <AuthProvider>
        <Routes>
          <Route path="/login" element={<Login />} />
          <Route
            path="/*"
            element={
              <ProtectedRoute>
                <Layout>
                  <Routes>
                    <Route path="/" element={<Dashboard />} />
                    <Route path="/documents" element={<Documents />} />
                    <Route path="/batches" element={<Batches />} />
                    <Route path="/batches/:id" element={<BatchViewer />} />
                    <Route
                      path="/stores"
                      element={
                        <ProtectedRoute minimumRole="manager">
                          <Stores />
                        </ProtectedRoute>
                      }
                    />
                    <Route
                      path="/settings"
                      element={
                        <ProtectedRoute minimumRole="admin">
                          <Settings />
                        </ProtectedRoute>
                      }
                    />
                  </Routes>
                </Layout>
              </ProtectedRoute>
            }
          />
        </Routes>
      </AuthProvider>
    </BrowserRouter>
  );
}

export default App;
