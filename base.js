const getRandomElement = arr => arr[Math.floor(Math.random() * arr.length)];

const clamp = (val, min, max) => Math.min(Math.max(val, min), max);

const localStorageGet = key => {
    return window.localStorage.getItem(key);
};
const localStorageSet = (key, value) => {
    window.localStorage.setItem(key, value);
};

const markdownToHtml = markdown => {
    return DOMPurify.sanitize(marked.parse(markdown));
};

const copyElementHtml = async element => {
    try {
        // Create a new Blob object with HTML type
        //const blob = new Blob([element.innerHTML], { type: 'text/html' });
        // Use the ClipboardItem API with our blob
        //await navigator.clipboard.write([new ClipboardItem({ 'text/html': blob })]);
        await navigator.clipboard.writeText(element.innerHTML);
    } catch (error) {
        console.error('Failed to copy:', error);
    }
}

const showPopup = (titleHTML = 'Popup', bodyHTML = '', actions) => {
    const dialog = document.createElement('dialog');
    dialog.classList.add('dialog');
    dialog.innerHTML = /*html*/`
        <div class="content col gap-5">
            <div class="title flex-no-shrink">
                <h4>${titleHTML}</h4>
            </div>
            <div class="body">${bodyHTML}</div>
            <div class="actions row gap-10 flex-no-shrink" style="flex-direction: row-reverse"></div>
        </div>
    `;
    if (!actions) actions = [{
        label: 'Close',
        onClick: () => dialog.close()
    }];
    for (const action of actions) {
        const btn = document.createElement('button');
        btn.classList = 'btn';
        btn.innerText = action.label;
        btn.addEventListener('click', () => {
            action.onClick();
            dialog.close();
        });
        dialog.querySelector('.actions').appendChild(btn);
    }
    dialog.addEventListener('close', () => {
        if (!dialog.classList.contains('visible')) return;
        dialog.showModal();
        dialog.classList.remove('visible');
        setTimeout(() => {
            dialog.remove();
        }, 300);
    });
    document.body.appendChild(dialog);
    dialog.showModal();
    setTimeout(() => {
        dialog.classList.add('visible');
    }, 10);
    return dialog;
}