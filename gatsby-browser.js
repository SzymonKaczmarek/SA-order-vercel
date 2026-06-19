import React from 'react';
import './src/styles/global.css';
import { AuthProvider } from './src/context/AuthContext';
import { AccessAccountProvider } from './src/context/AccessAccountContext';

export const wrapRootElement = ({ element }) => (
  <AuthProvider>
    <AccessAccountProvider>{element}</AccessAccountProvider>
  </AuthProvider>
);
