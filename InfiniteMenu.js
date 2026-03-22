/**
 * InfiniteMenu.js
 * Adapted for Vanilla JS from React source provided by the user.
 * Requires gl-matrix.js library.
 */

const discVertShaderSource = `#version 300 es
uniform mat4 uWorldMatrix;
uniform mat4 uViewMatrix;
uniform mat4 uProjectionMatrix;
uniform vec3 uCameraPosition;
uniform vec4 uRotationAxisVelocity;

in vec3 aModelPosition;
in vec3 aModelNormal;
in vec2 aModelUvs;
in mat4 aInstanceMatrix;

out vec2 vUvs;
out float vAlpha;
flat out int vInstanceId;

#define PI 3.141593

void main() {
    vec4 worldPosition = uWorldMatrix * aInstanceMatrix * vec4(aModelPosition, 1.);
    vec3 centerPos = (uWorldMatrix * aInstanceMatrix * vec4(0., 0., 0., 1.)).xyz;
    float radius = length(centerPos.xyz);

    if (gl_VertexID > 0) {
        vec3 rotationAxis = uRotationAxisVelocity.xyz;
        float rotationVelocity = min(.15, uRotationAxisVelocity.w * 15.);
        vec3 stretchDir = normalize(cross(centerPos, rotationAxis));
        vec3 relativeVertexPos = normalize(worldPosition.xyz - centerPos);
        float strength = dot(stretchDir, relativeVertexPos);
        float invAbsStrength = min(0., abs(strength) - 1.);
        strength = rotationVelocity * sign(strength) * abs(invAbsStrength * invAbsStrength * invAbsStrength + 1.);
        worldPosition.xyz += stretchDir * strength;
    }

    worldPosition.xyz = radius * normalize(worldPosition.xyz);
    gl_Position = uProjectionMatrix * uViewMatrix * worldPosition;

    vAlpha = smoothstep(0.5, 1., normalize(worldPosition.xyz).z) * .9 + .1;
    vUvs = aModelUvs;
    vInstanceId = gl_InstanceID;
}
`;

const discFragShaderSource = `#version 300 es
precision highp float;
uniform sampler2D uTex;
uniform int uItemCount;
uniform int uAtlasSize;
out vec4 outColor;
in vec2 vUvs;
in float vAlpha;
flat in int vInstanceId;

void main() {
    int itemIndex = vInstanceId % uItemCount;
    int cellsPerRow = uAtlasSize;
    int cellX = itemIndex % cellsPerRow;
    int cellY = itemIndex / cellsPerRow;
    vec2 cellSize = vec2(1.0) / vec2(float(cellsPerRow));
    vec2 cellOffset = vec2(float(cellX), float(cellY)) * cellSize;

    ivec2 texSize = textureSize(uTex, 0);
    float imageAspect = float(texSize.x) / float(texSize.y);
    float containerAspect = 1.0;
    float scale = max(imageAspect / containerAspect, containerAspect / imageAspect);
    
    vec2 st = vec2(vUvs.x, 1.0 - vUvs.y);
    st = (st - 0.5) * scale + 0.5;
    st = clamp(st, 0.0, 1.0);
    st = st * cellSize + cellOffset;
    
    outColor = texture(uTex, st);
    outColor.a *= vAlpha;
}
`;

// Math utilities - robust extraction for gl-matrix CDN
const mat4 = window.mat4 || (window.glMatrix && window.glMatrix.mat4);
const vec2 = window.vec2 || (window.glMatrix && window.glMatrix.vec2);
const vec3 = window.vec3 || (window.glMatrix && window.glMatrix.vec3);
const quat = window.quat || (window.glMatrix && window.glMatrix.quat);

if (!mat4 || !vec3) {
    console.error("gl-matrix components not found in window or window.glMatrix. Make sure gl-matrix is loaded.");
}

class Face {
    constructor(a, b, c) { this.a = a; this.b = b; this.c = c; }
}

class Vertex {
    constructor(x, y, z) {
        this.position = vec3.fromValues(x, y, z);
        this.normal = vec3.create();
        this.uv = vec2.create();
    }
}

