import { SkeletonVisualizer } from "./visualizer";

// Doit correspondre au serveur Python
const MAGIC_NUMBER = 0xBADDF00D;

export class AnimationClient {
    private ws: WebSocket | null = null;
    private visualizer: SkeletonVisualizer;
    private url: string;
    private infoDiv: HTMLElement;

    constructor(url: string, visualizer: SkeletonVisualizer) {
        this.url = url;
        this.visualizer = visualizer;
        this.infoDiv = document.getElementById('info')!;
        this.connect();
    }

    private connect() {
        this.ws = new WebSocket(this.url);
        this.ws.binaryType = "arraybuffer"; // CRUCIAL pour la perf

        this.ws.onopen = () => {
            console.log("Connecté au serveur Python");
            this.infoDiv.innerText = "Connecté. Attente handshake...";
        };

        this.ws.onmessage = (event) => {
            this.handleMessage(event.data);
        };

        this.ws.onclose = () => {
            console.log("Déconnecté. Tentative de reconnexion...");
            this.infoDiv.innerText = "Déconnecté. Reconnexion...";
            // setTimeout(() => this.connect(), 2000);
        };
    }

    private handleMessage(data: any) {
        // 1. Si c'est du texte (JSON), c'est le Handshake
        if (typeof data === "string") {
            try {
                const msg = JSON.parse(data);
                if (msg.type === "SKELETON_DEF") {
                    this.visualizer.initializeSkeleton(msg.bone_names);
                    this.infoDiv.innerText = "Squelette chargé. Streaming...";
                }
            } catch (e) {
                console.error("Erreur JSON", e);
            }
            return;
        }

        // 2. Si c'est du binaire, ce sont les matrices
        if (data instanceof ArrayBuffer) {
            this.processBinaryPacket(data);
            // this.ws?.close()
        }
    }

    private processBinaryPacket(buffer: ArrayBuffer) {
        // Lecture du Header
        // Header size = 12 bytes (Magic(4) + FrameID(4) + NumChars(4))
        if (buffer.byteLength < 12) return;

        const view = new DataView(buffer);
        const magic = view.getUint32(0, true); // true = Little Endian

        if (magic !== MAGIC_NUMBER) {
            console.warn("Magic number invalide !");
            return;
        }

        // const frameId = view.getUint32(4, true);
        // const numChars = view.getUint32(8, true);

        // Lecture du Body (Matrices)
        // On crée une vue Float32Array sur le reste du buffer
        // Offset 12 octets pour sauter le header
        const matricesData = new Float32Array(buffer, 12);

        // Mise à jour de la scène
        this.visualizer.updatePose(matricesData);
    }
}