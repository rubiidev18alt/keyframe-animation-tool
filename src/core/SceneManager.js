import * as GlobalTHREE from 'three'; 
import { FBXLoader } from 'three/examples/jsm/loaders/FBXLoader.js';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';
import { TransformControls } from 'three/examples/jsm/controls/TransformControls.js';
import { createThreeAnimationTracks, sampleSteppedPose } from '../utils/steppedAnimation.js';

const TARGET_MODEL_MAX_DIMENSION = 150; // Used to normalize model size on import

class SceneManager {
    constructor(containerElement) {
        this.containerElement = containerElement; 

        this.scene = null;
        this.camera = null;
        this.renderer = null;
        this.controls = null; 
        this.transformControls = null; 
        
        this.model = null;
        this.modelStage = new GlobalTHREE.Group(); // Viewport framing only; never exported.
        this.skeletonHelper = null;
        this.bones = [];
        this.boneMap = new Map(); 

        this.mixer = null;
        this.clock = new GlobalTHREE.Clock(); 
        this.activeAction = null;

        this.raycaster = new GlobalTHREE.Raycaster();
        this.mouse = new GlobalTHREE.Vector2();

        this.onBoneTransformChangeByGizmoCallback = null; 
        this.onTimeUpdateCallback = null;
        this.onGizmoDraggingChangedCallback = null;
        this.onBoneClickCallback = null;
        this.animationFrameId = null;
        this.resizeObserver = null;
        this.onMouseClickBound = null;

        this.boneMarkersGroup = new GlobalTHREE.Group();
        this.markerGeometry = new GlobalTHREE.SphereGeometry(2.5, 8, 8); // Small marker size
        this.defaultMarkerMaterial = new GlobalTHREE.MeshBasicMaterial({ color: 0x75e0cc, transparent: true, opacity: 0.6, depthTest: false, depthWrite: false });
        this.selectedMarkerMaterial = new GlobalTHREE.MeshBasicMaterial({ color: 0xffca75, transparent: true, opacity: 0.9, depthTest: false, depthWrite: false });
        this.boneMarkersGroup.renderOrder = 1; // Render markers on top

        this.init(); 
        this.animate(); 
    }

