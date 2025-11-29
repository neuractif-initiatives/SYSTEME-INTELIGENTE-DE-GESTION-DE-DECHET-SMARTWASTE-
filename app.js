// app.js - logique SmartBin (map, vues, simulation, notifications)

let currentView = 'collector';
let map = null;
let binMarkers = [];

// Seuils de remplissage
let thresholds = { orange: 70, red: 90 };

// Données de démonstration des poubelles
let bins = [
  { id: 'BIN001', address: '424 Boulevard de la Paix', lat: 48.8566, lng: 2.3522, level: 45, lastCollection: '2025-11-26' },
  { id: 'BIN002', address: '201 Avenue de la présidence', lat: 48.8606, lng: 2.3376, level: 78, lastCollection: '2025-11-25' },
  { id: 'BIN003', address: '325 Boulevard Eyadéma', lat: 48.8546, lng: 2.3250, level: 92, lastCollection: '2025-11-24' },
  { id: 'BIN004', address: '745 Rue de la Gare', lat: 48.8575, lng: 2.3294, level: 35, lastCollection: '2025-11-27' },
  { id: 'BIN005', address: '001 Rue du commerce', lat: 48.8631, lng: 2.3444, level: 85, lastCollection: '2025-11-24' }
];

// Logs d'activité
let activityLogs = [
  { time: '2024-11-27 13:15', action: 'Poubelle BIN003 - Niveau critique atteint (92%)' },
  { time: '2024-11-27 12:45', action: 'Collecte programmée pour BIN005' },
  { time: '2024-11-27 11:30', action: 'Seuils de configuration mis à jour' },
  { time: '2024-11-27 10:15', action: 'Nouvelle poubelle BIN005 ajoutée au système' }
];

// --- FONCTIONS UTILITAIRES ---
function getBinColor(level) {
  if (level >= thresholds.red) return 'red';
  if (level >= thresholds.orange) return 'orange';
  return 'green';
}

function getBinStatus(level) {
  if (level >= thresholds.red) return 'Critique';
  if (level >= thresholds.orange) return 'Attention';
  return 'Normal';
}

function addLog(action) {
  const now = new Date();
  const timeString = now.toLocaleString('fr-FR');
  activityLogs.unshift({ time: timeString, action });
  if (activityLogs.length > 50) activityLogs.pop();
  updateActivityLogs();
}

function showNotification(message, type = 'info') {
  const notification = document.createElement('div');
  
  // Classes CSS basées sur le type
  const typeClasses = {
    error: 'bg-red-600',
    success: 'bg-green-600', 
    warning: 'bg-orange-600',
    info: 'bg-blue-600'
  };
  
  notification.className = `p-4 rounded-lg shadow-lg text-white ${typeClasses[type] || 'bg-blue-600'}`;
  notification.textContent = message;
  document.getElementById('notifications').appendChild(notification);
  
  setTimeout(() => notification.remove(), 5000);
}

// --- GESTION DE LA CARTE ---
function initMap() {
  if (map) map.remove();
  map = L.map('map').setView([48.8566, 2.3522], 13);
  L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
    attribution: '© OpenStreetMap contributors'
  }).addTo(map);
  updateMapMarkers();
}

function updateMapMarkers() {
  // Supprimer les marqueurs existants
  binMarkers.forEach(m => map.removeLayer(m));
  binMarkers = [];
  
  // Ajouter les nouveaux marqueurs
  bins.forEach(bin => {
    const color = getBinColor(bin.level);
    const icon = L.divIcon({
      className: `bin-marker bin-${color}`,
      html: `<div class="w-5 h-5 rounded-full border-2 border-white shadow-lg bg-${color === 'red' ? 'red' : color === 'orange' ? 'orange' : 'green'}-500"></div>`,
      iconSize: [20, 20],
      popupAnchor: [0, -10]
    });
    
    const marker = L.marker([bin.lat, bin.lng], { icon })
      .bindPopup(`
        <div class="text-center p-2">
          <strong class="text-lg">${bin.id}</strong><br>
          <span class="text-sm">${bin.address}</span><br>
          <span class="text-sm">Niveau: ${bin.level}%</span><br>
          <button onclick="openSimulation('${bin.id}')" class="btn-simulate-bin mt-2">Modifier</button>
        </div>
      `).addTo(map);
      
    binMarkers.push(marker);
  });
}

