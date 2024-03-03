
const input = $('#input');
const btnModel = $('#model');
const btnSettings = $('#settings');
const btnGo = $('#go');
const elInteractions = $('#interactions');

const models = {
    'gpt-3.5-turbo': {
        name: 'GPT-3.5 Turbo',
        desc: 'GPT-3.5 Turbo models are capable and cost-effective.',
        price: {
            input: 0.001 / 1000,
            output: 0.002 / 1000
        }
    },
    'gpt-4': {
        name: 'GPT-4',
        desc: 'With broad general knowledge and domain expertise, GPT-4 can follow complex instructions in natural language and solve difficult problems with accuracy.',
        price: {
            input: 0.03 / 1000,
            output: 0.06 / 1000
        }
    },
    'gpt-4-1106-preview': {
        name: 'GPT-4 Turbo',
        desc: 'With 128k context, fresher knowledge and the broadest set of capabilities, GPT-4 Turbo is more powerful than GPT-4 and offered at a lower price.',
        price: {
            input: 0.01 / 1000,
            output: 0.03 / 1000
        }
    }
};

const localStorageGet = key => {
    return window.localStorage.getItem(key);
};
const localStorageSet = (key, value) => {
    window.localStorage.setItem(key, value);
};

const markdownToHtml = markdown => {
    return DOMPurify.sanitize(marked.parse(markdown));
};

if (!localStorageGet('model'))
    localStorageSet('model', 'gpt-3.5-turbo');
if (!localStorageGet('systemPrompt'))
    localStorageSet('systemPrompt', 'You are a helpful assistant.');

const setModel = model => {
    localStorageSet('model', model);
    $('span', btnModel).innerText = models[model].name;
};
setModel(localStorageGet('model'));

const getModelResponse = async(prompt, n = 1) => {
    try {
        const model = localStorageGet('model');
        const systemPrompt = localStorageGet('systemPrompt');
        const key = localStorageGet('apiKey');
        const requestTimeout = 90*1000;
        let retryCount = 3;
        let res;
        while (retryCount > 0) {
            try {
                res = await axios.post('https://api.openai.com/v1/chat/completions', {
                    model: model,
                    n: n,
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
                    timeout: requestTimeout
                });
                break;
            } catch (error) {
                retryCount--;
                if (retryCount == 0) {
                    throw error;
                }
            }
        }
        return {
            time: Date.now(),
            model,
            system_prompt: systemPrompt,
            prompt,
            response:
                res.data.choices.length == 1
                    ? res.data.choices[0].message.content
                    : res.data.choices.map(x => x.message.content),
            tokens: {
                input: res.data.usage.prompt_tokens,
                output: res.data.usage.completion_tokens
            }
        };
    } catch (error) {
        console.error(error, error.response?.data);
        return {
            error: error.response?.data?.error?.message || `${error}`
        };
    }
};