class Geometry {
    constructor() {
        this.vertices = [];
        this.faces = [];
    }

    addVertex(...args) {
        for (let i = 0; i < args.length; i += 3) {
            this.vertices.push(new Vertex(args[i], args[i + 1], args[i + 2]));
        }
        return this;
    }

    addFace(...args) {
        for (let i = 0; i < args.length; i += 3) {
            this.faces.push(new Face(args[i], args[i + 1], args[i + 2]));
        }
        return this;
    }

    get lastVertex() { return this.vertices[this.vertices.length - 1]; }

    subdivide(divisions = 1) {
        const midPointCache = {};
        let f = this.faces;
        for (let div = 0; div < divisions; ++div) {
            const newFaces = new Array(f.length * 4);
            f.forEach((face, ndx) => {
                const mAB = this.getMidPoint(face.a, face.b, midPointCache);
                const mBC = this.getMidPoint(face.b, face.c, midPointCache);
                const mCA = this.getMidPoint(face.c, face.a, midPointCache);
                const i = ndx * 4;
                newFaces[i + 0] = new Face(face.a, mAB, mCA);
                newFaces[i + 1] = new Face(face.b, mBC, mAB);
                newFaces[i + 2] = new Face(face.c, mCA, mBC);
                newFaces[i + 3] = new Face(mAB, mBC, mCA);
            });
            f = newFaces;
        }
        this.faces = f;
        return this;
    }

    spherize(radius = 1) {
        this.vertices.forEach(vertex => {
            vec3.normalize(vertex.normal, vertex.position);
            vec3.scale(vertex.position, vertex.normal, radius);
        });
        return this;
    }

    get data() {
        return {
            vertices: new Float32Array(this.vertices.flatMap(v => Array.from(v.position))),
            indices: new Uint16Array(this.faces.flatMap(f => [f.a, f.b, f.c])),
            uvs: new Float32Array(this.vertices.flatMap(v => Array.from(v.uv)))
        };
    }

    getMidPoint(ndxA, ndxB, cache) {
        const cacheKey = ndxA < ndxB ? `k_${ndxB}_${ndxA}` : `k_${ndxA}_${ndxB}`;
        if (Object.prototype.hasOwnProperty.call(cache, cacheKey)) return cache[cacheKey];
        const a = this.vertices[ndxA].position;
        const b = this.vertices[ndxB].position;
        const ndx = this.vertices.length;
        cache[cacheKey] = ndx;
        this.addVertex((a[0] + b[0]) * 0.5, (a[1] + b[1]) * 0.5, (a[2] + b[2]) * 0.5);
        return ndx;
    }
}

class IcosahedronGeometry extends Geometry {
    constructor() {
        super();
        const t = Math.sqrt(5) * 0.5 + 0.5;
        this.addVertex(-1, t, 0, 1, t, 0, -1, -t, 0, 1, -t, 0, 0, -1, t, 0, 1, t, 0, -1, -t, 0, 1, -t, t, 0, -1, t, 0, 1, -t, 0, -1, -t, 0, 1)
            .addFace(0, 11, 5, 0, 5, 1, 0, 1, 7, 0, 7, 10, 0, 10, 11, 1, 5, 9, 5, 11, 4, 11, 10, 2, 10, 7, 6, 7, 1, 8, 3, 9, 4, 3, 4, 2, 3, 2, 6, 3, 6, 8, 3, 8, 9, 4, 9, 5, 2, 4, 11, 6, 2, 10, 8, 6, 7, 9, 8, 1);
    }
}

class DiscGeometry extends Geometry {
    constructor(steps = 4, radius = 1) {
        super();
        steps = Math.max(4, steps);
        const alpha = (2 * Math.PI) / steps;
        this.addVertex(0, 0, 0);
        this.lastVertex.uv[0] = 0.5;
        this.lastVertex.uv[1] = 0.5;
        for (let i = 0; i < steps; ++i) {
            const x = Math.cos(alpha * i);
            const y = Math.sin(alpha * i);
            this.addVertex(radius * x, radius * y, 0);
            this.lastVertex.uv[0] = x * 0.5 + 0.5;
            this.lastVertex.uv[1] = y * 0.5 + 0.5;
            if (i > 0) this.addFace(0, i, i + 1);
        }
        this.addFace(0, steps, 1);
    }
}

