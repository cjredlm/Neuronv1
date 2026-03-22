document.addEventListener('DOMContentLoaded', () => {
    // Register GSAP plugins
    if (typeof gsap !== 'undefined' && typeof ScrollTrigger !== 'undefined') {
        gsap.registerPlugin(ScrollTrigger);
    }
    
    console.log('main.js: DOMContentLoaded triggered');
    // Smooth scroll for anchor links
    document.querySelectorAll('a[href^="#"]').forEach(anchor => {
        anchor.addEventListener('click', function (e) {
            e.preventDefault();
            const target = document.querySelector(this.getAttribute('href'));
            if(target) {
                target.scrollIntoView({ behavior: 'smooth' });
            }
        });
    });

    // Sticky header background transition
    const header = document.querySelector('header');
    if (header) {
        window.addEventListener('scroll', () => {
            if (window.scrollY > 20) {
                header.classList.add('scrolled');
            } else {
                header.classList.remove('scrolled');
            }
        });
    }

    // --- Modern FAQ Split-Panel Logic ---
    const faqNavItems = document.querySelectorAll('.faq-nav-item');
    const faqContents = document.querySelectorAll('.faq-answer-content');

    faqNavItems.forEach(item => {
        item.addEventListener('click', () => {
            const targetIndex = item.dataset.index;
            
            // Update active nav button
            faqNavItems.forEach(nav => nav.classList.remove('active'));
            item.classList.add('active');

            // Switch content with animation
            const currentActive = document.querySelector('.faq-answer-content.active');
            const targetContent = document.querySelector(`.faq-answer-content[data-content="${targetIndex}"]`);

            if (currentActive === targetContent) return;

            // GSAP Transition
            if (typeof gsap !== 'undefined') {
                gsap.to(currentActive, {
                    opacity: 0,
                    y: -10,
                    duration: 0.3,
                    onComplete: () => {
                        currentActive.classList.remove('active');
                        targetContent.classList.add('active');
                        gsap.fromTo(targetContent, 
                            { opacity: 0, y: 10 },
                            { opacity: 1, y: 0, duration: 0.4, ease: "power2.out" }
                        );
                    }
                });
            } else {
                currentActive.classList.remove('active');
                targetContent.classList.add('active');
            }
        });
    });

    // Staggered entrance for the FAQ wrapper
    if (typeof gsap !== 'undefined') {
        gsap.from(".faq-split-wrapper", {
            scrollTrigger: {
                trigger: "#faq",
                start: "top 80%",
            },
            y: 50,
            opacity: 0,
            duration: 1.2,
            ease: "expo.out"
        });
    }
    
    // --- Scroll Reveal Animation ---
    const revealElements = document.querySelectorAll('section, .glass-panel, .step-card, .beneficio-card, .intro-reveal');
    
    const revealObserver = new IntersectionObserver((entries) => {
        entries.forEach(entry => {
            if (entry.isIntersecting) {
                entry.target.classList.add('revealed');
            }
        });
    }, { threshold: 0.1 });
    
    revealElements.forEach(el => {
        // Skip reveal animation for specific sections to handle them manually (GSAP, WebGL, etc)
        if (el.id === 'proyectos' || el.id === 'ejemplos' || el.id === 'beneficios' || el.id === 'proceso' || el.id === 'incluye' || el.classList.contains('bounceCardsContainer')) return;
        el.classList.add('reveal-init');
        revealObserver.observe(el);
    });

    // --- Interactive Liquid Ether Background ---
    const bgContainer = document.getElementById('liquid-ether-bg');
    if (bgContainer && !bgContainer.dataset.initialized) {
        bgContainer.dataset.initialized = "true";
        const isMobileDevice = window.innerWidth < 768;
        new LiquidEther({
            container: bgContainer,
            colors: ['#5ca3e6', '#025c8f', '#81d4fd'],
            resolution: isMobileDevice ? 0.25 : 0.5,
            iterationsViscous: isMobileDevice ? 12 : 32,
            iterationsPoisson: isMobileDevice ? 12 : 32,
            cursorSize: isMobileDevice ? 50 : 100
        });
    }


    // --- Unified Initialization with Error Handling ---
    const initSafe = (name, fn) => {
        try {
            fn();
        } catch (e) {
            console.warn(`Error initializing ${name}:`, e);
        }
    };

    initSafe('UnifiedComponent', initUnifiedComponent);
    initSafe('ProcessAnimations', initProcessAnimations);
    initSafe('BeneficiosAnimations', initBeneficiosAnimations);
    initSafe('FlexCards', initFlexCards);
    initSafe('IncluyeAnimations', initIncluyeAnimations);
    initSafe('ImpactoAnimations', initImpactoAnimations);
    initSafe('ContactForm', initContactForm);

    // --- Initialize Circular Gallery 3D ---
    const startGallery = () => {
        try {
            const container = document.getElementById('circular-gallery');
            if (!container || container.dataset.initialized) return;

            if (window.initCircularGallery) {
                container.dataset.initialized = "true";
                window.initCircularGallery('circular-gallery', [
                    { image: 'public/card_fitness.jpeg', text: 'Gimnasio & Fitness' },
                    { image: 'public/card_abogado.jpeg', text: 'Buffet de Abogados' },
                    { image: 'public/card_medical.jpeg', text: 'Clínica Médica' },
                    { image: 'public/card_restaurant.jpeg', text: 'Restaurante Gourmet' }
                ], {
                    textColor: '#ffffff', // Improved contrast
                    bend: 1.0,
                    borderRadius: 0.05
                });
            } else {
                setTimeout(startGallery, 500);
            }
        } catch (e) {
            console.error("Gallery failed to init:", e);
        }
    };
    startGallery();
});

