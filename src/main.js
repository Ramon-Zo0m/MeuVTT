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
    playersLocked: false
};

const ASSETS_PATH = path.join(__dirname, '../assets');
const TOKENS_PATH = path.join(ASSETS_PATH, 'Tokens');
const CENAS_PATH = path.join(ASSETS_PATH, 'Cenas');

function createWindow() {
    mainWindow = new BrowserWindow({
        width: 1200, height: 800,
        title: "Painel do Mestre - VTT",
        webPreferences: { nodeIntegration: true, contextIsolation: false }
    });
    mainWindow.loadFile('src/dashboard.html');
}

app.whenReady().then(() => {
    createWindow();
    iniciarServidor();
    iniciarVigilanciaDePastas();
});

function iniciarServidor() {
    const expressApp = express();
    const httpServer = http.createServer(expressApp);
    io = new Server(httpServer);

    expressApp.use(express.static(path.join(__dirname, '../src'))); 
    expressApp.use('/assets', express.static(ASSETS_PATH));

    expressApp.get('/', (req, res) => { res.sendFile(path.join(__dirname, 'client.html')); });

    io.on('connection', (socket) => {
        socket.emit('init_state', gameState);

        // --- SISTEMA DE VARIAÇÃO DE TOKEN ---
        socket.on('request_variation', (data) => {
            const tk = gameState.tokens.find(t => t.id === data.id);
            if (!tk) return;

            const urlPath = decodeURI(tk.img); 
            const relativePath = urlPath.replace('/assets', '');
            const fullPath = path.join(ASSETS_PATH, relativePath);
            const directory = path.dirname(fullPath);
            const filename = path.basename(fullPath); 
            const ext = path.extname(filename);
            const baseName = filename.replace(/_\d+(\.[^/.]+)$/, '$1'); 
            
            let novoNome = baseName;
            if (data.variation !== '0') {
                const nomeSemExt = path.basename(baseName, ext);
                novoNome = `${nomeSemExt}_${data.variation}${ext}`;
            }

            const novoCaminhoCompleto = path.join(directory, novoNome);
            if (fs.existsSync(novoCaminhoCompleto)) {
                const urlDir = path.dirname(tk.img);
                const novaUrl = `${urlDir}/${novoNome}`;
                tk.img = novaUrl; 
                io.emit('update_token_image', { id: tk.id, img: novaUrl });
            }
        });

        // --- OUTROS EVENTOS ---
        socket.on('gm_toggle_lock', () => {
            gameState.playersLocked = !gameState.playersLocked;
            io.emit('update_lock_state', gameState.playersLocked);
        });

        socket.on('gm_change_map', (url) => { gameState.sceneImage = url; io.emit('set_background', url); });
        
        socket.on('gm_add_token', (tokenData) => { 
            tokenData.scaleX = 1; tokenData.scaleY = 1; 
            gameState.tokens.push(tokenData); io.emit('add_token', tokenData); 
        });
        
        socket.on('gm_clear_all', () => { gameState.tokens = []; io.emit('clear_tokens'); });
        
        socket.on('move_token', (data) => {
            const tk = gameState.tokens.find(t => t.id === data.id);
            if (tk) { tk.x = data.x; tk.y = data.y; socket.broadcast.emit('update_token', data); }
        });

        socket.on('resize_token', (data) => {
            const tk = gameState.tokens.find(t => t.id === data.id);
            if (tk) { tk.scaleX = data.scaleX; tk.scaleY = data.scaleY; tk.rotation = data.rotation; socket.broadcast.emit('update_token_size', data); }
        });
        
        socket.on('gm_delete_token', (id) => {
            gameState.tokens = gameState.tokens.filter(t => t.id !== id);
            io.emit('delete_token', id);
        });
    });

    httpServer.listen(3000, '0.0.0.0', () => console.log('Servidor ON'));
}

function iniciarVigilanciaDePastas() {
    // Garante que as pastas existem ao iniciar
    if (!fs.existsSync(TOKENS_PATH)) fs.mkdirSync(TOKENS_PATH, { recursive: true });
    if (!fs.existsSync(CENAS_PATH)) fs.mkdirSync(CENAS_PATH, { recursive: true });

    fs.watch(TOKENS_PATH, { recursive: true }, () => { if (mainWindow) mainWindow.webContents.send('folders-updated'); });
    fs.watch(CENAS_PATH, () => { if (mainWindow) mainWindow.webContents.send('folders-updated'); }); // Avisa se cenas mudarem
}

ipcMain.handle('get-ip', () => ip.address());
ipcMain.handle('get-files', async (event, folder) => {
    const dir = path.join(ASSETS_PATH, folder);
    if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
    
    if (folder === 'Cenas') return fs.readdirSync(dir).filter(f => f.endsWith('.json'));
    if (folder === 'Tokens') return fs.readdirSync(dir, { withFileTypes: true }).filter(d => d.isDirectory()).map(d => d.name);
    return fs.readdirSync(dir).filter(f => f.match(/\.(png|jpg|jpeg|webp)$/i));
});

// --- SALVAR CENA (CORRIGIDO) ---
ipcMain.handle('save-scene', async (event, nomeCena) => {
    try {
        if (!fs.existsSync(CENAS_PATH)) fs.mkdirSync(CENAS_PATH, { recursive: true });
        
        // Remove caracteres perigosos do nome do arquivo
        const nomeArquivo = nomeCena.replace(/[^a-z0-9 \-_]/gi, '_') + '.json';
        const caminho = path.join(CENAS_PATH, nomeArquivo);
        
        fs.writeFileSync(caminho, JSON.stringify(gameState, null, 2));
        console.log("Cena salva com sucesso:", caminho);
        return { success: true };
    } catch (err) {
        console.error("Erro ao salvar cena:", err);
        return { success: false, error: err.message };
    }
});

ipcMain.handle('load-scene', async (event, nomeArquivo) => {
    const caminho = path.join(CENAS_PATH, nomeArquivo);
    if (fs.existsSync(caminho)) {
        gameState = JSON.parse(fs.readFileSync(caminho));
        if(io) { io.emit('clear_tokens'); setTimeout(() => io.emit('init_state', gameState), 100); }
    }
});