function createShader(gl, type, source) {
    const shader = gl.createShader(type);
    gl.shaderSource(shader, source);
    gl.compileShader(shader);
    if (gl.getShaderParameter(shader, gl.COMPILE_STATUS)) return shader;
    console.error(gl.getShaderInfoLog(shader));
    gl.deleteShader(shader);
    return null;
}

function createProgram(gl, shaderSources, attribLocations) {
    const program = gl.createProgram();
    const vs = createShader(gl, gl.VERTEX_SHADER, shaderSources[0]);
    const fs = createShader(gl, gl.FRAGMENT_SHADER, shaderSources[1]);
    if (vs) gl.attachShader(program, vs);
    if (fs) gl.attachShader(program, fs);
    if (attribLocations) {
        for (const attrib in attribLocations) gl.bindAttribLocation(program, attribLocations[attrib], attrib);
    }
    gl.linkProgram(program);
    if (gl.getProgramParameter(program, gl.LINK_STATUS)) return program;
    console.error(gl.getProgramInfoLog(program));
    gl.deleteProgram(program);
    return null;
}

function makeVertexArray(gl, bufLocNumElmPairs, indices) {
    const va = gl.createVertexArray();
    gl.bindVertexArray(va);
    for (const [buffer, loc, numElem] of bufLocNumElmPairs) {
        if (loc === -1) continue;
        gl.bindBuffer(gl.ARRAY_BUFFER, buffer);
        gl.enableVertexAttribArray(loc);
        gl.vertexAttribPointer(loc, numElem, gl.FLOAT, false, 0, 0);
    }
    if (indices) {
        const indexBuffer = gl.createBuffer();
        gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, indexBuffer);
        gl.bufferData(gl.ELEMENT_ARRAY_BUFFER, indices, gl.STATIC_DRAW);
    }
    gl.bindVertexArray(null);
    return va;
}

function resizeCanvasToDisplaySize(canvas) {
    const dpr = Math.min(2, window.devicePixelRatio);
    const displayWidth = Math.round(canvas.clientWidth * dpr);
    const displayHeight = Math.round(canvas.clientHeight * dpr);
    const needResize = canvas.width !== displayWidth || canvas.height !== displayHeight;
    if (needResize) {
        canvas.width = displayWidth;
        canvas.height = displayHeight;
    }
    return needResize;
}

function makeBuffer(gl, data, usage) {
    const buf = gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER, buf);
    gl.bufferData(gl.ARRAY_BUFFER, data, usage);
    gl.bindBuffer(gl.ARRAY_BUFFER, null);
    return buf;
}

class ArcballControl {
    constructor(canvas, updateCallback) {
        this.canvas = canvas;
        this.updateCallback = updateCallback || (() => null);
        this.isPointerDown = false;
        this.orientation = quat.create();
        this.pointerRotation = quat.create();
        this.rotationVelocity = 0;
        this.rotationAxis = vec3.fromValues(1, 0, 0);
        this.snapDirection = vec3.fromValues(0, 0, -1);
        this.snapTargetDirection = null;
        this.EPSILON = 0.1;
        this.IDENTITY_QUAT = quat.create();
        this.pointerPos = vec2.create();
        this.previousPointerPos = vec2.create();
        this._rotationVelocity = 0;
        this._combinedQuat = quat.create();

        canvas.addEventListener('pointerdown', e => {
            vec2.set(this.pointerPos, e.clientX, e.clientY);
            vec2.copy(this.previousPointerPos, this.pointerPos);
            this.isPointerDown = true;
        });
        window.addEventListener('pointerup', () => this.isPointerDown = false);
        canvas.addEventListener('pointermove', e => {
            if (this.isPointerDown) vec2.set(this.pointerPos, e.clientX, e.clientY);
        });
        canvas.style.touchAction = 'none';
    }

