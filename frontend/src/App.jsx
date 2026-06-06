import { BrowserRouter as Router, Routes, Route } from 'react-router-dom';
import Home from './pages/Home';
import CompetitionDetails from './pages/CompetitionDetails';

function App() {
  return (
    <Router>
      <Routes>
        {/* La page d'accueil (Le tableau de bord avec les cartes) */}
        <Route path="/" element={<Home />} />
        
        {/* La page de détail dynamique (ex: /competition/uuid-de-la-ligue-1) */}
        <Route path="/competition/:id" element={<CompetitionDetails />} />
      </Routes>
    </Router>
  );
}

export default App;