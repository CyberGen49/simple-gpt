const elInteractions = document.querySelector('#interactions');
const btnAddImages = document.querySelector('#addImage');
const elInput = document.querySelector('#input');
const elImageList = document.querySelector('#imageList');
const btnSend = document.querySelector('#send');
const btnModel = document.querySelector('#model');
const btnModelName = document.querySelector('#modelName');
const btnSettings = document.querySelector('#settings');
const elSettingsLink = document.querySelector('#settingsLink');
const progress = document.querySelector('progress');
let samplePrompts = [];
let generationInProgress = false;
let selectedImages = [];

const models = {
    'gpt-4o': {
        name: 'GPT-4o',
        desc: 'GPT-4o is OpenAI\'s flagship and most advanced multimodal model that\'s faster and cheaper than GPT-4 Turbo, with stronger vision capabilities and a more recent knowledge cutoff.',
        price: {
            input: 5 / 1000000,
            output: 15 / 1000000,
            image_low_res: (5 / 1000000) * 85,
            image_high_res: (15 / 1000000) * 170
        },
        vision: true,
        max_tokens: 4096,
        hue: 165
    },
    'gpt-4o-mini': {
        name: 'GPT-4o Mini',
        desc: 'The successor to GPT-3.5 Turbo, GPT-4o Mini is a smaller and more affordable version of GPT-4o that\'s suited for simpler tasks. It supports vision but is the cheapest model available.',
        price: {
            input: 0.15 / 1000000,   // $0.15 per 1M input tokens
            output: 0.60 / 1000000,  // $0.60 per 1M output tokens
            image_low_res: (0.15 / 1000000) * 2833,
            image_high_res: (0.60 / 1000000) * 5667
        },
        vision: true,
        max_tokens: 4096,
        hue: 100
    }
};

const setModel = (model) => {
    if (!model || !models[model]) model = defaultConfig.chat_model;
    localStorageSet('chat_model', model);
    let modelData = models[model];
    btnModelName.innerText = modelData.name;
    btnAddImages.style.display = modelData.vision ? '' : 'none';
};

