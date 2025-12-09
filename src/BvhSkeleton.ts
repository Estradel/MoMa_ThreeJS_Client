import * as THREE from 'three';
import type {SkeletonDef} from "./type.ts";

export class BvhSkeleton {
    public root: THREE.Group;
    public skeleton: THREE.Skeleton;
    public bones: THREE.Bone[] = [];

    constructor(data: SkeletonDef) {
        this.root = new THREE.Group();
        this.bones = [];

        // 1. Création des os
        for (let i = 0; i < data.bone_names.length; i++) {
            const bone = new THREE.Bone();
            bone.name = data.bone_names[i];

            // Configuration importante pour manipuler la matrice directement
            bone.matrixAutoUpdate = false;

            this.bones.push(bone);
        }

        // 2. Reconstruction de la hiérarchie
        // Le tableau 'parents' donne l'index du parent pour chaque os (-1 si root)
        for (let i = 0; i < data.parents.length; i++) {
            const parentIdx = data.parents[i];
            const bone = this.bones[i];

            if (parentIdx === -1) {
                // C'est un os racine
                this.root.add(bone);
            } else {
                // On l'attache à son parent
                this.bones[parentIdx].add(bone);
            }

            // 3. Application de la Bind Pose (optionnel mais recommandé pour avoir une pose par défaut)
            // Note: Le serveur envoie les matrices locales d'animation, donc la bind pose
            // sert surtout si l'animation s'arrête ou pour le helper.
            const p = data.bind_pose.positions[i];
            const r = data.bind_pose.rotations[i]; // Quaternion [x, y, z, w]
            const s = data.bind_pose.scales[i];

            bone.position.set(p[0], p[1], p[2]);
            bone.quaternion.set(r[0], r[1], r[2], r[3]);
            bone.scale.set(s[0], s[1], s[2]);
            bone.updateMatrix(); // Applique pos/rot/scl à la matrice locale
        }

        // Création de l'objet Skeleton de ThreeJS (utile pour les SkinnedMesh ou SkeletonHelper)
        this.skeleton = new THREE.Skeleton(this.bones);

        // Ajout d'un helper pour visualiser
        const helper = new THREE.SkeletonHelper(this.root);
        this.root.add(helper);
    }

    /**
     * Met à jour la pose à partir d'un buffer binaire (Float64Array) reçu du WebSocket.
     * Le buffer contient une suite de matrices 4x4 (16 floats par os).
     */
    public updateFromBinary(buffer: ArrayBuffer) {
        // Le serveur Python envoie du float64 (double precision)
        const view = new Float64Array(buffer);

        // Une matrice 4x4 contient 16 floats
        const MATRIX_SIZE = 16;

        // Sécurité
        const numBones = Math.min(this.bones.length, Math.floor(view.length / MATRIX_SIZE));

        for (let i = 0; i < numBones; i++) {
            const bone = this.bones[i];
            const offset = i * MATRIX_SIZE;

            // Charger la matrice depuis le buffer
            // NumPy envoie en Row-Major, ThreeJS attend du Column-Major
            bone.matrix.fromArray(view, offset);
            bone.matrix.transpose();

            // console.log(new THREE.Vector3().setFromMatrixPosition(bone.matrixWorld));
        }

        // // Vérification de sécurité
        // if (view.length < this.bones.length * 16) return;
        //
        // for (let i = 0; i < this.bones.length; i++) {
        //     const bone = this.bones[i];
        //
        //     // On récupère la tranche correspondant à la matrice de cet os
        //     // Attention: ThreeJS utilise column-major, NumPy est souvent row-major.
        //     // Mais la méthode 'tobytes()' de NumPy aplatit ligne par ligne (C-order).
        //     // ThreeJS .fromArray() lit en column-major par défaut.
        //     // Si l'affichage est distordu, il faudra utiliser .transpose() côté serveur ou gérer ici.
        //     // Pour l'instant, assumons que l'ordre des éléments correspond ou que le serveur envoie transposé.
        //
        //     // Note: Si le serveur envoie Row-Major (standard NumPy), il faut transposer pour ThreeJS.
        //     // Mais une méthode simple est de charger et d'indiquer à ThreeJS de transposer si besoin.
        //     // Ici, on charge brute.
        //     bone.matrix.fromArray(view, i * 16);
        //
        //     // Comme c'est du Row-Major (NumPy) et que ThreeJS veut Column-Major,
        //     // il faut souvent transposer la matrice reçue.
        //     bone.matrix.transpose();
        // }
    }
}