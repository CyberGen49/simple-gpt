const elUi = document.querySelector('#ui');
const elInteractions = document.querySelector('#interactions');
const elInput = document.querySelector('#input');
const btnSend = document.querySelector('#send');
const btnModel = document.querySelector('#model');
const btnModelName = document.querySelector('#modelName');
const btnSettings = document.querySelector('#settings');
const elSettingsLink = document.querySelector('#settingsLink');
const progress = document.querySelector('progress');

const models = {
    'gpt-3.5-turbo': {
        name: 'GPT-3.5 Turbo',
        desc: 'GPT-3.5 Turbo models are capable and cost-effective.',
        price: {
            input: 0.0005 / 1000,
            output: 0.0015 / 1000
        },
        hue: 100
    },
    'gpt-4-turbo-preview': {
        name: 'GPT-4 Turbo',
        desc: 'With 128k context, fresher knowledge and the broadest set of capabilities, GPT-4 Turbo is more powerful than GPT-4 and offered at a lower price.',
        price: {
            input: 0.01 / 1000,
            output: 0.03 / 1000
        },
        hue: 165
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

let generationInProgress = false;
const getModelResponse = async(prompt, streamCb = () => {}) => {
    try {
        const model = localStorageGet('model');
        const systemPrompt = localStorageGet('systemPrompt');
        const key = localStorageGet('apiKey') || '';
        if (!key.trim()) throw new Error(`Missing API key! Get or generate yours [here](https://platform.openai.com/account/api-keys), then apply it from the Settings button in the top right.`);
        const contextCount = parseInt(localStorageGet('contextCount') || 0);
        const storedMessages = (JSON.parse(localStorageGet('messages')) || []).reverse();
        const context = [{
            role: 'system',
            content: systemPrompt
        }];
        for (let i = 0; i < contextCount; i++) {
            const msg = storedMessages[i];
            if (!msg) break;
            context.push({
                role: msg.role == 'model' ? 'assistant' : 'user',
                content: msg.content
            });
        }
        let isFinished = false;
        let response = '';
        let lastResponseText = '';
        generationInProgress = true;
        progress.style.display = '';
        const res = await axios.post('https://api.openai.com/v1/chat/completions', {
            model: model,
            stream: true,
            messages: [ ...context, { role: 'user', content: prompt }]
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
                    let data;
                    try {
                        data = JSON.parse(json);
                    } catch (error) {}
                    const delta = data.choices[0].delta.content;
                    if (!delta) continue;
                    response += delta;
                    streamCb(delta, response);
                }
            }
        });
        generationInProgress = false;
        elInput.dispatchEvent(new Event('input'));
        progress.style.display = 'none';
        return { success: true, response };
    } catch (error) {
        console.log(error);
        const message = error.response?.data?.error?.message || error.message || error.toString();
        generationInProgress = false;
        elInput.dispatchEvent(new Event('input'));
        progress.style.display = 'none';
        return { success: false, error: message };
    }
};

const setModel = model => {
    localStorageSet('model', model);
    let modelData = models[model];
    if (!modelData) modelData = Object.values(models)[0];
    btnModelName.innerText = models[model].name;
};

const addMessage = (role, name, content) => {
    const el = document.createElement('div');
    el.classList = `message ${role} row gap-10`;
    el.innerHTML = /*html*/`
        <div class="picture"></div>
        <div class="col gap-5">
            <div class="name">${name}</div>
            <div class="content">${content}</div>
        </div>
        <div class="menu row gap-5">
            <button class="copyText btn no-shadow small icon" title="Copy message text">
                content_copy
            </button>
            <button class="copyHtml btn no-shadow small icon" title="Copy message HTML">
                code
            </button>
            <button class="delete btn no-shadow small icon danger" title="Delete message">
                delete
            </button>
        </div>
    `;
    const btnCopyText = el.querySelector('.copyText');
    const btnCopyHtml = el.querySelector('.copyHtml');
    const btnDelete = el.querySelector('.delete');
    btnCopyHtml.addEventListener('click', () => {
        navigator.clipboard.writeText(el.querySelector('.content').innerHTML);
    });
    elInteractions.insertAdjacentElement('afterbegin', el);
    elInteractions.scrollTop = 0;
    return el;
}