    update(deltaTime, targetFrameDuration = 16) {
        const timeScale = deltaTime / targetFrameDuration + 0.00001;
        let angleFactor = timeScale;
        let snapRotation = quat.create();

        if (this.isPointerDown) {
            const INTENSITY = 0.3 * timeScale;
            const ANGLE_AMPLIFICATION = 5 / timeScale;
            const midPointerPos = vec2.sub(vec2.create(), this.pointerPos, this.previousPointerPos);
            vec2.scale(midPointerPos, midPointerPos, INTENSITY);
            if (vec2.sqrLen(midPointerPos) > this.EPSILON) {
                vec2.add(midPointerPos, this.previousPointerPos, midPointerPos);
                const p = this.#project(midPointerPos);
                const q = this.#project(this.previousPointerPos);
                const a = vec3.normalize(vec3.create(), p);
                const b = vec3.normalize(vec3.create(), q);
                vec2.copy(this.previousPointerPos, midPointerPos);
                angleFactor *= ANGLE_AMPLIFICATION;
                this.quatFromVectors(a, b, this.pointerRotation, angleFactor);
            } else {
                quat.slerp(this.pointerRotation, this.pointerRotation, this.IDENTITY_QUAT, INTENSITY);
            }
        } else {
            const INTENSITY = 0.1 * timeScale;
            quat.slerp(this.pointerRotation, this.pointerRotation, this.IDENTITY_QUAT, INTENSITY);
            if (this.snapTargetDirection) {
                const SNAPPING_INTENSITY = 0.2;
                const a = this.snapTargetDirection;
                const b = this.snapDirection;
                const sqrDist = vec3.squaredDistance(a, b);
                const distanceFactor = Math.max(0.1, 1 - sqrDist * 10);
                angleFactor *= SNAPPING_INTENSITY * distanceFactor;
                this.quatFromVectors(a, b, snapRotation, angleFactor);
            }
        }

        const combinedQuat = quat.multiply(quat.create(), snapRotation, this.pointerRotation);
        this.orientation = quat.multiply(quat.create(), combinedQuat, this.orientation);
        quat.normalize(this.orientation, this.orientation);
        quat.slerp(this._combinedQuat, this._combinedQuat, combinedQuat, 0.8 * timeScale);
        quat.normalize(this._combinedQuat, this._combinedQuat);

        const rad = Math.acos(this._combinedQuat[3]) * 2.0;
        const s = Math.sin(rad / 2.0);
        let rv = 0;
        if (s > 0.000001) {
            rv = rad / (2 * Math.PI);
            this.rotationAxis[0] = this._combinedQuat[0] / s;
            this.rotationAxis[1] = this._combinedQuat[1] / s;
            this.rotationAxis[2] = this._combinedQuat[2] / s;
        }
        this._rotationVelocity += (rv - this._rotationVelocity) * 0.5 * timeScale;
        this.rotationVelocity = this._rotationVelocity / timeScale;
        this.updateCallback(deltaTime);
    }

    quatFromVectors(a, b, out, angleFactor = 1) {
        const axis = vec3.cross(vec3.create(), a, b);
        vec3.normalize(axis, axis);
        const d = Math.max(-1, Math.min(1, vec3.dot(a, b)));
        const angle = Math.acos(d) * angleFactor;
        quat.setAxisAngle(out, axis, angle);
    }

    #project(pos) {
        const r = 2;
        const w = this.canvas.clientWidth;
        const h = this.canvas.clientHeight;
        const s = Math.max(w, h) - 1;
        const x = (2 * pos[0] - w - 1) / s;
        const y = (2 * pos[1] - h - 1) / s;
        let z = 0;
        const xySq = x * x + y * y;
        const rSq = r * r;
        z = xySq <= rSq / 2.0 ? Math.sqrt(rSq - xySq) : rSq / Math.sqrt(xySq);
        return vec3.fromValues(-x, y, z);
    }
}

