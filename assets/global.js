let defaultConfig = {
    openai_api_key: '',
    imgbb_key: 'd7df51cf14f9ce4e6f8e88f5d0f3693f',
    chat_model: 'gpt-4o-mini',
    chat_system_prompt: 'You are a helpful assistant.',
    chat_context_count: 0,
    chat_messages: '{}'
};
const appVersion = 'v5';

const elUi = document.querySelector('#ui');
const elSidebar = document.querySelector('#sidebar');
const elTitle = document.querySelector('#title');

window.addEventListener('DOMContentLoaded', async() => {
    const sidebar = await (await fetch('/assets/sidebar.json')).json();
    elSidebar.innerHTML = /*html*/`
        <h3 class="title">SimpleAI</h3>
    `;
    for (const entry of sidebar) {
        if (entry.type == 'header') {
            elSidebar.insertAdjacentHTML('beforeend', /*html*/`
                <div class="header">${entry.label}</div>
            `);
        }
        if (entry.type == 'item') {
            elSidebar.insertAdjacentHTML('beforeend', /*html*/`
                <a href="${entry.href}" class="btn">
                    <span class="icon">${entry.icon}</span>
                    ${entry.label}
                </a>
            `);
            const currentPath = window.location.pathname;
            if (normalizePath(currentPath) == normalizePath(entry.href)) {
                elSidebar.lastElementChild.classList.add('active');
                document.title = `${entry.label} | SimpleAI`;
                elTitle.innerHTML = `<h4>${entry.label}</h4>`;
            }
        }
    }
});

window.addEventListener('load', () => {
    if (localStorageGet('app_version') != appVersion) {
        window.localStorage.clear();
        localStorageSet('app_version', appVersion);
    }
});