const getInteractionElement = (interaction) => {
    const elInteraction = document.createElement('div');
    elInteraction.classList.add('interaction');
    elInteraction.innerHTML = /*html*/`
        <div class="topbar row gap-10 align-center flex-wrap">
            <div class="row gap-10 align-center flex-grow">
                <button class="collapse btn secondary small iconOnly">
                    <div class="icon">expand_more</div>
                </button>
                <small style="margin-bottom: -3px">
                    ${dayjs(interaction.time).format('MMM D, YYYY, h:mm A')}
                    <!-- • $<span class="price">${interaction.tokens ? `${
                        roundSmart((interaction.tokens.input*models[interaction.model].price.input)+(interaction.tokens.output*models[interaction.model].price.output), 4)}`:'0.00'}</span> -->
                </small>
            </div>
            <button class="delete btn secondary small iconOnly" disabled>
                <div class="icon" style="color: var(--red3)">delete</div>
            </button>
            <button class="menu btn secondary small iconOnly" disabled title="Export interaction...">
                <div class="icon">share</div>
            </button>
        </div>
        <div class="content col gap-10">
            <div class="user">
                <div class="header">You</div>
                <div class="prompt">
                    ${markdownToHtml(interaction.prompt)}
                </div>
            </div>
            <div class="assistant">
                <div class="header">${models[interaction.model].name}</div>
                <div class="response">
                    ${interaction.response ? markdownToHtml(interaction.response) : `
                        <progress class="info" style="margin-top: -3px; margin-bottom: 3px"></progress>
                    `}
                </div>
            </div>
        </div>
    `;
    const btnCollapse = $('.collapse', elInteraction);
    btnCollapse.addEventListener('click', () => {
        const elIcon = $('.icon', btnCollapse);
        if (elIcon.innerText == 'expand_more') {
            elIcon.innerText = 'chevron_right';
            elInteraction.classList.add('collapsed');
        } else {
            elIcon.innerText = 'expand_more';
            elInteraction.classList.remove('collapsed');
        }
    });
    const btnDelete = $('.delete', elInteraction);
    btnDelete.addEventListener('click', () => {
        elInteraction.remove();
        const savedInteractions = JSON.parse(localStorageGet('interactions') || '{}');
        delete savedInteractions[interaction.time];
        localStorageSet('interactions', JSON.stringify(savedInteractions));
    });
    const btnMenu = $('.menu', elInteraction);
    btnMenu.addEventListener('click', () => {
        new ContextMenuBuilder()
            .addItem(item => item
                .setLabel('Copy prompt as text')
                .setIcon('content_copy')
                .setClickHandler(() => {
                    navigator.clipboard.writeText(interaction.prompt);
                }))
            .addItem(item => item
                .setLabel('Copy response as text')
                .setIcon('content_copy')
                .setClickHandler(() => {
                    navigator.clipboard.writeText(interaction.response || 'Loading...');
                }))
            .addItem(item => item
                .setLabel('Copy response as HTML')
                .setIcon('content_copy')
                .setClickHandler(() => {
                    navigator.clipboard.writeText(markdownToHtml(interaction.response || 'Loading...'));
                }))
            .addItem(item => item
                .setLabel('Download interaction as text')
                .setIcon('download')
                .setClickHandler(() => {
                    const data = [
                        `Interaction happened on ${dayjs(interaction.time).format('MMM D YYYY [at] h:mm A')} local system time`,
                        '',
                        'User prompt:',
                        '='.repeat(50),
                        interaction.prompt,
                        '',
                        `Response from ${models[interaction.model].name}:`,
                        '='.repeat(50),
                        interaction.response || 'Loading...'
                    ].join('\n');
                    const blob = new Blob([data], {type: 'text/plain'});
                    const url = URL.createObjectURL(blob);
                    const a = document.createElement('a');
                    a.href = url;
                    a.download = `interaction-${interaction.time}.txt`;
                    a.click();
                    a.remove();
                }))
            .addItem(item => item
                .setLabel('Download interaction as webpage')
                .setIcon('download')
                .setClickHandler(() => {
                    const data = '';
                    const blob = new Blob([ data ], { type: 'text/plain' });
                    const url = URL.createObjectURL(blob);
                    const a = document.createElement('a');
                    a.href = url;
                    a.download = `interaction-${interaction.time}.html`;
                    a.click();
                    a.remove();
                    new PopupBuilder()
                        .setTitle(`Download started`)
                        .addBodyHTML(/*html*/`
                            <p>You're downloading this interaction in a viewable format, as a self-contained webpage. To view it, open the <code>.html</code> file in your web browser.</p>
                            <p>This is experimental and may not be working quite yet.</p>
                        `)
                        .addAction(action => action.setLabel('Okay').setIsPrimary(true))
                        .show();
                }))
            .addItem(item => item
                .setLabel('Download response as Markdown')
                .setIcon('download')
                .setClickHandler(() => {
                    const blob = new Blob([ interaction.response ], {
                        type: 'text/plain'
                    });
                    const url = URL.createObjectURL(blob);
                    const a = document.createElement('a');
                    a.href = url;
                    a.download = `response-${interaction.time}.md`;
                    a.click();
                    a.remove();
                }))
            .showAtCursor();
    });
    return elInteraction;
};

let samplePrompts = [];
(async() => {
    const res = await axios.get('/prompts.json');
    samplePrompts = res.data;
    input.placeholder = getRandomElement(samplePrompts);
})();

input.addEventListener('keydown', e => {
    if (e.ctrlKey && e.code == 'Enter') {
        btnGo.click();
    }
    setTimeout(() => {
        btnGo.disabled = (!input.value.trim());
    }, 0);
});

