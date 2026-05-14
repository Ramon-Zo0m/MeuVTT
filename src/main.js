const { app, BrowserWindow, ipcMain } = require('electron');
const path = require('path');
const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const fs = require('fs');
const ip = require('ip');

let mainWindow;
let io;

// ESTADO DO JOGO
let gameState = {
    sceneImage: null,
    tokens: [],
    playersLocked: false,
    currentAudio: null,
    audioStartTime: 0
};

// --- MUDANÇA CRÍTICA PARA O INSTALADOR ---
const documentsPath = app.getPath('documents');
const ASSETS_PATH = path.join(documentsPath, 'OpenVTT_Assets');

const TOKENS_PATH = path.join(ASSETS_PATH, 'Tokens');
const CENAS_PATH = path.join(ASSETS_PATH, 'Cenas');
const SOUNDS_PATH = path.join(ASSETS_PATH, 'Sounds');
const MAPS_PATH = path.join(ASSETS_PATH, 'Maps');

// Função para garantir que as pastas existem na primeira vez que abre
function garantirPastas() {
    if (!fs.existsSync(ASSETS_PATH)) fs.mkdirSync(ASSETS_PATH, { recursive: true });
    if (!fs.existsSync(TOKENS_PATH)) fs.mkdirSync(TOKENS_PATH, { recursive: true });
    if (!fs.existsSync(CENAS_PATH)) fs.mkdirSync(CENAS_PATH, { recursive: true });
    if (!fs.existsSync(SOUNDS_PATH)) fs.mkdirSync(SOUNDS_PATH, { recursive: true });
    if (!fs.existsSync(MAPS_PATH)) fs.mkdirSync(MAPS_PATH, { recursive: true });
    console.log("Pastas garantidas em: " + ASSETS_PATH);
}

function createWindow() {
    mainWindow = new BrowserWindow({
        width: 1200, height: 800,
        title: "Painel do Mestre - OpenVTT",
        
        icon: path.join(__dirname, '../build/icon.png'), 
        
        webPreferences: { nodeIntegration: true, contextIsolation: false }
    });
    mainWindow.loadFile('src/dashboard.html');
}

app.whenReady().then(() => {
    garantirPastas(); // <--- CRIA AS PASTAS ASSIM QUE ABRE
    createWindow();
    iniciarServidor();
    iniciarVigilanciaDePastas();
});

function iniciarServidor() {
    const expressApp = express();
    const httpServer = http.createServer(expressApp);
    io = new Server(httpServer, {
        cors: { origin: "*" },
        pingTimeout: 60000 // Aumenta tolerância de conexão
    });

    expressApp.use(express.static(path.join(__dirname, '../src'))); 
    expressApp.use('/assets', express.static(ASSETS_PATH));
    expressApp.get('/', (req, res) => { res.sendFile(path.join(__dirname, 'client.html')); });

    io.on('connection', (socket) => {
        // Envia estado atual para quem acabou de entrar (ou deu F5)
        socket.emit('init_state', {
            ...gameState,
            serverTime: Date.now() // Envia hora do servidor para sincronia perfeita
        });

        // --- ÁUDIO SINCRONIZADO ---
        socket.on('gm_play_audio', (data) => {
            gameState.currentAudio = data;
            gameState.audioStartTime = Date.now(); // Marca o inicio
            io.emit('play_audio', { ...data, startTime: gameState.audioStartTime });
        });

        socket.on('gm_stop_audio', () => {
            gameState.currentAudio = null;
            gameState.audioStartTime = 0;
            io.emit('stop_audio');
        });

        // --- SISTEMA DE IMAGEM/VÍDEO/SKINS ---
        socket.on('request_variation', (data) => {
            const tk = gameState.tokens.find(t => t.id === data.id);
            if (!tk) return;
            // Lógica de variação de arquivo
            const urlPath = decodeURI(tk.img).replace('/assets', '');
            const fullPath = path.join(ASSETS_PATH, urlPath);
            const directory = path.dirname(fullPath);
            const filename = path.basename(fullPath);
            const ext = path.extname(filename);
            const baseName = filename.replace(/_\d+(\.[^/.]+)$/, '$1');
            let novoNome = baseName;
            if (data.variation !== '0') {
                const nomeSemExt = path.basename(baseName, ext);
                novoNome = `${nomeSemExt}_${data.variation}${ext}`;
            }
            const novoCaminho = path.join(directory, novoNome);
            if (fs.existsSync(novoCaminho)) {
                const novaUrl = `${path.dirname(tk.img)}/${novoNome}`;
                tk.img = novaUrl;
                // Usa io.emit para garantir que TODOS vejam a troca
                io.emit('update_token_image', { id: tk.id, img: novaUrl });
            }
        });

        socket.on('gm_toggle_lock', () => { gameState.playersLocked = !gameState.playersLocked; io.emit('update_lock_state', gameState.playersLocked); });
        socket.on('gm_change_map', (url) => { gameState.sceneImage = url; io.emit('set_background', url); });
        
        socket.on('gm_add_token', (tokenData) => { 
            // Recebe posição já calculada do Dashboard
            gameState.tokens.push(tokenData); 
            io.emit('add_token', tokenData); 
        });
        
        socket.on('gm_clear_all', () => { gameState.tokens = []; io.emit('clear_tokens'); });
        
        // Movimentação com atualização de estado garantida
        socket.on('move_token', (data) => {
            const tk = gameState.tokens.find(t => t.id === data.id);
            if (tk) { 
                tk.x = data.x; tk.y = data.y; 
                // broadcast envia para todos MENOS quem enviou. 
                // Isso evita "tremedeira" no player que está arrastando.
                socket.broadcast.emit('update_token', data); 
            }
        });

        socket.on('resize_token', (data) => {
            const tk = gameState.tokens.find(t => t.id === data.id);
            if (tk) { 
                tk.scaleX = data.scaleX; tk.scaleY = data.scaleY; tk.rotation = data.rotation; 
                socket.broadcast.emit('update_token_size', data); 
            }
        });

        socket.on('gm_delete_token', (id) => {
            gameState.tokens = gameState.tokens.filter(t => t.id !== id);
            io.emit('delete_token', id);
        });
    });

    httpServer.listen(3000, '0.0.0.0', () => console.log('Servidor ON'));
}

