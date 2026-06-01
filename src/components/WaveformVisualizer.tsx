import { useEffect, useRef } from "react";

interface WaveformVisualizerProps {
  isRecording: boolean;
  stream: MediaStream | null;
}

export default function WaveformVisualizer({ isRecording, stream }: WaveformVisualizerProps) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const animationRef = useRef<number | null>(null);
  const analyserRef = useRef<AnalyserNode | null>(null);
  const audioContextRef = useRef<AudioContext | null>(null);

  // Set up analyzer when streaming starts
  useEffect(() => {
    if (isRecording && stream) {
      try {
        const AudioContextClass = window.AudioContext || (window as any).webkitAudioContext;
        const audioCtx = new AudioContextClass();
        const source = audioCtx.createMediaStreamSource(stream);
        const analyser = audioCtx.createAnalyser();
        analyser.fftSize = 256;
        source.connect(analyser);

        audioContextRef.current = audioCtx;
        analyserRef.current = analyser;
      } catch (e) {
        console.error("Error setting up audio visualizer:", e);
      }
    } else {
      // Clean up on stop
      if (audioContextRef.current) {
        audioContextRef.current.close().catch(() => {});
        audioContextRef.current = null;
      }
      analyserRef.current = null;
    }

    return () => {
      if (audioContextRef.current) {
        audioContextRef.current.close().catch(() => {});
      }
    };
  }, [isRecording, stream]);

  // Main canvas animation loop
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    // Resize canvas to match display size
    const resizeCanvas = () => {
      const rect = canvas.getBoundingClientRect();
      canvas.width = rect.width * (window.devicePixelRatio || 1);
      canvas.height = rect.height * (window.devicePixelRatio || 1);
      ctx.scale(window.devicePixelRatio || 1, window.devicePixelRatio || 1);
    };
    resizeCanvas();

    // Resize listener
    window.addEventListener("resize", resizeCanvas);

    let phase = 0;

    const render = () => {
      const width = canvas.width / (window.devicePixelRatio || 1);
      const height = canvas.height / (window.devicePixelRatio || 1);

      // Clear with elegant translucent black background
      ctx.fillStyle = "rgba(28, 28, 30, 0.25)";
      ctx.fillRect(0, 0, width, height);

      const bufferLength = analyserRef.current ? analyserRef.current.frequencyBinCount : 128;
      const dataArray = new Uint8Array(bufferLength);

      if (analyserRef.current) {
        analyserRef.current.getByteFrequencyData(dataArray);
      }

      ctx.lineWidth = 2.5;
      ctx.lineCap = "round";

      if (isRecording) {
        // Draw dancing interactive neon soundwaves!
        const barWidth = (width / bufferLength) * 1.5;
        let x = 0;

        ctx.beginPath();
        for (let i = 0; i < bufferLength; i++) {
          const val = dataArray[i];
          const percent = val / 255;
          // Calculate high bar sizes
          const barHeight = Math.max(4, percent * height * 0.82);

          // Neon gradient style: vibrant deep blue to tech cyan
          const grad = ctx.createLinearGradient(0, height / 2 - barHeight / 2, 0, height / 2 + barHeight / 2);
          grad.addColorStop(0, "#007AFF"); // iOS Blue
          grad.addColorStop(0.5, "#5856d6"); // iOS Indigo
          grad.addColorStop(1, "#5ac8fa"); // iOS Cyan

          ctx.fillStyle = grad;
          // Draw bars mirrored vertically about the center line
          const r = 3; // rounded corner radius
          const drawY = height / 2 - barHeight / 2;
          ctx.beginPath();
          ctx.roundRect(x, drawY, barWidth - 2, barHeight, r);
          ctx.fill();

          x += barWidth;
        }
      } else {
        // Draw smooth, breathing aesthetic ambient sine waves (iOS active-siri vibe)
        phase += 0.05;
        
        ctx.shadowBlur = 0;

        // Draw 3 layers of translucent wave bands (corporate blues & purples)
        const waves = [
          { amplitude: 14, speed: 0.12, color: "rgba(0, 122, 255, 0.55)", shift: 0 },
          { amplitude: 8, speed: -0.08, color: "rgba(90, 200, 250, 0.45)", shift: Math.PI / 2 },
          { amplitude: 5, speed: 0.15, color: "rgba(88, 86, 214, 0.45)", shift: Math.PI },
        ];

        waves.forEach((wave) => {
          ctx.beginPath();
          ctx.strokeStyle = wave.color;
          for (let x = 0; x <= width; x += 3) {
            const y = height / 2 + Math.sin(x * 0.025 + phase * wave.speed + wave.shift) * wave.amplitude;
            if (x === 0) {
              ctx.moveTo(x, y);
            } else {
              ctx.lineTo(x, y);
            }
          }
          ctx.stroke();
        });
      }

      animationRef.current = requestAnimationFrame(render);
    };

    render();

    return () => {
      window.removeEventListener("resize", resizeCanvas);
      if (animationRef.current) {
        cancelAnimationFrame(animationRef.current);
      }
    };
  }, [isRecording]);

  return (
    <div id="visualizer-container" className="relative w-full h-24 rounded-2xl overflow-hidden bg-zinc-950 border border-zinc-800/50 shadow-inner">
      <canvas ref={canvasRef} className="w-full h-full block" />
      <div className="absolute inset-0 bg-radial-gradient from-transparent to-zinc-950/60 pointer-events-none" />
    </div>
  );
}