btnModel.addEventListener('click', () => {
    const popup = showPopup('Change model');
    const body = popup.querySelector('.body');
    const buttonCont = document.createElement('div');
    buttonCont.classList = 'col gap-10';
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
        buttonCont.appendChild(btn);
    }
    body.appendChild(buttonCont);
    popup.showModal();
});

btnSettings.addEventListener('click', () => {
    const popup = showPopup('Settings', /*html*/`
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
                <label>Active model</label>
                <div>
                    <button id="settingsChangeModel" class="btn">Change model...</button>
                </div>
            </div>
            <div class="col">
                <label>System prompt</label>
                <textarea id="systemPrompt" rows="5" class="textbox auto" style="max-width: 100%; width: 500px"></textarea>
                <small class="pad-top">The system prompt can be used to influence the model's behavior and is sent at the beginning of every interaction.</small>
            </div>
            <div class="col">
                <label>Context messages</label>
                <input type="number" id="contextCount" class="textbox" placeholder="2" style="width: 100px">
                <small class="pad-top">This value determines how many previous messages are included as context for new interactions. For example, if set to 2, new interactions will include the previous 2 messages.</small>
                <small class="pad-top">Higher numbers will allow the model to remember further back, but will result in greater costs and longer loading times.</small>
                <small class="pad-top">Set to 0 to not include any context with new interactions.</small>
            </div>
            <div class="col">
                <label>Clear local storage</label>
                <div>
                    <button id="wipeStorage" class="btn danger">Wipe</button>
                </div>
                <small class="pad-top">Clear all locally stored data for this site, including message history and settings.</small>
            </div>
        </div>
    `);
    const body = popup.querySelector('.body');
    const inputApiKey = body.querySelector('#apiKey');
    const btnKeyVisibility = body.querySelector('#keyVisibility');
    const inputSystemPrompt = body.querySelector('#systemPrompt');
    const inputContextCount = body.querySelector('#contextCount');
    const btnChangeModel = body.querySelector('#settingsChangeModel');
    const btnWipe = body.querySelector('#wipeStorage');
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
    inputSystemPrompt.addEventListener('input', () => {
        localStorageSet('systemPrompt', inputSystemPrompt.value.trim() || 'You are a helpful assistant.');
    });
    inputSystemPrompt.value = localStorageGet('systemPrompt');
    inputContextCount.addEventListener('input', () => {
        localStorageSet('contextCount', parseInt(inputContextCount.value));
    });
    inputContextCount.value = localStorageGet('contextCount');
    btnWipe.addEventListener('click', () => {
        window.localStorage.clear();
        window.location.reload();
    });
    popup.showModal();
});

elSettingsLink.addEventListener('click', () => btnSettings.click());

elInput.addEventListener('input', e => {
    // Set input height to scroll height
    elInput.style.height = 'auto';
    const lineHeight = 16 * 1.4;
    elInput.style.height = `${clamp(elInput.scrollHeight+2, lineHeight, window.innerHeight*0.4)}px`;
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
        e.preventDefault();
        btnSend.click();
    }
});
elInput.dispatchEvent(new Event('input'));

let samplePrompts = [];
(async() => {
    const res = await axios.get('/prompts.json');
    samplePrompts = res.data;
    input.placeholder = getRandomElement(samplePrompts);
    elInput.dispatchEvent(new Event('input'));
})();

