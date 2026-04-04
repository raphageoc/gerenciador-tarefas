// src/main.tsx (exemplo de como deve ficar)
import React from 'react';
import ReactDOM from 'react-dom/client';
import  App  from './App'; // ou o nome do seu arquivo principal
import { GoogleOAuthProvider } from '@react-oauth/google';
import './index.css';


// COLE SUA CHAVE AQUI:
const GOOGLE_CLIENT_ID = import.meta.env.VITE_GOOGLE_CLIENT_ID;

ReactDOM.createRoot(document.getElementById('root') as HTMLElement).render(
  <React.StrictMode>
    {/* Envolvendo o app inteiro com o Google Provider */}
    <GoogleOAuthProvider clientId={GOOGLE_CLIENT_ID}>
      <App />
    </GoogleOAuthProvider>
  </React.StrictMode>
);