class InfiniteGridMenu {
    constructor(canvas, items, options = {}) {
        this.canvas = canvas;
        this.items = items || [];
        this.onActiveItemChange = options.onActiveItemChange || (() => {});
        this.onMovementChange = options.onMovementChange || (() => {});
        this.scaleFactor = options.scale || 1.0;
        this.SPHERE_RADIUS = 4.0;
        this.TARGET_FRAME_DURATION = 1000 / 60;
        
        this.#time = 0;
        this.#frames = 0;
        this.movementActive = false;
        
        this.camera = {
            matrix: mat4.create(),
            near: 0.1, far: 50, fov: Math.PI / 2.5, aspect: 1, 
            position: vec3.fromValues(0, 0, 5 * this.scaleFactor), // Moved closer
            up: vec3.fromValues(0, 1, 0),
            matrices: { view: mat4.create(), projection: mat4.create() }
        };

        this.mouse = { x: 0, y: 0, targetX: 0, targetY: 0 };

        this.#init();
    }

    #time; #frames;

    #init() {
        this.gl = this.canvas.getContext('webgl2', { antialias: true, alpha: true });
        const gl = this.gl;
        this.discProgram = createProgram(gl, [discVertShaderSource, discFragShaderSource], {
            aModelPosition: 0, aModelNormal: 1, aModelUvs: 2, aInstanceMatrix: 3
        });
        this.discLocations = {
            aModelPosition: gl.getAttribLocation(this.discProgram, 'aModelPosition'),
            aModelUvs: gl.getAttribLocation(this.discProgram, 'aModelUvs'),
            aInstanceMatrix: gl.getAttribLocation(this.discProgram, 'aInstanceMatrix'),
            uWorldMatrix: gl.getUniformLocation(this.discProgram, 'uWorldMatrix'),
            uViewMatrix: gl.getUniformLocation(this.discProgram, 'uViewMatrix'),
            uProjectionMatrix: gl.getUniformLocation(this.discProgram, 'uProjectionMatrix'),
            uRotationAxisVelocity: gl.getUniformLocation(this.discProgram, 'uRotationAxisVelocity'),
            uTex: gl.getUniformLocation(this.discProgram, 'uTex'),
            uItemCount: gl.getUniformLocation(this.discProgram, 'uItemCount'),
            uAtlasSize: gl.getUniformLocation(this.discProgram, 'uAtlasSize')
        };

        const discGeo = new DiscGeometry(56, 1);
        const discData = discGeo.data;
        this.discVAO = makeVertexArray(gl, [
            [makeBuffer(gl, discData.vertices, gl.STATIC_DRAW), this.discLocations.aModelPosition, 3],
            [makeBuffer(gl, discData.uvs, gl.STATIC_DRAW), this.discLocations.aModelUvs, 2]
        ], discData.indices);
        this.discIndicesLength = discData.indices.length;

        const icoGeo = new IcosahedronGeometry();
        icoGeo.subdivide(1).spherize(this.SPHERE_RADIUS);
        this.instancePositions = icoGeo.vertices.map(v => v.position);
        this.DISC_INSTANCE_COUNT = this.instancePositions.length;

        this.#initInstances(gl);
        this.#initTexture(gl);
        this.control = new ArcballControl(this.canvas, dt => this.#onControlUpdate(dt));
        
        // Mouse reactivity
        this.canvas.addEventListener('mousemove', e => {
            const rect = this.canvas.getBoundingClientRect();
            this.mouse.targetX = ((e.clientX - rect.left) / rect.width) * 2 - 1;
            this.mouse.targetY = -((e.clientY - rect.top) / rect.height) * 2 + 1;
        });

        this.worldMatrix = mat4.create();
        this.resize();
    }