    init() {
        const THREE = GlobalTHREE; 
        if (!this.scene) {
            this.scene = new THREE.Scene();
            this.scene.background = new THREE.Color(0x141b21);
            this.scene.fog = new THREE.FogExp2(0x141b21, 0.00115);
        }

        this.scene.add(this.modelStage, this.boneMarkersGroup);

        if (!this.renderer) {
            this.renderer = new THREE.WebGLRenderer({ antialias: true });
            this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
            this.renderer.shadowMap.enabled = true;
            if(this.containerElement && this.renderer.domElement && !this.containerElement.contains(this.renderer.domElement)) {
                this.containerElement.appendChild(this.renderer.domElement);
            }
        }
        if (this.containerElement && this.renderer) { 
             this.renderer.setSize(this.containerElement.clientWidth, this.containerElement.clientHeight, false);
        }


        if (!this.camera) {
            this.camera = new THREE.PerspectiveCamera(60, this.containerElement ? this.containerElement.clientWidth / this.containerElement.clientHeight : 1, 0.1, 2000);
            this.camera.position.set(100, 200, 300);
        } else {
            if (this.containerElement) {
                this.camera.aspect = this.containerElement.clientWidth / this.containerElement.clientHeight;
                this.camera.updateProjectionMatrix();
            }
        }


        if (!this.controls && this.camera && this.renderer) { 
            this.controls = new OrbitControls(this.camera, this.renderer.domElement);
            this.controls.target.set(0, 100, 0); 
            this.controls.enableDamping = true;
            this.controls.dampingFactor = 0.05;
            this.controls.screenSpacePanning = false;
            this.controls.minDistance = 10;
            this.controls.maxDistance = 1000;
        }
        if (this.controls) this.controls.update();


        if (!this.scene.getObjectByName("hemiLight")) {
            const hemiLight = new THREE.HemisphereLight(0xffffff, 0x444444, 1.5);
            hemiLight.name = "hemiLight";
            hemiLight.position.set(0, 200, 0);
            this.scene.add(hemiLight);
        }
        if (!this.scene.getObjectByName("dirLight")) {
            const dirLight = new THREE.DirectionalLight(0xffffff, 1.5);
            dirLight.name = "dirLight";
            dirLight.position.set(50, 200, 100);
            dirLight.castShadow = true;
            dirLight.shadow.camera.top = 180;
            dirLight.shadow.camera.bottom = -100;
            dirLight.shadow.camera.left = -120;
            dirLight.shadow.camera.right = 120;
            dirLight.shadow.mapSize.width = 1024;
            dirLight.shadow.mapSize.height = 1024;
            this.scene.add(dirLight);
        }
        if (!this.scene.getObjectByName("gridHelper")) {
            const grid = new THREE.GridHelper(2000, 40, 0x608d94, 0x374954);
            grid.name = "gridHelper";
            grid.material.opacity = 0.7;
            grid.material.transparent = true;
            this.scene.add(grid);
        }

        if (!this.transformControls && this.camera && this.renderer) { 
            this.transformControls = new TransformControls(this.camera, this.renderer.domElement);
            this.transformControls.addEventListener('dragging-changed', (event) => {
                if (this.controls) {
                    this.controls.enabled = !event.value;
                }
                if (this.onGizmoDraggingChangedCallback) { 
                    this.onGizmoDraggingChangedCallback(event.value);
                }
            });
            this.transformControls.addEventListener('objectChange', () => {
                if (this.transformControls.object) { 
                    const bone = this.transformControls.object;
                    if (this.model) {
                        this.model.updateMatrixWorld(true); 
                    }
                    if (this.onBoneTransformChangeByGizmoCallback) {
                        this.onBoneTransformChangeByGizmoCallback(
                            bone.name,
                            bone.position,   
                            bone.quaternion  
                        );
                    }
                }
            });
            this.transformControls.setSize(1.0); 
            this.scene.add(this.transformControls);
        }
        
        this.resizeObserver?.disconnect();
        this.resizeObserver = new ResizeObserver(() => this.onWindowResize());
        this.resizeObserver.observe(this.containerElement);
        if (this.onMouseClickBound) {
            this.renderer.domElement.removeEventListener('click', this.onMouseClickBound);
        }
        this.onMouseClickBound = this.onMouseClick.bind(this);
        if (this.renderer && this.renderer.domElement) {
            this.renderer.domElement.addEventListener('click', this.onMouseClickBound);
        }
    }

    onWindowResize() {
        if (!this.containerElement || !this.renderer || !this.camera) return;
        const { clientWidth: width, clientHeight: height } = this.containerElement;
        if (!width || !height) return;
        this.camera.aspect = width / height;
        this.camera.updateProjectionMatrix();
        this.renderer.setSize(width, height, false);
    }

    onMouseClick(event) {
        if (!this.model || !this.camera || !this.renderer || !this.onBoneClickCallback) return;
        if (this.transformControls && this.transformControls.dragging) return;
        if (!this.boneMarkersGroup.visible) return; 
        
        const rect = this.renderer.domElement.getBoundingClientRect();
        this.mouse.x = ((event.clientX - rect.left) / rect.width) * 2 - 1;
        this.mouse.y = -((event.clientY - rect.top) / rect.height) * 2 + 1;
        
        this.raycaster.setFromCamera(this.mouse, this.camera);
        
        const intersects = this.raycaster.intersectObjects(this.boneMarkersGroup.children, false); 

        if (intersects.length > 0) {
            const closestMarker = intersects[0].object;
            if (closestMarker && closestMarker.userData.boneName) {
                this.onBoneClickCallback(closestMarker.userData.boneName);
            }
        }
    }

