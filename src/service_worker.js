import * as tf from '@tensorflow/tfjs-core';
import * as handpose from '@tensorflow-models/handpose';

chrome.runtime.onInstalled.addListener(() => {
  chrome.contextMenus.create({
    id: 'gesture-control',
    title: 'Ativar Controle por Gestos',
    contexts: ['all']
  });
});

chrome.contextMenus.onClicked.addListener((info, tab) => {
  if (info.menuItemId === 'gesture-control') {
    chrome.scripting.executeScript({
      target: { tabId: tab.id },
      files: ['src/content.js']
    });
    console.log('[BACKGROUND] Script de controle por gestos injetado via menu de contexto.');
  }
});

chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  const { action, tabId } = message;
  console.log('[BACKGROUND] Mensagem recebida:', message);

  if (!tabId) return;

  switch (action) {
    case 'startGestureControl':
      chrome.scripting.executeScript({
        target: { tabId },
        files: ['src/content.js']
      });
      console.log('[BACKGROUND] Injetando content.js para iniciar gestos.');
      break;

    case 'pauseGestureControl':
      chrome.scripting.executeScript({
        target: { tabId },
        func: () => {
          console.log('[CONTENT] Gestos pausados.');
          window.__gesturePaused = true;
        }
      });
      break;

    case 'stopGestureControl':
      chrome.scripting.executeScript({
        target: { tabId },
        func: () => {
          console.log('[CONTENT] Encerrando controle de gestos...');
          const container = document.getElementById('gesture-video-container');
          if (container) {
            const video = container.querySelector('video');
            if (video?.srcObject) {
              video.srcObject.getTracks().forEach(t => t.stop());
            }
            container.remove();
          }
          window.__gesturePaused = false;
          window.__gestureStop = true;
        }
      });
      break;

    case 'startPesquisarComando':
      chrome.scripting.executeScript({
        target: { tabId },
        func: () => {
          if (typeof window.escutaComandoPesquisar === 'function') {
            console.log('[CONTENT] Iniciando escuta por "pesquisar ..." via popup.');
            window.escutaComandoPesquisar();
          } else {
            console.warn('[CONTENT] Função escutaComandoPesquisar não encontrada.');
          }
        }
      });
      break;

    default:
      console.warn('[BACKGROUND] Ação desconhecida:', action);
  }
});
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  if (request.action === "iniciarReconhecimento") {
    iniciarReconhecimento();
  }
});

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