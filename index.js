const elUi = document.querySelector('#ui');
const elInteractions = document.querySelector('#interactions');
const elInput = document.querySelector('#input');
const btnSend = document.querySelector('#send');
const btnModel = document.querySelector('#model');
const btnModelName = document.querySelector('#modelName');
const btnSettings = document.querySelector('#settings');
const btnPopOut = document.querySelector('#popOut');

const models = {
    'gpt-3.5-turbo': {
        name: 'GPT-3.5 Turbo',
        desc: 'GPT-3.5 Turbo models are capable and cost-effective.',
        price: {
            input: 0.0005 / 1000,
            output: 0.0015 / 1000
        }
    },
    'gpt-4-turbo-preview': {
        name: 'GPT-4 Turbo',
        desc: 'With 128k context, fresher knowledge and the broadest set of capabilities, GPT-4 Turbo is more powerful than GPT-4 and offered at a lower price.',
        price: {
            input: 0.01 / 1000,
            output: 0.03 / 1000
        }
    }
};

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

const createPopup = (titleHTML = 'Popup', bodyHTML = '', actions) => {
    const dialog = document.createElement('dialog');
    dialog.classList.add('dialog');
    dialog.innerHTML = /*html*/`
        <div class="content col gap-15">
            <div class="title">
                <h4>${titleHTML}</h4>
            </div>
            <div class="body">${bodyHTML}</div>
            <div class="actions row gap-10" style="flex-direction: row-reverse"></div>
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
    document.body.appendChild(dialog);
    return dialog;
}

let generationInProgress = false;
const getModelResponse = async(prompt, streamCb = () => {}) => {
    try {
        const model = localStorageGet('model');
        const systemPrompt = localStorageGet('systemPrompt');
        const key = localStorageGet('apiKey');
        let isFinished = false;
        let response = '';
        let lastResponseText = '';
        generationInProgress = true;
        const res = await axios.post('https://api.openai.com/v1/chat/completions', {
            model: model,
            stream: true,
            messages: [{
                role: 'system',
                content: systemPrompt
            }, {
                role: 'user',
                content: prompt
            }]
        }, {
            headers: {
                'Authorization': `Bearer ${key}`,
            },
            onDownloadProgress: progressEvent => {
                const xhr = progressEvent.event.target
                const text = xhr.responseText.replace(lastResponseText, '');
                lastResponseText = xhr.responseText;
                const messages = text.split('\n').filter(x => x);
                for (const message of messages) {
                    const json = message.replace(/^data: /, '');
                    if (json == '[DONE]') {
                        isFinished = true;
                        break;
                    }
                    const data = JSON.parse(json);
                    const delta = data.choices[0].delta.content;
                    if (!delta) continue;
                    response += delta;
                    streamCb(delta, response);
                }
            }
        });
        generationInProgress = false;
        elInput.dispatchEvent(new Event('input'));
        return response;
    } catch (error) {
        console.log(error);
        generationInProgress = false;
        elInput.dispatchEvent(new Event('input'));
        return false;
    }
};

const setModel = model => {
    localStorageSet('model', model);
    btnModelName.innerText = models[model].name;
};

if (!localStorageGet('model'))
    setModel('gpt-4-turbo-preview');
if (!localStorageGet('systemPrompt'))
    localStorageSet('systemPrompt', 'You are a helpful assistant.');

setModel(localStorageGet('model'));

const addMessage = (role, name, content) => {
    const el = document.createElement('div');
    el.classList = `message ${role} row gap-10`;
    el.innerHTML = /*html*/`
        <div class="picture"></div>
        <div class="col gap-5">
            <div class="name">${name}</div>
            <div class="content">${content}</div>
        </div>
    `;
    elInteractions.insertAdjacentElement('afterbegin', el);
    elInteractions.scrollTop = elInteractions.scrollHeight;
    return el;
}

let samplePrompts = [];
(async() => {
    const res = await axios.get('/prompts.json');
    samplePrompts = res.data;
    input.placeholder = getRandomElement(samplePrompts);
    elInput.dispatchEvent(new Event('input'));
})();

btnModel.addEventListener('click', () => {
    const popup = createPopup('Change model');
    const body = popup.querySelector('.body');
    body.classList = 'col gap-10';
    for (const modelId in models) {
        const model = models[modelId];
        const btn = document.createElement('button');
        btn.classList = 'btn';
        btn.style.height = 'auto';
        btn.style.padding = '10px 15px';
        btn.style.display = 'block';
        btn.style.maxWidth = '500px';
        btn.style.textAlign = 'left';
        btn.style.whiteSpace = 'normal';
        btn.innerHTML = /*html*/`
            <p><b>${model.name}</b></p>
            <p>${model.desc}</p>
            <p>
                About $${model.price.input*1000} per 1000 words of input.
                <br>About $${model.price.output*1000} per 1000 words of output.
            </p>
        `;
        btn.addEventListener('click', () => {
            setModel(modelId);
            popup.close();
        });
        body.appendChild(btn);
    }
    popup.showModal();
});

btnSettings.addEventListener('click', () => {
    const popup = createPopup('Settings', /*html*/`
        <div class="col gap-15">
            <div class="col">
                <label>OpenAI API key</label>
                <div class="row gap-10">
                    <input type="password" id="apiKey" class="textbox" placeholder="<paste key here>" style="width: 400px">
                    <button id="keyVisibility" class="btn icon">visibility</button>
                </div>
                <small class="pad-top">Get or generate your API key <a href="https://platform.openai.com/account/api-keys">here</a>.</small>
            </div>
            <div class="col">
                <label>Context amount</label>
                <input type="number" id="contextCount" class="textbox" placeholder="1" style="width: 100px">
                <small class="pad-top">This value determines how many previous interactions are included as context for new interactions. For example, if set to 1, new interactions will only use the previous user-model interaction as context.</small>
                <small class="pad-top">Higher values will make the bot remember more, but will lead to higher costs and longer loading times. This number will always be capped at the model's max context window in tokens.</small>
                <small class="pad-top">Set to 0 to send no context with new interactions.</small>
            </div>
            <div class="col">
                <label>Active model</label>
                <div>
                    <button id="settingsChangeModel" class="btn">Change model...</button>
                </div>
            </div>
        </div>
    `);
    const body = popup.querySelector('.body');
    const inputApiKey = body.querySelector('#apiKey');
    const btnKeyVisibility = body.querySelector('#keyVisibility');
    const inputContextCount = body.querySelector('#contextCount');
    const btnChangeModel = body.querySelector('#settingsChangeModel');
    btnChangeModel.addEventListener('click', () => {
        btnModel.click();
    });
    inputApiKey.addEventListener('input', () => {
        localStorageSet('apiKey', inputApiKey.value);
    });
    btnKeyVisibility.addEventListener('click', () => {
        inputApiKey.type = inputApiKey.type == 'password' ? 'text' : 'password';
    });
    inputApiKey.value = localStorageGet('apiKey');
    inputContextCount.addEventListener('input', () => {
        localStorageSet('contextCount', parseInt(inputContextCount.value));
    });
    inputContextCount.value = localStorageGet('contextCount') || 1;
    popup.showModal();
});

btnPopOut.addEventListener('click', () => {
    // Open the page in a 500x800 popup
    // Center the popup on the screen
    const width = 500;
    const height = 800;
    const left = (window.screen.width - width) / 2;
    const top = (window.screen.height - height) / 2;
    window.open(window.location.href, 'simplegpt', `width=${width},height=${height},left=${left},top=${top}`).focus();
});

// Hide popup button if in popup
if (window.opener) {
    btnPopOut.style.display = 'none';
}

elInput.addEventListener('input', e => {
    // Set input height to scroll height
    elInput.style.height = 'auto';
    const lineHeight = 16 * 1.4;
    elInput.style.height = `${clamp(elInput.scrollHeight, lineHeight*1, window.innerHeight*0.4)}px`;
    // Disable send button accordingly
    const value = elInput.value.trim();
    if (!value) {
        btnSend.disabled = true;
        return;
    }
    if (!generationInProgress)
        btnSend.disabled = false;
});
elInput.addEventListener('keydown', e => {
    if (e.key == 'Enter' && e.ctrlKey) {
        btnSend.click();
    }
});
elInput.dispatchEvent(new Event('input'));

btnSend.addEventListener('click', async() => {
    if (btnSend.disabled) return;
    const el = document.createElement('div');
    const input = elInput.value.trim();
    elInput.value = '';
    elInput.dispatchEvent(new Event('input'));
    const inputMsg = addMessage('user', 'You', markdownToHtml(input));
    const outputMsg = addMessage('model', models[localStorageGet('model')].name, '');
    const outputContent = outputMsg.querySelector('.content');
    const response = await getModelResponse(input, (delta, response) => {
        outputContent.innerHTML = markdownToHtml(response);
    });
});

window.addEventListener('resize', () => {
    elUi.classList.toggle('floating', window.innerWidth > 1200);
    elInput.dispatchEvent(new Event('input'));
});

window.addEventListener('load', () => {
    window.dispatchEvent(new Event('resize'));
});