// --- MISE À JOUR DES VUES ---
function updateCollectorView() {
  const fullBins = bins.filter(b => b.level >= thresholds.red).length;
  const urgentBins = bins.filter(b => b.level >= thresholds.orange).length;
  const averageFill = Math.round(bins.reduce((s, b) => s + b.level, 0) / bins.length);
  
  // Mettre à jour les statistiques
  document.getElementById('fullBins').textContent = fullBins;
  document.getElementById('urgentCollections').textContent = urgentBins;
  document.getElementById('averageFill').textContent = averageFill + '%';
  document.getElementById('totalBins').textContent = bins.length;

  // Mettre à jour la liste des collectes urgentes
  const urgentList = document.getElementById('urgentList');
  urgentList.innerHTML = '';
  
  const urgentBinsData = bins.filter(b => b.level >= thresholds.orange)
                            .sort((a, b) => b.level - a.level);
  
  if (urgentBinsData.length === 0) {
    urgentList.innerHTML = '<p class="text-gray-500 text-center py-4">Aucune collecte urgente</p>';
  } else {
    urgentBinsData.forEach(bin => {
      const div = document.createElement('div');
      const isCritical = bin.level >= thresholds.red;
      
      div.className = `p-3 border rounded-lg ${
        isCritical ? 'border-red-300 bg-red-50' : 'border-orange-300 bg-orange-50'
      }`;
      
      div.innerHTML = `
        <div class="flex justify-between items-center">
          <div>
            <strong>${bin.id}</strong>
            <p class="text-sm text-gray-600">${bin.address}</p>
          </div>
          <div class="text-right">
            <div class="text-lg font-bold ${
              isCritical ? 'text-red-600' : 'text-orange-600'
            }">${bin.level}%</div>
            <button onclick="openSimulation('${bin.id}')" class="btn-simulate-bin">Modifier</button>
          </div>
        </div>`;
        
      urgentList.appendChild(div);
    });
  }
}

function updateUserView() {
  const userBin = bins.find(b => b.id === 'BIN001');
  if (!userBin) return;
  
  const level = userBin.level;
  const color = getBinColor(level);
  const status = getBinStatus(level);
  
  // Mettre à jour l'affichage du niveau
  document.getElementById('userBinLevel').textContent = level + '%';
  
  // Mettre à jour la barre de progression
  const progressBar = document.getElementById('userBinBar');
  progressBar.style.width = level + '%';
  progressBar.className = `progress-bar-fill ${
    color === 'red' ? 'bg-red-600' : 
    color === 'orange' ? 'bg-orange-600' : 'bg-green-600'
  }`;
  
  document.getElementById('userBinStatus').textContent = status;

  // Mettre à jour les notifications
  const notificationsContainer = document.getElementById('userNotifications');
  notificationsContainer.innerHTML = '';
  
  let notificationHTML = '';
  if (level >= thresholds.red) {
    notificationHTML = `
      <div class="p-3 bg-red-100 border border-red-300 rounded-lg">
        <div class="flex items-center">
          <span class="text-red-600 mr-2">🚨</span>
          <span class="text-red-800">Votre poubelle est pleine à ${level}% - Collecte urgente nécessaire</span>
        </div>
      </div>`;
  } else if (level >= thresholds.orange) {
    notificationHTML = `
      <div class="p-3 bg-orange-100 border border-orange-300 rounded-lg">
        <div class="flex items-center">
          <span class="text-orange-600 mr-2">⚠️</span>
          <span class="text-orange-800">Votre poubelle se remplit (${level}%) - Prochaine collecte bientôt</span>
        </div>
      </div>`;
  } else {
    notificationHTML = `
      <div class="p-3 bg-green-100 border border-green-300 rounded-lg">
        <div class="flex items-center">
          <span class="text-green-600 mr-2">✅</span>
          <span class="text-green-800">Tout va bien - Niveau normal (${level}%)</span>
        </div>
      </div>`;
  }
  
  notificationsContainer.innerHTML = notificationHTML;
}

function updateAdminView() {
  const binsList = document.getElementById('adminBinsList');
  binsList.innerHTML = '';
  
  bins.forEach(bin => {
    const color = getBinColor(bin.level);
    const status = getBinStatus(bin.level);
    
    const row = document.createElement('tr');
    row.className = 'border-b hover:bg-gray-50';
    
    row.innerHTML = `
      <td class="table-cell font-medium">${bin.id}</td>
      <td class="table-cell">${bin.address}</td>
      <td class="table-cell">
        <div class="flex items-center">
          <div class="w-16 bg-gray-200 rounded-full h-2 mr-2">
            <div class="h-2 rounded-full ${
              color === 'red' ? 'bg-red-600' : 
              color === 'orange' ? 'bg-orange-600' : 'bg-green-600'
            }" style="width:${bin.level}%"></div>
          </div>
          <span class="text-sm">${bin.level}%</span>
        </div>
      </td>
      <td class="table-cell">
        <span class="px-2 py-1 rounded-full text-xs ${
          color === 'red' ? 'bg-red-100 text-red-800' : 
          color === 'orange' ? 'bg-orange-100 text-orange-800' : 'bg-green-100 text-green-800'
        }">
          ${status}
        </span>
      </td>
      <td class="table-cell">
        <button onclick="openSimulation('${bin.id}')" class="btn-edit-bin">Modifier</button>
        <button onclick="deleteBin('${bin.id}')" class="btn-delete-bin">Supprimer</button>
      </td>
    `;
    
    binsList.appendChild(row);
  });
}