    createOrUpdateBoneMarkers() {
        while(this.boneMarkersGroup.children.length > 0){
            const marker = this.boneMarkersGroup.children[0];
            this.boneMarkersGroup.remove(marker);
        }

        this.bones.forEach(boneInfo => {
            const bone = this.getBoneByName(boneInfo.name);
            if (!bone) return;

            const marker = new GlobalTHREE.Mesh(this.markerGeometry, this.defaultMarkerMaterial);
            marker.userData.boneName = boneInfo.name;
            this.boneMarkersGroup.add(marker);
        });
        this.updateBoneMarkerPositions();
        this.highlightSelectedBoneMarker(null); 
    }

    updateBoneMarkerPositions() {
        if (!this.model) return;
        this.model.updateMatrixWorld(true); 

        this.boneMarkersGroup.children.forEach(marker => {
            const bone = this.getBoneByName(marker.userData.boneName);
            if (bone) {
                marker.position.setFromMatrixPosition(bone.matrixWorld);
            }
        });
    }

    highlightSelectedBoneMarker(selectedBoneName) {
        this.boneMarkersGroup.children.forEach(marker => {
            if (marker.userData.boneName === selectedBoneName) {
                marker.material = this.selectedMarkerMaterial;
            } else {
                marker.material = this.defaultMarkerMaterial;
            }
        });
    }


    setOnGizmoDraggingChangedCallback(callback) { 
        this.onGizmoDraggingChangedCallback = callback;
    }

    setOnBoneClickCallback(callback) {
        this.onBoneClickCallback = callback;
    }

    clearModel() {
        this.detachGizmo();
        this.stopAnimation();
        if (this.model) {
            this.modelStage.remove(this.model);
            this.model.traverse(child => {
                if (child.isMesh) {
                    child.geometry?.dispose();
                    if (Array.isArray(child.material)) {
                        child.material.forEach(m => m?.dispose());
                    } else {
                        child.material?.dispose();
                    }
                }
            });
            this.model = null;
        }
        if (this.skeletonHelper && this.scene) { 
            this.scene.remove(this.skeletonHelper);
            this.skeletonHelper.dispose();
            this.skeletonHelper = null;
        }
        if (this.mixer) {
            this.mixer.stopAllAction();
            this.mixer = null;
        }
        this.bones = [];
        this.boneMap.clear();
        this.modelStage.position.set(0, 0, 0);
        this.modelStage.scale.setScalar(1);

        while(this.boneMarkersGroup.children.length > 0){
            this.boneMarkersGroup.remove(this.boneMarkersGroup.children[0]);
        }
    }

    async loadModel(file) {
        this.clearModel();
        const buffer = await file.arrayBuffer();
        if (!this.scene) throw new Error('The viewport is unavailable.');
        const object = new FBXLoader().parse(buffer, '');
        this.model = object;
        this.modelStage.add(object);
        this.modelStage.updateMatrixWorld(true);

        const initialBoneData = Object.create(null);
        object.traverse(child => {
            if (child.isBone) {
                this.bones.push({ name: child.name, bone: child });
                this.boneMap.set(child.name, child);
                const { x, y, z } = child.position;
                const { x: qx, y: qy, z: qz, w } = child.quaternion;
                child.userData.initialLocalPosition = { x, y, z };
                child.userData.initialLocalQuaternion = { x: qx, y: qy, z: qz, w };
                initialBoneData[child.name] = {
                    position: child.userData.initialLocalPosition,
                    quaternion: child.userData.initialLocalQuaternion,
                };
            }
            if (child.isMesh) {
                child.castShadow = true;
                child.receiveShadow = true;
            }
        });
        this.bones.sort((a, b) => a.name.localeCompare(b.name));

        const box = new GlobalTHREE.Box3().setFromObject(object);
        if (box.isEmpty()) {
            // A skeleton-only FBX (including our export) has no mesh bounds.
            for (const { bone } of this.bones) box.expandByPoint(bone.getWorldPosition(new GlobalTHREE.Vector3()));
        }
        const size = box.getSize(new GlobalTHREE.Vector3());
        const maxDimension = Math.max(size.x, size.y, size.z);
        const scale = Number.isFinite(maxDimension) && maxDimension > 0 ? TARGET_MODEL_MAX_DIMENSION / maxDimension : 1;
        this.modelStage.scale.setScalar(scale);
        const center = box.getCenter(new GlobalTHREE.Vector3());
        if (!box.isEmpty()) this.modelStage.position.set(-center.x * scale, -box.min.y * scale, -center.z * scale);
        this.modelStage.updateMatrixWorld(true);

        this.createOrUpdateBoneMarkers();
        this.skeletonHelper = new GlobalTHREE.SkeletonHelper(object);
        this.scene.add(this.skeletonHelper);
        this.mixer = new GlobalTHREE.AnimationMixer(object);
        this.controls.target.set(0, size.y * scale / 2, 0);
        this.camera.position.copy(this.controls.target).add(new GlobalTHREE.Vector3(185, 135, 235));
        this.controls.update();
        return initialBoneData;
    }

