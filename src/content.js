import * as tf from '@tensorflow/tfjs-core';
import * as handpose from '@tensorflow-models/handpose';
import '@tensorflow/tfjs-backend-webgl';

// Flags globais de controle
window.__gesturePaused = false;
window.__gestureStop = false;

let shouldRestart = true;

// Container de vídeo/overlay
const container = document.createElement('div');
container.id = 'gesture-video-container';
container.style.position = 'fixed';
container.style.bottom = '10px';
container.style.left = '10px';
container.style.zIndex = '100000';
container.style.backgroundColor = 'rgba(30,30,30,0.9)';
container.style.borderRadius = '8px';
container.style.padding = '5px';
container.style.boxShadow = '0 2px 8px rgba(0,0,0,0.3)';
container.style.maxWidth = '180px';
container.style.width = 'fit-content';
container.style.display = 'flex';
container.style.flexDirection = 'column';

document.body.appendChild(container);

// Vídeo
const video = document.createElement('video');
video.width = 160;
video.height = 120;
video.autoplay = true;
video.style.display = 'block';
video.style.borderRadius = '6px';
container.appendChild(video);

// Canvas para landmarks
const canvas = document.createElement('canvas');
canvas.width = 160;
canvas.height = 120;
canvas.style.position = 'absolute';
canvas.style.bottom = '10px';
canvas.style.left = '10px';
canvas.style.zIndex = '100001';
container.appendChild(canvas);

const ctx = canvas.getContext('2d');

let stream = null;

async function setupWebcam() {
  if (!navigator.mediaDevices?.getUserMedia) throw new Error('Webcam não suportada');
  stream = await navigator.mediaDevices.getUserMedia({ video: true });
  video.srcObject = stream;
  return new Promise((res) => (video.onloadedmetadata = () => res(video)));
}

// ===========================
//  Gestos 
let readyForInput = false;

let lastPositions = [];
let lastGestureTime = 0;
let lastZoomTime = 0;
const gestureCooldown = 3000;
const zoomCooldown = 1000; // 1 segundo entre zooms
let scrollActive = false;

function detectGesture(hand) {
  const now = Date.now();
  const landmarks = hand.landmarks;
  const thumbTip = landmarks[4];
  const indexTip = landmarks[8];
  const palm = landmarks[0];

  const pinchDistance = Math.hypot(
    thumbTip[0] - indexTip[0],
    thumbTip[1] - indexTip[1]
  );

  // Histórico de movimentos
  lastPositions.push({ x: palm[0], y: palm[1], time: now });
  if (lastPositions.length > 6) lastPositions.shift();

  const dx = lastPositions.at(-1).x - lastPositions[0].x;
  const dy = lastPositions.at(-1).y - lastPositions[0].y;
  const dt = lastPositions.at(-1).time - lastPositions[0].time;

  // === Swipes
  if (!scrollActive && dt < 800) {
    if (Math.abs(dx) > 80) {
      lastGestureTime = now;
      return dx < 0 ? 'swipe-left' : 'swipe-right';
    }
    if (dy > 80) {
      lastGestureTime = now;
      return 'swipe-down';
    }
  }

  // === Pinch (refresh)
  if (!scrollActive && pinchDistance < 15) {
    lastGestureTime = now;
    return 'pinch';
  }

  // === Zoom Out (mais de 150px)
  if (!scrollActive && pinchDistance > 150 && now - lastZoomTime > zoomCooldown) {
    lastZoomTime = now;
    return 'zoom-out';
  }

  // === Zoom In (entre 100 e 150px)
  if (!scrollActive && pinchDistance > 100 && pinchDistance <= 150 && now - lastZoomTime > zoomCooldown) {
    lastZoomTime = now;
    return 'zoom-in';
  }

  // === L-shape
  const dxLI = Math.abs(indexTip[0] - thumbTip[0]);
  const dyLI = Math.abs(indexTip[1] - thumbTip[1]);
  if (!scrollActive && dxLI > 80 && dyLI > 80) {
    lastGestureTime = now;
    return 'L-shape';
  }

  // === Scroll
  if (pinchDistance >= 20 && pinchDistance < 60) {
    scrollActive = true;
    return 'closed';
  }

  if (pinchDistance >= 80 && pinchDistance <= 120) {
    scrollActive = true;
    return 'open';
  }

  scrollActive = false;
  return null;
}



