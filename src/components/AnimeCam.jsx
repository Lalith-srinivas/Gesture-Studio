import { useEffect, useRef } from 'react';

const SKELETON_CONNECTIONS = [
  [0, 1], [1, 2], [2, 3], [3, 4],
  [0, 5], [5, 6], [6, 7], [7, 8],
  [5, 9], [9, 10], [10, 11], [11, 12],
  [9, 13], [13, 14], [14, 15], [15, 16],
  [13, 17], [17, 18], [18, 19], [19, 20],
  [0, 17]
];

function createShader(gl, type, source) {
  const shader = gl.createShader(type);
  gl.shaderSource(shader, source);
  gl.compileShader(shader);
  if (!gl.getShaderParameter(shader, gl.COMPILE_STATUS)) {
    gl.deleteShader(shader);
    return null;
  }
  return shader;
}

function initAnimeGL(canvas) {
  if (!canvas) return null;
  const gl = canvas.getContext('webgl', { alpha: false, preserveDrawingBuffer: false }) ||
             canvas.getContext('experimental-webgl', { alpha: false });
  if (!gl) return null;

  const vsSource = `
    attribute vec2 a_pos;
    varying vec2 v_uv;
    void main() {
      // Mirror horizontally so it feels natural like looking into a mirror
      v_uv = vec2(0.5 - a_pos.x * 0.5, 0.5 - a_pos.y * 0.5);
      gl_Position = vec4(a_pos, 0.0, 1.0);
    }
  `;

  const fsSource = `
    precision mediump float;
    uniform sampler2D u_image;
    uniform vec2 u_resolution;
    varying vec2 v_uv;

    float getLuma(vec3 c) {
      return dot(c, vec3(0.299, 0.587, 0.114));
    }

    void main() {
      vec2 d = vec2(1.0) / u_resolution;

      // Sobel Edge Detection for cartoon black ink lines
      float c00 = getLuma(texture2D(u_image, v_uv + vec2(-d.x, -d.y)).rgb);
      float c10 = getLuma(texture2D(u_image, v_uv + vec2(0.0, -d.y)).rgb);
      float c20 = getLuma(texture2D(u_image, v_uv + vec2(d.x, -d.y)).rgb);
      float c01 = getLuma(texture2D(u_image, v_uv + vec2(-d.x, 0.0)).rgb);
      float c21 = getLuma(texture2D(u_image, v_uv + vec2(d.x, 0.0)).rgb);
      float c02 = getLuma(texture2D(u_image, v_uv + vec2(-d.x, d.y)).rgb);
      float c12 = getLuma(texture2D(u_image, v_uv + vec2(0.0, d.y)).rgb);
      float c22 = getLuma(texture2D(u_image, v_uv + vec2(d.x, d.y)).rgb);

      float sx = -c00 - 2.0 * c01 - c02 + c20 + 2.0 * c21 + c22;
      float sy = -c00 - 2.0 * c10 - c20 + c02 + 2.0 * c12 + c22;
      float edge = sqrt(sx * sx + sy * sy);

      vec3 rgb = texture2D(u_image, v_uv).rgb;

      // Vibrant anime saturation boost
      float l = getLuma(rgb);
      rgb = mix(vec3(l), rgb, 1.45);

      // Cel-Shading: Quantize into 4 clean anime tone levels
      rgb = floor(rgb * 4.0 + 0.5) / 4.0;

      // Overlay bold black ink outlines on detected edges
      if (edge > 0.16) {
        rgb = vec3(0.06, 0.06, 0.08);
      }

      gl_FragColor = vec4(rgb, 1.0);
    }
  `;

  const vs = createShader(gl, gl.VERTEX_SHADER, vsSource);
  const fs = createShader(gl, gl.FRAGMENT_SHADER, fsSource);
  if (!vs || !fs) return null;

  const prog = gl.createProgram();
  gl.attachShader(prog, vs);
  gl.attachShader(prog, fs);
  gl.linkProgram(prog);
  if (!gl.getProgramParameter(prog, gl.LINK_STATUS)) return null;

  const posBuf = gl.createBuffer();
  gl.bindBuffer(gl.ARRAY_BUFFER, posBuf);
  gl.bufferData(
    gl.ARRAY_BUFFER,
    new Float32Array([
      -1, -1,
       1, -1,
      -1,  1,
      -1,  1,
       1, -1,
       1,  1,
    ]),
    gl.STATIC_DRAW
  );

  const texture = gl.createTexture();
  gl.bindTexture(gl.TEXTURE_2D, texture);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);

  const aPos = gl.getAttribLocation(prog, 'a_pos');
  const uRes = gl.getUniformLocation(prog, 'u_resolution');
  const uImg = gl.getUniformLocation(prog, 'u_image');

  return {
    gl,
    render(video) {
      if (!video || video.readyState < 2) return;
      gl.useProgram(prog);

      gl.bindBuffer(gl.ARRAY_BUFFER, posBuf);
      gl.enableVertexAttribArray(aPos);
      gl.vertexAttribPointer(aPos, 2, gl.FLOAT, false, 0, 0);

      gl.activeTexture(gl.TEXTURE0);
      gl.bindTexture(gl.TEXTURE_2D, texture);
      gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, video);
      gl.uniform1i(uImg, 0);

      gl.uniform2f(uRes, canvas.width, canvas.height);
      gl.viewport(0, 0, canvas.width, canvas.height);

      gl.drawArrays(gl.TRIANGLES, 0, 6);
    },
    destroy() {
      try {
        gl.deleteProgram(prog);
        gl.deleteShader(vs);
        gl.deleteShader(fs);
        gl.deleteBuffer(posBuf);
        gl.deleteTexture(texture);
      } catch (e) {}
    }
  };
}