/**
 * Modern Animations for the Impacto (Before/After) section
 */
function initProcessAnimations() {
    const steps = document.querySelectorAll('.reveal-step');
    const line = document.querySelector('.process-line-draw');
    if (!steps.length) return;

    if (typeof gsap !== 'undefined') {
        const tl = gsap.timeline({
            scrollTrigger: {
                trigger: ".process-wrapper",
                start: "top 80%",
                toggleActions: "play none none none"
            }
        });

        // Animar la línea primero (solo en desktop donde es visible)
        if (line) {
            tl.fromTo(line, 
                { scaleX: 0, transformOrigin: "left center" }, 
                { scaleX: 1, duration: 1.5, ease: "power2.inOut" }
            );
        }

        // Animar pasos
        tl.from(steps, {
            y: 40,
            opacity: 0,
            stagger: 0.2,
            duration: 0.8,
            ease: "back.out(1.7)"
        }, "-=1"); // Empezar un poco antes de que termine la línea
    }
}

function initImpactoAnimations() {
    const section = document.querySelector('#impacto');
    const masterCard = document.querySelector('.impacto-master-card');
    if (!section || !masterCard) return;

    if (typeof gsap !== 'undefined' && gsap.registerPlugin) {
        const tl = gsap.timeline({
            scrollTrigger: {
                trigger: section,
                start: "top 75%",
                toggleActions: "play none none none"
            }
        });

        tl.from(masterCard, {
            y: 60,
            opacity: 0,
            duration: 1.2,
            ease: "expo.out"
        })
        .from(".comparison-list-modern li", {
            x: -20,
            opacity: 0,
            stagger: 0.1,
            duration: 0.8,
            ease: "power2.out"
        }, "-=0.6")
        .from(".recommended-badge", {
            scale: 0,
            opacity: 0,
            duration: 0.6,
            ease: "back.out(1.7)"
        }, "-=0.4")
        .from(".impacto-footer", {
            y: 20,
            opacity: 0,
            duration: 0.8,
            ease: "power2.out"
        }, "-=0.4")
        .from(".btn-shimmer", {
            scale: 0.9,
            opacity: 0,
            duration: 0.8,
            ease: "elastic.out(1, 0.5)"
        }, "-=0.2");
        // Mouse Tilt Effect para la Master Card
        masterCard.addEventListener('mousemove', (e) => {
            const rect = masterCard.getBoundingClientRect();
            const x = e.clientX - rect.left;
            const y = e.clientY - rect.top;
            const centerX = rect.width / 2;
            const centerY = rect.height / 2;
            const rotateX = (y - centerY) / 25; 
            const rotateY = (centerX - x) / 25;

            gsap.to(masterCard, {
                rotateX: rotateX,
                rotateY: rotateY,
                duration: 0.4,
                ease: "power1.out",
                overwrite: true,
                transformPerspective: 1000
            });
        });

        masterCard.addEventListener('mouseleave', () => {
            gsap.to(masterCard, {
                rotateX: 0,
                rotateY: 0,
                duration: 0.8,
                ease: "elastic.out(1, 0.5)",
                overwrite: true
            });
        });
    }
}

