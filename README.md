# DashBord-SmartWaste
Système intelligent de gestion de déchets (SmarteWaste)
# Système intelligent de gestion des déchets(SmartWaste)

## Description
Ce projet vise à améliorer le ramassage des déchets grâce à une poubelle intelligente qui mesure son niveau de remplissage et envoie les données à un serveur. Un site web récupère ces informations, affiche l’état des poubelles sur une carte et notifie les gestionnaires selon trois niveaux critiques. Au troisième niveau, l’intervention devient urgente pour éviter le débordement.

## Motivation
Au Togo (et dans de nombreux pays africains), le ramassage présente des retards, des déplacements inutiles et des débordements fréquents. Le système proposé permet de réduire ces inefficiences en déclenchant des notifications dès le premier seuil critique, en renforçant l’alerte au second, et en signalant l’urgence au troisième, tout en soutenant l’optimisation des trajets.

## Table des matières
1. [Installation](#installation)
2. [Utilisation](#utilisation)
3. [Architecture du système](#architecture-du-système)
4. [Composante ia](#composante-ia)
5. [Contributeurs](#contributeurs)
6. [Licence](#licence)
7. [Contact et support](#contact-et-support)
8. [Conclusion](#conclusion)

## Installation

### Pour les utilisateurs
- Installation sur site: La poubelle intelligente est livrée montée (ESP32, HC-SR04, GPS, alimentation solaire) et prête à être fixée sur le terrain.
- Accès au site web: Un lien sera communiqué dès la mise en ligne. Les gestionnaires pourront consulter les états et recevoir les notifications.

### Pour les développeurs

#### Prérequis matériels
- ESP32: Microcontrôleur principal.
- HC-SR04: Capteur ultrason pour le niveau de remplissage.
- Panneau solaire: Alimentation autonome.
- Batterie lithium-ion: Stockage d’énergie.
- Module GPS NEO-6M: Localisation des poubelles.
- Câbles Dupont: Optionnel mais recommandé pour les connexions.

#### Prérequis logiciels
- Arduino IDE: Programmation du microcontrôleur ESP32.
- Simulateurs: Proteus ou Wokwi pour tests/simulations.
- Technologies web: HTML, CSS, JavaScript pour l’interface.
- Serveur / base de données: Firebase pour le stockage.
- Navigateur web: Accès au tableau de bord.

#### Étapes d’installation (développeurs)
1. Cloner le dépôt:
2. Arduino IDE: Ouvrir le code, installer les bibliothèques ESP32, HC-SR04, GPS.
3. Configuration serveur: Renseigner les clés/identifiants (ex. Firebase) dans les variables de configuration.
4. Interface web: Déployer les fichiers HTML/CSS/JS et configurer l’accès au backend.
5. Simulation (option): Lancer Wokwi/Proteus si le matériel n’est pas disponible.

## Utilisation
1. Installation de la poubelle: Fixer sur site, alimentation solaire opérationnelle.
2. Collecte des données: Le capteur mesure en temps réel le niveau et envoie les données au serveur.
3. Suivi sur le site web: Les poubelles apparaissent sur une carte avec leur état.
4. Niveaux et notifications:
- Niveau 1 (notification initiale): Planifier le ramassage.
- Niveau 2 (alerte renforcée): Ramasser rapidement.
- Niveau 3 (urgence): Intervention immédiate pour éviter le débordement.
5. Action des gestionnaires: Organiser les tournées et prioriser les sites en rouge.

## Architecture du système

### Poubelle intelligente (IoT)
- ESP32: Centralise les mesures et la communication.
- HC-SR04: Mesure du niveau de remplissage.
- GPS NEO-6M: Localisation sur la carte.
- Énergie: Panneau solaire + batterie pour autonomie.
- Transmission: Envoi des données vers le serveur.

### Serveur / base de données
- Firebase: Stockage des niveaux et coordonnées.
- Seuils & états: Gestion des niveaux 1/2/3 et déclenchement des notifications.

### Site web (interface)
- Front-end: HTML, CSS, JavaScript.
- Carte & états: Visualisation en temps réel, code couleur des niveaux.
- Notifications: Avertissements dès le seuil 1, urgence au seuil 3.

## Composante IA
- Objectifs IA (présents ou prévus):
- Prédiction du remplissage: Estimer le temps restant avant le seuil 3 en fonction des historiques.
- Optimisation de tournée: Proposer des trajets qui minimisent la distance/temps tout en respectant les urgences.
- Détection d’anomalies: Identifier des capteurs défaillants ou des lectures incohérentes.
- Statut: En cours de conception. Les modules IA seront intégrés après stabilisation des flux de données et de la collecte d’historiques.
- Présence de "EcoBot" un chatbot ou assistant environnemental, qui réponse à toutes les questions liées à l'environnement

## Contributeurs
- Bright AGBLEZE: Responsable de la partie électronique (capteurs, microcontrôleur, alimentation).
- Assou Pierre HIHEGLO: Développement du site-web, du chatBot et du pitch-deck.
- Kevin HUGBEKEY: Conception du cahier de planning, vidéo de présentation.
## Licence
Ce projet est sous licence MIT.  
Vous êtes libres de l’utiliser, le modifier et le distribuer, à condition de mentionner les auteurs originaux.

## Contact et support
Pour toute question ou retour, veuillez contacter:
- Bright – Responsable électronique: <ajouter-email>
- Équipe SmartWaste: <hiheglopierre173@gmail.com ou canal de contact: 70419057>

## Conclusion
Le Système Intelligent de Gestion des Déchets associe électronique embarquée, énergie renouvelable et technologies web pour un ramassage plus efficace. Les notifications par seuils, la localisation GPS et l’interface cartographique permettent un ramassage à temps et une réduction des déplacements inutiles, tout en préparant l’intégration de modules IA pour la prédiction et l’optimisation des tournées.