function controlBrowser(gesture) {
  try {
    if (gesture === 'open') {
     focarElementoAnterior();
      
      console.log('Gesto: open → Foco no elemento anterior');
    }

    if (gesture === 'closed') {
  focarProximoElemento();
  readyForInput = true;
  console.log('Gesto: closed → Foco + pronto para escrever');
}

if (gesture === 'pinch') {
  clicarElementoFocado('left');
  console.log('Gesto: pinch → Clique esquerdo');
  if (readyForInput) {
    ativarEntradaDeTexto();
    readyForInput = false;
  }
}


    if (gesture === 'swipe-left') {
      window.history.back();
      console.log('Gesto: swipe-left → Back');
    }

    if (gesture === 'swipe-right') {
      window.history.forward();
      console.log('Gesto: swipe-right → Forward');
    }

    if (gesture === 'swipe-up') {
      window.scrollBy(0, -100);
      console.log('Gesto: swipe-up → Fast up');
    }

    if (gesture === 'swipe-down') {
      window.scrollBy(0, 100);
      console.log('Gesto: swipe-down → Fast down');
    }


    if (gesture === 'zoom-in') {
      clicarElementoFocado('left');
    }

    if (gesture === 'zoom-out') {
      const z = parseFloat(document.body.style.zoom || 1) - 0.1;
      document.body.style.zoom = z.toFixed(2);
      console.log('Gesto: zoom-out →', z.toFixed(2));
    }

    if (gesture === 'L-shape') {
      window.location.reload();
      console.log('Gesto: L-shape → Refresh');
    }
  } catch (e) {
    console.error('Erro no gesto', gesture, e);
  }
}

// ===========================
//  Loop principal
// ===========================
async function startDetection() {
  await tf.setBackend('webgl');
  const model = await handpose.load();
  await setupWebcam();

  async function detectLoop() {
    if (window.__gestureStop) return;

    if (!window.__gesturePaused) {
      const predictions = await model.estimateHands(video, true);
      ctx.clearRect(0, 0, canvas.width, canvas.height);

      let gestureLabel = '—';

      if (predictions.length > 0) {
        const hand = predictions[0];

        // Desenhar landmarks
        hand.landmarks.forEach(([x, y]) => {
          ctx.beginPath();
          ctx.arc(x, y, 4, 0, 2 * Math.PI);
          ctx.fillStyle = 'lime';
          ctx.fill();
        });

        const gesture = detectGesture(hand);
        if (gesture) {
          // --- gerir scrollActive & cooldown extra ---
          if (gesture === 'open' || gesture === 'closed') {
            scrollActive = true;
          } else {
            if (scrollActive) lastGestureTime = Date.now();
            scrollActive = false;
          }

          controlBrowser(gesture);
          gestureLabel = gesture;
        } else if (!scrollActive) {
          gestureLabel = '…';
        }
      }

      // HUD de gesto
      ctx.font = '12px Arial';
      ctx.fillStyle = 'white';
      ctx.fillText(`Gesto: ${gestureLabel}`, 5, 15);
    }
    requestAnimationFrame(detectLoop);
  }
  detectLoop();
}

startDetection();

// ===========================
//  Helpers extra
// ===========================


// ================== VOZ =========================

// ========== VOZ AUTOMÁTICA + POR MENSAGEM ==========
if (!location.protocol.startsWith('http')) {
  console.warn('⚠️ Página sem protocolo http/https. Reconhecimento de voz pode falhar:', location.href);
}
let recognizer = null;

// ✅ Inicia reconhecimento
function iniciarReconhecimento() {
  console.log("🎙️ iniciarReconhecimento chamado em:", window.location.href);

  if (recognizer) return;

  const SR = window.SpeechRecognition || window.webkitSpeechRecognition;
  if (!SR) {
    alert('SpeechRecognition não suportado neste navegador.');
    return;
  }

  recognizer = new SR();
  recognizer.lang = 'pt-PT';
  recognizer.continuous = true;
  recognizer.interimResults = false;

  recognizer.onstart = () => console.log('🎤 A ouvir...');
  recognizer.onresult = e => {
    const comando = e.results[e.results.length - 1][0].transcript.trim().toLowerCase();
    console.log('🗣️ Comando reconhecido:', comando);
    executarComando(comando);
  };
  recognizer.onerror = err => {
    console.error('⚠️ Erro:', err.error);
    recognizer = null;
  };
  recognizer.onend = () => {
    console.log('🎤 Reconhecimento parado.');
    recognizer = null;
  };

  recognizer.start();
}

// ✅ Para reconhecimento
function pararReconhecimento() {
  if (recognizer) {
    recognizer.stop();
    recognizer = null;
    console.log('🛑 Reconhecimento parado manualmente.');
  }
}

// ✅ Executa comandos falados
function executarComando(c) {
  const abrir = urlOuNome => {
    let url = urlOuNome.trim();
    if (!url.startsWith('http'))
      url = url.includes('.') ? `https://${url}` : `https://www.${url}.com`;
    window.open(url, '_blank');
  };

  if (c.includes('voltar')) history.back();
  else if (c.includes('avançar')) history.forward();
  else if (c.includes('fechar')) window.close();
  else if (c.includes('recarregar') || c.includes('atualizar')) location.reload();
  else if (c.startsWith('abrir página')) abrir(c.replace('abrir página', ''));
  else if (c.includes('subir')) window.scrollBy(0, -200);
  else if (c.includes('descer')) window.scrollBy(0, 200);
  else if (c.includes('zoom in')) zoom(+0.1);
  else if (c.includes('zoom out')) zoom(-0.1);
  else if (c.includes('ajuda') || c.includes('assistência')) {
    alert('Comandos: voltar, avançar, recarregar, abrir página ..., subir, descer, zoom in/out, parar extensão …');
  }
  else if (c.includes('parar extensão') || c.includes('desligar extensão')) {
    chrome.storage.local.set({ vozAtiva: false });
    pararReconhecimento();
  }

  function zoom(delta) {
    const z = parseFloat(document.body.style.zoom || 1) + delta;
    document.body.style.zoom = z.toString();
  }
}

