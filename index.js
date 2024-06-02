window.addEventListener('DOMContentLoaded', async() => {
    const entries = await (await fetch('/assets/sidebar.json')).json();
    const elUiScroll = document.querySelector('#uiScroll');
    let pendingTiles = [];
    const appendPendingTiles = () => {
        if (pendingTiles.length) {
            const tilesCont = document.createElement('div');
            tilesCont.classList.add('tiles');
            for (const tile of pendingTiles) {
                tilesCont.appendChild(tile);
            }
            elUiScroll.appendChild(tilesCont);
            pendingTiles = [];
        }
    }
    for (const entry of entries) {
        if (entry.hide_in_overview) continue;
        if (entry.type == 'header') {
            appendPendingTiles();
            const header = document.createElement('div');
            header.classList.add('header');
            header.innerText = entry.label;
            elUiScroll.appendChild(header);
        }
        if (entry.type == 'item') {
            const tile = document.createElement('a');
            tile.classList.add('btn', 'tile');
            tile.href = entry.href;
            tile.innerHTML = /*html*/`
                <div class="icon">${entry.icon}</div>
                <div class="text">
                    <div class="title">${entry.label}</div>
                    <div class="desc">${entry.description}</div>
                </div>
            `;
            pendingTiles.push(tile);
        }
    }
    appendPendingTiles();
});