    #initInstances(gl) {
        this.discInstances = {
            matricesArray: new Float32Array(this.DISC_INSTANCE_COUNT * 16),
            matrices: [],
            buffer: gl.createBuffer()
        };
        for (let i = 0; i < this.DISC_INSTANCE_COUNT; i++) {
            this.discInstances.matrices.push(new Float32Array(this.discInstances.matricesArray.buffer, i * 16 * 4, 16));
        }
        gl.bindVertexArray(this.discVAO);
        gl.bindBuffer(gl.ARRAY_BUFFER, this.discInstances.buffer);
        gl.bufferData(gl.ARRAY_BUFFER, this.discInstances.matricesArray.byteLength, gl.DYNAMIC_DRAW);
        for (let j = 0; j < 4; j++) {
            const loc = this.discLocations.aInstanceMatrix + j;
            gl.enableVertexAttribArray(loc);
            gl.vertexAttribPointer(loc, 4, gl.FLOAT, false, 64, j * 16);
            gl.vertexAttribDivisor(loc, 1);
        }
        gl.bindVertexArray(null);
    }

    #initTexture(gl) {
        this.tex = gl.createTexture();
        gl.bindTexture(gl.TEXTURE_2D, this.tex);
        const itemCount = Math.max(1, this.items.length);
        this.atlasSize = Math.ceil(Math.sqrt(itemCount));
        const atlasCanvas = document.createElement('canvas');
        const ctx = atlasCanvas.getContext('2d');
        const cellSize = 512;
        atlasCanvas.width = atlasCanvas.height = this.atlasSize * cellSize;

        // Draw benefits text on each cell of the atlas
        this.items.forEach((item, i) => {
            const x = (i % this.atlasSize) * cellSize;
            const y = Math.floor(i / this.atlasSize) * cellSize;

            // Background
            ctx.fillStyle = 'rgba(255, 255, 255, 0.9)';
            ctx.fillRect(x, y, cellSize, cellSize);

            // Circle border
            ctx.strokeStyle = '#000';
            ctx.lineWidth = 20;
            ctx.beginPath();
            ctx.arc(x + cellSize/2, y + cellSize/2, cellSize/2 - 20, 0, Math.PI * 2);
            ctx.stroke();

            // Text configuration
            ctx.fillStyle = 'black';
            ctx.textAlign = 'center';
            ctx.textBaseline = 'middle';
            
            const words = (item.title || "BENEFICIO").split(' ');
            let fontSize = 70;
            if (words.length > 3) fontSize = 50;
            ctx.font = `bold ${fontSize}px sans-serif`;

            const lineHeight = fontSize * 1.2;
            let currentY = y + cellSize / 2 - ((words.length - 1) * lineHeight) / 2;
            
            words.forEach(word => {
                ctx.fillText(word.toUpperCase(), x + cellSize / 2, currentY);
                currentY += lineHeight;
            });
        });

        gl.bindTexture(gl.TEXTURE_2D, this.tex);
        gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, atlasCanvas);
        gl.generateMipmap(gl.TEXTURE_2D);
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR_MIPMAP_LINEAR);
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
    }

    resize() {
        const gl = this.gl;
        if (resizeCanvasToDisplaySize(gl.canvas)) {
            gl.viewport(0, 0, gl.drawingBufferWidth, gl.drawingBufferHeight);
            this.#updateProjectionMatrix();
        }
    }

    #updateProjectionMatrix() {
        const gl = this.gl;
        this.camera.aspect = gl.canvas.clientWidth / gl.canvas.clientHeight;
        mat4.perspective(this.camera.matrices.projection, this.camera.fov, this.camera.aspect, this.camera.near, this.camera.far);
    }

    #onControlUpdate(dt) {
        const timeScale = dt / this.TARGET_FRAME_DURATION + 0.0001;
        let cameraTargetZ = 3 * this.scaleFactor;
        const isMoving = this.control.isPointerDown || Math.abs(this.control.rotationVelocity) > 0.01;
        if (isMoving !== this.movementActive) {
            this.movementActive = isMoving;
            this.onMovementChange(isMoving);
        }
        if (!this.control.isPointerDown) {
            const nearest = this.#findNearest();
            this.onActiveItemChange(nearest % this.items.length);
            this.control.snapTargetDirection = vec3.normalize(vec3.create(), vec3.transformQuat(vec3.create(), this.instancePositions[nearest], this.control.orientation));
        } else {
            cameraTargetZ += this.control.rotationVelocity * 80 + 2.5;
        }
        this.camera.position[2] += (cameraTargetZ - this.camera.position[2]) / (this.control.isPointerDown ? 7 / timeScale : 5 / timeScale);
        mat4.targetTo(this.camera.matrix, this.camera.position, [0, 0, 0], this.camera.up);
        mat4.invert(this.camera.matrices.view, this.camera.matrix);
    }

    #findNearest() {
        const nt = vec3.transformQuat(vec3.create(), this.control.snapDirection, quat.conjugate(quat.create(), this.control.orientation));
        let maxD = -1, nearest = 0;
        this.instancePositions.forEach((p, i) => {
            const d = vec3.dot(nt, p);
            if (d > maxD) { maxD = d; nearest = i; }
        });
        return nearest;
    }

    run(time = 0) {
        const dt = Math.min(32, time - this.#time);
        this.#time = time;
        this.control.update(dt, this.TARGET_FRAME_DURATION);
        
        const gl = this.gl;
        const scale = 0.65; // Massive scale to cover the section
        
        // Smoothen mouse movement
        this.mouse.x += (this.mouse.targetX - this.mouse.x) * 0.08;
        this.mouse.y += (this.mouse.targetY - this.mouse.y) * 0.08;

        // Apply mouse tilt to world matrix with heavy intensity
        mat4.identity(this.worldMatrix);
        mat4.rotateY(this.worldMatrix, this.worldMatrix, this.mouse.x * 1.5);
        mat4.rotateX(this.worldMatrix, this.worldMatrix, -this.mouse.y * 1.5);

        // Constant environmental rotation
        const autoRot = time * 0.0002;
        mat4.rotateY(this.worldMatrix, this.worldMatrix, autoRot);

        this.instancePositions.forEach((p, i) => {
            const wp = vec3.transformQuat(vec3.create(), p, this.control.orientation);
            const s = (Math.abs(wp[2]) / this.SPHERE_RADIUS) * 0.6 + 0.4;
            const matrix = mat4.create();
            mat4.targetTo(matrix, [0,0,0], wp, [0,1,0]);
            mat4.scale(matrix, matrix, [s * scale, s * scale, s * scale]);
            mat4.translate(matrix, matrix, [0, 0, -this.SPHERE_RADIUS]);
            mat4.copy(this.discInstances.matrices[i], matrix);
        });
        gl.bindBuffer(gl.ARRAY_BUFFER, this.discInstances.buffer);
        gl.bufferSubData(gl.ARRAY_BUFFER, 0, this.discInstances.matricesArray);

        gl.useProgram(this.discProgram);
        gl.enable(gl.CULL_FACE); gl.enable(gl.DEPTH_TEST);
        gl.clearColor(0,0,0,0); gl.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT);

        gl.uniformMatrix4fv(this.discLocations.uWorldMatrix, false, this.worldMatrix);
        gl.uniformMatrix4fv(this.discLocations.uViewMatrix, false, this.camera.matrices.view);
        gl.uniformMatrix4fv(this.discLocations.uProjectionMatrix, false, this.camera.matrices.projection);
        gl.uniform4f(this.discLocations.uRotationAxisVelocity, this.control.rotationAxis[0], this.control.rotationAxis[1], this.control.rotationAxis[2], this.control.rotationVelocity * 1.1);
        gl.uniform1i(this.discLocations.uItemCount, this.items.length);
        gl.uniform1i(this.discLocations.uAtlasSize, this.atlasSize);
        gl.activeTexture(gl.TEXTURE0); gl.bindTexture(gl.TEXTURE_2D, this.tex);

        gl.bindVertexArray(this.discVAO);
        gl.drawElementsInstanced(gl.TRIANGLES, this.discIndicesLength, gl.UNSIGNED_SHORT, 0, this.DISC_INSTANCE_COUNT);

        requestAnimationFrame(t => this.run(t));
    }
}

window.InfiniteGridMenu = InfiniteGridMenu;
