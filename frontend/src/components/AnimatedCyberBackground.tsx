import { useEffect, useRef } from 'react';
import { useCarTrim } from '../context/CarTrimContext';

export const AnimatedCyberBackground = () => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const { config } = useCarTrim();

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    let animId: number;
    let width = (canvas.width = window.innerWidth);
    let height = (canvas.height = window.innerHeight);

    const handleResize = () => {
      if (!canvas) return;
      width = canvas.width = window.innerWidth;
      height = canvas.height = window.innerHeight;
    };

    window.addEventListener('resize', handleResize);

    // Particle Stars
    const particleCount = 70;
    const particles = Array.from({ length: particleCount }, () => ({
      x: Math.random() * width,
      y: Math.random() * height,
      size: Math.random() * 2 + 0.5,
      speedY: Math.random() * 0.4 + 0.1,
      speedX: (Math.random() - 0.5) * 0.2,
      opacity: Math.random() * 0.7 + 0.2,
      pulse: Math.random() * Math.PI
    }));

    // Speed Drift Lines (Hypercar racing light streaks)
    const lineCount = 12;
    const lines = Array.from({ length: lineCount }, () => ({
      x: Math.random() * width,
      y: Math.random() * height,
      length: Math.random() * 120 + 60,
      speed: Math.random() * 4 + 2,
      opacity: Math.random() * 0.4 + 0.1
    }));

    let gridOffset = 0;

    const render = () => {
      // Clear with dark obsidian semi-transparent wash for motion blur
      ctx.fillStyle = '#020617';
      ctx.fillRect(0, 0, width, height);

      // Subtle radial vignetting
      const radialGrad = ctx.createRadialGradient(
        width / 2, height / 2, 50,
        width / 2, height / 2, Math.max(width, height) * 0.8
      );
      radialGrad.addColorStop(0, 'rgba(15, 23, 42, 0.4)');
      radialGrad.addColorStop(0.6, 'rgba(2, 6, 23, 0.85)');
      radialGrad.addColorStop(1, '#000000');
      ctx.fillStyle = radialGrad;
      ctx.fillRect(0, 0, width, height);

      // Perspective 3D Cyber Track Grid (Bottom Horizon)
      const horizonY = height * 0.62;
      gridOffset = (gridOffset + 1.2) % 40;

      ctx.save();
      ctx.beginPath();
      ctx.rect(0, horizonY, width, height - horizonY);
      ctx.clip();

      // Perspective vanishing lines
      ctx.strokeStyle = `${config.primaryColor}18`; // very subtle accent
      ctx.lineWidth = 1;
      const fovCenter = width / 2;
      for (let x = -width; x < width * 2; x += 60) {
        ctx.beginPath();
        ctx.moveTo(fovCenter, horizonY);
        ctx.lineTo(x, height);
        ctx.stroke();
      }

      // Horizontal depth grid rungs
      for (let z = 0; z < height - horizonY; z += 20) {
        const y = horizonY + Math.pow(z / (height - horizonY), 1.8) * (height - horizonY) + gridOffset * 0.2;
        if (y <= height) {
          ctx.beginPath();
          ctx.moveTo(0, y);
          ctx.lineTo(width, y);
          ctx.stroke();
        }
      }
      ctx.restore();

      // Speed Light Streaks
      lines.forEach((l) => {
        l.y += l.speed;
        if (l.y > height + l.length) {
          l.y = -l.length;
          l.x = Math.random() * width;
        }

        const streakGrad = ctx.createLinearGradient(l.x, l.y - l.length, l.x, l.y);
        streakGrad.addColorStop(0, 'transparent');
        streakGrad.addColorStop(0.8, `${config.primaryColor}30`);
        streakGrad.addColorStop(1, `${config.primaryColor}80`);

        ctx.strokeStyle = streakGrad;
        ctx.lineWidth = 1.5;
        ctx.beginPath();
        ctx.moveTo(l.x, l.y - l.length);
        ctx.lineTo(l.x, l.y);
        ctx.stroke();
      });

      // Floating Particle Stars
      particles.forEach((p) => {
        p.y -= p.speedY;
        p.x += p.speedX;
        p.pulse += 0.02;

        if (p.y < 0) p.y = height;
        if (p.x < 0) p.x = width;
        if (p.x > width) p.x = 0;

        const currentOpacity = p.opacity * (0.6 + 0.4 * Math.sin(p.pulse));
        ctx.fillStyle = `rgba(255, 255, 255, ${currentOpacity})`;
        ctx.beginPath();
        ctx.arc(p.x, p.y, p.size, 0, Math.PI * 2);
        ctx.fill();

        // Subtle glow halo around larger particles
        if (p.size > 1.5) {
          ctx.fillStyle = `${config.primaryColor}${Math.floor(currentOpacity * 40).toString(16).padStart(2, '0')}`;
          ctx.beginPath();
          ctx.arc(p.x, p.y, p.size * 3, 0, Math.PI * 2);
          ctx.fill();
        }
      });

      // Ambient Horizon Glow
      const glowGrad = ctx.createLinearGradient(0, horizonY - 40, 0, horizonY + 80);
      glowGrad.addColorStop(0, 'transparent');
      glowGrad.addColorStop(0.5, `${config.primaryColor}15`);
      glowGrad.addColorStop(1, 'transparent');
      ctx.fillStyle = glowGrad;
      ctx.fillRect(0, horizonY - 40, width, 120);

      animId = requestAnimationFrame(render);
    };

    animId = requestAnimationFrame(render);

    return () => {
      window.removeEventListener('resize', handleResize);
      cancelAnimationFrame(animId);
    };
  }, [config]);

  return (
    <canvas
      ref={canvasRef}
      className="fixed inset-0 pointer-events-none z-0 w-full h-full opacity-90 transition-opacity duration-1000"
    />
  );
};
