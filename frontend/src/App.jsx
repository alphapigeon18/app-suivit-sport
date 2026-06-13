import { BrowserRouter as Router, Routes, Route } from 'react-router-dom';
import Home from './pages/Home';
import CompetitionDetails from './pages/CompetitionDetails';
import InstallPrompt from './components/InstallPrompt';

function App() {
  return (
    // basename : '/' en local, '/app-suivit-sport' sur GitHub Pages
    <Router basename={import.meta.env.BASE_URL.replace(/\/$/, '')}>
      <Routes>
        {/* La page d'accueil (Le tableau de bord avec les cartes) */}
        <Route path="/" element={<Home />} />

        {/* La page de détail dynamique (ex: /competition/uuid-de-la-ligue-1) */}
        <Route path="/competition/:id" element={<CompetitionDetails />} />
      </Routes>

      {/* Bandeau d'installation de l'app (PWA) */}
      <InstallPrompt />
    </Router>
  );
}

export default App;