function updateActivityLogs() {
  const logsContainer = document.getElementById('activityLogs');
  logsContainer.innerHTML = '';
  
  activityLogs.slice(0, 10).forEach(log => {
    const div = document.createElement('div');
    div.className = 'text-gray-600';
    div.innerHTML = `<span class="text-gray-400">${log.time}</span> - ${log.action}`;
    logsContainer.appendChild(div);
  });
}

// --- GESTION DES VUES ---
function showView(viewName) {
  // Masquer toutes les vues
  document.querySelectorAll('.view-container').forEach(v => v.classList.add('hidden'));
  
  // Afficher la vue sélectionnée
  const el = document.getElementById(viewName + 'View');
  if (el) el.classList.remove('hidden');
  
  currentView = viewName;

  // Mettre à jour l'apparence des boutons de navigation
  document.getElementById('viewCollector').className = 'btn-collector-view';
  document.getElementById('viewUser').className = 'btn-user-view'; 
  document.getElementById('viewAdmin').className = 'btn-admin-view';
  
  // Appliquer la classe active au bouton courant
  if (viewName === 'collector') {
    document.getElementById('viewCollector').classList.add('bg-blue-800');
    updateCollectorView();
    setTimeout(() => { 
      if (currentView === 'collector') initMap(); 
    }, 100);
  } else if (viewName === 'user') {
    document.getElementById('viewUser').classList.add('bg-green-800');
    updateUserView();
  } else if (viewName === 'admin') {
    document.getElementById('viewAdmin').classList.add('bg-purple-800');
    updateAdminView();
    updateActivityLogs();
  }
}

// --- SIMULATION / MODAL ---
function openSimulation(binId) {
  const bin = bins.find(b => b.id === binId);
  if (!bin) return;
  
  // Remplir le sélecteur de poubelles
  const select = document.getElementById('modalBinId');
  select.innerHTML = '';
  
  bins.forEach(b => {
    const option = document.createElement('option');
    option.value = b.id;
    option.textContent = `${b.id} - ${b.address}`;
    if (b.id === binId) option.selected = true;
    select.appendChild(option);
  });
  
  // Initialiser les valeurs du modal
  document.getElementById('modalNewLevel').value = bin.level;
  document.getElementById('modalLevelDisplay').textContent = bin.level + '%';
  document.getElementById('simulationModal').classList.remove('hidden');
}

function applySimulation() {
  const binId = document.getElementById('modalBinId').value;
  const newLevel = parseInt(document.getElementById('modalNewLevel').value, 10);
  const bin = bins.find(b => b.id === binId);
  
  if (!bin) return;
  
  const oldLevel = bin.level;
  bin.level = newLevel;
  
  // Journaliser l'action
  addLog(`Simulation: ${binId} niveau modifié de ${oldLevel}% à ${newLevel}%`);
  
  // Notifications si changement de statut
  if (newLevel >= thresholds.red && oldLevel < thresholds.red) {
    showNotification(`🚨 ${binId} - Niveau critique atteint (${newLevel}%)`, 'error');
  } else if (newLevel >= thresholds.orange && oldLevel < thresholds.orange) {
    showNotification(`⚠️ ${binId} - Seuil orange dépassé (${newLevel}%)`, 'warning');
  }
  
  // Mettre à jour toutes les vues
  updateCollectorView();
  updateUserView(); 
  updateAdminView();
  
  if (map && currentView === 'collector') updateMapMarkers();
  
  // Fermer le modal et confirmer
  document.getElementById('simulationModal').classList.add('hidden');
  showNotification(`Niveau de ${binId} mis à jour: ${newLevel}%`, 'success');
}

function deleteBin(binId) {
  if (confirm(`Êtes-vous sûr de vouloir supprimer la poubelle ${binId} ?`)) {
    bins = bins.filter(b => b.id !== binId);
    addLog(`Poubelle supprimée: ${binId}`);
    showNotification(`Poubelle ${binId} supprimée`, 'success');
    updateAdminView();
    updateCollectorView();
    if (map && currentView === 'collector') updateMapMarkers();
  }
}

