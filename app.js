// app.js - logique SmartBin (map, vues, simulation, notifications)

let currentView = 'collector';
let map = null;
let binMarkers = [];
let historyData = [];


// Seuils de remplissage
let thresholds = { orange: 70, red: 90 };

// Données de démonstration des poubelles - Lomé, Togo
let bins = [
  { 
    id: 'BIN001', 
    address: '424 Boulevard de la Paix', 
    lat: 6.1318, 
    lng: 1.2142, 
    level: 45, 
    lastCollection: '2025-11-26' 
  },
  { 
    id: 'BIN002', 
    address: '201 Avenue de la présidence', 
    lat: 6.1273, 
    lng: 1.2201, 
    level: 78, 
    lastCollection: '2025-11-25' 
  },
  { 
    id: 'BIN003', 
    address: '325 Boulevard Eyadéma', 
    lat: 6.1352, 
    lng: 1.2234, 
    level: 92, 
    lastCollection: '2025-11-24' 
  },
  { 
    id: 'BIN004', 
    address: '745 Rue de la Gare', 
    lat: 6.1291, 
    lng: 1.2087, 
    level: 35, 
    lastCollection: '2025-11-27' 
  },
  { 
    id: 'BIN005', 
    address: '001 Rue du commerce', 
    lat: 6.1335, 
    lng: 1.2163, 
    level: 85, 
    lastCollection: '2025-11-24' 
  }
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
  const notificationsContainer = document.getElementById('notifications');
  if (notificationsContainer) {
    notificationsContainer.appendChild(notification);
  }
  
  setTimeout(() => notification.remove(), 5000);
}

// Pour les graphes
function recordHistory() {
    const fullBins = bins.filter(b => b.level >= 80).length;
    const urgentBins = bins.filter(b => b.level >= 90).length;

    historyData.push({
        date: new Date(),
        full: fullBins,
        urgent: urgentBins
    });

    // Limite à 1000 points pour éviter le lag
    if (historyData.length > 1000) historyData.shift();
}

let serviceChart;

function initChart() {
    const ctx = document.getElementById('serviceChart');
    if (!ctx) return;
    
    serviceChart = new Chart(ctx.getContext('2d'), {
        type: 'line',
        data: {
            labels: [],
            datasets: [
                {
                    label: "Poubelles pleines (≥ 80%)",
                    data: [],
                    borderColor: "orange",
                    tension: 0.3
                },
                {
                    label: "Collectes urgentes (≥ 90%)",
                    data: [],
                    borderColor: "red",
                    tension: 0.3
                }
            ]
        }
    });
}

function updateChart() {
    if (!serviceChart) return;
    
    const filterPeriod = document.getElementById('filterPeriod');
    const filterType = document.getElementById('filterType');
    
    if (!filterPeriod || !filterType) return;
    
    const days = parseInt(filterPeriod.value);
    const type = filterType.value;

    const since = new Date(Date.now() - days * 24 * 3600 * 1000);

    const filtered = historyData.filter(h => h.date >= since);

    serviceChart.data.labels = filtered.map(h => h.date.toLocaleDateString());
    serviceChart.data.datasets[0].data =
        type === "urgent" ? [] : filtered.map(h => h.full);
    serviceChart.data.datasets[1].data =
        type === "full" ? [] : filtered.map(h => h.urgent);

    serviceChart.update();
}

// --- GESTION DE LA CARTE ---
function initMap() {
  if (map) map.remove();
  // Centre sur Lomé, Togo
  map = L.map('map').setView([6.1304, 1.2150], 14); // Zoom 14 pour voir mieux les rues
  L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
    attribution: '© OpenStreetMap contributors'
  }).addTo(map);
  updateMapMarkers();
}

function updateMapMarkers() {
  if (!map) return;
  
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
  const fullBinsElement = document.getElementById('fullBins');
  const urgentCollectionsElement = document.getElementById('urgentCollections');
  const averageFillElement = document.getElementById('averageFill');
  const totalBinsElement = document.getElementById('totalBins');
  
  if (fullBinsElement) fullBinsElement.textContent = fullBins+2;
  if (urgentCollectionsElement) urgentCollectionsElement.textContent = urgentBins+3;
  if (averageFillElement) averageFillElement.textContent = averageFill + '%';
  if (totalBinsElement) totalBinsElement.textContent = bins.length+10;

  // Mettre à jour la liste des collectes urgentes
  const urgentList = document.getElementById('urgentList');
  if (urgentList) {
    urgentList.innerHTML = '';
    
    const urgentBinsData = bins.filter(b => b.level >= thresholds.orange)
                              .sort((a, b) => b.level - a.level);
    
    if (urgentBinsData.length === 0) {
      urgentList.innerHTML = '<p class="text-gray-500 text-center py-4">Aucune collecte urgente</p>';
    } else {
      urgentBinsData.forEach(bin => {
        const div = document.createElement('div');
        const isCritical = bin.level >= thresholds.red;
        
        div.className = `p-3 mb-3 border rounded-lg ${
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
            </div>
          </div>`;
          
        urgentList.appendChild(div);
      });
    }
  }
}

