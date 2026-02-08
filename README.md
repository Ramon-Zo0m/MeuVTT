# 🎲 MeuVTT - Virtual Tabletop Universal

Um VTT (Virtual Tabletop) **Local-First**, gratuito e leve, desenvolvido com **Electron** e **Socket.io**.
Focado em performance e simplicidade: o Mestre roda o aplicativo no PC e os jogadores acessam diretamente pelo navegador via rede local (ou VPN como Radmin/Hamachi).

![Status](https://img.shields.io/badge/Status-Funcional-brightgreen)
![Tech](https://img.shields.io/badge/Tech-Node.js%20%7C%20Electron%20%7C%20Konva.js-blue)

## ✨ Funcionalidades

* **Zero Instalação para Players:** Jogadores acessam via Link no navegador (Mobile/Desktop).
* **Suporte Multimídia Completo:**
    * Mapas em Imagem (`.jpg`, `.png`) ou Vídeo (`.mp4`, `.webm`).
    * Tokens Animados.
    * Sons de Ambiente e Efeitos (`.mp3`).
* **Sistema de Cenas e Sessões:** Salve o estado da mesa (posições, mapas) organizado por pastas de Sessão.
* **Controles do Mestre:**
    * 🔒 **Trava de Movimento:** Impeça que jogadores mexam nas peças.
    * 🔄 **Sistema de Skins:** Alterne estados do token (machucado, transformado) trocando a imagem automaticamente.
    * 🔊 **Audio Player:** Toque sons sincronizados para todos.
* **Interatividade:**
    * Zoom Inteligente (Scroll do mouse).
    * Redimensionamento e Rotação de Tokens.
    * Flip Horizontal (Tecla F).
    * Estados Visuais (Cor/Filtros).

## 🚀 Como Rodar o Projeto

### Pré-requisitos
* [Node.js](https://nodejs.org/) instalado.
* (Opcional) Radmin VPN ou Hamachi para jogar com amigos via internet.

## 🎮 Controles e Atalhos

### Para o Mestre e Jogadores
* **Arrastar:** Move o token.
* **Clique:** Seleciona o token (Caixa Azul).
* **Roda do Mouse:** Zoom In/Out no mapa.
* **Tecla `F`:** Espelhar (Flip) o token horizontalmente.

### Sistema de Variações (Skins)
Selecione um token e aperte os números para trocar a imagem (requer arquivos nomeados corretamente na pasta, ex: `Goku.png`, `Goku_1.png`):
* **`1`, `2`, `3`:** Troca para a variação correspondente.
* **`0`:** Volta para a imagem original.

### Apenas Mestre
* **`Delete` / `Backspace`:** Apaga o token selecionado.
* **Painel Lateral:**
    * **Salvar Sessão:** Cria uma pasta com o nome da sessão e salva o arquivo JSON da cena.
    * **Trava (Cadeado):** Bloqueia/Libera a movimentação dos players.
    * **Player de Som:** Toca músicas em loop.

---

## 📂 Estrutura de Pastas (Assets)

Para adicionar conteúdo, coloque seus arquivos na pasta `assets` criada automaticamente:

* `assets/Maps/` -> Imagens ou vídeos de fundo.
* `assets/Tokens/` -> Crie pastas aqui (ex: `Herois`, `Monstros`). O sistema cria as categorias automaticamente.
* `assets/Sounds/` -> Arquivos de áudio.
* `assets/Cenas/` -> Onde os saves são guardados (não mexa manualmente).

---

## 🛠️ Tecnologias Utilizadas

* **Electron:** Para criar o executável Desktop do Mestre.
* **Express + Socket.io:** Para o servidor Real-Time e comunicação WebSocket.
* **Konva.js:** Para manipulação do Canvas (mapa, tokens, arraste).
* **HTML5/CSS3:** Interface.

---

Feito para jogar RPG com os amigos.