// --- EXPORT RAPPORT ---
function exportReport() {
  const reportData = {
    date: new Date().toLocaleString('fr-FR'),
    totalBins: bins.length,
    fullBins: bins.filter(b => b.level >= thresholds.red).length,
    urgentCollections: bins.filter(b => b.level >= thresholds.orange).length,
    averageFill: Math.round(bins.reduce((s, b) => s + b.level, 0) / bins.length),
    bins: bins.map(b => ({
      id: b.id,
      address: b.address, 
      level: b.level,
      status: getBinStatus(b.level),
      lastCollection: b.lastCollection
    })),
    logs: activityLogs.slice(0, 20)
  };
  
  const dataStr = JSON.stringify(reportData, null, 2);
  const dataBlob = new Blob([dataStr], { type: 'application/json' });
  const url = URL.createObjectURL(dataBlob);
  
  const link = document.createElement('a');
  link.href = url;
  link.download = `rapport_smartbin_${new Date().toISOString().replace(/[:.]/g, '-')}.json`;
  document.body.appendChild(link);
  link.click();
  link.remove();
  
  URL.revokeObjectURL(url);
  showNotification('Rapport exporté avec succès', 'success');
}

// --- AJOUT POUBELLE ---
function addRandomBin() {
  const newId = `BIN${String(bins.length + 1).padStart(3, '0')}`;
  const addresses = [
    'Rue de l\'artisanat (ex-rue du Commerce',
    'Rue des Evala 151 AFG', 
    'Avenue de la Libération',
    'Rue Klala 264 BKK',
    'Boulevard de la paix',
    'Avenue Papale',
    'Boulevard du 13 Janvier',
    'Avenue de la chance',
    'Boulevard Eyadéma'
  ];
  
  const newBin = {
    id: newId,
    address: addresses[Math.floor(Math.random() * addresses.length)],
    lat: 48.8566 + (Math.random() - 0.5) * 0.02,
    lng: 2.3522 + (Math.random() - 0.5) * 0.02,
    level: Math.floor(Math.random() * 100),
    lastCollection: new Date().toISOString().split('T')[0]
  };
  
  bins.push(newBin);
  addLog(`Nouvelle poubelle ajoutée: ${newId}`);
  showNotification(`Poubelle ${newId} ajoutée`, 'success');
  
  updateAdminView();
  updateCollectorView();
  if (map && currentView === 'collector') updateMapMarkers();
}

// --- ÉVÉNEMENTS ET INITIALISATION ---
document.addEventListener('DOMContentLoaded', function() {
  // Navigation entre vues
  document.getElementById('viewCollector').addEventListener('click', () => showView('collector'));
  document.getElementById('viewUser').addEventListener('click', () => showView('user'));
  document.getElementById('viewAdmin').addEventListener('click', () => showView('admin'));
  
  // Export rapport
  document.getElementById('exportReport').addEventListener('click', exportReport);
  
  // Sauvegarde configuration
  document.getElementById('saveConfig').addEventListener('click', function() {
    thresholds.orange = parseInt(document.getElementById('orangeThreshold').value, 10) || thresholds.orange;
    thresholds.red = parseInt(document.getElementById('redThreshold').value, 10) || thresholds.red;
    
    addLog(`Configuration mise à jour: Seuils ${thresholds.orange}%/${thresholds.red}%`);
    showNotification('Configuration sauvegardée', 'success');
    
    updateCollectorView();
    updateUserView();
    updateAdminView();
    if (map && currentView === 'collector') updateMapMarkers();
  });

  // Contrôles du modal
  document.getElementById('modalNewLevel').addEventListener('input', function() {
    document.getElementById('modalLevelDisplay').textContent = this.value + '%';
  });
  
  document.getElementById('applySimulation').addEventListener('click', applySimulation);
  document.getElementById('cancelSimulation').addEventListener('click', () => {
    document.getElementById('simulationModal').classList.add('hidden');
  });

  // Ajout poubelle
  document.getElementById('addBin').addEventListener('click', addRandomBin);

  // Initialisation
  showView('collector');

  // Simulation automatique périodique
  setInterval(() => {
    if (bins.length === 0) return;
    
    if (Math.random() < 0.1) { // 10% de chance toutes les 30 secondes
      const randomBin = bins[Math.floor(Math.random() * bins.length)];
      const change = Math.floor(Math.random() * 10) - 5; // -5 à +4
      const newLevel = Math.max(0, Math.min(100, randomBin.level + change));
      
      if (newLevel !== randomBin.level) {
        randomBin.level = newLevel;
        addLog(`Mise à jour automatique: ${randomBin.id} - ${newLevel}%`);
        
        // Mettre à jour les vues actives
        if (currentView === 'collector') updateCollectorView();
        if (currentView === 'user') updateUserView();
        if (currentView === 'admin') updateAdminView();
        if (map && currentView === 'collector') updateMapMarkers();
      }
    }
  }, 30000);
});