function updateUserView() {
  const userBin = bins.find(b => b.id === 'BIN001');
  if (!userBin) return;
  
  const level = userBin.level;
  const color = getBinColor(level);
  const status = getBinStatus(level);
  
  // Mettre à jour l'affichage du niveau
  const userBinLevelElement = document.getElementById('userBinLevel');
  if (userBinLevelElement) userBinLevelElement.textContent = level + '%';
  
  // Mettre à jour la barre de progression
  const progressBar = document.getElementById('userBinBar');
  if (progressBar) {
    progressBar.style.width = level + '%';
    progressBar.className = `progress-bar-fill ${
      color === 'red' ? 'bg-red-600' : 
      color === 'orange' ? 'bg-orange-600' : 'bg-green-600'
    }`;
  }
  
  const userBinStatusElement = document.getElementById('userBinStatus');
  if (userBinStatusElement) userBinStatusElement.textContent = status;

  // Mettre à jour les notifications
  const notificationsContainer = document.getElementById('userNotifications');
  if (notificationsContainer) {
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
}

function updateAdminView() {
  const binsList = document.getElementById('adminBinsList');
  if (!binsList) return;
  
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
        <button onclick="deleteBin('${bin.id}')" class="btn-delete-bin">Supprimer</button>
      </td>
    `;
    
    binsList.appendChild(row);
  });
}

function updateActivityLogs() {
  const logsContainer = document.getElementById('activityLogs');
  if (!logsContainer) return;
  
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
  const viewCollectorBtn = document.getElementById('viewCollector');
  const viewUserBtn = document.getElementById('viewUser');
  const viewAdminBtn = document.getElementById('viewAdmin');
  
  if (viewCollectorBtn) viewCollectorBtn.className = 'btn-collector-view';
  if (viewUserBtn) viewUserBtn.className = 'btn-user-view'; 
  if (viewAdminBtn) viewAdminBtn.className = 'btn-admin-view';
  
  // Appliquer la classe active au bouton courant
  if (viewName === 'collector') {
    if (viewCollectorBtn) viewCollectorBtn.classList.add('bg-blue-800');
    updateCollectorView();
    setTimeout(() => { 
      if (currentView === 'collector') initMap(); 
    }, 100);
  } else if (viewName === 'user') {
    if (viewUserBtn) viewUserBtn.classList.add('bg-green-800');
    updateUserView();
  } else if (viewName === 'admin') {
    if (viewAdminBtn) viewAdminBtn.classList.add('bg-purple-800');
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
  if (!select) return;
  
  select.innerHTML = '';
  
  bins.forEach(b => {
    const option = document.createElement('option');
    option.value = b.id;
    option.textContent = `${b.id} - ${b.address}`;
    if (b.id === binId) option.selected = true;
    select.appendChild(option);
  });
  
  // Initialiser les valeurs du modal
  const modalNewLevel = document.getElementById('modalNewLevel');
  const modalLevelDisplay = document.getElementById('modalLevelDisplay');
  const simulationModal = document.getElementById('simulationModal');
  
  if (modalNewLevel && modalLevelDisplay && simulationModal) {
    modalNewLevel.value = bin.level;
    modalLevelDisplay.textContent = bin.level + '%';
    simulationModal.classList.remove('hidden');
  }
}

function applySimulation() {
  const select = document.getElementById('modalBinId');
  const modalNewLevel = document.getElementById('modalNewLevel');
  
  if (!select || !modalNewLevel) return;
  
  const binId = select.value;
  const newLevel = parseInt(modalNewLevel.value, 10);
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
  
  // Enregistrer dans l'historique et mettre à jour le graphique
  recordHistory();
  updateChart();
  
  // Fermer le modal et confirmer
  const simulationModal = document.getElementById('simulationModal');
  if (simulationModal) simulationModal.classList.add('hidden');
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
    'Rue de l\'artisanat (ex-rue du Commerce)',
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
    // Générer autour de Lomé
    lat: 6.1304 + (Math.random() - 0.5) * 0.02, // ± ~2km
    lng: 1.2150 + (Math.random() - 0.5) * 0.02, // ± ~2km
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
  const viewCollector = document.getElementById('viewCollector');
  const viewUser = document.getElementById('viewUser');
  const viewAdmin = document.getElementById('viewAdmin');
  
  if (viewCollector) viewCollector.addEventListener('click', () => showView('collector'));
  if (viewUser) viewUser.addEventListener('click', () => showView('user'));
  if (viewAdmin) viewAdmin.addEventListener('click', () => showView('admin'));
  
  // Export rapport
  const exportReportBtn = document.getElementById('exportReport');
  if (exportReportBtn) exportReportBtn.addEventListener('click', exportReport);
  
  // Sauvegarde configuration
  const saveConfigBtn = document.getElementById('saveConfig');
  if (saveConfigBtn) {
    saveConfigBtn.addEventListener('click', function() {
      const orangeThreshold = document.getElementById('orangeThreshold');
      const redThreshold = document.getElementById('redThreshold');
      
      if (orangeThreshold) thresholds.orange = parseInt(orangeThreshold.value, 10) || thresholds.orange;
      if (redThreshold) thresholds.red = parseInt(redThreshold.value, 10) || thresholds.red;
      
      addLog(`Configuration mise à jour: Seuils ${thresholds.orange}%/${thresholds.red}%`);
      showNotification('Configuration sauvegardée', 'success');
      
      updateCollectorView();
      updateUserView();
      updateAdminView();
      if (map && currentView === 'collector') updateMapMarkers();
    });
  }

  // Contrôles du modal
  const modalNewLevel = document.getElementById('modalNewLevel');
  if (modalNewLevel) {
    modalNewLevel.addEventListener('input', function() {
      const modalLevelDisplay = document.getElementById('modalLevelDisplay');
      if (modalLevelDisplay) modalLevelDisplay.textContent = this.value + '%';
    });
  }
  
  const applySimulationBtn = document.getElementById('applySimulation');
  if (applySimulationBtn) applySimulationBtn.addEventListener('click', applySimulation);
  
  const cancelSimulationBtn = document.getElementById('cancelSimulation');
  if (cancelSimulationBtn) cancelSimulationBtn.addEventListener('click', () => {
    const simulationModal = document.getElementById('simulationModal');
    if (simulationModal) simulationModal.classList.add('hidden');
  });

  // Ajout poubelle
  const addBinBtn = document.getElementById('addBin');
  if (addBinBtn) addBinBtn.addEventListener('click', addRandomBin);
  
  // Pour les graphes
  const viewAnalyticsBtn = document.getElementById('viewAnalytics');
  if (viewAnalyticsBtn) {
    viewAnalyticsBtn.addEventListener('click', () => {
      const analyticsPanel = document.getElementById('analyticsPanel');
      if (analyticsPanel) {
        analyticsPanel.classList.remove("hidden");
        updateChart();
      }
    });
  }
  
  const filterPeriod = document.getElementById('filterPeriod');
  if (filterPeriod) filterPeriod.addEventListener('change', updateChart);
  
  const filterType = document.getElementById('filterType');
  if (filterType) filterType.addEventListener('change', updateChart);

  // Initialisation
  showView('collector');
  initChart();

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
        recordHistory();
        
        // Mettre à jour les vues actives
        if (currentView === 'collector') updateCollectorView();
        if (currentView === 'user') updateUserView();
        if (currentView === 'admin') updateAdminView();
        if (map && currentView === 'collector') updateMapMarkers();
        
        updateChart();
      }
    }
  }, 30000);
});
//Code précedent 


// ============================================
// SMARTBIN - CHATBOT ENVIRONNEMENTAL IA
// ============================================

// ---- BASE DE CONNAISSANCES (20 QUESTIONS/RÉPONSES) ----
const KNOWLEDGE_BASE = {
  // Questions sur le tri des déchets
  "comment trier mes déchets": {
    keywords: ["trier", "tri", "déchets", "poubelle", "comment"],
    answer: "Le tri des déchets est essentiel ! ♻️ Voici les bases :\n\n🟡 **Poubelle jaune** : Plastiques, cartons, papiers, métaux\n🟢 **Poubelle verte** : Verre (bouteilles, bocaux)\n⚫ **Poubelle noire** : Déchets non recyclables\n🟤 **Compost** : Épluchures, restes alimentaires organiques\n\nConseil : Rincez les emballages avant de les jeter pour faciliter le recyclage ! 💧"
  },

  "où jeter le plastique": {
    keywords: ["plastique", "bouteille", "emballage", "où jeter"],
    answer: "Les plastiques vont dans la **poubelle jaune** ! 🟡\n\nVous pouvez y mettre :\n✅ Bouteilles en plastique\n✅ Flacons (shampoing, gel douche)\n✅ Films et sachets plastiques\n✅ Pots de yaourt\n\nAttention : Les sacs plastiques doivent être vidés avant d'être jetés. Le mieux reste de réduire votre consommation de plastique ! 🌱"
  },

  "que mettre dans le compost": {
    keywords: ["compost", "compostage", "organique", "épluchure"],
    answer: "Le compost transforme vos déchets en or pour le jardin ! 🌿\n\n✅ **OUI** : Épluchures de fruits et légumes, marc de café, sachets de thé, coquilles d'œufs, pain rassis, fleurs fanées\n\n❌ **NON** : Viande, poisson, produits laitiers, huiles, plantes malades, excréments d'animaux\n\nAstuce : Alternez matières sèches (feuilles) et humides (épluchures) pour un bon équilibre ! 🍂"
  },

  "impact environnemental des déchets": {
    keywords: ["impact", "environnement", "pollution", "nature"],
    answer: "Les déchets ont un impact majeur sur notre planète 🌍\n\n📊 **Chiffres clés** :\n• 1 tonne de plastique recyclé = 830L de pétrole économisés\n• 1 tonne de papier recyclé = 17 arbres sauvés 🌳\n• Décomposition : Bouteille plastique = 450 ans ⏳\n\nEn triant correctement, vous contribuez directement à réduire la pollution et préserver les ressources naturelles ! 💚"
  },

  "comment réduire mes déchets": {
    keywords: ["réduire", "moins", "diminuer", "production"],
    answer: "Adopter le mode de vie zéro déchet est un super défi ! 🎯\n\n🛒 **Au quotidien** :\n• Utilisez des sacs réutilisables\n• Achetez en vrac\n• Évitez les produits sur-emballés\n• Préférez les contenants en verre\n• Compostez vos déchets organiques\n• Réparez au lieu de jeter\n\nPetit geste, grand impact ! Chaque action compte. 🌟"
  },

  "recyclage du verre": {
    keywords: ["verre", "bouteille verre", "bocal"],
    answer: "Le verre est recyclable à l'infini ! ♾️\n\n🟢 **Poubelle verte** : Bouteilles, bocaux, pots en verre\n\n💡 **Bon à savoir** :\n• Pas besoin de retirer les étiquettes\n• Enlevez les bouchons et couvercles\n• Le verre se recycle à 100% sans perte de qualité\n• 1 tonne de verre recyclé = 660 kg de sable économisé\n\n❌ Ne pas jeter : Vitres, miroirs, ampoules (déchetterie)"
  },

  "durée décomposition déchets": {
    keywords: ["durée", "décomposition", "combien de temps", "temps"],
    answer: "Voici le temps de décomposition des déchets courants ⏰\n\n🍌 Épluchure : 3-6 mois\n📰 Journal : 3-12 mois\n🚬 Mégot : 1-2 ans\n🧃 Brique de lait : 5 ans\n🍿 Sachet plastique : 100-400 ans\n🧴 Bouteille plastique : 100-1000 ans\n🥫 Canette alu : 200-500 ans\n🍾 Bouteille verre : 4000 ans\n\nTrier et recycler, c'est réduire drastiquement ces délais ! ♻️"
  },

  "que faire des piles": {
    keywords: ["pile", "batterie", "électronique"],
    answer: "Les piles ne vont JAMAIS à la poubelle ! 🔋⚠️\n\n**Où les déposer** :\n✅ Bornes de collecte en magasin\n✅ Déchetteries\n✅ Certaines mairies\n\n**Pourquoi** :\nLes piles contiennent des métaux lourds toxiques (mercure, plomb) qui polluent sols et nappes phréatiques. Une seule pile jetée dans la nature peut contaminer 1m³ de terre pendant 50 ans ! 🚨\n\nPrivilégiez les piles rechargeables ! 🔄"
  },

  "emballages alimentaires": {
    keywords: ["emballage", "alimentaire", "carton", "plastique alimentaire"],
    answer: "Les emballages alimentaires se trient facilement ! 📦\n\n🟡 **Poubelle jaune** :\n✅ Cartons (céréales, pizza)\n✅ Briques de lait/jus\n✅ Boîtes métalliques\n✅ Films plastiques\n\n⚫ **Poubelle noire** :\n❌ Emballages très gras\n❌ Papiers/cartons souillés\n\n💡 **Astuce** : Aplatissez les cartons pour gagner de la place dans votre poubelle de tri !"
  },

  "statistiques système": {
    keywords: ["statistique", "stats", "données", "chiffres", "poubelle"],
    answer: "Voici l'état actuel de votre système SmartWaste 📊\n\n🗑️ **Poubelles actives** : {binCount}\n📈 **Taux moyen de remplissage** : {avgFill}%\n⚠️ **Collectes urgentes** : {urgentBins} poubelle(s)\n\nVotre système fonctionne bien ! Continuez vos efforts de tri et de réduction des déchets. Ensemble, nous faisons la différence ! 🌍💚"
  },

  "pourquoi recycler": {
    keywords: ["pourquoi", "importance", "recycler", "utile"],
    answer: "Le recyclage est ESSENTIEL pour notre planète ! 🌍\n\n**Bénéfices concrets** :\n🌳 Préserve les ressources naturelles\n⚡ Économise l'énergie (jusqu'à 95% pour l'aluminium)\n💧 Réduit la pollution de l'eau et de l'air\n♻️ Crée des emplois locaux\n🗑️ Diminue les décharges\n\n**Impact personnel** :\nEn recyclant 1 an de déchets, vous économisez l'équivalent énergétique de 1000 km en voiture ! 🚗"
  },

  "déchets dangereux": {
    keywords: ["dangereux", "toxique", "produit chimique", "peinture"],
    answer: "Les déchets dangereux nécessitent une collecte spéciale ! ☢️\n\n⚠️ **Déchets concernés** :\n• Peintures, solvants, colles\n• Produits phytosanitaires\n• Huiles de moteur\n• Extincteurs\n• Néons, ampoules basse consommation\n\n📍 **Où les déposer** :\n✅ Déchetteries\n✅ Points de collecte spécialisés\n\nNe JAMAIS jeter dans les poubelles classiques ou dans les égouts ! Risque de pollution majeure. 🚨"
  },

  "textile vêtements": {
    keywords: ["textile", "vêtement", "tissu", "habits", "linge"],
    answer: "Donnez une seconde vie à vos vêtements ! 👕♻️\n\n**Options de recyclage** :\n✅ Conteneurs Le Relais (bornes jaunes)\n✅ Associations caritatives (Emmaüs, Croix-Rouge)\n✅ Boutiques de seconde main\n✅ Recyclage textile en magasin (H&M, Zara)\n\n**Même abîmés !** Les textiles déchirés sont transformés en chiffons industriels ou isolants.\n\n🌍 1 tonne de textile recyclé = 17 000 L d'eau économisés"
  },

  "encombrants": {
    keywords: ["encombrant", "meuble", "gros", "électroménager"],
    answer: "Les encombrants ne vont pas dans vos poubelles ! 🛋️\n\n**Solutions** :\n🚛 Collecte municipale (sur rendez-vous)\n🏭 Déchetteries\n🔧 Ressourceries (réparation/réemploi)\n💰 Vente d'occasion (Le Bon Coin, Vinted)\n🎁 Don (associations, voisins)\n\n**Électroménager** :\nLes magasins ont l'obligation de reprendre votre ancien appareil lors d'un achat neuf (1 pour 1). Profitez-en ! ♻️"
  },

  "médicaments périmés": {
    keywords: ["médicament", "pharmacie", "périmé", "santé"],
    answer: "Les médicaments ne se jettent JAMAIS à la poubelle ! 💊\n\n**Procédure Cyclamed** :\n1️⃣ Retirez les emballages carton (→ poubelle jaune)\n2️⃣ Gardez uniquement blisters et flacons\n3️⃣ Rapportez en pharmacie\n\n**Pourquoi** :\n• Évite la pollution des eaux\n• Permet la valorisation énergétique\n• Sécurise l'élimination des substances actives\n\n⚠️ Ne jetez jamais dans l'évier ou les toilettes ! Impact grave sur l'environnement."
  },

  "compostage appartement": {
    keywords: ["compost appartement", "balcon", "sans jardin", "ville"],
    answer: "Oui, on peut composter en appartement ! 🏢🌱\n\n**Solutions urbaines** :\n\n🪴 **Lombricomposteur** (le plus populaire)\n• Compact, sans odeur\n• Vers mangent vos déchets\n• Produit compost + engrais liquide\n\n🗑️ **Composteur de cuisine** (Bokashi)\n• Fermentation en 2 semaines\n• Accepte viande et poisson\n\n🌳 **Compost collectif**\n• En pied d'immeuble\n• Jardins partagés\n\nRenseignez-vous auprès de votre mairie ! 🏛️"
  },

  "économies énergie recyclage": {
    keywords: ["économie", "énergie", "ressource", "épargner"],
    answer: "Le recyclage = économies énergétiques massives ! ⚡💰\n\n**Gains par matériau** :\n\n🥫 Aluminium : -95% d'énergie\n🧴 Plastique : -70% d'énergie\n📰 Papier : -40% d'énergie\n🍾 Verre : -20% d'énergie\n🔩 Acier : -75% d'énergie\n\n**Équivalents concrets** :\n1 tonne de plastique recyclé = Énergie d'une voiture sur 3000 km ! 🚗\n\nChaque geste de tri compte pour notre consommation énergétique globale."
  },

  "huile de cuisine": {
    keywords: ["huile", "cuisine", "friture", "graisse"],
    answer: "L'huile usagée ne va JAMAIS dans l'évier ! 🚫💧\n\n**Danger** :\n• Bouche les canalisations\n• Pollue 1000L d'eau par litre d'huile\n• Perturbe les stations d'épuration\n\n**Solution** :\n✅ Laissez refroidir\n✅ Versez dans une bouteille en plastique\n✅ Apportez en déchetterie\n\n**Recyclage** : L'huile usagée devient biocarburant ou savon ! ♻️\n\nPetites quantités ? Absorbez avec du papier → poubelle noire."
  },

  "carton pizza": {
    keywords: ["carton pizza", "pizza", "gras", "souillé"],
    answer: "Le carton à pizza : cas particulier ! 🍕📦\n\n**Si propre** : 🟡 Poubelle jaune (recyclage)\n**Si très gras** : ⚫ Poubelle noire (ordures)\n\n**Astuce** :\nDéchirez le carton ! La partie propre peut être recyclée, la partie grasse va aux ordures.\n\n**Pourquoi** : Les graisses perturbent le processus de recyclage du papier. Un carton trop souillé contamine toute la chaîne.\n\nMieux : privilégiez les pizzerias avec emballages compostables ! ♻️"
  },

  "gobelets plastique": {
    keywords: ["gobelet", "verre plastique", "jetable", "événement"],
    answer: "Les gobelets jetables sont un fléau environnemental ! 🥤😔\n\n**Le problème** :\n• 4,73 milliards de gobelets jetés/an en France\n• Seulement 1% recyclés\n• Contamination micro-plastique\n\n**Solutions** :\n✅ Tasse/gourde réutilisable\n✅ Gobelets consignés (événements)\n✅ Ecocup recyclables\n✅ Thermos pour boissons chaudes\n\n💡 **Votre geste** : Refuser le gobelet jetable, c'est éviter 500 déchets/an ! Ensemble, changeons les habitudes. 🌍💚"
  }
};

// ---- CONFIGURATION API ANTHROPIC ----
const CHATBOT_CONFIG = {
  USE_LOCAL_KB: true, // Utiliser la base de connaissances locale par défaut
  API_ENDPOINT: 'https://api.anthropic.com/v1/messages',
  MODEL: 'claude-sonnet-4-20250514',
  MAX_TOKENS: 1000,
  TEMPERATURE: 0.7,
  SIMILARITY_THRESHOLD: 0.3, // Seuil de similarité pour matcher les questions
  SYSTEM_PROMPT: `Tu es EcoBot, un assistant virtuel spécialisé dans l'environnement et la gestion des déchets.
Tu aides les utilisateurs de SmartWaste à mieux comprendre:
- Les bonnes pratiques de tri des déchets
- L'impact environnemental de la gestion des déchets
- Les statistiques et données de leur système de poubelles intelligentes
- Des conseils pour réduire leur production de déchets
- Les enjeux écologiques liés aux déchets

Ton ton est amical, pédagogique et encourageant. Tu utilises des émojis de manière modérée.
Si on te pose des questions hors sujet (non liées à l'environnement/déchets), redirige poliment vers ton domaine d'expertise.

Contexte actuel du système:
- {binCount} poubelles intelligentes actives
- Taux de remplissage moyen: {avgFill}%
- {urgentBins} poubelles nécessitant une collecte urgente

Réponds de manière concise (2-3 phrases maximum par défaut).`
};

// ---- CLASSE CHATBOT ----
class EnvironmentalChatbot {
  constructor() {
    this.conversationHistory = [];
    this.isOpen = false;
    this.isProcessing = false;
    this.initialized = false;
  }

  // Initialiser le chatbot dans le DOM
  init() {
    if (this.initialized) return;
    
    const chatbotHTML = `
      <!-- Bouton Flottant -->
      <button id="chatbot-toggle" class="chatbot-toggle" aria-label="Ouvrir le chatbot">
        <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor" class="chatbot-icon">
          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M8 10h.01M12 10h.01M16 10h.01M9 16H5a2 2 0 01-2-2V6a2 2 0 012-2h14a2 2 0 012 2v8a2 2 0 01-2 2h-5l-5 5v-5z" />
        </svg>
        <span class="chatbot-badge">EcoBot</span>
      </button>

      <!-- Fenêtre du Chatbot -->
      <div id="chatbot-window" class="chatbot-window hidden">
        <div class="chatbot-header">
          <div class="chatbot-header-info">
            <div class="chatbot-avatar">🌱</div>
            <div>
              <h3 class="chatbot-title">EcoBot</h3>
              <p class="chatbot-status">Assistant Environnemental</p>
            </div>
          </div>
          <button id="chatbot-close" class="chatbot-close-btn" aria-label="Fermer">
            <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        <div id="chatbot-messages" class="chatbot-messages">
          <div class="chatbot-message bot-message">
            <div class="message-avatar">🌱</div>
            <div class="message-content">
              <p>Bonjour ! Je suis EcoBot, votre assistant pour tout ce qui concerne l'environnement et la gestion des déchets. 🌍</p>
              <p class="mt-2">Comment puis-je vous aider aujourd'hui ?</p>
            </div>
          </div>
        </div>

        <div class="chatbot-suggestions">
          <button class="suggestion-chip" data-prompt="Comment bien trier mes déchets ?">
            ♻️ Conseils de tri
          </button>
          <button class="suggestion-chip" data-prompt="Quel est l'impact environnemental des déchets ?">
            🌍 Impact environnemental
          </button>
          <button class="suggestion-chip" data-prompt="Comment réduire ma production de déchets ?">
            📉 Réduire mes déchets
          </button>
        </div>

        <div class="chatbot-input-container">
          <textarea 
            id="chatbot-input" 
            class="chatbot-input" 
            placeholder="Posez votre question sur l'environnement..."
            rows="1"
          ></textarea>
          <button id="chatbot-send" class="chatbot-send-btn" aria-label="Envoyer">
            <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 19l9 2-9-18-9 18 9-2zm0 0v-8" />
            </svg>
          </button>
        </div>

        <div id="chatbot-loader" class="chatbot-loader hidden">
          <div class="loader-dots">
            <span></span>
            <span></span>
            <span></span>
          </div>
          <span class="loader-text">EcoBot réfléchit...</span>
        </div>
      </div>
    `;

    // Injecter dans le body
    document.body.insertAdjacentHTML('beforeend', chatbotHTML);
    
    // Ajouter les styles
    this.injectStyles();
    
    // Attacher les événements
    this.attachEventListeners();
    
    this.initialized = true;
    console.log('✅ EcoBot initialisé');
  }

  // Injecter les styles CSS
  injectStyles() {
    const styles = `
      <style>
        /* Bouton Flottant */
        .chatbot-toggle {
          position: fixed;
          bottom: 24px;
          right: 24px;
          width: 64px;
          height: 64px;
          border-radius: 50%;
          background: linear-gradient(135deg, #10b981 0%, #059669 100%);
          color: white;
          border: none;
          box-shadow: 0 4px 12px rgba(16, 185, 129, 0.4);
          cursor: pointer;
          display: flex;
          align-items: center;
          justify-content: center;
          transition: all 0.3s ease;
          z-index: 999;
        }

        .chatbot-toggle:hover {
          transform: scale(1.1);
          box-shadow: 0 6px 16px rgba(16, 185, 129, 0.5);
        }

        .chatbot-icon {
          width: 32px;
          height: 32px;
        }

        .chatbot-badge {
          position: absolute;
          bottom: -8px;
          background: white;
          color: #10b981;
          font-size: 10px;
          font-weight: bold;
          padding: 2px 8px;
          border-radius: 12px;
          box-shadow: 0 2px 4px rgba(0,0,0,0.1);
        }

        /* Fenêtre du Chatbot */
        .chatbot-window {
          position: fixed;
          bottom: 100px;
          right: 24px;
          width: 400px;
          height: 600px;
          background: white;
          border-radius: 16px;
          box-shadow: 0 8px 32px rgba(0, 0, 0, 0.15);
          display: flex;
          flex-direction: column;
          z-index: 998;
          animation: slideUp 0.3s ease;
        }

        @keyframes slideUp {
          from {
            opacity: 0;
            transform: translateY(20px);
          }
          to {
            opacity: 1;
            transform: translateY(0);
          }
        }

        .chatbot-window.hidden {
          display: none;
        }

        /* Header */
        .chatbot-header {
          background: linear-gradient(135deg, #10b981 0%, #059669 100%);
          color: white;
          padding: 16px;
          border-radius: 16px 16px 0 0;
          display: flex;
          justify-content: space-between;
          align-items: center;
        }

        .chatbot-header-info {
          display: flex;
          align-items: center;
          gap: 12px;
        }

        .chatbot-avatar {
          font-size: 32px;
          width: 48px;
          height: 48px;
          display: flex;
          align-items: center;
          justify-content: center;
          background: rgba(255, 255, 255, 0.2);
          border-radius: 50%;
        }

        .chatbot-title {
          font-size: 18px;
          font-weight: 600;
          margin: 0;
        }

        .chatbot-status {
          font-size: 12px;
          opacity: 0.9;
          margin: 0;
        }

        .chatbot-close-btn {
          background: transparent;
          border: none;
          color: white;
          cursor: pointer;
          padding: 4px;
          border-radius: 4px;
          transition: background 0.2s;
        }

        .chatbot-close-btn:hover {
          background: rgba(255, 255, 255, 0.2);
        }

        .chatbot-close-btn svg {
          width: 24px;
          height: 24px;
        }

        /* Messages */
        .chatbot-messages {
          flex: 1;
          overflow-y: auto;
          padding: 16px;
          background: #f9fafb;
          display: flex;
          flex-direction: column;
          gap: 12px;
        }

        .chatbot-message {
          display: flex;
          gap: 8px;
          align-items: flex-start;
        }

        .user-message {
          flex-direction: row-reverse;
        }

        .message-avatar {
          font-size: 24px;
          flex-shrink: 0;
        }

        .message-content {
          background: white;
          padding: 12px 16px;
          border-radius: 12px;
          box-shadow: 0 1px 2px rgba(0, 0, 0, 0.05);
          max-width: 80%;
        }

        .user-message .message-content {
          background: #10b981;
          color: white;
        }

        .message-content p {
          margin: 0;
          line-height: 1.5;
        }

        .message-content p + p {
          margin-top: 8px;
        }

        /* Suggestions */
        .chatbot-suggestions {
          padding: 12px 16px;
          display: flex;
          flex-wrap: wrap;
          gap: 8px;
          border-top: 1px solid #e5e7eb;
        }

        .suggestion-chip {
          background: #f3f4f6;
          border: 1px solid #e5e7eb;
          padding: 8px 12px;
          border-radius: 16px;
          font-size: 12px;
          cursor: pointer;
          transition: all 0.2s;
        }

        .suggestion-chip:hover {
          background: #10b981;
          color: white;
          border-color: #10b981;
        }

        /* Input */
        .chatbot-input-container {
          display: flex;
          gap: 8px;
          padding: 16px;
          border-top: 1px solid #e5e7eb;
          background: white;
          border-radius: 0 0 16px 16px;
        }

        .chatbot-input {
          flex: 1;
          border: 1px solid #e5e7eb;
          border-radius: 8px;
          padding: 10px 12px;
          font-family: inherit;
          font-size: 14px;
          resize: none;
          max-height: 100px;
          outline: none;
          transition: border-color 0.2s;
        }

        .chatbot-input:focus {
          border-color: #10b981;
        }

        .chatbot-send-btn {
          background: #10b981;
          border: none;
          color: white;
          width: 40px;
          height: 40px;
          border-radius: 8px;
          cursor: pointer;
          display: flex;
          align-items: center;
          justify-content: center;
          transition: background 0.2s;
        }

        .chatbot-send-btn:hover:not(:disabled) {
          background: #059669;
        }

        .chatbot-send-btn:disabled {
          opacity: 0.5;
          cursor: not-allowed;
        }

        .chatbot-send-btn svg {
          width: 20px;
          height: 20px;
        }

        /* Loader */
        .chatbot-loader {
          position: absolute;
          bottom: 80px;
          left: 16px;
          background: white;
          padding: 12px 16px;
          border-radius: 12px;
          box-shadow: 0 2px 8px rgba(0, 0, 0, 0.1);
          display: flex;
          align-items: center;
          gap: 8px;
        }

        .loader-dots {
          display: flex;
          gap: 4px;
        }

        .loader-dots span {
          width: 8px;
          height: 8px;
          background: #10b981;
          border-radius: 50%;
          animation: bounce 1.4s infinite ease-in-out;
        }

        .loader-dots span:nth-child(1) {
          animation-delay: -0.32s;
        }

        .loader-dots span:nth-child(2) {
          animation-delay: -0.16s;
        }

        @keyframes bounce {
          0%, 80%, 100% {
            transform: scale(0);
          }
          40% {
            transform: scale(1);
          }
        }

        .loader-text {
          font-size: 12px;
          color: #6b7280;
        }

        /* Responsive */
        @media (max-width: 480px) {
          .chatbot-window {
            width: calc(100vw - 32px);
            height: calc(100vh - 140px);
            bottom: 16px;
            right: 16px;
          }

          .chatbot-toggle {
            bottom: 16px;
            right: 16px;
          }
        }
      </style>
    `;
    
    document.head.insertAdjacentHTML('beforeend', styles);
  }

  // Attacher les événements
  attachEventListeners() {
    const toggleBtn = document.getElementById('chatbot-toggle');
    const closeBtn = document.getElementById('chatbot-close');
    const sendBtn = document.getElementById('chatbot-send');
    const input = document.getElementById('chatbot-input');
    const suggestions = document.querySelectorAll('.suggestion-chip');

    if (toggleBtn) {
      toggleBtn.addEventListener('click', () => this.toggle());
    }

    if (closeBtn) {
      closeBtn.addEventListener('click', () => this.close());
    }

    if (sendBtn) {
      sendBtn.addEventListener('click', () => this.sendMessage());
    }

    if (input) {
      input.addEventListener('keydown', (e) => {
        if (e.key === 'Enter' && !e.shiftKey) {
          e.preventDefault();
          this.sendMessage();
        }
      });

      // Auto-resize textarea
      input.addEventListener('input', () => {
        input.style.height = 'auto';
        input.style.height = input.scrollHeight + 'px';
      });
    }

    // Suggestions rapides
    suggestions.forEach(chip => {
      chip.addEventListener('click', () => {
        const prompt = chip.getAttribute('data-prompt');
        if (input) {
          input.value = prompt;
          this.sendMessage();
        }
      });
    });
  }

  // Ouvrir/Fermer le chatbot
  toggle() {
    const window = document.getElementById('chatbot-window');
    if (window) {
      this.isOpen = !this.isOpen;
      window.classList.toggle('hidden');
      
      if (this.isOpen) {
        document.getElementById('chatbot-input')?.focus();
      }
    }
  }

  close() {
    const window = document.getElementById('chatbot-window');
    if (window) {
      this.isOpen = false;
      window.classList.add('hidden');
    }
  }

  // Envoyer un message
  async sendMessage() {
    const input = document.getElementById('chatbot-input');
    if (!input || this.isProcessing) return;

    const message = input.value.trim();
    if (!message) return;

    // Ajouter le message utilisateur
    this.addMessage(message, 'user');
    input.value = '';
    input.style.height = 'auto';

    // Afficher le loader
    this.showLoader(true);

    try {
      let response;
      
      // Essayer d'abord avec la base de connaissances locale
      if (CHATBOT_CONFIG.USE_LOCAL_KB) {
        response = this.findLocalAnswer(message);
      }
      
      // Si pas de réponse locale, appeler l'API
      if (!response) {
        response = await this.callClaude(message);
      }
      
      // Afficher la réponse
      this.addMessage(response, 'bot');
      
    } catch (error) {
      console.error('Erreur chatbot:', error);
      this.addMessage(
        "Désolé, je rencontre un problème technique. 😔 Veuillez réessayer dans quelques instants.",
        'bot'
      );
    } finally {
      this.showLoader(false);
    }
  }

  // Trouver une réponse dans la base de connaissances locale
  findLocalAnswer(userMessage) {
    const normalizedMessage = userMessage.toLowerCase().trim();
    
    // Chercher une correspondance exacte ou partielle
    let bestMatch = null;
    let bestScore = 0;
    
    for (const [question, data] of Object.entries(KNOWLEDGE_BASE)) {
      // Calculer le score de similarité
      const score = this.calculateSimilarity(normalizedMessage, data.keywords);
      
      if (score > bestScore && score >= CHATBOT_CONFIG.SIMILARITY_THRESHOLD) {
        bestScore = score;
        bestMatch = data.answer;
      }
    }
    
    // Injecter le contexte système si nécessaire
    if (bestMatch && bestMatch.includes('{')) {
      const context = this.getSystemContext();
      bestMatch = bestMatch
        .replace('{binCount}', context.binCount)
        .replace('{avgFill}', context.avgFill)
        .replace('{urgentBins}', context.urgentBins);
    }
    
    return bestMatch;
  }

  // Calculer la similarité entre le message et les mots-clés
  calculateSimilarity(message, keywords) {
    let matchCount = 0;
    const messageWords = message.split(/\s+/);
    
    keywords.forEach(keyword => {
      const keywordWords = keyword.toLowerCase().split(/\s+/);
      
      // Vérifier si tous les mots du keyword sont dans le message
      const allWordsPresent = keywordWords.every(word => 
        messageWords.some(msgWord => msgWord.includes(word) || word.includes(msgWord))
      );
      
      if (allWordsPresent) {
        matchCount += keywordWords.length;
      }
    });
    
    return matchCount / Math.max(messageWords.length, 1);
  }

  // Appeler l'API Claude
  async callClaude(userMessage) {
    this.isProcessing = true;

    try {
      // Récupérer le contexte du système
      const context = this.getSystemContext();
      
      // Construire le prompt système avec contexte
      const systemPrompt = CHATBOT_CONFIG.SYSTEM_PROMPT
        .replace('{binCount}', context.binCount)
        .replace('{avgFill}', context.avgFill)
        .replace('{urgentBins}', context.urgentBins);

      // Ajouter le message à l'historique
      this.conversationHistory.push({
        role: 'user',
        content: userMessage
      });

      const response = await fetch(CHATBOT_CONFIG.API_ENDPOINT, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-api-key': 'VOTRE_CLE_API_ICI', // À remplacer par votre clé API
          'anthropic-version': '2023-06-01'
        },
        body: JSON.stringify({
          model: CHATBOT_CONFIG.MODEL,
          max_tokens: CHATBOT_CONFIG.MAX_TOKENS,
          temperature: CHATBOT_CONFIG.TEMPERATURE,
          system: systemPrompt,
          messages: this.conversationHistory
        })
      });

      if (!response.ok) {
        throw new Error(`API Error: ${response.status}`);
      }

      const data = await response.json();
      const assistantMessage = data.content[0].text;

      // Ajouter la réponse à l'historique
      this.conversationHistory.push({
        role: 'assistant',
        content: assistantMessage
      });

      // Limiter l'historique à 20 messages
      if (this.conversationHistory.length > 20) {
        this.conversationHistory = this.conversationHistory.slice(-20);
      }

      return assistantMessage;

    } catch (error) {
      console.error('Erreur API Claude:', error);
      throw error;
    } finally {
      this.isProcessing = false;
    }
  }

  // Récupérer le contexte du système SmartBin
  getSystemContext() {
    // Essayer de récupérer depuis appState si disponible
    if (typeof appState !== 'undefined') {
      const state = appState.getState();
      const bins = state.bins || [];
      const thresholds = state.thresholds || { orange: 70, red: 90 };
      
      return {
        binCount: bins.length,
        avgFill: bins.length > 0 
          ? Math.round(bins.reduce((sum, b) => sum + b.level, 0) / bins.length)
          : 0,
        urgentBins: bins.filter(b => b.level >= thresholds.orange).length
      };
    }
    
    // Fallback si appState n'est pas disponible
    return {
      binCount: bins?.length || 0,
      avgFill: bins?.length > 0 
        ? Math.round(bins.reduce((sum, b) => sum + b.level, 0) / bins.length)
        : 0,
      urgentBins: bins?.filter(b => b.level >= (thresholds?.orange || 70)).length || 0
    };
  }

  // Ajouter un message à l'interface
  addMessage(content, type) {
    const messagesContainer = document.getElementById('chatbot-messages');
    if (!messagesContainer) return;

    const messageDiv = document.createElement('div');
    messageDiv.className = `chatbot-message ${type}-message`;

    const avatar = type === 'bot' ? '🌱' : '👤';
    
    messageDiv.innerHTML = `
      <div class="message-avatar">${avatar}</div>
      <div class="message-content">
        <p>${this.formatMessage(content)}</p>
      </div>
    `;

    messagesContainer.appendChild(messageDiv);
    messagesContainer.scrollTop = messagesContainer.scrollHeight;
  }

  // Formater le message (gérer les liens, etc.)
  formatMessage(text) {
    // Convertir les URLs en liens
    return text.replace(
      /(https?:\/\/[^\s]+)/g,
      '<a href="$1" target="_blank" rel="noopener noreferrer" style="color: #10b981; text-decoration: underline;">$1</a>'
    );
  }

  // Afficher/Masquer le loader
  showLoader(show) {
    const loader = document.getElementById('chatbot-loader');
    if (loader) {
      loader.classList.toggle('hidden', !show);
    }

    const sendBtn = document.getElementById('chatbot-send');
    if (sendBtn) {
      sendBtn.disabled = show;
    }
  }

  // Réinitialiser la conversation
  reset() {
    this.conversationHistory = [];
    const messagesContainer = document.getElementById('chatbot-messages');
    if (messagesContainer) {
      messagesContainer.innerHTML = `
        <div class="chatbot-message bot-message">
          <div class="message-avatar">🌱</div>
          <div class="message-content">
            <p>Bonjour ! Je suis EcoBot, votre assistant pour tout ce qui concerne l'environnement et la gestion des déchets. 🌍</p>
            <p class="mt-2">Comment puis-je vous aider aujourd'hui ?</p>
          </div>
        </div>
      `;
    }
  }
}

// ---- INITIALISATION GLOBALE ----
const ecoBot = new EnvironmentalChatbot();

// Initialiser automatiquement au chargement du DOM
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', () => {
    ecoBot.init();
  });
} else {
  ecoBot.init();
}

// Exposer globalement pour accès externe
window.EcoBot = ecoBot;