function initOrbitSystem() {
    const container = document.getElementById('orbit-system');
    const satellites = document.querySelectorAll('.orbit-satellite');
    if (!container || !satellites.length) return;

    if (typeof gsap !== 'undefined') {
        let rotationData = { angle: 0 };
        const radiusX = window.innerWidth > 850 ? 450 : 0;
        const radiusY = window.innerWidth > 850 ? 120 : 0;
        
        // No orbit on mobile, just reveal
        if (window.innerWidth <= 850) {
            gsap.from(satellites, {
                y: 50,
                opacity: 0,
                stagger: 0.2,
                duration: 1,
                scrollTrigger: {
                    trigger: container,
                    start: "top 80%"
                }
            });
            return;
        }

        const orbitTl = gsap.to(rotationData, {
            angle: Math.PI * 2,
            duration: 20,
            repeat: -1,
            ease: "none",
            onUpdate: () => {
                satellites.forEach((sat, i) => {
                    if (sat.matches(':hover')) return; // Pause individual on hover

                    const offset = (i / satellites.length) * Math.PI * 2;
                    const currentAngle = rotationData.angle + offset;
                    
                    const x = Math.cos(currentAngle) * radiusX;
                    const z = Math.sin(currentAngle) * radiusX;
                    const y = Math.sin(currentAngle * 0.5) * radiusY; // Slight vertical wave

                    const scale = gsap.utils.mapRange(-radiusX, radiusX, 0.7, 1.1, z);
                    const opacity = gsap.utils.mapRange(-radiusX, radiusX, 0.3, 1, z);
                    const blur = gsap.utils.mapRange(-radiusX, radiusX, 4, 0, z);

                    gsap.set(sat, {
                        x: x,
                        y: y,
                        z: z,
                        scale: scale,
                        opacity: opacity,
                        filter: `blur(${blur}px)`,
                        zIndex: Math.round(gsap.utils.mapRange(-radiusX, radiusX, 1, 100, z))
                    });
                });
            }
        });

        // Magnetic Hover Effect
        satellites.forEach(sat => {
            sat.addEventListener('mouseenter', () => {
                gsap.to(sat, {
                    scale: 1.2,
                    filter: "blur(0px)",
                    opacity: 1,
                    z: 200,
                    duration: 0.5,
                    ease: "power2.out",
                    overwrite: true
                });
                sat.style.zIndex = 1000;
            });

            sat.addEventListener('mouseleave', () => {
                gsap.to(sat, {
                    duration: 0.5,
                    ease: "power2.inOut",
                    overwrite: true
                });
            });
        });
    }
}


function initUnifiedComponent() {
    const btnDesafio = document.getElementById('btn-desafio');
    const btnSolucion = document.getElementById('btn-solucion');
    const indicator = document.querySelector('.switch-indicator');
    const stateDesafio = document.getElementById('state-desafio');
    const stateSolucion = document.getElementById('state-solucion');

    if (!btnDesafio || !btnSolucion || !indicator) return;

    function switchState(target) {
        const isDesafio = target === 'state-desafio';
        
        // Update buttons
        btnDesafio.classList.toggle('active', isDesafio);
        btnSolucion.classList.toggle('active', !isDesafio);

        // Animate indicator
        gsap.to(indicator, {
            left: isDesafio ? "0.4rem" : "50%",
            duration: 0.5,
            ease: "expo.out"
        });

        // Animate states
        const fromState = isDesafio ? stateSolucion : stateDesafio;
        const toState = isDesafio ? stateDesafio : stateSolucion;

        // Transition: Fade out current, Fade in new
        const tl = gsap.timeline();

        tl.to(fromState, {
            opacity: 0,
            x: isDesafio ? 50 : -50,
            scale: 0.95,
            duration: 0.4,
            ease: "power2.in",
            onComplete: () => {
                fromState.classList.remove('active');
                toState.classList.add('active');
            }
        });

        tl.fromTo(toState, 
            { opacity: 0, x: isDesafio ? -50 : 50, scale: 0.95 },
            { 
                opacity: 1, 
                x: 0, 
                scale: 1, 
                duration: 0.6, 
                ease: "expo.out",
                clearProps: "all" 
            }
        );
    }

    btnDesafio.addEventListener('click', () => switchState('state-desafio'));
    btnSolucion.addEventListener('click', () => switchState('state-solucion'));
}