btnModel.addEventListener('click', () => {
    const el = document.createElement('div');
    el.classList = 'col gap-10';
    el.style.marginBottom = '10px';
    const popup = new PopupBuilder()
        .setTitle('Select model')
        .addBody(el)
    for (const model in models) {
        const modelInfo = models[model];
        const option = document.createElement('label');
        option.classList = 'selectOption';
        option.style.maxWidth = '400px';
        option.innerHTML = `
            <input type="radio" name="model" value="${model}" ${model == localStorageGet('model') ? 'checked' : ''}>
            <div class="col gap-2">
                <div>${modelInfo.name}</div>
                <small>${modelInfo.desc}</small>
                <small>
                    Input: About $${roundSmart(modelInfo.price.input*1000, 4)} per 1,000 words
                    <br>
                    Output: About $${roundSmart(modelInfo.price.output*1000, 4)} per 1,000 words
                </small>
            </div>
        `;
        const radio = $('input', option);
        radio.addEventListener('change', () => {
            setModel(radio.value);
            popup.hide();
        });
        el.appendChild(option);
    }
    $('.actions', popup.el).style.display = 'none';
    popup.show();
});

btnSettings.addEventListener('click', () => {
    const el = document.createElement('div');
    el.classList = 'col gap-15'
    el.style.paddingTop = '5px'
    el.innerHTML = /*html*/`
        <div style="width: 500px; max-width: 100%">
            <label>OpenAI API Key</label>
            <input type="password" class="textbox" id="apiKey" value="${localStorageGet('apiKey') || ''}">
            <small class="pad-top">Get or generate your API key <a href="https://platform.openai.com/account/api-keys">here</a>!</small>
            <small class="pad-top">See pricing per model <a href="https://openai.com/pricing">here</a>.</small>
        </div>
        <div style="width: 500px; max-width: 100%">
            <label>System prompt</label>
            <div class="textbox textarea">
                <textarea rows="5">${localStorageGet('systemPrompt') || ''}</textarea>
            </div>
        </div>
    `;
    const inputKey = $('#apiKey', el);
    const inputSystemPrompt = $('textarea', el);
    inputKey.addEventListener('input', () => {
        localStorageSet('apiKey', inputKey.value);
    });
    inputSystemPrompt.addEventListener('input', () => {
        localStorageSet('systemPrompt', inputSystemPrompt.value);
    });
    new PopupBuilder()
        .setTitle('Settings')
        .addBody(el)
        .addAction(action => action.setLabel('Done').setIsPrimary(true))
        .show();
});
if (!localStorageGet('apiKey')) btnSettings.click();

btnGo.addEventListener('click', async() => {
    if (btnGo.disabled) return;
    const prompt = input.value.trim();
    input.placeholder = getRandomElement(samplePrompts);
    input.value = '';
    input.dispatchEvent(new Event('input'));
    btnGo.disabled = true;
    const elTemp = getInteractionElement({
        prompt: prompt,
        model: localStorageGet('model'),
        time: Date.now()
    });
    elInteractions.insertAdjacentElement('afterbegin', elTemp);
    const data = await getModelResponse(prompt);
    if (!data.error) {
        const savedInteractions = JSON.parse(localStorageGet('interactions') || '{}');
        savedInteractions[data.time] = data;
        const maxSavedLength = 100000;
        while (JSON.stringify(savedInteractions).length > maxSavedLength) {
            const oldestKey = Object.keys(savedInteractions).sort((a, b) => a - b)[0];
            delete savedInteractions[oldestKey];
        }
        localStorageSet('interactions', JSON.stringify(savedInteractions));
        const elNew = getInteractionElement(data);
        elInteractions.replaceChild(elNew, elTemp);
        $('.delete', elNew).disabled = false;
        $('.menu', elNew).disabled = false;
        Prism.highlightAll();
    } else {
        const elResponse = $('.response', elTemp);
        elResponse.innerHTML = data.error;
        elResponse.classList.add('error');
    }
});

// Load interactions
const savedInteractions = JSON.parse(localStorageGet('interactions') || '{}');
const interactionValues = Object.values(savedInteractions);
interactionValues.sort((a, b) => b.time - a.time);
for (const interaction of interactionValues) {
    const elInteraction = getInteractionElement(interaction);
    $('.delete', elInteraction).disabled = false;
    $('.menu', elInteraction).disabled = false;
    elInteractions.appendChild(elInteraction);
}

window.addEventListener('resize', () => {
    input.style.maxHeight = `${window.innerHeight*0.3}px`;
});
window.dispatchEvent(new Event('resize'));