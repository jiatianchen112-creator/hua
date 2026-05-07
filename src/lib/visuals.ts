export interface Vector2 {
  x: number;
  y: number;
}

export class Particle {
  x: number;
  y: number;
  vx: number;
  vy: number;
  life: number;
  maxLife: number;
  size: number;
  color: string;
  type: 'nebula' | 'spore' | 'pollen';
  
  constructor(x: number, y: number, type: 'nebula' | 'spore' | 'pollen') {
    this.x = x;
    this.y = y;
    this.type = type;
    
    if (type === 'nebula') {
      this.vx = (Math.random() - 0.5) * 0.2;
      this.vy = (Math.random() - 0.5) * 0.2;
      this.maxLife = 500 + Math.random() * 500;
      this.size = 2 + Math.random() * 4;
      this.color = Math.random() > 0.5 ? '180, 100%, 80%' : '300, 80%, 70%'; // pastel pink/magenta
    } else if (type === 'spore') {
      this.vx = (Math.random() - 0.5) * 1.5;
      this.vy = (Math.random() - 0.5) * 1.5;
      this.maxLife = 50 + Math.random() * 50;
      this.size = 1 + Math.random() * 2;
      this.color = '320, 100%, 75%'; // bright magenta
    } else { // pollen
      const angle = Math.random() * Math.PI * 2;
      const speed = 1 + Math.random() * 4;
      this.vx = Math.cos(angle) * speed;
      this.vy = Math.sin(angle) * speed;
      this.maxLife = 100 + Math.random() * 80;
      this.size = 1.5 + Math.random() * 2.5;
      this.color = '45, 100%, 65%'; // golden
    }
    this.life = this.maxLife;
  }

  update() {
    this.x += this.vx;
    this.y += this.vy;
    this.life--;
    
    if (this.type === 'spore' || this.type === 'pollen') {
      this.vx *= 0.95; // friction
      this.vy *= 0.95;
    }
  }

  draw(ctx: CanvasRenderingContext2D) {
    if (this.life <= 0) return;
    const alpha = this.life / this.maxLife;
    ctx.beginPath();
    ctx.arc(this.x, this.y, this.size, 0, Math.PI * 2);
    ctx.fillStyle = `hsla(${this.color}, ${alpha * (this.type === 'nebula' ? 0.3 : 0.8)})`;
    if (this.type !== 'nebula') {
        ctx.shadowBlur = 10;
        ctx.shadowColor = `hsla(${this.color}, 1)`;
    } else {
        ctx.shadowBlur = 0;
    }
    ctx.fill();
    ctx.shadowBlur = 0; // reset
  }
}

export class Bloom {
  x: number;
  y: number;
  progress: number;
  maxRadius: number;
  petals: number;
  rotation: number;
  colorScheme: string[];

  constructor(x: number, y: number) {
    this.x = x;
    this.y = y;
    this.progress = 0;
    this.maxRadius = 60 + Math.random() * 40;
    this.petals = 6 + Math.floor(Math.random() * 4) * 2; // Even number of petals usually 6, 8, 10
    this.rotation = Math.random() * Math.PI * 2;
    this.colorScheme = [
      `hsla(${280 + Math.random() * 40}, 80%, 65%, 0.6)`, // Plums/Purples
      `hsla(${320 + Math.random() * 30}, 90%, 70%, 0.6)`, // Pinks/Magentas
      `hsla(${40 + Math.random() * 20}, 90%, 60%, 0.4)`,  // Gold highlights
    ];
  }

  update() {
    if (this.progress < 1) {
      this.progress += 0.02; // Bloom speed
      if (this.progress > 1) this.progress = 1;
    }
  }

  isComplete(): boolean {
    return this.progress >= 1;
  }

  draw(ctx: CanvasRenderingContext2D) {
    if (this.progress <= 0) return;
    
    const currentRadius = this.maxRadius * this.easeOutElastic(this.progress);
    
    ctx.save();
    ctx.translate(this.x, this.y);
    ctx.rotate(this.rotation + this.progress * 0.5);

    // Draw central orb
    ctx.beginPath();
    ctx.arc(0, 0, currentRadius * 0.2, 0, Math.PI * 2);
    ctx.fillStyle = this.colorScheme[2];
    ctx.shadowBlur = 20 * this.progress;
    ctx.shadowColor = 'rgba(255, 200, 100, 0.8)';
    ctx.fill();

    // Draw faceted petals
    for (let i = 0; i < this.petals; i++) {
        const angle = (Math.PI * 2 / this.petals) * i;
        ctx.save();
        ctx.rotate(angle);
        
        ctx.beginPath();
        ctx.moveTo(0, 0);
        // Diamond shaped petal
        const petalRadius = currentRadius;
        const petalWidth = currentRadius * 0.3;
        ctx.lineTo(petalWidth, -petalRadius * 0.5);
        ctx.lineTo(0, -petalRadius);
        ctx.lineTo(-petalWidth, -petalRadius * 0.5);
        ctx.closePath();

        ctx.fillStyle = this.colorScheme[i % 2];
        ctx.strokeStyle = `rgba(255, 255, 255, ${0.4 * this.progress})`;
        ctx.lineWidth = 1;
        
        // Add blending mode for crystal effect
        ctx.globalCompositeOperation = 'screen';
        
        ctx.fill();
        ctx.stroke();
        
        // Inner facet
        ctx.beginPath();
        ctx.moveTo(0, 0);
        ctx.lineTo(0, -petalRadius);
        ctx.strokeStyle = `rgba(255, 255, 255, ${0.2 * this.progress})`;
        ctx.stroke();

        ctx.restore();
    }

    ctx.restore();
  }

  easeOutElastic(x: number): number {
    const c4 = (2 * Math.PI) / 3;
    return x === 0 ? 0 : x === 1 ? 1 : Math.pow(2, -10 * x) * Math.sin((x * 10 - 0.75) * c4) + 1;
  }
}
