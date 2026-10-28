# { } DualCode

> Éditeur de code collaboratif en temps réel, 100 % P2P.

DualCode est une application web **statique** (HTML / CSS / JavaScript vanilla) qui permet à un **Host** et à plusieurs **Guests** de coder ensemble dans le navigateur, avec une interface inspirée de VS Code.

Il n'y a **aucun serveur backend** à écrire, héberger ou payer : les échanges passent directement d'un navigateur à l'autre grâce à **WebRTC** (via la librairie **PeerJS**). Le projet se déploie tel quel sur **Vercel** (ou n'importe quel hébergement statique).

---

## Sommaire

1. [Fonctionnalités](#fonctionnalités)
2. [Aperçu rapide](#aperçu-rapide)
3. [Structure du projet](#structure-du-projet)
4. [Démarrage rapide](#démarrage-rapide)
5. [Déploiement sur Vercel](#déploiement-sur-vercel)
6. [Guide d'utilisation](#guide-dutilisation)
7. [Modes de validation](#modes-de-validation)
8. [Fichiers et dossiers](#fichiers-et-dossiers)
9. [Salon vocal](#salon-vocal)
10. [Chat, participants, chrono](#chat-participants-chrono)
11. [Expulsion et arrêt de la session](#expulsion-et-arrêt-de-la-session)
12. [Architecture technique](#architecture-technique)
13. [Protocole de messages](#protocole-de-messages)
14. [Configuration et personnalisation](#configuration-et-personnalisation)
15. [Sécurité et confidentialité](#sécurité-et-confidentialité)
16. [Limites connues](#limites-connues)
17. [Dépannage](#dépannage)
18. [FAQ](#faq)
19. [Pistes d'amélioration](#pistes-damélioration)
20. [Licence](#licence)

---

## Fonctionnalités

**Session et connexion**
- Création d'une session en un clic : un code unique de **4 caractères** (ex : `A7X9`) est généré.
- Rejoindre avec ce code. **Plusieurs invités** peuvent se connecter à la même session.
- **Demande d'accès** : chaque invité doit être accepté par le Host (modal avec son pseudo).
- **Pseudos** choisis par chacun ; le Host est affiché `pseudo (HOST)`.
- **Liste des participants** et **compteur** de personnes connectées.
- **Chrono** de session (temps écoulé depuis le lancement), identique pour tous.

**Édition**
- **Monaco Editor** (le moteur de VS Code) avec coloration syntaxique selon l'extension.
- Synchronisation en direct des frappes et des **curseurs** (une couleur par personne).
- Onglets pour les fichiers ouverts.

**Validation des modifications**
- Les modifications, créations, suppressions et déplacements d'un invité sont **visibles en direct** chez le Host, puis **acceptés ou refusés**.
- Trois modes configurables : sécurisé, validation mutuelle, libre.
- Un refus **restaure** l'état précédent.

**Fichiers**
- Explorateur en arbre avec **dossiers et sous-dossiers**.
- **Clic droit** : nouveau fichier / dossier au bon endroit, suppression.
- **Glisser-déposer** pour déplacer fichiers et dossiers.
- **Import d'un dossier** de départ par le Host.
- **Export ZIP** du projet.

**Communication**
- **Chat** texte entre tous les participants.
- **Salon vocal** facultatif en audio P2P direct, avec micro, coupure du son et volume par personne.

**Gestion de session**
- Le Host peut **expulser** un invité.
- Le Host peut **arrêter la session** : tout le monde est déconnecté, plus personne ne peut rejoindre, et le projet est téléchargé en ZIP.

---

## Aperçu rapide

```
┌──────────────────────────────────────────────────────────────────────────┐
│ { } DualCode   Code : A7X9 [Copier]       👥 3 connecté(s) [⏹ Arrêter] [ZIP] │
├───────────────┬──────────────────────────────────────┬───────────────────┤
│ EXPLORATEUR   │ index.html ● │ app.js │              │ PARTICIPANTS   3  │
│ 📂 src        │                                      │ ● Léa (HOST) 🎙   │
│   📄 app.js   │   (Monaco Editor)                    │ ● Tom (moi)       │
│   📄 style.css│                                      │ ● Sam        ⛔   │
│ 📄 index.html │                                      │ SALON VOCAL    1  │
│               │                                      │ [🎙 Rejoindre]    │
│ MODIFICATIONS │                                      │ CHAT              │
│ EN ATTENTE  2 │                                      │ Tom : salut !     │
│ [✔][✖]        │                                      │ [Message…]   [➤]  │
├───────────────┴──────────────────────────────────────┴───────────────────┤
│ ● HOST — Léa   🟢 Session active        Mode sécurisé  ⚙ Paramètres  ⏱ 00:12:34 │
└──────────────────────────────────────────────────────────────────────────┘
```

---

## Structure du projet

```
dualcode/
├── index.html   # Lobby, interface de l'éditeur, modals, chargement des CDN
├── style.css    # Thème sombre façon VS Code
├── app.js       # Toute la logique : P2P, éditeur, validation, fichiers, vocal…
└── README.md
```

**Dépendances (toutes via CDN, versions épinglées)**

| Librairie | Version | Rôle |
|---|---|---|
| PeerJS | 1.5.4 | WebRTC / DataChannel / appels audio |
| Monaco Editor | 0.52.0 | Éditeur de code |
| JSZip | 3.10.1 | Création de l'archive ZIP |
| FileSaver.js | 2.0.5 | Déclenchement du téléchargement |

Aucun `npm install`, aucun build, aucun bundler.

---

## Démarrage rapide

### En local

N'ouvre pas `index.html` directement (`file://`) : le micro et les workers de Monaco peuvent être bloqués. Lance plutôt un petit serveur statique depuis le dossier du projet :

```bash
# Option 1 : Node
npx serve .

# Option 2 : Python
python3 -m http.server 8080
```

Puis ouvre `http://localhost:3000` (ou `:8080`). `localhost` est considéré comme un contexte sécurisé, donc le micro fonctionne.

### Tester à deux sur la même machine

1. Ouvre la page dans une fenêtre et clique sur **Créer une session**.
2. Ouvre la page dans une **fenêtre de navigation privée** (ou un autre navigateur), saisis un autre pseudo et le code, puis **Rejoindre**.
3. Reviens sur la première fenêtre et clique sur **Accepter**.

---

## Déploiement sur Vercel

DualCode est un site 100 % statique : aucune configuration de build n'est nécessaire.

**Via la CLI**
```bash
npm i -g vercel
cd dualcode
vercel --prod
```
(À la question « Framework », choisis **Other** ; le dossier de sortie est la racine.)

**Via Git**
1. Pousse le dossier sur GitHub / GitLab / Bitbucket.
2. Sur Vercel : **Add New → Project**, importe le dépôt.
3. Framework Preset : **Other**. Build Command et Output Directory : laisser vides.
4. **Deploy**.

**Via glisser-déposer** : le dashboard Vercel permet aussi de déposer directement le dossier.

> Vercel sert en **HTTPS**, ce qui est indispensable pour le micro (`getUserMedia`) et recommandé pour WebRTC.

Le projet fonctionne aussi sur Netlify, GitHub Pages, Cloudflare Pages ou tout hébergement de fichiers statiques.

---

## Guide d'utilisation

### Créer une session (Host)
1. Saisis ton **pseudo** (16 caractères max).
2. *(Optionnel)* Clique sur **📁 Importer un dossier de départ** pour charger un projet existant.
3. Clique sur **Créer une session (Host)**.
4. Le code à 4 caractères s'affiche en haut. Clique sur **Copier le code** et partage-le.

Sans import, la session démarre avec deux fichiers d'exemple : `index.html` et `script.js`.

### Rejoindre une session (Guest)
1. Saisis ton **pseudo**.
2. Saisis le **code à 4 caractères**.
3. Clique sur **Rejoindre**. Tu restes en attente jusqu'à la décision du Host.
4. Si le Host **accepte**, l'éditeur s'ouvre avec tous les fichiers. S'il **refuse**, tu reçois « Connexion refusée par l'hôte ».

### Accepter ou refuser un invité (Host)
Une fenêtre s'affiche : « *pseudo* demande à rejoindre la session » avec **Accepter** / **Refuser**. Les demandes sont traitées une par une.

### Importer un dossier de départ (Host)
- Sélectionne un dossier : sa **structure** (sous-dossiers compris) est conservée dans l'explorateur.
- Sont **ignorés** automatiquement : `node_modules`, `.git`, `.next`, `dist`, les fichiers `.env*`, les fichiers de plus de **1 Mo** et les fichiers **binaires**.
- Les caractères non autorisés dans les noms sont remplacés par `_`.
- Les dossiers vides ne sont pas importés (limitation du navigateur).

### Exporter le projet
Le bouton **Exporter en ZIP** (en haut à droite) compresse tous les fichiers (et dossiers vides) du projet et lance le téléchargement. Il est disponible pour tout le monde.

---

## Modes de validation

Le Host choisit le mode dans **⚙ Paramètres** (barre d'état, en bas). Le mode courant est visible par tous.

| Mode | Modifications du Host | Modifications des invités |
|---|---|---|
| **Auto-approbation du Host** *(défaut)* | Appliquées en direct, sans validation | Visibles en direct chez le Host, qui les **accepte ou refuse** |
| **Validation mutuelle** | Visibles en direct chez les invités, qui les acceptent ou refusent chacun | Visibles en direct chez le Host, qui les accepte ou refuse |
| **Mode Libre P2P** | En direct, sans validation | En direct, sans validation |

### Ce que le validateur voit
Tout est visible **en direct**, avant même la décision :

- **Code modifié** : les lignes changées sont surlignées en orange dans l'éditeur, un `●` apparaît sur l'onglet, et une carte dans **MODIFICATIONS EN ATTENTE** affiche un aperçu des lignes retirées (`-`) et ajoutées (`+`).
- **Fichier / dossier créé** : affiché en **vert** dans l'arbre et les onglets.
- **Fichier / dossier supprimé** : reste visible, en **rouge barré**.
- **Déplacement** : le nouvel emplacement apparaît en vert et l'ancien en rouge (un déplacement est traité comme une création + une suppression).

### Accepter / refuser
| Type | ✔ Accepter | ✖ Refuser |
|---|---|---|
| Modification de code | Le code est conservé | Le fichier est **restauré** à son état d'avant, chez tout le monde |
| Création | L'élément est conservé | L'élément est **supprimé** partout |
| Suppression | L'élément est supprimé définitivement | L'élément est **restauré** chez celui qui l'avait supprimé |

L'auteur de la proposition reçoit une notification de la décision.

> Tant qu'une modification est en attente sur un fichier, ce fichier est en **lecture seule** pour la personne qui doit valider, afin de ne pas écraser son propre travail en cas de refus.

---

## Fichiers et dossiers

### Explorateur
- Arbre avec dossiers repliables, icônes 📂 / 📁 / 📄, dossiers triés avant les fichiers.
- Cliquer sur un fichier l'ouvre dans un **onglet**.
- Cliquer sur un dossier le sélectionne : le bouton **🗎** (nouveau fichier) et **🗀** (nouveau dossier) créent alors l'élément **dans ce dossier**.
- Cliquer dans le vide de l'explorateur sélectionne la racine.

### Clic droit
| Cible | Actions |
|---|---|
| Dossier | Nouveau fichier ici · Nouveau dossier ici · Supprimer |
| Fichier | Nouveau fichier (dans son dossier) · Nouveau dossier (dans son dossier) · Supprimer |
| Espace vide | Nouveau fichier / dossier à la racine |

On peut saisir un chemin avec des `/` (ex : `src/utils/helpers.js`) : les dossiers intermédiaires sont créés automatiquement.

### Glisser-déposer
- Glisse un fichier ou un dossier **sur un dossier** pour l'y déplacer.
- Glisse-le **sur un fichier** pour le placer dans le dossier de ce fichier.
- Glisse-le **dans le vide** de l'explorateur pour le remonter à la racine.
- Un dossier ne peut pas être déplacé dans lui-même ; un conflit de nom est refusé.

### Règles de nommage
Caractères autorisés : lettres, chiffres, `_`, `-`, `.`, `/`. Pas de `.` / `..` comme segment, pas de `/` au début ou à la fin.

### Langages reconnus
Selon l'extension : JavaScript, TypeScript, JSX/TSX, HTML, CSS, JSON, Markdown, Python, Java, C, C++, PHP, XML, YAML, Shell, SQL. Le reste est traité comme du texte brut.

---

## Salon vocal

Le vocal est un **salon facultatif** : personne n'est inclus automatiquement, chacun décide de le rejoindre.

- **🎙 Rejoindre le salon** : le navigateur demande l'accès au micro.
- Une fois dans le salon, tu disposes de :
  - **Micro ON / OFF** (te couper sans quitter),
  - **Son ON / OFF** (couper tout ce que tu entends),
  - **Un curseur de volume par personne** dans la liste des participants,
  - **Quitter** le salon.
- Les personnes dans le salon sont marquées 🎙 dans la liste, et un badge indique leur nombre.

**Fonctionnement** : audio WebRTC **direct** entre navigateurs (appels PeerJS en maillage : chaque personne du salon est reliée à chacune des autres). Un seul appel est établi par paire.

**Prérequis** : HTTPS (ou `localhost`) et autorisation du micro.

---

## Chat, participants, chrono

- **Chat** : messages texte pour tous, affichés avec le pseudo. Les messages des invités passent par le Host qui les retransmet aux autres.
- **Participants** : liste en direct avec une pastille de couleur (la même que le curseur de la personne), le tag `(HOST)`, `(moi)` et l'indicateur 🎙. Le nombre de personnes connectées est affiché en haut et dans le panneau.
- **Pseudos** : si deux personnes choisissent le même pseudo, un numéro est ajouté au second (`Sam`, `Sam 2`).
- **Chrono** : ⏱ en bas à droite, temps écoulé depuis le lancement de la session. Les invités se calent sur l'horloge du Host (sans dépendre de l'heure de leur ordinateur).
- **Notifications** : un message bref apparaît quand quelqu'un rejoint, part, ou quand une décision est prise.

---

## Expulsion et arrêt de la session

### Expulser un invité
Dans la liste des participants, le Host voit un bouton **⛔** à côté de chaque invité. Après confirmation, l'invité voit « Expulsé » et peut revenir à l'accueil. Il peut redemander à rejoindre avec le code, et le Host pourra alors refuser.

### Arrêter la session
Le bouton rouge **⏹ Arrêter la session** (Host uniquement) :

1. Demande une **confirmation**.
2. **Bloque immédiatement** toute nouvelle connexion (les demandes en attente sont refusées).
3. **Déconnecte tous les invités** avec le message « Session arrêtée ».
4. Génère le **ZIP du projet** et le **télécharge automatiquement** chez le Host.
5. Affiche le bouton **Quitter** une fois le téléchargement lancé (ou **Réessayer** si le ZIP a échoué).

---

## Architecture technique

### Topologie en étoile (hub & spokes)

```
            ┌─────────┐
   ┌────────│  HOST   │────────┐
   │        └────┬────┘        │
   │             │             │
┌──┴───┐     ┌───┴──┐     ┌────┴─┐
│Guest1│     │Guest2│     │Guest3│
└──────┘     └──────┘     └──────┘
```

- Le **Host** est l'autorité : il détient l'état de référence des fichiers, valide les demandes d'accès et **retransmet** les messages d'un invité aux autres.
- Les invités ne sont connectés **qu'au Host** pour les données (édition, fichiers, chat). Seul l'audio du salon vocal est en maillage entre invités.
- Le Host utilise comme Peer ID `dualcode-` + le code à 4 caractères. Ce préfixe évite les collisions avec d'autres applications sur le broker public PeerJS ; l'utilisateur ne voit et ne saisit que les 4 caractères.
- Les codes utilisent l'alphabet `ABCDEFGHJKLMNPQRSTUVWXYZ23456789` (sans `I`, `O`, `0`, `1` pour éviter les confusions). En cas de collision, un nouveau code est généré automatiquement.

### Signalisation et connexion
- La **signalisation** WebRTC (échange initial des informations de connexion) passe par le **broker PeerJS public gratuit**. Une fois la connexion établie, les données circulent en direct entre navigateurs.
- La connexion d'un invité est créée avec son pseudo en métadonnée ; le Host la garde **en attente** (file d'attente) jusqu'à sa décision. Tant qu'elle n'est pas acceptée, ses messages sont ignorés.

### Synchronisation de l'éditeur
- Un **modèle Monaco par fichier**.
- Chaque frappe est envoyée sous forme de **deltas** (plage + texte), pas de fichier complet.
- Un drapeau empêche la ré-émission des modifications distantes (pas de boucle d'écho).
- Les restaurations (refus) utilisent un remplacement complet du fichier (`sync`).
- Les curseurs sont affichés comme décorations Monaco, une couleur par participant.

### Gros messages
Le DataChannel limite la taille des messages. Les messages de plus de **4 000 caractères** (par exemple l'état initial d'un gros projet importé) sont **découpés en morceaux** puis recollés à l'arrivée. Sans cela, un invité pouvait rester bloqué sur « en attente ».

### Validation
Chaque modification marquée « en attente » (`p: 1`) est enregistrée côté validateur avec son **état de base** (pour calculer l'aperçu et pouvoir restaurer) et son **auteur** (pour lui notifier la décision).

### Vocal
Appels audio PeerJS en maillage. Pour éviter les doubles appels, seule la personne dont l'identifiant est le plus petit lance l'appel pour chaque paire. L'état « dans le salon » de chacun est diffusé via la liste des participants.

---

## Protocole de messages

Tous les messages sont des objets JSON `{ t: <type>, ... }`. Les messages du Host portent `from: 'host'` ; ceux relayés par le Host portent l'identifiant de l'auteur.

| Type | Sens | Rôle |
|---|---|---|
| `init` | Host → Guest | État initial : fichiers, dossiers, mode, participants, chrono, identifiant |
| `refused` | Host → Guest | Demande d'accès refusée |
| `closed` | Host → Guest | Session arrêtée |
| `kicked` | Host → Guest | Invité expulsé |
| `members` | Host → tous | Liste des participants (pseudo, état vocal) |
| `voice` | Guest → Host | Entrée / sortie du salon vocal |
| `settings` | Host → tous | Changement de mode de validation |
| `edit` | tous | Deltas de code (`p: 1` = en attente de validation) |
| `sync` | tous | Remplacement complet d'un fichier (restauration après refus) |
| `fcreate` | tous | Création d'un fichier ou dossier |
| `fdelete` | tous | Suppression d'un fichier ou dossier |
| `res` | ciblé | Notification de la décision de validation |
| `cursor` | tous | Position du curseur |
| `chat` | tous | Message de chat |
| `chunk` | tous | Fragment d'un gros message |

**Relais par le Host** : `edit`, `sync`, `fcreate`, `fdelete`, `cursor` et `chat` d'un invité sont retransmis aux autres invités. Une suppression en attente n'est relayée qu'une fois acceptée.

---

## Configuration et personnalisation

Tout se règle dans `app.js` :

| Élément | Où | Description |
|---|---|---|
| `PREFIX` | haut du fichier | Préfixe du Peer ID. Change-le pour isoler ta propre instance. |
| `CH` | section « Réseau » | Taille max d'un message avant découpage (défaut : 4000). |
| `COLORS` | haut du fichier | Couleurs des participants. Si tu changes leur nombre, adapte aussi les classes `.rc0` à `.rcN` dans `style.css`. |
| `LANGS` | haut du fichier | Correspondance extension → langage Monaco. |
| Fichiers d'exemple | fonction `startHost` | Contenu des fichiers créés quand il n'y a pas d'import. |
| Limite d'import | gestionnaire `#import-dir` | Taille max (1 Mo) et dossiers ignorés. |
| Thème | `style.css` | Variables CSS en tête (`:root`). |

### Utiliser ton propre serveur de signalisation / un serveur TURN

Par défaut, PeerJS utilise son broker public et des serveurs STUN gratuits. Pour plus de fiabilité (réseaux d'entreprise, 4G stricte), ajoute un **serveur TURN** ou héberge ton propre `peerjs-server`. Les créations de `Peer` sont dans `startHost()` et dans le gestionnaire du bouton **Rejoindre** :

```js
const PEER_OPTIONS = {
  // host: 'mon-serveur-peerjs.exemple.com', port: 443, path: '/', secure: true,
  config: {
    iceServers: [
      { urls: 'stun:stun.l.google.com:19302' },
      { urls: 'turn:turn.exemple.com:3478', username: 'user', credential: 'pass' }
    ]
  }
};
// Host :   new Peer(PREFIX + code, PEER_OPTIONS)
// Guest :  new Peer(undefined, PEER_OPTIONS)
```

---

## Sécurité et confidentialité

- **Pas de serveur de données** : le code et les messages circulent en P2P, chiffrés par WebRTC (DTLS). Le broker public ne voit que la signalisation (identifiants de pairs et informations réseau).
- **Contrôle d'accès** : toute personne connaissant le code peut *demander* à rejoindre, mais seul le Host décide. Le code (4 caractères) est volontairement court : ne le publie pas et refuse les demandes que tu ne reconnais pas.
- **Les invités acceptés reçoivent tout le projet importé.** Les fichiers `.env*` sont exclus de l'import, mais vérifie ton dossier avant de le charger (clés, secrets, données personnelles).
- **La validation est un workflow, pas une barrière de sécurité.** Les modifications d'un invité sont appliquées en direct chez le Host et retransmises aux autres invités ; le refus les annule. Un client volontairement modifié pourrait contourner ce comportement : ne donne l'accès qu'à des personnes de confiance.
- **Aucune persistance** : rien n'est enregistré côté serveur ni dans le navigateur. Fermer l'onglet du Host met fin à la session. Pense à exporter ton projet (l'arrêt de session le fait automatiquement).
- **Contenu affiché de façon sûre** : pseudos, noms de fichiers et messages sont insérés en texte, jamais en HTML.

---

## Limites connues

- **Pas de résolution de conflits avancée** : les deltas sont appliqués par position. Deux personnes modifiant exactement la même zone en même temps peuvent produire un résultat inattendu (ce n'est pas un CRDT).
- **Un refus restaure le fichier** à l'état validé, ce qui écrase ce que l'auteur a pu taper entre-temps.
- **Un seul état de base par fichier** : si deux invités modifient en parallèle un même fichier en attente, l'auteur affiché est le premier.
- **Validation mutuelle** : chaque invité accepte pour lui-même, mais dès qu'un invité refuse, le fichier est restauré pour tout le monde.
- **Pas de renommage** (utilise le glisser-déposer pour déplacer). Pas de recherche, pas de sélection de texte partagée (seule la position du curseur l'est).
- **Fichiers volumineux** : l'import ignore les fichiers de plus de 1 Mo. Un projet très volumineux rend la connexion initiale plus longue.
- **Vocal en maillage** : adapté à de petits groupes ; la charge réseau augmente avec le nombre de personnes dans le salon.
- **Réseaux restrictifs** : sans serveur TURN, certaines connexions (NAT symétrique, pare-feu d'entreprise) peuvent échouer.
- **Dépendance au broker PeerJS public** pour la mise en relation (gratuit, sans garantie de disponibilité).
- **Les dossiers vides** ne sont pas importés depuis le disque.

---

## Dépannage

| Problème | Cause probable | Solution |
|---|---|---|
| « Session introuvable » | Code erroné, session arrêtée ou Host hors ligne | Vérifie le code ; demande au Host de recréer une session |
| Reste sur « en attente de l'approbation » | Le Host n'a pas encore cliqué sur **Accepter** | Demande au Host de regarder la fenêtre de demande |
| Connexion impossible / très longue | Réseau restrictif (NAT, pare-feu) | Essaie un autre réseau (4G) ; ajoute un serveur TURN |
| Page blanche ou éditeur absent | CDN bloqué (bloqueur de pub, réseau filtré) | Autorise `cdn.jsdelivr.net` et `cdnjs.cloudflare.com` |
| « Micro refusé ou indisponible » | Autorisation refusée ou page non sécurisée | Autorise le micro dans le navigateur ; utilise HTTPS ou `localhost` |
| On n'entend personne dans le salon | Son coupé, volume à 0, ou un seul participant dans le salon | Vérifie **Son : ON** et les curseurs de volume ; vérifie que l'autre a rejoint le salon |
| Le fichier est en lecture seule | Une modification est en attente sur ce fichier | Accepte ou refuse la carte correspondante |
| Le ZIP ne se télécharge pas | Téléchargements bloqués par le navigateur | Autorise les téléchargements ; utilise **Réessayer** ou **Exporter en ZIP** |
| Ça ne marche pas en ouvrant `index.html` | Ouverture en `file://` | Utilise un serveur local (`npx serve .`) |

Pour diagnostiquer, ouvre la **console du navigateur** (F12) : les erreurs PeerJS y sont affichées.

---

## FAQ

**Faut-il un compte ou une clé d'API ?**
Non. Aucun compte, aucune clé, aucun service payant.

**Combien de personnes peuvent rejoindre ?**
Le code ne fixe pas de limite stricte. En pratique, la qualité dépend de la connexion du Host (il relaie tout) ; reste sur de petits groupes, surtout avec le vocal.

**Que se passe-t-il si le Host ferme son onglet ?**
La session s'arrête pour tout le monde, puisque le Host est le hub. Les invités peuvent exporter le projet en ZIP tant qu'ils sont connectés.

**Les données sont-elles stockées quelque part ?**
Non. Tout vit en mémoire dans les navigateurs, tant que la session est ouverte.

**Puis-je utiliser DualCode pour du pair programming à deux seulement ?**
Oui, c'est le cas d'usage de base : un Host, un Guest. Le projet supporte simplement plus d'invités.

**Pourquoi un préfixe `dualcode-` dans l'identifiant ?**
Pour éviter les collisions avec d'autres applications utilisant le même broker public.

**Comment relancer une session avec le même code ?**
Les codes sont aléatoires et créés à chaque session ; il n'y a pas de salon permanent.

---

## Pistes d'amélioration

- Renommage de fichiers et de dossiers.
- Sélections de texte partagées et « suivre le curseur » d'un participant.
- Résolution de conflits plus robuste (CRDT, par exemple Yjs).
- Éditeur multi-fenêtres / vue côte à côte.
- Rôles et permissions par invité (lecture seule, éditeur).
- Terminal / exécution de code dans un sandbox.
- Sauvegarde automatique locale (restauration après crash du Host).
- Mot de passe optionnel sur la session.
- Serveur TURN intégré dans la configuration.

---

## Licence

À définir par l'auteur du projet (la licence MIT est un choix courant pour un projet de ce type).
