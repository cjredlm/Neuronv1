/**
 * Circular Gallery OGL Implementation (Robust UMD Version)
 */

(function() {
    function debounce(func, wait) {
        let timeout;
        return function (...args) {
            clearTimeout(timeout);
            timeout = setTimeout(() => func.apply(this, args), wait);
        };
    }

    function lerp(p1, p2, t) {
        return p1 + (p2 - p1) * t;
    }

    function autoBind(instance) {
        const proto = Object.getPrototypeOf(instance);
        Object.getOwnPropertyNames(proto).forEach(key => {
            if (key !== 'constructor' && typeof instance[key] === 'function') {
                instance[key] = instance[key].bind(instance);
            }
        });
    }

    function createTextTexture(gl, text, font = 'bold 30px sans-serif', color = 'white', ogl) {
        const canvas = document.createElement('canvas');
        const context = canvas.getContext('2d');
        context.font = font;
        const metrics = context.measureText(text);
        const textWidth = Math.ceil(metrics.width);
        const textHeight = Math.ceil(parseInt(font, 10) * 1.5);
        canvas.width = textWidth + 40;
        canvas.height = textHeight + 40;
        context.font = font;
        context.fillStyle = color;
        context.textBaseline = 'middle';
        context.textAlign = 'center';
        context.clearRect(0, 0, canvas.width, canvas.height);
        
        context.shadowColor = 'rgba(0,0,0,0.8)';
        context.shadowBlur = 10;
        context.fillText(text, canvas.width / 2, canvas.height / 2);
        
        const texture = new ogl.Texture(gl, { generateMipmaps: false });
        texture.image = canvas;
        return { texture, width: canvas.width, height: canvas.height };
    }

    class Title {
        constructor({ ogl, gl, plane, renderer, text, textColor = '#ffffff', font = 'bold 30px sans-serif' }) {
            autoBind(this);
            this.ogl = ogl;
            this.gl = gl;
            this.plane = plane;
            this.renderer = renderer;
            this.text = text;
            this.textColor = textColor;
            this.font = font;
            this.createMesh();
        }
        createMesh() {
            const { texture, width, height } = createTextTexture(this.gl, this.text, this.font, this.textColor, this.ogl);
            const geometry = new this.ogl.Plane(this.gl);
            const program = new this.ogl.Program(this.gl, {
                vertex: `
                    attribute vec3 position;
                    attribute vec2 uv;
                    uniform mat4 modelViewMatrix;
                    uniform mat4 projectionMatrix;
                    varying vec2 vUv;
                    void main() {
                        vUv = uv;
                        gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
                    }
                `,
                fragment: `
                    precision highp float;
                    uniform sampler2D tMap;
                    varying vec2 vUv;
                    void main() {
                        vec4 color = texture2D(tMap, vUv);
                        if (color.a < 0.05) color = vec4(1.0, 1.0, 1.0, 1.0);
                        gl_FragColor = color;
                    }
                `,
                uniforms: { tMap: { value: texture } },
                transparent: true
            });
            this.mesh = new this.ogl.Mesh(this.gl, { geometry, program });
            const aspect = width / height;
            const textHeight = this.plane.scale.y * 0.15;
            const textWidth = textHeight * aspect;
            this.mesh.scale.set(textWidth, textHeight, 1);
            this.mesh.position.y = -this.plane.scale.y * 0.5 - textHeight * 0.5 - 0.2;
            this.mesh.setParent(this.plane);
        }
    }

    class Media {
        constructor({
            ogl,
            geometry,
            gl,
            image,
            index,
            length,
            renderer,
            scene,
            screen,
            text,
            viewport,
            bend,
            textColor,
            borderRadius = 0,
            font
        }) {
            this.ogl = ogl;
            this.extra = 0;
            this.geometry = geometry;
            this.gl = gl;
            this.image = image;
            this.index = index;
            this.length = length;
            this.renderer = renderer;
            this.scene = scene;
            this.screen = screen;
            this.text = text;
            this.viewport = viewport;
            this.bend = bend;
            this.textColor = textColor;
            this.borderRadius = borderRadius;
            this.font = font;
            this.createShader();
            this.createMesh();
            this.createTitle();
            this.onResize();
        }
        createShader() {
            const texture = new this.ogl.Texture(this.gl, {
                generateMipmaps: true
            });
            this.program = new this.ogl.Program(this.gl, {
                depthTest: false,
                depthWrite: false,
                vertex: `
                    precision highp float;
                    attribute vec3 position;
                    attribute vec2 uv;
                    uniform mat4 modelViewMatrix;
                    uniform mat4 projectionMatrix;
                    uniform float uTime;
                    uniform float uSpeed;
                    varying vec2 vUv;
                    void main() {
                        vUv = uv;
                        vec3 p = position;
                        p.z = (sin(p.x * 4.0 + uTime) * 1.5 + cos(p.y * 2.0 + uTime) * 1.5) * (0.1 + uSpeed * 0.5);
                        gl_Position = projectionMatrix * modelViewMatrix * vec4(p, 1.0);
                    }
                `,
                fragment: `
                    precision highp float;
                    uniform vec2 uImageSizes;
                    uniform vec2 uPlaneSizes;
                    uniform sampler2D tMap;
                    uniform float uBorderRadius;
                    varying vec2 vUv;
                    
                    float roundedBoxSDF(vec2 p, vec2 b, float r) {
                        vec2 d = abs(p) - b;
                        return length(max(d, vec2(0.0))) + min(max(d.x, d.y), 0.0) - r;
                    }
                    
                    void main() {
                        vec2 ratio = vec2(
                            min((uPlaneSizes.x / uPlaneSizes.y) / (uImageSizes.x / uImageSizes.y), 1.0),
                            min((uPlaneSizes.y / uPlaneSizes.x) / (uImageSizes.y / uImageSizes.x), 1.0)
                        );
                        vec2 uv = vec2(
                            vUv.x * ratio.x + (1.0 - ratio.x) * 0.5,
                            vUv.y * ratio.y + (1.0 - ratio.y) * 0.5
                        );
                        vec4 color = texture2D(tMap, uv);
                        // Fallback color if texture is missing/transparent
                        if(color.a < 0.05) color = vec4(0.5, 0.2, 0.8, 1.0); 
                        
                        float d = roundedBoxSDF(vUv - 0.5, vec2(0.5 - uBorderRadius), uBorderRadius);
                        float alpha = 1.0 - smoothstep(-0.002, 0.002, d);
                        gl_FragColor = vec4(color.rgb, alpha);
                    }
                `,
                uniforms: {
                    tMap: { value: texture },
                    uPlaneSizes: { value: [0, 0] },
                    uImageSizes: { value: [0, 0] },
                    uSpeed: { value: 0 },
                    uTime: { value: 100 * Math.random() },
                    uBorderRadius: { value: this.borderRadius }
                },
                transparent: true
            });
            const img = new Image();
            img.src = this.image;
            img.onload = () => {
                texture.image = img;
                this.program.uniforms.uImageSizes.value = [img.naturalWidth, img.naturalHeight];
            };
            img.onerror = () => {
                console.error("Error loading gallery image:", this.image);
            };
        }
        createMesh() {
            this.plane = new this.ogl.Mesh(this.gl, {
                geometry: this.geometry,
                program: this.program
            });
            this.plane.setParent(this.scene);
        }
        createTitle() {
            this.title = new Title({
                ogl: this.ogl,
                gl: this.gl,
                plane: this.plane,
                renderer: this.renderer,
                text: this.text,
                textColor: this.textColor,
                font: this.font
            });
        }
        update(scroll, direction) {
            this.plane.position.x = this.x - scroll.current - this.extra;

            const x = this.plane.position.x;
            const H = this.viewport.width / 2;

            if (this.bend === 0) {
                this.plane.position.y = 0;
                this.plane.rotation.z = 0;
            } else {
                const B_abs = Math.abs(this.bend);
                const R = (H * H + B_abs * B_abs) / (2 * B_abs);
                const effectiveX = Math.min(Math.abs(x), H);
                const arc = R - Math.sqrt(R * R - effectiveX * effectiveX);
                if (this.bend > 0) {
                    this.plane.position.y = -arc;
                    this.plane.rotation.z = -Math.sign(x) * Math.asin(effectiveX / R);
                } else {
                    this.plane.position.y = arc;
                    this.plane.rotation.z = Math.sign(x) * Math.asin(effectiveX / R);
                }
            }

            this.speed = scroll.current - scroll.last;
            this.program.uniforms.uTime.value += 0.04;
            this.program.uniforms.uSpeed.value = this.speed || 0;

            const planeOffset = this.plane.scale.x / 2;
            const viewportOffset = this.viewport.width / 2;
            this.isBefore = this.plane.position.x + planeOffset < -viewportOffset;
            this.isAfter = this.plane.position.x - planeOffset > viewportOffset;
            if (direction === 'right' && this.isBefore) {
                this.extra -= this.widthTotal;
                this.isBefore = this.isAfter = false;
            }
            if (direction === 'left' && this.isAfter) {
                this.extra += this.widthTotal;
                this.isBefore = this.isAfter = false;
            }
        }
        onResize({ screen, viewport } = {}) {
            if (screen) this.screen = screen;
            if (viewport) {
                this.viewport = viewport;
                if (this.plane.program.uniforms.uViewportSizes) {
                    this.plane.program.uniforms.uViewportSizes.value = [this.viewport.width, this.viewport.height];
                }
            }
            this.scale = this.screen.height / 1500;
            this.plane.scale.y = (this.viewport.height * (900 * this.scale)) / this.screen.height;
            this.plane.scale.x = (this.viewport.width * (700 * this.scale)) / this.screen.width;
            this.plane.program.uniforms.uPlaneSizes.value = [this.plane.scale.x, this.plane.scale.y];
            this.padding = 2;
            this.width = this.plane.scale.x + this.padding;
            this.widthTotal = this.width * this.length;
            this.x = this.width * this.index;
        }
    }

    class CircularGallery {
        constructor(
            container,
            {
                items,
                bend = 1.0,
                textColor = '#ffffff',
                borderRadius = 0.05,
                font = 'bold 30px sans-serif',
                scrollSpeed = 2,
                scrollEase = 0.05
            } = {}
        ) {
            console.log("Intentando inicializar Galería Circular...");
            const OGL_LIB = window.ogl || window.OGL;
            if (!OGL_LIB) {
                console.error("Librería OGL no detectada en window. Reintentando...");
                setTimeout(() => new CircularGallery(container, {items, bend, textColor, borderRadius, font, scrollSpeed, scrollEase}), 500);
                return;
            }
            this.ogl = OGL_LIB;
            this.container = container;
            this.scrollSpeed = scrollSpeed;
            this.scroll = { ease: scrollEase, current: 0, target: 0, last: 0 };
            this.onCheckDebounce = debounce(this.onCheck.bind(this), 200);
            
            // Forzar altura mínima si el contenedor está vacío
            if (this.container.clientHeight === 0) {
                this.container.style.minHeight = "700px";
            }

            this.createRenderer();
            this.createCamera();
            this.createScene();
            this.onResize();
            this.createGeometry();
            this.createMedias(items, bend, textColor, borderRadius, font);
            this.update(); // RE-ACTIVATING ENGINE
            this.addEventListeners();
            
            // Diagnóstico: si después de 3s no hay canvas o está vacío, avisar
            setTimeout(() => {
                if (this.gl && this.gl.canvas && this.gl.canvas.width > 0) {
                    console.log("Diagnóstico OGL: Canvas verificado y activo.");
                } else {
                    console.warn("Diagnóstico OGL: El canvas parece no estar renderizando.");
                }
            }, 3000);

            console.log("Galería Circular inicializada con éxito.");
        }
        createRenderer() {
            try {
                this.renderer = new this.ogl.Renderer({
                    alpha: true,
                    antialias: true,
                    dpr: Math.min(window.devicePixelRatio || 1, 2)
                });
                this.gl = this.renderer.gl;
                this.gl.clearColor(0, 0, 0, 0);
                
                // Limpiar primero el contenedor por si acaso
                this.container.innerHTML = ''; 
                this.container.appendChild(this.gl.canvas);
                
                this.gl.canvas.style.display = "block";
                this.gl.canvas.style.width = "100%";
                this.gl.canvas.style.height = "100%";
                this.gl.canvas.style.position = "absolute";
                this.gl.canvas.style.top = "0";
                this.gl.canvas.style.left = "0";
                
                console.log("Lienzo WebGL integrado con éxito.");
            } catch (e) {
                console.error("Error crítico al crear Renderer:", e);
                this.container.innerHTML = `<div style="color: white; text-align: center; padding: 50px;">Error al cargar el motor 3D Proyectos. Prueba recargando la página.</div>`;
            }
        }
        createCamera() {
            this.camera = new this.ogl.Camera(this.gl);
            this.camera.fov = 45;
            this.camera.position.z = 20;
        }
        createScene() {
            this.scene = new this.ogl.Transform();
        }
        createGeometry() {
            this.planeGeometry = new this.ogl.Plane(this.gl, {
                heightSegments: 50,
                widthSegments: 100
            });
        }
        createMedias(items, bend, textColor, borderRadius, font) {
            const galleryItems = items && items.length ? items : [];
            this.mediasImages = galleryItems.concat(galleryItems).concat(galleryItems);
            this.medias = this.mediasImages.map((data, index) => {
                return new Media({
                    ogl: this.ogl,
                    geometry: this.planeGeometry,
                    gl: this.gl,
                    image: data.image,
                    index,
                    length: this.mediasImages.length,
                    renderer: this.renderer,
                    scene: this.scene,
                    screen: this.screen,
                    text: data.text,
                    viewport: this.viewport,
                    bend,
                    textColor,
                    borderRadius,
                    font
                });
            });
        }
        onTouchDown(e) {
            this.isDown = true;
            this.scroll.position = this.scroll.current;
            this.start = e.touches ? e.touches[0].clientX : e.clientX;
        }
        onTouchMove(e) {
            if (!this.isDown) return;
            const x = e.touches ? e.touches[0].clientX : e.clientX;
            const distance = (this.start - x) * (this.scrollSpeed * 0.025);
            this.scroll.target = this.scroll.position + distance;
        }
        onTouchUp() {
            this.isDown = false;
            this.onCheck();
        }
        onWheel(e) {
            const isOver = e.target.closest('.circular-gallery') || e.target.closest('.circular-gallery-wrapper');
            if (!isOver) return;
            const delta = e.deltaY;
            this.scroll.target += (delta > 0 ? this.scrollSpeed : -this.scrollSpeed) * 0.5;
            this.onCheckDebounce();
        }
        onCheck() {
            if (!this.medias || !this.medias[0]) return;
            const width = this.medias[0].width;
            const itemIndex = Math.round(Math.abs(this.scroll.target) / width);
            const item = width * itemIndex;
            this.scroll.target = this.scroll.target < 0 ? -item : item;
        }
        onResize() {
            if (!this.container) return;
            this.screen = {
                width: this.container.clientWidth,
                height: this.container.clientHeight
            };
            if (this.screen.width === 0) return;
            this.renderer.setSize(this.screen.width, this.screen.height);
            this.camera.perspective({
                aspect: this.screen.width / this.screen.height
            });
            const fov = (this.camera.fov * Math.PI) / 180;
            const height = 2 * Math.tan(fov / 2) * this.camera.position.z;
            const width = height * this.camera.aspect;
            this.viewport = { width, height };
            if (this.medias) {
                this.medias.forEach(media => media.onResize({ screen: this.screen, viewport: this.viewport }));
            }
            // Asegurar que el renderer dibuje al menos una vez tras resize
            if (this.renderer && this.scene && this.camera) {
                this.renderer.render({ scene: this.scene, camera: this.camera });
            }
        }
        update() {
            try {
                this.scroll.current = lerp(this.scroll.current, this.scroll.target, this.scroll.ease);
                const direction = this.scroll.current > this.scroll.last ? 'right' : 'left';
                if (this.medias) {
                    this.medias.forEach(media => media.update(this.scroll, direction));
                }
                this.renderer.render({ scene: this.scene, camera: this.camera });
                this.scroll.last = this.scroll.current;
                this.raf = window.requestAnimationFrame(this.update.bind(this));
            } catch (e) {
                console.error("Error en loop de animación OGL:", e);
            }
        }
        addEventListeners() {
            window.addEventListener('resize', this.onResize.bind(this));
            window.addEventListener('wheel', this.onWheel.bind(this), { passive: true });
            this.container.addEventListener('mousedown', this.onTouchDown.bind(this));
            window.addEventListener('mousemove', this.onTouchMove.bind(this));
            window.addEventListener('mouseup', this.onTouchUp.bind(this));
            this.container.addEventListener('touchstart', this.onTouchDown.bind(this), { passive: true });
            window.addEventListener('touchmove', this.onTouchMove.bind(this), { passive: true });
            window.addEventListener('touchend', this.onTouchUp.bind(this), { passive: true });
        }
    }

    window.initCircularGallery = function(containerId, items, options = {}) {
        const container = document.getElementById(containerId);
        if (!container) return;
        return new CircularGallery(container, {
            items,
            bend: options.bend || 1.0,
            textColor: options.textColor || '#ffffff',
            borderRadius: options.borderRadius || 0.05,
        });
    };
})();
