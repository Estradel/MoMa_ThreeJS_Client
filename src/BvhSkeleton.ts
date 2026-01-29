import * as THREE from "three";
import { Matrix4 } from "three";
import type { SkeletonDef } from "./type.ts";
import { FBXLoader } from "three/examples/jsm/loaders/FBXLoader.js";

export class BvhSkeleton {
  public skinnedMeshRoot: THREE.Group;
  public skinnedBones: THREE.Bone[] = [];
  public streamedBonesToSkinnedBonesMap: Map<THREE.Bone, THREE.Bone> = new Map<
    THREE.Bone,
    THREE.Bone
  >();
  public skinnedBonesToStreamedBonesMap: Map<THREE.Bone, THREE.Bone> = new Map<
    THREE.Bone,
    THREE.Bone
  >();

  public root: THREE.Group;
  public skeleton: THREE.Skeleton;
  public bones: THREE.Bone[] = [];

  private constructor(data: SkeletonDef) {
    this.root = new THREE.Group();
    this.skinnedMeshRoot = new THREE.Group();
    this.bones = [];
    console.log(data.bone_names);

    // 1. Création des os
    for (let i = 0; i < data.bone_names.length; i++) {
      const bone = new THREE.Bone();
      bone.name = data.bone_names[i];
      bone.add(new THREE.AxesHelper(3.0));

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
    }

    // Création de l'objet Skeleton de ThreeJS (utile pour les SkinnedMesh ou SkeletonHelper)
    this.skeleton = new THREE.Skeleton(this.bones);

    // Ajout d'un helper pour visualiser
    const helper = new THREE.SkeletonHelper(this.root);
    this.root.add(helper);
  }

  public static async initialize(data: SkeletonDef): Promise<BvhSkeleton> {
    const instance = new BvhSkeleton(data);

    const loader = new FBXLoader();
    const loadedMesh: THREE.Group = await loader.loadAsync("bot.fbx");
    instance.skinnedMeshRoot = loadedMesh;

    // Find the root bone and the main skinned mesh containing it
    const rootBone = loadedMesh.children.find(
      (child) => child instanceof THREE.Bone,
    );
    const mainSkinnedMesh = loadedMesh.children
      .filter((value) => value instanceof THREE.SkinnedMesh)
      .find((value) => value.skeleton.bones[0] == rootBone);
    const mainSkeleton = mainSkinnedMesh?.skeleton;

    instance.skinnedBones = mainSkeleton!.bones;

    // Mapping des os streamés vers les os du skinned mesh
    for (let i = 0; i < instance.bones.length; i++) {
      const streamedBone = instance.bones[i];
      let matchIndex = instance.skinnedBones.findIndex(
        (skinnedBone) =>
          skinnedBone.name.replace(/[^\w\s]/gi, "") ==
          streamedBone.name.replace(/[^\w\s]/gi, ""),
      );

      if (matchIndex !== -1) {
        instance.streamedBonesToSkinnedBonesMap.set(
          streamedBone,
          instance.skinnedBones[matchIndex],
        );
        instance.skinnedBonesToStreamedBonesMap.set(
          instance.skinnedBones[matchIndex],
          streamedBone,
        );
      }
    }

    for (let [
      streamedBone,
      skinnedBone,
    ] of instance.streamedBonesToSkinnedBonesMap) {
      skinnedBone.position.copy(streamedBone.position);
      skinnedBone.quaternion.copy(streamedBone.quaternion);
      skinnedBone.scale.copy(streamedBone.scale);
    }

    return instance;
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
    const numBones = Math.min(
      this.bones.length,
      Math.floor(view.length / MATRIX_SIZE),
    );

    const matrix4 = new Matrix4();

    for (let i = 0; i < numBones; i++) {
      const bone = this.bones[i];
      const offset = i * MATRIX_SIZE;

      // Charger la matrice depuis le buffer
      // NumPy envoie en Row-Major, ThreeJS attend du Column-Major
      matrix4.fromArray(view, offset);
      matrix4.transpose();

      // Update the position, rotation, scale from the world matrix
      matrix4.decompose(bone.position, bone.quaternion, bone.scale);

      if (this.streamedBonesToSkinnedBonesMap.has(bone)) {
        const skinnedBone = this.streamedBonesToSkinnedBonesMap.get(bone)!;
        skinnedBone.position.copy(bone.position);
        skinnedBone.rotation.copy(bone.rotation);
        skinnedBone.scale.copy(bone.scale);
      }
    }
  }
}
