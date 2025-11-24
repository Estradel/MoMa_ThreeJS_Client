
// 1. Initialiser le rendu 3D
import {AnimationClient} from "./network.ts";
import {SkeletonVisualizer} from "./visualizer.ts";

const visualizer = new SkeletonVisualizer();

// 2. Initialiser le réseau (se connecte au serveur Python local)
// Assurez-vous que le port correspond à votre script Python (8765 par défaut)
const client = new AnimationClient("ws://localhost:8765", visualizer);

// ### Comment lancer le projet
//
// 1.  **Initialiser :**
//     Dans le dossier, lancez :
//
// bun install
//     ```
//
// 2.  **Démarrer :**
//
// bun run dev