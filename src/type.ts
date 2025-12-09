// Structure envoyée par le serveur Python (get_skeleton_definition)
export interface SkeletonDef {
    type: string;
    bone_names: string[];
    parents: number[];
    bind_pose: {
        positions: number[][];
        rotations: number[][];
        scales: number[][];
    };
}