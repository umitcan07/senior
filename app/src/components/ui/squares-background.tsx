import { useRef, useEffect, useState } from "react";

interface SquaresProps {
  direction?: "diagonal" | "up" | "right" | "down" | "left";
  speed?: number;
  borderColor?: string;
  squareSize?: number;
  hoverFillColor?: string;
  className?: string;
}

export function Squares({
  direction = "diagonal",
  speed = 0.5,
  borderColor = "#333",
  squareSize = 40,
  hoverFillColor = "#222",
  className,
}: SquaresProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const requestRef = useRef<number>(0);
  const numSquaresX = useRef<number>(0);
  const numSquaresY = useRef<number>(0);
  const gridOffset = useRef({ x: 0, y: 0 });
  const [hoveredSquare, setHoveredSquare] = useState<{ x: number; y: number } | null>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");

    const resizeCanvas = () => {
      canvas.width = canvas.offsetWidth;
      canvas.height = canvas.offsetHeight;
      numSquaresX.current = Math.ceil(canvas.width / squareSize) + 1;
      numSquaresY.current = Math.ceil(canvas.height / squareSize) + 1;
    };

    window.addEventListener("resize", resizeCanvas);
    resizeCanvas();

    const drawGrid = () => {
      if (!ctx) return;
      ctx.clearRect(0, 0, canvas.width, canvas.height);

      const startX = Math.floor(gridOffset.current.x / squareSize) * squareSize;
      const startY = Math.floor(gridOffset.current.y / squareSize) * squareSize;

      ctx.lineWidth = 0.5;
      ctx.strokeStyle = borderColor;

      for (let x = startX; x < canvas.width + squareSize; x += squareSize) {
        for (let y = startY; y < canvas.height + squareSize; y += squareSize) {
          const squareX = x - (gridOffset.current.x % squareSize);
          const squareY = y - (gridOffset.current.y % squareSize);
          
          if (
            hoveredSquare &&
            Math.floor(x / squareSize) === hoveredSquare.x &&
            Math.floor(y / squareSize) === hoveredSquare.y
          ) {
            ctx.fillStyle = hoverFillColor;
            ctx.fillRect(squareX, squareY, squareSize, squareSize);
          }
          
          ctx.strokeRect(squareX, squareY, squareSize, squareSize);
        }
      }

      // Update offset
      const moveSpeed = speed;
      if (direction === "right") gridOffset.current.x = (gridOffset.current.x - moveSpeed) % squareSize;
      if (direction === "left") gridOffset.current.x = (gridOffset.current.x + moveSpeed) % squareSize;
      if (direction === "up") gridOffset.current.y = (gridOffset.current.y + moveSpeed) % squareSize;
      if (direction === "down") gridOffset.current.y = (gridOffset.current.y - moveSpeed) % squareSize;
      if (direction === "diagonal") {
        gridOffset.current.x = (gridOffset.current.x - moveSpeed) % squareSize;
        gridOffset.current.y = (gridOffset.current.y - moveSpeed) % squareSize;
      }

      requestRef.current = requestAnimationFrame(drawGrid);
    };

    requestRef.current = requestAnimationFrame(drawGrid);

    return () => {
      window.removeEventListener("resize", resizeCanvas);
      cancelAnimationFrame(requestRef.current);
    };
  }, [direction, speed, borderColor, hoverFillColor, hoveredSquare, squareSize]);

  const handleMouseMove = (event: React.MouseEvent<HTMLCanvasElement>) => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const rect = canvas.getBoundingClientRect();
    const x = event.clientX - rect.left;
    const y = event.clientY - rect.top;
    
    const effectiveX = x + (gridOffset.current.x % squareSize);
    const effectiveY = y + (gridOffset.current.y % squareSize);
    
    setHoveredSquare({ x: Math.floor(effectiveX / squareSize), y: Math.floor(effectiveY / squareSize) });
  };
    
  const handleMouseLeave = () => {
    setHoveredSquare(null);
  }

  return (
    <canvas
      ref={canvasRef}
      className={`block size-full ${className}`}
      onMouseMove={handleMouseMove}
      onMouseLeave={handleMouseLeave}
    />
  );
}
