const getRandomElement = arr => arr[Math.floor(Math.random() * arr.length)];

const clamp = (val, min, max) => Math.min(Math.max(val, min), max);

const normalizePath = (path) => {
    const parts = path.split('/');
    const normalizedParts = [];

    for (const part of parts) {
        if (part === '..') {
            normalizedParts.pop();
        } else if (part !== '.' && part !== '') {
            normalizedParts.push(part);
        }
    }

    return normalizedParts.join('/');
}

const localStorageGet = key => {
    let value = window.localStorage.getItem(key);
    if (value === null) value = defaultConfig[key];
    return (value === null || value === undefined) ? null : value;
};
const localStorageSet = (key, value) => {
    window.localStorage.setItem(key, value);
};

const sleep = ms => new Promise(resolve => setTimeout(resolve, ms));

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

const selectImagesBase64 = (multiple = true) => new Promise((resolve, reject) => {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = 'image/*';
    input.multiple = multiple;
    input.addEventListener('change', async e => {
        if (!e.target.files[0]) return resolve(null);
        const images = [];
        for (const file of e.target.files) {
            if (file.size > 1000 * 1000 * 32) {
                console.error(`File "${file.name}" is too large!`);
                continue;
            }
            const reader = new FileReader();
            await new Promise(resolve2 => {
                reader.onload = e => {
                    images.push(e.target.result);
                    resolve2();
                };
                reader.readAsDataURL(file);
            });
        }
        resolve(images);
    });
    input.click();
});

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