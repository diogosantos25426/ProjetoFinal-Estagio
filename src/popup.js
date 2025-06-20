console.log('popup.js carregado');

document.getElementById('startBtn').addEventListener('click', () => {
  chrome.tabs.query({ active: true, currentWindow: true }, tabs => {
    if (tabs[0]?.id) {
      chrome.runtime.sendMessage({ action: 'startGestureControl', tabId: tabs[0].id });
    }
  });
});

document.getElementById('pauseBtn').addEventListener('click', () => {
  chrome.tabs.query({ active: true, currentWindow: true }, tabs => {
    if (tabs[0]?.id) {
      chrome.runtime.sendMessage({ action: 'pauseGestureControl', tabId: tabs[0].id });
    }
  });
});

document.getElementById('stopBtn').addEventListener('click', () => {
  chrome.tabs.query({ active: true, currentWindow: true }, tabs => {
    if (tabs[0]?.id) {
      chrome.runtime.sendMessage({ action: 'stopGestureControl', tabId: tabs[0].id });
    }
  });
});

document.getElementById('voiceBtn').addEventListener('click', () => {
  chrome.tabs.query({ active: true, currentWindow: true }, tabs => {
    if (tabs[0]?.id) {
      chrome.runtime.sendMessage({ action: 'startPesquisarComando', tabId: tabs[0].id });
    }
  });
});

document.getElementById('ativarVoz').addEventListener('click', () => {
  chrome.tabs.query({ active: true, currentWindow: true }, tabs => {
    if (tabs[0]?.id) {
      chrome.tabs.sendMessage(tabs[0].id, { action: 'start-voice' });
    }
  });
});