    getBones() { return this.bones.map(b => ({ name: b.name })); }
    getBoneByName(boneName) { return this.boneMap.get(boneName); }

    setBoneTransform(boneName, position, quaternion) {
        const bone = this.getBoneByName(boneName);
        if (bone) {
            const isGizmoActiveOnThisBone = this.transformControls && 
                                            this.transformControls.object === bone && 
                                            this.transformControls.dragging;
            if (!isGizmoActiveOnThisBone) {
                if (position && typeof position.x === 'number' && typeof position.y === 'number' && typeof position.z === 'number') {
                     bone.position.set(position.x, position.y, position.z);
                }
                if (quaternion && typeof quaternion.x === 'number' && typeof quaternion.y === 'number' && typeof quaternion.z === 'number' && typeof quaternion.w === 'number') {
                     bone.quaternion.set(quaternion.x, quaternion.y, quaternion.z, quaternion.w);
                }
            }
        }
    }
    
    applyPoseFromData(poseData) {
        if (!this.model || !this.boneMap) return;
        let poseChanged = false;
        for (const boneName in poseData) {
            const bone = this.boneMap.get(boneName);
            const transform = poseData[boneName];
            if (bone && transform) {
                if (transform.position && 
                    typeof transform.position.x === 'number' && 
                    typeof transform.position.y === 'number' && 
                    typeof transform.position.z === 'number' ) {
                    const tempP = new GlobalTHREE.Vector3(transform.position.x, transform.position.y, transform.position.z);
                    if(!bone.position.equals(tempP)) { 
                        bone.position.copy(tempP);
                        poseChanged = true;
                    }
                }
                if (transform.quaternion && 
                    typeof transform.quaternion.x === 'number' &&
                    typeof transform.quaternion.y === 'number' &&
                    typeof transform.quaternion.z === 'number' &&
                    typeof transform.quaternion.w === 'number') {
                    const tempQ = new GlobalTHREE.Quaternion(transform.quaternion.x, transform.quaternion.y, transform.quaternion.z, transform.quaternion.w);
                    if(!bone.quaternion.equals(tempQ)) { 
                        bone.quaternion.copy(tempQ);
                        poseChanged = true;
                    }
                }
            }
        }
        if (poseChanged && this.model) {
            this.model.updateMatrixWorld(true);
        }
    }

    attachGizmo(boneName) {
        const bone = this.getBoneByName(boneName);
        if (bone && this.transformControls) {
            this.transformControls.attach(bone);
            this.transformControls.setMode('rotate'); 
            this.transformControls.setSpace('local');  
            this.transformControls.userData = { ...this.transformControls.userData, selectedBoneName: boneName }; 
            this.highlightSelectedBoneMarker(boneName);
        } else { this.detachGizmo(); }
    }
    detachGizmo() {
        if (this.transformControls) {
            this.transformControls.detach();
             if (this.transformControls.userData) delete this.transformControls.userData.selectedBoneName;
            this.highlightSelectedBoneMarker(null); 
        }
    }

    setOnBoneTransformChangeByGizmo(callback) { this.onBoneTransformChangeByGizmoCallback = callback; }