function iniciarVigilanciaDePastas() {
    if (!fs.existsSync(TOKENS_PATH)) fs.mkdirSync(TOKENS_PATH, { recursive: true });
    if (!fs.existsSync(CENAS_PATH)) fs.mkdirSync(CENAS_PATH, { recursive: true });
    if (!fs.existsSync(SOUNDS_PATH)) fs.mkdirSync(SOUNDS_PATH, { recursive: true });

    const update = () => { if (mainWindow) mainWindow.webContents.send('folders-updated'); };
    fs.watch(TOKENS_PATH, { recursive: true }, update);
    fs.watch(CENAS_PATH, { recursive: true }, update);
    fs.watch(SOUNDS_PATH, { recursive: true }, update);
    fs.watch(path.join(ASSETS_PATH, 'Maps'), update);
}

ipcMain.handle('get-ip', () => ip.address());

ipcMain.handle('get-files', async (event, folder) => {
    const dir = path.join(ASSETS_PATH, folder);
    if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
    if (folder === 'Cenas') return fs.readdirSync(dir, { withFileTypes: true }).filter(d => d.isDirectory()).map(d => d.name);
    if (folder.startsWith('Cenas') && folder !== 'Cenas') return fs.readdirSync(dir).filter(f => f.endsWith('.json'));
    if (folder === 'Tokens') return fs.readdirSync(dir, { withFileTypes: true }).filter(d => d.isDirectory()).map(d => d.name);
    return fs.readdirSync(dir).filter(f => f.match(/\.(png|jpg|jpeg|webp|mp4|webm|mp3|wav|ogg)$/i));
});

ipcMain.handle('save-scene', async (event, { nomeSessao, nomeCena }) => {
    try {
        if (!fs.existsSync(CENAS_PATH)) fs.mkdirSync(CENAS_PATH);
        const sessaoPath = path.join(CENAS_PATH, nomeSessao);
        if (!fs.existsSync(sessaoPath)) fs.mkdirSync(sessaoPath);
        const caminhoFinal = path.join(sessaoPath, nomeCena.replace(/[^a-z0-9 \-_]/gi, '_') + '.json');
        fs.writeFileSync(caminhoFinal, JSON.stringify(gameState, null, 2));
        return { success: true };
    } catch (err) { return { success: false, error: err.message }; }
});

ipcMain.handle('load-scene', async (event, { nomeSessao, nomeArquivo }) => {
    try {
        const caminho = path.join(CENAS_PATH, nomeSessao, nomeArquivo);
        if (fs.existsSync(caminho)) {
            gameState = JSON.parse(fs.readFileSync(caminho));
            if(io) {
                io.emit('clear_tokens');
                io.emit('stop_audio'); 
                setTimeout(() => {
                    // Ao carregar cena, reinicia o contador de audio
                    if(gameState.currentAudio) gameState.audioStartTime = Date.now();
                    
                    io.emit('init_state', { ...gameState, serverTime: Date.now() });
                    if(gameState.sceneImage) io.emit('set_background', gameState.sceneImage);
                    if(gameState.currentAudio) io.emit('play_audio', { ...gameState.currentAudio, startTime: gameState.audioStartTime });
                }, 200);
            }
            return { success: true };
        }
    } catch (e) { return { success: false, error: e.message }; }
    return { success: false, error: "Erro desconhecido" };
});