function initBounceCards() {
    const container = document.getElementById('bounce-cards-container');
    if (!container) return;

    const cards = container.querySelectorAll('.card');
    if (!cards.length) return;

    const transformStyles = Array.from(cards).map(card => card.style.transform || 'none');
    const imagesCount = cards.length;

    cards.forEach((card, idx) => {
        card.addEventListener('mouseenter', () => pushSiblings(idx, Array(imagesCount).fill(null), container, transformStyles));
        card.addEventListener('mouseleave', () => resetSiblings(Array(imagesCount).fill(null), container, transformStyles));
    });

    // Re-enable entrance animation for project cards
    gsap.fromTo(
        cards,
        { scale: 0, opacity: 0 },
        {
            scale: 1,
            opacity: 1,
            stagger: 0.1,
            ease: "elastic.out(1, 0.8)",
            duration: 1.2,
            delay: 0.5,
            scrollTrigger: {
                trigger: container,
                start: "top 85%",
                toggleActions: "play none none none"
            }
        }
    );
}

function getNoRotationTransform(transformStr) {
    const hasRotate = /rotate\([\s\S]*?\)/.test(transformStr);
    if (hasRotate) {
        return transformStr.replace(/rotate\([\s\S]*?\)/, 'rotate(0deg)');
    } else if (transformStr === 'none') {
        return 'rotate(0deg)';
    } else {
        return `${transformStr} rotate(0deg)`;
    }
}

function getPushedTransform(baseTransform, offsetX) {
    const translateRegex = /translate\(([-0-9.]+)px\)/;
    const match = baseTransform.match(translateRegex);
    if (match) {
        const currentX = parseFloat(match[1]);
        const newX = currentX + offsetX;
        return baseTransform.replace(translateRegex, `translate(${newX}px)`);
    } else {
        return baseTransform === 'none' ? `translate(${offsetX}px)` : `${baseTransform} translate(${offsetX}px)`;
    }
}

function pushSiblings(hoveredIdx, images, container, transformStyles) {
    images.forEach((_, i) => {
        const target = container.querySelector(`.card-${i}`);
        gsap.killTweensOf(target);

        const baseTransform = transformStyles[i] || 'none';

        if (i === hoveredIdx) {
            const noRotationTransform = getNoRotationTransform(baseTransform);
            gsap.to(target, {
                transform: noRotationTransform + ' scale(1.1)',
                duration: 0.5,
                ease: 'back.out(1.4)',
                overwrite: 'auto'
            });
        } else {
            const offsetX = i < hoveredIdx ? -120 : 120;
            const pushedTransform = getPushedTransform(baseTransform, offsetX);

            const distance = Math.abs(hoveredIdx - i);
            const delay = distance * 0.03;

            gsap.to(target, {
                transform: pushedTransform,
                duration: 0.5,
                ease: 'back.out(1.4)',
                delay,
                overwrite: 'auto'
            });
        }
    });
}

function resetSiblings(images, container, transformStyles) {
    images.forEach((_, i) => {
        const target = container.querySelector(`.card-${i}`);
        gsap.killTweensOf(target);
        const baseTransform = transformStyles[i] || 'none';
        gsap.to(target, {
            transform: baseTransform,
            duration: 0.5,
            ease: 'back.out(1.4)',
            overwrite: 'auto'
        });
    });
}