btnSend.addEventListener('click', async() => {
    if (btnSend.disabled) return;
    // Get input text and clear draft bar
    const input = elInput.value.trim();
    input.placeholder = getRandomElement(samplePrompts);
    elInput.value = '';
    elInput.focus();
    elInput.dispatchEvent(new Event('input'));
    // Get saved messages
    const messages = JSON.parse(localStorageGet('messages')) || [];
    // Create user message entry
    const inputMsg = addMessage('user', 'You', markdownToHtml(input));
    messages.push({
        role: 'user',
        name: 'You',
        content: input
    });
    inputMsg.dataset.index = messages.length - 1;
    inputMsg.querySelector('.copyText').addEventListener('click', () => {
        navigator.clipboard.writeText(input);
    });
    inputMsg.querySelector('.delete').addEventListener('click', () => {
        inputMsg.remove();
        messages.splice(parseInt(inputMsg.dataset.index), 1);
        localStorageSet('messages', JSON.stringify(messages));
    });
    // Create model message entry
    const model = models[localStorageGet('model')];
    const tmpMsg = addMessage('model', model.name, '');
    tmpMsg.style.setProperty('--hue', model.hue);
    tmpMsg.querySelector('.menu').style.display = 'none';
    // Update model message content as it generates
    const outputContent = tmpMsg.querySelector('.content');
    const response = await getModelResponse(input, (delta, response) => {
        const isAtBottom = elInteractions.scrollTop > -10;
        outputContent.innerHTML = markdownToHtml(response);
        Prism.highlightAllUnder(outputContent);
        if (isAtBottom) {
            elInteractions.scrollTop = 0;
        }
    });
    if (!response.success) {
        // Show an error message
        outputContent.innerHTML = /*html*/`
            <div class="error">
                ${markdownToHtml(response.error)}
            </div>
        `;
    } else {
        // Save response
        messages.push({
            role: 'model',
            model: model,
            name: model.name,
            content: response.response
        });
        while (messages.length > 128) {
            messages.shift();
        }
        localStorageSet('messages', JSON.stringify(messages));
        // Replace displayed message
        tmpMsg.remove();
        const msg = addMessage('model', model.name, markdownToHtml(response.response));
        msg.dataset.index = messages.length - 1;
        msg.style.setProperty('--hue', model.hue);
        msg.querySelector('.copyText').addEventListener('click', () => {
            navigator.clipboard.writeText(response.response);
        });
        msg.querySelector('.delete').addEventListener('click', () => {
            msg.remove();
            messages.splice(parseInt(msg.dataset.index), 1);
            localStorageSet('messages', JSON.stringify(messages));
        });
        Prism.highlightAllUnder(msg);
    }
});

window.addEventListener('resize', () => {
    elInput.dispatchEvent(new Event('input'));
});

window.addEventListener('load', async() => {
    window.dispatchEvent(new Event('resize'));

    const appVersion = 'v2';
    if (localStorageGet('simplegpt-version') != appVersion) {
        window.localStorage.clear();
        localStorageSet('simplegpt-version', appVersion);
    }
    if (!localStorageGet('model'))
        localStorageSet('model', 'gpt-4-turbo-preview');
    if (!localStorageGet('systemPrompt'))
        localStorageSet('systemPrompt', 'You are a helpful assistant.');
    if (!localStorageGet('contextCount'))
        localStorageSet('contextCount', 0);

    setModel(localStorageGet('model'));

    const messages = JSON.parse(localStorageGet('messages')) || [];
    for (let i = 0; i < messages.length; i++) {
        const message = messages[i];
        const el = addMessage(message.role, message.name, markdownToHtml(message.content));
        el.dataset.index = i;
        el.style.setProperty('--hue', message.model?.hue || 120);
        el.querySelector('.copyText').addEventListener('click', () => {
            navigator.clipboard.writeText(message.content);
        });
        el.querySelector('.delete').addEventListener('click', () => {
            el.remove();
            messages.splice(parseInt(el.dataset.index), 1);
            localStorageSet('messages', JSON.stringify(messages));
        });
    }
    Prism.highlightAll();
});

window.addEventListener('beforeunload', e => {
    if (generationInProgress) {
        e.preventDefault();
        e.returnValue = '';
    }
});