/**
 * Reusable AnimeCam Component
 * Renders real-time Anime Cel-Shaded live video filter with optional cyber hand skeleton overlay.
 */
export default function AnimeCam({
  videoRef,
  overlayCanvasRef,
  landmarks = null,
  isPinching = false,
  className = '',
  style = {}
}) {
  const glCanvasRef = useRef(null);

  useEffect(() => {
    let animId;
    let glHelper = null;
    if (glCanvasRef.current) {
      glHelper = initAnimeGL(glCanvasRef.current);
    }

    const renderLoop = () => {
      const video = videoRef?.current;
      if (video && video.readyState >= 2) {
        // Render Anime Cel-Shaded Video
        if (glHelper) {
          glHelper.render(video);
        } else if (glCanvasRef.current) {
          const ctx = glCanvasRef.current.getContext('2d');
          if (ctx) {
            ctx.save();
            ctx.translate(glCanvasRef.current.width, 0);
            ctx.scale(-1, 1);
            ctx.filter = 'contrast(160%) saturate(160%)';
            ctx.drawImage(video, 0, 0, glCanvasRef.current.width, glCanvasRef.current.height);
            ctx.restore();
          }
        }

        // Render Hand Skeleton if landmarks are provided directly
        if (overlayCanvasRef?.current && landmarks && landmarks.length > 0) {
          const overlay = overlayCanvasRef.current;
          const ctx = overlay.getContext('2d');
          ctx.clearRect(0, 0, overlay.width, overlay.height);

          const w = overlay.width;
          const h = overlay.height;

          // Glowing Bones
          ctx.strokeStyle = '#A3E635';
          ctx.lineWidth = 2;
          ctx.shadowColor = '#A3E635';
          ctx.shadowBlur = 4;
          ctx.beginPath();
          for (const [a, b] of SKELETON_CONNECTIONS) {
            ctx.moveTo((1 - landmarks[a].x) * w, landmarks[a].y * h);
            ctx.lineTo((1 - landmarks[b].x) * w, landmarks[b].y * h);
          }
          ctx.stroke();
          ctx.shadowBlur = 0;

          // Joint Nodes
          for (let i = 0; i < landmarks.length; i++) {
            const x = (1 - landmarks[i].x) * w;
            const y = landmarks[i].y * h;
            const isTip = [4, 8, 12, 16, 20].includes(i);

            ctx.beginPath();
            ctx.arc(x, y, isTip ? 3.5 : 2, 0, Math.PI * 2);
            ctx.fillStyle = isTip ? '#FFE600' : '#FFFFFF';
            ctx.strokeStyle = '#000000';
            ctx.lineWidth = 1;
            ctx.fill();
            ctx.stroke();
          }

          if (isPinching && landmarks[8]) {
            const px = (1 - landmarks[8].x) * w;
            const py = landmarks[8].y * h;
            ctx.beginPath();
            ctx.arc(px, py, 8, 0, Math.PI * 2);
            ctx.fillStyle = 'rgba(250, 204, 21, 0.45)';
            ctx.strokeStyle = '#FFE600';
            ctx.lineWidth = 2;
            ctx.fill();
            ctx.stroke();
          }
        }
      }
      animId = requestAnimationFrame(renderLoop);
    };

    animId = requestAnimationFrame(renderLoop);

    return () => {
      cancelAnimationFrame(animId);
      glHelper?.destroy();
    };
  }, [videoRef, landmarks, isPinching, overlayCanvasRef]);

  return (
    <div
      className={className}
      style={{
        position: 'relative',
        width: '100%',
        height: '100%',
        overflow: 'hidden',
        background: '#18181B',
        ...style,
      }}
    >
      {/* Hardware-accelerated Anime WebGL Canvas */}
      <canvas
        ref={glCanvasRef}
        width={200}
        height={150}
        style={{
          width: '100%',
          height: '100%',
          display: 'block',
          objectFit: 'cover',
        }}
      />

      {/* Cyber Anime Landmark Skeleton Overlay Canvas */}
      {overlayCanvasRef && (
        <canvas
          ref={overlayCanvasRef}
          width={200}
          height={150}
          style={{
            position: 'absolute',
            inset: 0,
            width: '100%',
            height: '100%',
            pointerEvents: 'none',
          }}
        />
      )}

      {/* Top Neo-Brutalist Badge: ANIME CAM */}
      <div
        style={{
          position: 'absolute',
          top: 3,
          left: 3,
          background: '#FFE600',
          color: '#000000',
          border: '1.5px solid #000000',
          boxShadow: '1px 1px 0px #000000',
          padding: '1px 4px',
          fontSize: '8px',
          fontFamily: '"JetBrains Mono", monospace',
          fontWeight: 900,
          textTransform: 'uppercase',
          letterSpacing: '0.05em',
          display: 'flex',
          alignItems: 'center',
          gap: '3px',
          pointerEvents: 'none',
          zIndex: 10,
        }}
      >
        <span
          style={{
            width: '4px',
            height: '4px',
            borderRadius: '50%',
            background: '#22C55E',
          }}
        />
        <span>ANIME CAM</span>
      </div>
    </div>
  );
}

