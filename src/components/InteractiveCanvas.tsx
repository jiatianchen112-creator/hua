import React, { useEffect, useRef, useState } from 'react';
import { audioSystem } from '../lib/audio';
import { Particle, Bloom, Vector2 } from '../lib/visuals';
import { WebGLRenderer } from '../lib/webglRenderer';

const MAX_DPR = 2;
const NEBULA_PARTICLE_COUNT = 50;
const MAX_PARTICLES = 360;
const MAX_BLOOMS = 80;

export const InteractiveCanvas: React.FC = () => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [hasStarted, setHasStarted] = useState(false);
  const hasStartedRef = useRef(false);
  
  // State refs to avoid re-renders
  const stateRef = useRef({
    particles: [] as Particle[],
    blooms: [] as Bloom[],
    vinePoints: [] as Vector2[],
    mouseX: -100,
    mouseY: -100,
    lastMouseX: -100,
    lastMouseY: -100,
    time: 0,
    lastChimeFrame: 0
  });

  const handleInteractionStart = () => {
    if (!hasStartedRef.current) {
      hasStartedRef.current = true;
      setHasStarted(true);
      audioSystem.init();
      audioSystem.resume();
    }
  };

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    let renderer: WebGLRenderer;
    try {
      renderer = new WebGLRenderer(canvas, MAX_DPR);
    } catch (error) {
      console.error(error);
      return;
    }

    let animationFrameId: number;
    let width = window.innerWidth;
    let height = window.innerHeight;

    const state = stateRef.current;

    const resize = () => {
      width = window.innerWidth;
      height = window.innerHeight;
      renderer.resize(MAX_DPR);
    };

    window.addEventListener('resize', resize);
    resize();

    // Initialize Nebula
    for (let i = state.particles.length; i < NEBULA_PARTICLE_COUNT; i++) {
        state.particles.push(new Particle(Math.random() * width, Math.random() * height, 'nebula'));
    }

    const render = () => {
      state.time += 1;
      renderer.clear();
      renderer.drawGrid(state.time);

      // Manage Vine points
      if (state.mouseX > 0 && state.mouseY > 0 && 
         (state.mouseX !== state.lastMouseX || state.mouseY !== state.lastMouseY)) {
         
         const dist = Math.hypot(state.mouseX - state.lastMouseX, state.mouseY - state.lastMouseY);
         
         // Only add if moved enough
         if (dist > 2) {
             state.vinePoints.push({ x: state.mouseX, y: state.mouseY });
             
             // Play dynamic chime based on movement speed
             if (hasStartedRef.current && state.time - state.lastChimeFrame > 4) {
                 state.lastChimeFrame = state.time;
                 audioSystem.playChime(dist);
             }

             // Emit spores
             if (state.particles.length < MAX_PARTICLES && Math.random() < 0.3) {
                 state.particles.push(new Particle(state.mouseX, state.mouseY, 'spore'));
             }
         }
      }

      // Shrink vine trail to make it grow forward and disappear behind
      if (state.vinePoints.length > 50) { // max length
        state.vinePoints.shift();
      } else if (state.mouseX === state.lastMouseX && state.mouseY === state.lastMouseY) {
         // gradually shrink if mouse stopped
         if (state.vinePoints.length > 0) {
             state.vinePoints.shift();
         }
      }

      state.lastMouseX = state.mouseX;
      state.lastMouseY = state.mouseY;

      renderer.drawVine(state.vinePoints);

      for (let i = state.blooms.length - 1; i >= 0; i--) {
        const bloom = state.blooms[i];
        if (!bloom.isComplete()) {
          bloom.update();
        }
      }
      renderer.drawBlooms(state.blooms);

      // Update & Render particles
      for (let i = state.particles.length - 1; i >= 0; i--) {
        const p = state.particles[i];
        p.update();
        
        if (p.life <= 0) {
          state.particles.splice(i, 1);
          // respawn nebula particles to keep environment alive
          if (p.type === 'nebula') {
              state.particles.push(new Particle(Math.random() * width, Math.random() * height, 'nebula'));
          }
        }
      }
      renderer.drawParticles(state.particles);

      animationFrameId = requestAnimationFrame(render);
    };

    render();

    return () => {
      window.removeEventListener('resize', resize);
      cancelAnimationFrame(animationFrameId);
    };
  }, []);

  const handleMouseMove = (e: React.MouseEvent | React.TouchEvent) => {
    handleInteractionStart();
    const state = stateRef.current;
    
    // Handle both mouse and touch
    let clientX, clientY;
    if ('touches' in e) {
       clientX = e.touches[0].clientX;
       clientY = e.touches[0].clientY;
    } else {
       clientX = e.clientX;
       clientY = e.clientY;
    }
    
    state.mouseX = clientX;
    state.mouseY = clientY;
  };

  const handleClick = (e: React.MouseEvent | React.TouchEvent) => {
    handleInteractionStart();
    const state = stateRef.current;
    
    let clientX, clientY;
    if ('touches' in e && e.touches.length > 0) {
       clientX = e.touches[0].clientX;
       clientY = e.touches[0].clientY;
    } else if ('changedTouches' in e && e.changedTouches.length > 0) {
       clientX = e.changedTouches[0].clientX;
       clientY = e.changedTouches[0].clientY;
    } else {
       clientX = (e as React.MouseEvent).clientX;
       clientY = (e as React.MouseEvent).clientY;
    }

    // Play bloom sound
    audioSystem.playBloom();

    // Spawn a bloom
    state.blooms.push(new Bloom(clientX, clientY));
    if (state.blooms.length > MAX_BLOOMS) {
        state.blooms.splice(0, state.blooms.length - MAX_BLOOMS);
    }

    // Spawn golden pollen
    const pollenCount = Math.min(30, MAX_PARTICLES - state.particles.length);
    for (let i = 0; i < pollenCount; i++) {
        state.particles.push(new Particle(clientX, clientY, 'pollen'));
    }
  };

  return (
    <div className="relative w-full h-full bg-[#1a0b25] overflow-hidden flex flex-col font-sans text-white select-none">
      <div className="absolute inset-0 opacity-20 pointer-events-none z-0" style={{ backgroundImage: 'linear-gradient(#f06292 0.5px, transparent 0.5px), linear-gradient(90deg, #f06292 0.5px, transparent 0.5px)', backgroundSize: '40px 40px' }}></div>
      <div className="absolute inset-0 pointer-events-none z-0">
        <div className="absolute top-1/4 left-1/4 w-[500px] h-[500px] bg-purple-700/30 rounded-full blur-[120px] mix-blend-screen animate-pulse"></div>
        <div className="absolute bottom-1/4 right-1/4 w-[400px] h-[400px] bg-fuchsia-500/20 rounded-full blur-[100px] mix-blend-screen"></div>
      </div>

      <canvas
        ref={canvasRef}
        onMouseMove={handleMouseMove}
        onTouchMove={handleMouseMove}
        onClick={handleClick}
        onTouchEnd={handleClick}
        className="absolute inset-0 z-10 block touch-none cursor-crosshair"
      />

      <header className={`relative z-20 w-full pt-12 text-center pointer-events-none transition-opacity duration-1000 ${hasStarted ? 'opacity-30' : 'opacity-100'}`}>
        <h1 className="text-5xl font-light tracking-[0.2em] text-pink-100 drop-shadow-[0_0_15px_rgba(240,98,146,0.6)]">
          CRYSTAL BLOOM PULSE
        </h1>
        <p className="mt-4 text-xs font-semibold tracking-[0.4em] text-purple-300 uppercase opacity-70">
          Era of Sylvan Spirits
        </p>
      </header>

      <main className={`relative z-20 flex-1 flex items-center justify-center pointer-events-none transition-opacity duration-1000 ${hasStarted ? 'opacity-10' : 'opacity-100'}`}>
        <div className="relative w-[500px] h-[500px] flex items-center justify-center">
          <div className="absolute w-full h-full border border-pink-500/20 rounded-full rotate-45"></div>
          <div className="absolute w-[80%] h-[80%] border border-purple-400/30 rounded-full"></div>
          
          <div className="relative z-20 mix-blend-screen">
            <svg viewBox="0 0 200 200" className="w-80 h-80 drop-shadow-[0_0_30px_rgba(240,98,146,0.8)]">
              <path d="M100 20 L120 70 L170 80 L130 110 L140 160 L100 130 L60 160 L70 110 L30 80 L80 70 Z" fill="rgba(248,187,208,0.4)" stroke="#f06292" strokeWidth="1" />
              <path d="M100 40 L112 80 L150 90 L118 108 L125 145 L100 120 L75 145 L82 108 L50 90 L88 80 Z" fill="rgba(225,190,231,0.6)" stroke="#e1bee7" strokeWidth="0.5" />
              <circle cx="100" cy="100" r="8" fill="#ffd54f" className="animate-pulse" />
              <g fill="none" stroke="#f06292" strokeWidth="0.5" opacity="0.5">
                <line x1="100" y1="20" x2="100" y2="180" />
                <line x1="20" y1="100" x2="180" y2="100" />
              </g>
            </svg>
          </div>

          <div className="absolute w-[1px] h-[600px] bg-gradient-to-b from-transparent via-pink-400/40 to-transparent"></div>
          <div className="absolute h-[1px] w-[600px] bg-gradient-to-r from-transparent via-purple-400/40 to-transparent"></div>
        </div>

        <div className="absolute top-20 left-20 w-32 h-32 opacity-60">
          <svg viewBox="0 0 100 100" className="w-full h-full stroke-pink-300 fill-none">
            <path d="M10,90 Q30,10 90,10" strokeDasharray="2 2" />
            <circle cx="90" cy="10" r="3" fill="currentColor" />
          </svg>
        </div>
        
        <div className="absolute bottom-20 right-20 w-48 h-48 opacity-40">
          <svg viewBox="0 0 100 100" className="w-full h-full stroke-purple-400 fill-none">
            <path d="M90,10 Q70,90 10,90" strokeDasharray="4 2" />
            <circle cx="10" cy="90" r="4" fill="currentColor" />
          </svg>
        </div>
      </main>

      <footer className={`relative z-20 w-full p-12 flex justify-between items-end pointer-events-none transition-opacity duration-1000 ${hasStarted ? 'opacity-30' : 'opacity-100'}`}>
        <div className="space-y-2">
          <div className="text-[10px] tracking-widest text-pink-300 opacity-50 uppercase">Ecosystem Frequency</div>
          <div className="flex items-end gap-1 h-8">
            <div className="w-[2px] bg-pink-500 h-2"></div>
            <div className="w-[2px] bg-pink-400 h-4"></div>
            <div className="w-[2px] bg-pink-300 h-6"></div>
            <div className="w-[2px] bg-pink-400 h-3"></div>
            <div className="w-[2px] bg-pink-500 h-5"></div>
            <div className="w-[2px] bg-pink-300 h-2 animate-pulse"></div>
          </div>
        </div>

        <div className="text-right space-y-4">
          <div className="group pointer-events-auto cursor-pointer">
            <div className="text-[10px] tracking-[0.3em] text-[#e8bbf5] opacity-60 group-hover:opacity-100 transition-opacity">SPIRIT RESONANCE</div>
            <div className="text-2xl font-light text-white">98.42%</div>
          </div>
          <div className="flex gap-4 justify-end">
            <div className="w-2 h-2 rounded-full border border-pink-500"></div>
            <div className="w-2 h-2 rounded-full border border-pink-500 bg-pink-500 shadow-[0_0_10px_#f06292]"></div>
            <div className="w-2 h-2 rounded-full border border-pink-500"></div>
          </div>
        </div>
      </footer>

      <div className={`absolute bottom-32 left-1/2 -translate-x-1/2 flex items-center gap-8 z-20 pointer-events-none transition-opacity duration-1000 ${hasStarted ? 'opacity-30' : 'opacity-100'}`}>
        <div className="h-[1px] w-32 bg-gradient-to-r from-transparent to-pink-500/50"></div>
        <div className="text-[10px] tracking-[0.5em] text-white/40 uppercase whitespace-nowrap italic font-serif">
          {hasStarted ? "Nurture the Crystalline Garden" : "CLICK ANYWHERE TO AWAKEN"}
        </div>
        <div className="h-[1px] w-32 bg-gradient-to-l from-transparent to-pink-500/50"></div>
      </div>

      <div className="absolute inset-0 pointer-events-none z-20 mix-blend-screen">
        <div className="absolute top-1/3 left-1/3 w-1 h-1 bg-white rounded-full shadow-[0_0_8px_white]"></div>
        <div className="absolute top-2/3 right-1/4 w-1 h-1 bg-pink-300 rounded-full shadow-[0_0_8px_#f06292]"></div>
        <div className="absolute bottom-1/3 right-1/3 w-1.5 h-1.5 bg-yellow-200 rounded-full shadow-[0_0_10px_#ffd54f] opacity-50"></div>
      </div>
    </div>
  );
};