// ✅ Ativa automaticamente se já estava ligado
if (!window.__vozIniciada) {
  window.__vozIniciada = true;

  chrome.storage.local.get('vozAtiva', dados => {
    if (dados.vozAtiva) iniciarReconhecimento();
  });

  chrome.runtime.onMessage.addListener((msg, _sender, _resp) => {
    if (msg.action === 'start-voice') iniciarReconhecimento();
    if (msg.action === 'stop-voice') pararReconhecimento();
  });
}


let lastFocusTime = 0;

function focarProximoElemento() {
  const now = Date.now();
  if (now - lastFocusTime < 1000) return; // Delay de 800ms
  lastFocusTime = now;

  const focaveis = Array.from(document.querySelectorAll(
    'a, button, input, textarea, select, details, [tabindex]:not([tabindex="-1"])'
  )).filter(el => !el.disabled && el.offsetParent !== null);

  const indexAtual = focaveis.indexOf(document.activeElement);
  const proximo = focaveis[indexAtual + 1] || focaveis[0];

  if (proximo) proximo.focus();
}

let lastFocusTime2 = 0;

function focarElementoAnterior() {
  const now = Date.now();
  if (now - lastFocusTime2 < 1000) return; // Delay de 800ms
  lastFocusTime = now;

  const focaveis = Array.from(document.querySelectorAll(
    'a, button, input, textarea, select, details, [tabindex]:not([tabindex="-1"])'
  )).filter(el => !el.disabled && el.offsetParent !== null);

  const indexAtual = focaveis.indexOf(document.activeElement);
  const anterior = focaveis[indexAtual - 1] || focaveis[0];

  if (anterior) anterior.focus();
}


function clicarElementoFocado(tipo = 'left') {
  const ativo = document.activeElement;
  if (!ativo) return;

  if (tipo === 'left') {
    ativo.click();
    console.log('Clique esquerdo no elemento focado');
  } else if (tipo === 'right') {
    const evt = new MouseEvent('contextmenu', {
      bubbles: true,
      cancelable: true,
      view: window
    });
    ativo.dispatchEvent(evt);
    console.log('Clique direito (context menu)');
  }
}

function ativarEntradaDeTexto() {
  const ativo = document.activeElement;
  if (!ativo || !(ativo.tagName === 'INPUT' || ativo.tagName === 'TEXTAREA')) {
    console.log('Nenhum campo de texto focado para entrada.');
    return;
  }

  ativo.focus();
  console.log('🧠 Entrada de texto ativada. Aguardando comando de voz...');

  if (!('webkitSpeechRecognition' in window)) {
    alert('Reconhecimento de voz não suportado neste navegador.');
    return;
  }

  const recognition = new webkitSpeechRecognition();
  recognition.lang = 'pt-PT';
  recognition.interimResults = false;
  recognition.continuous = false;

  recognition.onstart = () => {
    console.log('🎤 A ouvir...');
  };

  recognition.onresult = (event) => {
    const textoCompleto = event.results[0][0].transcript.trim();
    console.log('🎙️ Texto reconhecido:', textoCompleto);

    if (textoCompleto.toLowerCase().startsWith('pesquisar ')) {
      const termo = textoCompleto.slice(10).trim(); // remove "pesquisar "
      ativo.value = termo;
      console.log('🔍 Termo pesquisado:', termo);

      // Simular Enter (opcional)
      const enterEvent = new KeyboardEvent('keydown', {
        bubbles: true,
        cancelable: true,
        key: 'Enter',
        code: 'Enter',
        keyCode: 13,
      });
      ativo.dispatchEvent(enterEvent);
    } else {
      ativo.value = textoCompleto;
    }
  };

  recognition.onerror = (e) => {
    console.error('Erro no reconhecimento:', e);
  };

  recognition.onend = () => {
    console.log('🎤 Fim da gravação');
  };

  recognition.start();
}

chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  if (request.action === 'start-voice') {
    iniciarReconhecimento();
  } else if (request.action === 'stop-voice') {
    if (recognizer) {
      recognizer.stop();
      recognizer = null;
      console.log('🛑 Reconhecimento de voz parado.');
    }
  }
});
if (!window.__vozIniciada) {
  window.__vozIniciada = true;
  iniciarReconhecimento(); // <- chamada direta
}