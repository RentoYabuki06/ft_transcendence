import { useEffect, useRef } from 'react';

interface Star {
  x: number;
  y: number;
  size: number;
  speed: number;
  opacity: number;
  twinkleSpeed: number;
  twinkleOffset: number;
}

export function StarField() {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    let animationId: number;
    const stars: Star[] = [];
    const STAR_COUNT = 200;

    function resize() {
      canvas!.width = window.innerWidth;
      canvas!.height = window.innerHeight;
    }

    function initStars() {
      stars.length = 0;
      for (let i = 0; i < STAR_COUNT; i++) {
        stars.push({
          x: Math.random() * canvas!.width,
          y: Math.random() * canvas!.height,
          size: Math.random() * 2 + 0.5,
          speed: Math.random() * 0.3 + 0.05,
          opacity: Math.random(),
          twinkleSpeed: Math.random() * 0.02 + 0.005,
          twinkleOffset: Math.random() * Math.PI * 2,
        });
      }
    }

    function draw(time: number) {
      ctx!.clearRect(0, 0, canvas!.width, canvas!.height);

      // Draw nebula glow
      const gradient = ctx!.createRadialGradient(
        canvas!.width * 0.3, canvas!.height * 0.4, 0,
        canvas!.width * 0.3, canvas!.height * 0.4, canvas!.width * 0.5,
      );
      gradient.addColorStop(0, 'rgba(0, 212, 255, 0.02)');
      gradient.addColorStop(0.5, 'rgba(139, 92, 246, 0.01)');
      gradient.addColorStop(1, 'rgba(0, 0, 0, 0)');
      ctx!.fillStyle = gradient;
      ctx!.fillRect(0, 0, canvas!.width, canvas!.height);

      // Draw stars
      for (const star of stars) {
        star.opacity = 0.3 + 0.7 * Math.abs(Math.sin(time * star.twinkleSpeed + star.twinkleOffset));
        star.y += star.speed;
        if (star.y > canvas!.height) {
          star.y = 0;
          star.x = Math.random() * canvas!.width;
        }

        ctx!.beginPath();
        ctx!.arc(star.x, star.y, star.size, 0, Math.PI * 2);
        ctx!.fillStyle = `rgba(224, 231, 255, ${star.opacity})`;
        ctx!.fill();

        // Add glow to larger stars
        if (star.size > 1.5) {
          ctx!.beginPath();
          ctx!.arc(star.x, star.y, star.size * 3, 0, Math.PI * 2);
          ctx!.fillStyle = `rgba(0, 212, 255, ${star.opacity * 0.1})`;
          ctx!.fill();
        }
      }

      animationId = requestAnimationFrame(draw);
    }

    resize();
    initStars();
    animationId = requestAnimationFrame(draw);

    window.addEventListener('resize', () => {
      resize();
      initStars();
    });

    return () => {
      cancelAnimationFrame(animationId);
      window.removeEventListener('resize', resize);
    };
  }, []);

  return (
    <canvas
      ref={canvasRef}
      className="fixed inset-0 pointer-events-none"
      style={{ zIndex: 0 }}
    />
  );
}
