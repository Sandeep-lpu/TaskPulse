import React, { useEffect } from 'react';
import { Routes, Route } from 'react-router-dom';
import LandingPage from './LandingPage';
import AuthPage from './AuthPage';
import Dashboard from './Dashboard';
import { initPerformanceMonitoring } from './utils/performance';

const App: React.FC = () => {
  useEffect(() => {
    initPerformanceMonitoring();
  }, []);

  return (
    <Routes>
      <Route path="/" element={<LandingPage />} />
      <Route path="/auth" element={<AuthPage />} />
      <Route path="/dashboard" element={<Dashboard />} />
    </Routes>
  );
};

export default App;