function initIncluyeAnimations() {
    const section = document.querySelector('.incluye-human');
    if (!section) return;

    if (typeof gsap !== 'undefined') {
        const tl = gsap.timeline({
            scrollTrigger: {
                trigger: section,
                start: "top 75%",
                toggleActions: "play none none none",
                once: true
            }
        });

        tl.fromTo(".human-visual-side", {
            x: -50,
            opacity: 0
        }, {
            x: 0,
            opacity: 1,
            duration: 1,
            ease: "power2.out"
        })
        .fromTo(".human-content-side > .section-badge, .human-content-side > h2, .human-content-side > p", {
            y: 30,
            opacity: 0
        }, {
            y: 0,
            opacity: 1,
            stagger: 0.2,
            duration: 0.8,
            ease: "power2.out"
        }, "-=0.6")
        .fromTo(".feature-human-card", {
            y: 20,
            scale: 0.95,
            opacity: 0
        }, {
            y: 0,
            scale: 1,
            opacity: 1,
            stagger: 0.1,
            duration: 0.6,
            ease: "back.out(1.7)"
        }, "-=0.4")
        .fromTo(".floating-stat-card", {
            scale: 0,
            opacity: 0
        }, {
            scale: 1,
            opacity: 1,
            duration: 0.8,
            ease: "back.out(2)"
        }, "-=0.6");
    }
}
function initFlexCards() {
    const cards = document.querySelectorAll('.flex-card');
    if (!cards.length) return;

    cards.forEach(card => {
        // En hover para desktop
        card.addEventListener('mouseenter', () => {
            cards.forEach(c => c.classList.remove('active'));
            card.classList.add('active');
        });
        
        // En click/touch para móviles o enfoque explícito
        card.addEventListener('click', () => {
            cards.forEach(c => c.classList.remove('active'));
            card.classList.add('active');
        });
    });
}

function initBeneficiosAnimations() {
    const section = document.querySelector('.beneficios-interactive');
    if (!section) return;

    if (typeof gsap !== 'undefined') {
        gsap.fromTo(".flex-cards-container", 
            { y: 50, opacity: 0 },
            {
                scrollTrigger: {
                    trigger: section,
                    start: "top 75%",
                    toggleActions: "play none none none"
                },
                y: 0,
                opacity: 1,
                duration: 1,
                ease: "expo.out"
            }
        );
    }
}

function initContactForm() {
    const form = document.getElementById('contact-form');
    if (!form) return;

    form.addEventListener('submit', async (e) => {
        e.preventDefault();
        
        const btn = form.querySelector('button[type="submit"]');
        const originalBtnHTML = btn.innerHTML;
        
        btn.innerHTML = '<span>Enviando petición...</span>';
        btn.style.opacity = '0.7';
        btn.disabled = true;

        const formData = {
            name: document.getElementById('name').value,
            phone: document.getElementById('phone').value,
            email: document.getElementById('email').value,
            business: document.getElementById('business').value,
            message: document.getElementById('message').value
        };

        try {
            // Se usa no-cors para evitar que el navegador bloquee la petición por falta de cabeceras CORS en N8N
            await fetch('https://n8n.automationf5networking.com/webhook/2bf412f3-30ff-4490-9be9-fe776e2a8a96', {
                method: 'POST',
                mode: 'no-cors',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify(formData)
            });

            // Con no-cors, la respuesta es "opaca" (no podemos leer response.ok). 
            // Asumimos que si no hubo error de red, la petición salió bien.
            btn.innerHTML = '<span>¡Solicitud Enviada!</span><svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="20 6 9 17 4 12"></polyline></svg>';
            btn.style.backgroundColor = '#1EBE5D';
            btn.style.borderColor = '#1EBE5D';
            btn.style.color = '#fff';
            btn.style.opacity = '1';
            form.reset();
            
            setTimeout(() => {
                btn.innerHTML = originalBtnHTML;
                btn.style.backgroundColor = '';
                btn.style.borderColor = '';
                btn.style.color = '';
                btn.disabled = false;
            }, 5000);
            
        } catch (error) {
            console.error('Error enviando formulario:', error);
            alert('Hubo un error al conectar con el servidor. Verifica tu conexión e intenta otra vez.');
            btn.innerHTML = originalBtnHTML;
            btn.style.opacity = '1';
            btn.disabled = false;
        }
    });
}