    playAnimationFromData(keyFramesData, duration, startTime) {
        if (!this.model || !this.mixer) return false;
        const tracks = createThreeAnimationTracks(keyFramesData, this, duration);
        if (!tracks.length) return false;
        this.stopAnimation();
        this.detachGizmo();
        const time = startTime < duration ? startTime : 0;
        this.applyPoseFromData(Object.fromEntries(
            this.bones.map(({ name }) => [name, this.getPoseAtTimeForBone(name, keyFramesData, time)]),
        ));
        const clip = new GlobalTHREE.AnimationClip('Timeline', duration, tracks);
        this.activeAction = this.mixer.clipAction(clip);
        this.activeAction.reset().play();
        this.mixer.setTime(time);
        this.clock.start();
        return true;
    }

    stopAnimation() {
        if (!this.activeAction) return;
        this.activeAction.stop();
        this.mixer.uncacheClip(this.activeAction.getClip());
        this.activeAction = null;
    }

    setOnTimeUpdate(callback) { this.onTimeUpdateCallback = callback; }

    getPoseAtTimeForBone(boneName, keyFramesData, time) {
        const data = this.getBoneByName(boneName)?.userData;
        return sampleSteppedPose(Object.hasOwn(keyFramesData, boneName) ? keyFramesData[boneName] : [], time, {
            position: data?.initialLocalPosition ?? { x: 0, y: 0, z: 0 },
            quaternion: data?.initialLocalQuaternion ?? { x: 0, y: 0, z: 0, w: 1 },
        });
    }

    animate() {
        this.animationFrameId = requestAnimationFrame(this.animate.bind(this));
        if (!this.renderer || !this.scene || !this.camera) return;

        const deltaTime = this.clock.getDelta();
        if (this.activeAction) {
            this.mixer.update(deltaTime);
            this.onTimeUpdateCallback?.(this.activeAction.time);
        }

        if (this.controls) {
            this.controls.update(); 
        }

        if (this.model && this.boneMarkersGroup.children.length > 0 && this.boneMarkersGroup.visible) {
             this.updateBoneMarkerPositions(); 
        }
        
        this.renderer.render(this.scene, this.camera);
    }

    cleanup() {
        if (this.animationFrameId) {
            cancelAnimationFrame(this.animationFrameId);
            this.animationFrameId = null;
        }
        this.resizeObserver?.disconnect();
        this.resizeObserver = null;
        if (this.onMouseClickBound && this.renderer && this.renderer.domElement) {
            this.renderer.domElement.removeEventListener('click', this.onMouseClickBound);
            this.onMouseClickBound = null;
        }
        
        this.clearModel(); 

        if (this.transformControls) {
            this.transformControls.dispose(); 
            if(this.scene && this.scene.children.includes(this.transformControls)) {
                this.scene.remove(this.transformControls); 
            }
            this.transformControls = null;
        }
        if (this.controls) { 
            this.controls.dispose();
            this.controls = null;
        }
        
        if (this.markerGeometry) this.markerGeometry.dispose();
        if (this.defaultMarkerMaterial) this.defaultMarkerMaterial.dispose();
        if (this.selectedMarkerMaterial) this.selectedMarkerMaterial.dispose();

        if (this.scene) {
            if(this.scene.children.includes(this.boneMarkersGroup)){
                 this.scene.remove(this.boneMarkersGroup);
            }
            const childrenToRemove = [...this.scene.children]; 
            childrenToRemove.forEach(child => {
                if (child !== this.model && child !== this.skeletonHelper && child !== this.transformControls && child !== this.boneMarkersGroup) { 
                    this.scene.remove(child);
                    if(child.geometry) child.geometry.dispose();
                    if(child.material) {
                        if(Array.isArray(child.material)){
                            child.material.forEach(m=>m?.dispose());
                        } else {
                            child.material?.dispose();
                        }
                    }
                }
            });
            this.scene = null; 
        }

        if (this.renderer) {
            this.renderer.dispose();
            if (this.renderer.domElement && this.renderer.domElement.parentElement) {
                 this.renderer.domElement.parentElement.removeChild(this.renderer.domElement);
            }
            this.renderer = null;
        }
        
        this.camera = null; 
    }
}

export default SceneManager;