const addMessage = (entry, ts) => {
    const el = document.createElement('div');
    el.classList = `message ${entry.role} row gap-10`;
    if (entry.role == 'model') el.style.setProperty('--hue', entry.model?.hue || 120);
    el.innerHTML = /*html*/`
        <div class="picture"></div>
        <div class="col gap-5">
            <div class="name">${entry.name}</div>
            <div class="content"></div>
        </div>
        <div class="menu row gap-5">
            <button class="flag btn no-shadow small icon" title="Add/remove flag">
                flag
            </button>
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
    const elContent = el.querySelector('.content');
    for (const part of entry.content) {
        switch (part.type) {
            case 'text': {
                elContent.innerHTML += markdownToHtml(part.text);
                break;
            }
            case 'image_url': {
                elContent.innerHTML += /*html*/`
                    <a href="${part.image_url.url}"><img src="${part.image_url.url}" alt="Image"></a>
                `;
                break;
            }
        }
    }
    const html = elContent.innerHTML;
    const btnCopyHtml = el.querySelector('.copyHtml');
    btnCopyHtml.addEventListener('click', () => {
        navigator.clipboard.writeText(html);
    });
    if (entry.references && entry.references.length) {
        const flagsList = document.createElement('small');
        flagsList.style.padding = '3px 5px';
        flagsList.style.lineHeight = '1.4';
        for (const flaggedTs of entry.references) {
            const elFlagged = document.querySelector(`.message[data-ts="${flaggedTs}"]`);
            let anchor;
            if (elFlagged) {
                const text = (elFlagged.querySelector('.content').innerText || '').replace('\n', ' ').trim();
                const substringLength = 100;
                const textSubstring = text.length > substringLength ? text.substring(0, substringLength) + '...' : text;
                anchor = document.createElement('a');
                anchor.innerText = `Flagged message: "${textSubstring}"`;
                anchor.addEventListener('click', async() => {
                    elFlagged.scrollIntoView({ behavior: 'smooth' });
                    elFlagged.classList.add('selected');
                    await sleep(100);
                    elFlagged.classList.remove('selected');
                    await sleep(100);
                    elFlagged.classList.add('selected');
                    await sleep(1000);
                    elFlagged.classList.remove('selected');
                });
            } else {
                anchor = document.createElement('span');
                anchor.innerText = 'Flagged message';
            }
            flagsList.appendChild(anchor);
            flagsList.appendChild(document.createElement('br'));
        }
        elContent.prepend(flagsList);
    }
    if (ts) {
        el.dataset.ts = ts;
        el.querySelector('.flag').addEventListener('click', () => {
            el.classList.toggle('flagged');
        });
        el.querySelector('.delete').addEventListener('click', () => {
            el.remove();
            const messages = JSON.parse(localStorageGet('chat_messages')) || {};
            delete messages[ts];
            localStorageSet('chat_messages', JSON.stringify(messages));
        });
    }
    elInteractions.insertAdjacentElement('afterbegin', el);
    elInteractions.scrollTop = 0;
    return el;
}

const getModelResponse = async(content, streamCb = () => {}) => {
    try {
        const model = localStorageGet('chat_model');
        const systemPrompt = localStorageGet('chat_system_prompt');
        const key = localStorageGet('openai_api_key');
        if (!key.trim()) throw new Error(`Missing API key! Get or generate yours [here](https://platform.openai.com/account/api-keys), then apply it from the Settings button in the top right.`);
        const contextCount = parseInt(localStorageGet('chat_context_count'));
        const messages = JSON.parse(localStorageGet('chat_messages'));
        const messagesValues = Object.values(messages).reverse();
        const context = [{
            role: 'system',
            content: systemPrompt
        }];
        for (let i = 0; i < contextCount; i++) {
            const msg = messagesValues[i];
            if (!msg) break;
            context.push({
                role: msg.role == 'model' ? 'assistant' : 'user',
                content: msg.content
            });
        }
        const flags = [...document.querySelectorAll('.message.flagged')].reverse();
        for (const el of flags) {
            const message = messages[parseInt(el.dataset.ts)];
            context.push({
                role: message.role == 'model' ? 'assistant' : 'user',
                content: message.content
            });
        }
        let response = '';
        let lastResponseText = '';
        generationInProgress = true;
        progress.style.display = '';
        const res = await axios.post('https://api.openai.com/v1/chat/completions', {
            model: model,
            stream: true,
            messages: [ ...context, { role: 'user', content: content }],
            max_tokens: models[model].max_tokens || undefined
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

const imgbbUpload = async(base64) => {
    try {
        const res = await axios.post('https://api.imgbb.com/1/upload', new URLSearchParams({
            key: localStorageGet('imgbb_key'),
            image: base64.split(',')[1]
        }));
        return {
            url: res.data.data.url,
            thumb_url: res.data.data.thumb.url,
            delete_url: res.data.data.delete_url
        };
    } catch (error) {
        console.error(error);
    }
};

const updateImageList = () => {
    elImageList.innerHTML = '';
    for (const base64 of selectedImages) {
        const img = document.createElement('img');
        img.src = base64;
        img.title = `Click to remove`
        img.addEventListener('click', () => {
            selectedImages.splice(selectedImages.indexOf(base64), 1);
            img.remove();
        });
        elImageList.appendChild(img);
    }
};

btnModel.addEventListener('click', () => {
    const popup = showPopup('Change model');
    const body = popup.querySelector('.body');
    const buttonCont = document.createElement('div');
    buttonCont.classList = 'col gap-10';
    for (const modelId in models) {
        const model = models[modelId];
        const btn = document.createElement('button');
        btn.classList = 'btn modelSelect';
        if (modelId == localStorageGet('chat_model'))
            btn.classList.add('selected');
        btn.innerHTML = /*html*/`
            <p><b>${model.name}</b></p>
            <p>${model.desc}</p>
            <small>
                ~$${(model.price.input*1333333).toFixed(2)} per 1 million words of input.
                <br>~$${(model.price.output*1333333).toFixed(2)} per 1 million words of output.
                ${model.vision ? /*html*/`
                    <br>$${model.price.image_low_res.toFixed(5)} per image 512x or smaller.
                    <br>$${model.price.image_low_res.toFixed(5)} + $${model.price.image_high_res.toFixed(5)} per 512x chunk of larger images.
                ` : ''}
            </small>
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
                <input type="number" id="contextCount" class="textbox" placeholder="2" style="width: 100px" min="0" max="128">
                <small class="pad-top">This value determines how many previous messages are included as context for new interactions. For example, if set to 2, new interactions will include the previous 2 messages.</small>
                <small class="pad-top">Higher numbers will allow the model to remember further back, but will result in greater costs and longer loading times.</small>
                <small class="pad-top">Set to 0 to not include any context with new interactions.</small>
            </div>
            <div class="col">
                <label>ImgBB API key</label>
                <div class="row gap-10">
                    <input type="text" id="imgbbKey" class="textbox" placeholder="<paste key here>" style="width: 400px">
                </div>
                <small class="pad-top">An ImgBB API key to use for uploading images to supported models. Get your own key <a href="https://api.imgbb.com/">here</a>, or use the one provided.</small>
            </div>
            <div class="col">
                <label>Clear local storage</label>
                <div class="row gap-10 flex-wrap">
                    <button id="wipeStorage" class="btn danger">Wipe everything</button>
                    <button id="wipeMessages" class="btn danger">Wipe messages</button>
                </div>
                <small class="pad-top">Clear all locally stored data for this site, including message history and settings. Alternatively, choose to wipe just message history.</small>
            </div>
        </div>
    `);
    const body = popup.querySelector('.body');
    const inputApiKey = body.querySelector('#apiKey');
    const btnKeyVisibility = body.querySelector('#keyVisibility');
    const inputSystemPrompt = body.querySelector('#systemPrompt');
    const inputContextCount = body.querySelector('#contextCount');
    const btnChangeModel = body.querySelector('#settingsChangeModel');
    const inputImgbbKey = body.querySelector('#imgbbKey');
    const btnWipe = body.querySelector('#wipeStorage');
    const btnWipeMessages = body.querySelector('#wipeMessages');
    btnChangeModel.addEventListener('click', () => {
        btnModel.click();
    });
    inputApiKey.addEventListener('input', () => {
        localStorageSet('openai_api_key', inputApiKey.value);
    });
    btnKeyVisibility.addEventListener('click', () => {
        inputApiKey.type = inputApiKey.type == 'password' ? 'text' : 'password';
    });
    inputApiKey.value = localStorageGet('openai_api_key');
    inputSystemPrompt.addEventListener('input', () => {
        localStorageSet('chat_system_prompt', inputSystemPrompt.value.trim() || 'You are a helpful assistant.');
    });
    inputSystemPrompt.value = localStorageGet('chat_system_prompt');
    inputContextCount.addEventListener('input', () => {
        localStorageSet('chat_context_count', parseInt(inputContextCount.value));
    });
    inputContextCount.value = localStorageGet('chat_context_count');
    inputImgbbKey.addEventListener('input', () => {
        localStorageSet('imgbb_key', inputImgbbKey.value);
    });
    inputImgbbKey.value = localStorageGet('imgbb_key');
    inputImgbbKey.placeholder = localStorageGet('imgbb_key');
    btnWipe.addEventListener('click', () => {
        window.localStorage.clear();
        window.location.reload();
    });
    btnWipeMessages.addEventListener('click', () => {
        localStorageSet('chat_messages', '{}');
        window.location.reload();
    });
    popup.showModal();
});

elSettingsLink.addEventListener('click', () => btnSettings.click());

elInput.addEventListener('input', e => {
    // Set input height to scroll height
    elInput.style.height = 'auto';
    const lineHeight = 16 * 1.4;
    elInput.style.height = `${clamp(elInput.scrollHeight+2, lineHeight, window.innerHeight*0.3)}px`;
    // Disable send button accordingly
    const value = elInput.value.trim();
    if (!value && !selectedImages.length) {
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
elInput.addEventListener('paste', async(e) => {
    if (!models[localStorageGet('chat_model')].vision) return;
    const items = (e.clipboardData || e.originalEvent.clipboardData).items;
    for (const item of items) {
        if (item.kind == 'file' && item.type.match(/^image\//)) {
            const file = item.getAsFile();
            const reader = new FileReader();
            await new Promise(resolve => {
                reader.onload = e => {
                    selectedImages.push(e.target.result);
                    updateImageList();
                    resolve();
                };
                reader.readAsDataURL(file);
            });
        }
    }
    elInput.dispatchEvent(new Event('input'));
});
elInput.addEventListener('drop', async(e) => {
    if (!models[localStorageGet('chat_model')].vision) return;
    const items = (e.dataTransfer || e.originalEvent.dataTransfer).items;
    for (const item of items) {
        if (item.kind == 'file' && item.type.match(/^image\//)) {
            const file = item.getAsFile();
            const reader = new FileReader();
            await new Promise(resolve => {
                reader.onload = e => {
                    selectedImages.push(e.target.result);
                    updateImageList();
                    resolve();
                };
                reader.readAsDataURL(file);
            });
        }
    }
    elInput.dispatchEvent(new Event('input'));
});
elInput.dispatchEvent(new Event('input'));

(async() => {
    const res = await axios.get('/assets/prompts.json');
    samplePrompts = res.data;
    input.placeholder = getRandomElement(samplePrompts);
    elInput.dispatchEvent(new Event('input'));
})();

btnAddImages.addEventListener('click', async() => {
    const images = await selectImagesBase64();
    if (!images) return;
    selectedImages.push(...images);
    updateImageList();
    elInput.dispatchEvent(new Event('input'));
});

btnSend.addEventListener('click', async() => {
    if (btnSend.disabled) return;
    // Get input text and clear draft bar
    const content = [
        { type: 'text', text: elInput.value.trim() }
    ];
    elInput.placeholder = getRandomElement(samplePrompts);
    elInput.value = '';
    elInput.focus();
    elInput.dispatchEvent(new Event('input'));
    // Create user message entry
    const inputMsgEntry = {
        role: 'user',
        name: 'You',
        content: [],
        references: []
    };
    const flags = [...document.querySelectorAll('.message.flagged')].reverse();
    for (const el of flags) {
        inputMsgEntry.references.push(parseInt(el.dataset.ts));
    }
    const tmpInputMsg = addMessage(inputMsgEntry);
    // Add images to input if any
    if (selectedImages.length) {
        progress.style.display = '';
        elImageList.innerHTML = '';
        for (const base64url of selectedImages) {
            try {
                const res = await imgbbUpload(base64url);
                content.push({
                    type: 'image_url',
                    image_url: {
                        url: res.url
                    }
                });
            } catch (error) {
                console.error(`Failed to upload image:`, error);
            }
        }
        selectedImages = [];
    }
    // Update saved content
    inputMsgEntry.content = content;
    // Get saved messages
    const messages = JSON.parse(localStorageGet('chat_messages')) || {};
    // Update user message entry
    const inputMsgTs = Date.now();
    messages[inputMsgTs] = inputMsgEntry;
    const inputMsg = addMessage(inputMsgEntry, inputMsgTs);
    tmpInputMsg.replaceWith(inputMsg);
    inputMsg.querySelector('.copyText').addEventListener('click', () => {
        navigator.clipboard.writeText(inputMsgEntry.content[0].text);
    });
    // Create model message entry
    const model = models[localStorageGet('chat_model')];
    const tmpOutputMsg = addMessage({
        role: 'model',
        model: model,
        name: model.name,
        content: []
    });
    tmpOutputMsg.querySelector('.menu').style.display = 'none';
    // Update model message content as it generates
    const outputContent = tmpOutputMsg.querySelector('.content');
    const res = await getModelResponse(content, (delta, response) => {
        const isAtBottom = elInteractions.scrollTop > -10;
        outputContent.innerHTML = markdownToHtml(response);
        Prism.highlightAllUnder(outputContent);
        if (isAtBottom) {
            elInteractions.scrollTop = 0;
        }
    });
    if (!res.success) {
        // Show an error message
        outputContent.innerHTML = /*html*/`
            <div class="error">
                ${markdownToHtml(res.error)}
            </div>
        `;
    } else {
        // Save response
        const outputMsgEntry = {
            role: 'model',
            model: model,
            name: model.name,
            content: [{
                type: 'text',
                text: res.response
            }]
        };
        const outputMsgTs = Date.now();
        messages[outputMsgTs] = outputMsgEntry;
        while (Object.values(messages).length > 128) {
            const key = Object.keys(messages).shift();
            const msg = messages[key];
            delete messages[key];
            console.log(`Deleted message ${key}:`, msg);
        }
        localStorageSet('chat_messages', JSON.stringify(messages));
        // Replace displayed message
        const outputMsg = addMessage(outputMsgEntry, outputMsgTs);
        tmpOutputMsg.replaceWith(outputMsg);
        outputMsg.querySelector('.copyText').addEventListener('click', () => {
            navigator.clipboard.writeText(res.response);
        });
        Prism.highlightAllUnder(outputMsg);
    }
});

window.addEventListener('resize', () => {
    elInput.dispatchEvent(new Event('input'));
});

window.addEventListener('load', async() => {
    window.dispatchEvent(new Event('resize'));

    setModel(localStorageGet('model'));

    const messages = JSON.parse(localStorageGet('chat_messages')) || {};
    for (const ts in messages) {
        const message = messages[ts];
        const el = addMessage(message, ts);
        el.querySelector('.copyText').addEventListener('click', () => {
            navigator.clipboard.writeText(message.content[0].text);
        });
    }
    Prism.highlightAll();

    setInterval(() => {
        const anchors = elInteractions.querySelectorAll('a:not([modified])');
        for (const a of anchors) {
            a.target = '_blank';
            a.dataset.modified = true;
        }
    }, 500);
});

window.addEventListener('beforeunload', e => {
    if (generationInProgress) {
        e.preventDefault();
        e.returnValue = '';
    }
});