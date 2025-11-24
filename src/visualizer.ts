import * as THREE from "three"
import {OrbitControls} from 'three/examples/jsm/controls/OrbitControls.js';

export class SkeletonVisualizer {
    private scene: THREE.Scene;
    private camera: THREE.PerspectiveCamera;
    private renderer: THREE.WebGLRenderer;
    private controls: OrbitControls;

    // Stockage des objets "Os" (des cubes ou axes)
    // Structure: un tableau plat qui matche l'index du serveur
    private bonesMeshes: THREE.Object3D[] = [];
    private isInitialized = false;

    constructor() {
        // 1. Initialisation ThreeJS de base
        this.scene = new THREE.Scene();
        this.scene.background = new THREE.Color(0x222222);

        // Grille pour se repérer
        const grid = new THREE.GridHelper(10, 10);
        this.scene.add(grid);
        this.scene.add(new THREE.AxesHelper(1)); // Origine monde

        // Lumières
        const hemiLight = new THREE.HemisphereLight(0xffffff, 0x444444, 3);
        this.scene.add(hemiLight);

        // Caméra & Rendu
        this.camera = new THREE.PerspectiveCamera(60, window.innerWidth / window.innerHeight, 0.1, 100);
        this.camera.position.set(0, 2, 5);

        this.renderer = new THREE.WebGLRenderer({antialias: true});
        this.renderer.setSize(window.innerWidth, window.innerHeight);
        document.body.appendChild(this.renderer.domElement);

        // Contrôles
        this.controls = new OrbitControls(this.camera, this.renderer.domElement);
        this.controls.target.set(0, 1, 0);
        this.controls.update();

        // Gestion du resize
        window.addEventListener('resize', () => this.onWindowResize(), false);

        // Boucle de rendu
        this.animate();
    }

    /**
     * Appelé quand on reçoit le JSON "Handshake" avec les noms des os.
     * On crée les objets physiques.
     */
    public initializeSkeleton(boneNames: string[]) {
        // Nettoyage si reconnexion
        this.bonesMeshes.forEach(b => this.scene.remove(b));
        this.bonesMeshes = [];

        console.log(`Initialisation squelette avec ${boneNames.length} os.`);

        // Création des objets graphiques
        boneNames.forEach((name, index) => {
            // On utilise un AxesHelper pour voir l'orientation de l'os
            // Rouge = X, Vert = Y, Bleu = Z
            const boneObj = new THREE.AxesHelper(1.15);

            // On peut ajouter un cube pour mieux voir la position
            const geometry = new THREE.BoxGeometry(0.05, 0.05, 0.05);
            const material = new THREE.MeshBasicMaterial({color: 0x00ff00});
            const cube = new THREE.Mesh(geometry, material);
            boneObj.add(cube);

            // IMPORTANT : On désactive la mise à jour automatique de la matrice
            // car on va injecter la matrice globale calculée par le serveur.
            boneObj.matrixAutoUpdate = false;

            this.scene.add(boneObj);
            this.bonesMeshes.push(boneObj);
        });

        this.isInitialized = true;
    }

    /**
     * Appelé à chaque frame binaire reçue.
     * @param floatData Le tableau plat de floats contenant toutes les matrices
     */
    public updatePose(floatData: Float32Array) {
        if (!this.isInitialized) return;

        // Une matrice 4x4 contient 16 floats
        const MATRIX_SIZE = 16;

        // Sécurité
        const numBones = Math.min(this.bonesMeshes.length, Math.floor(floatData.length / MATRIX_SIZE));

        for (let i = 0; i < numBones; i++) {
            const bone = this.bonesMeshes[i];
            const offset = i * MATRIX_SIZE;

            // Charger la matrice depuis le buffer
            // NumPy envoie en Row-Major, ThreeJS attend du Column-Major
            bone.matrix.fromArray(floatData, offset);
            bone.matrix.transpose();

            // console.log(new THREE.Vector3().setFromMatrixPosition(bone.matrixWorld));
        }
    }

    private animate() {
        requestAnimationFrame(() => this.animate());
        this.controls.update();
        this.renderer.render(this.scene, this.camera);
    }

    private onWindowResize() {
        this.camera.aspect = window.innerWidth / window.innerHeight;
        this.camera.updateProjectionMatrix();
        this.renderer.setSize(window.innerWidth, window.innerHeight);
    }
}