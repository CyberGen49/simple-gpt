
const localStorageGet = key => {
    return window.localStorage.getItem(key);
};
const localStorageSet = (key, value) => {
    window.localStorage.setItem(key, value);
    console.log(`Updated local storage:\nKey: ${key}\nValue: ${value}`);
};

if (!localStorageGet('model'))
    localStorageSet('model', 'gpt-3.5-turbo');
if (!localStorageGet('systemPrompt'))
    localStorageSet('systemPrompt', 'You are a helpful assistant.');

const input = $('#input');
const btnModel = $('#model');
const btnSettings = $('#settings');
const btnGo = $('#go');
const elInteractions = $('#interactions');

const setModel = model => {
    localStorageSet('model', model);
    $('span', btnModel).innerText = model;
};
setModel(localStorageGet('model'));

const getModelResponse = async(prompt) => {
    try {
        const res = await axios.post('https://api.openai.com/v1/chat/completions', {
            model: localStorageGet('model'),
            messages: [{
                role: 'system',
                content: localStorageGet('systemPrompt')
            }, {
                role: 'user',
                content: prompt
            }]
        }, {
            headers: {
                'Authorization': `Bearer ${localStorageGet('apiKey')}`,
            }
        });
        console.log(res.data);
        return {
            success: true,
            content: res.data.choices[0].message.content
        };
    } catch (error) {
        console.error(error, error.response?.data);
        return {
            success: false,
            error: error.response?.data?.error?.message || `${error}`
        };
    }
};

const sampleQuestions = [
    "Summarise Think and Grow Rich",
    "Create a simple HTML page",
    "Create a HTML vat calculator",
    "Create a JavaScript countdown to December 31st 2023",
    "Create a PHP mortgage calculator",
    "Create a function in C++",
    "Write a slogan for a coffee bean company",
    "Write a letter demanding my landlord address a mould and damp issue in the home I rent",
    "Create a 6 month employment contract for a freelance graphic designer",
    "How do I grow a YouTube channel?",
    "How do I grow a brand on Amazon FBA?",
    "Write a short story about a cat named Mimi",
    "Create a 2000 calorie 7-day meal plan",
    "Write a wedding speech for a groom named Brian who is marrying Jenny",
    "Write an email inviting people to my wedding",
    "Write a cold email to a dog grooming business to sell them SEO services",
    "Write 5 titles for a blogpost about learning to use AI",
    "Create 5 google ads to promote a pet grooming business",
    "Write a song about a dog that turns to crime to feed it's bone addiction",
    "Output the first page of Alice in Wonderland",
    "Teach me how to use Photoshop",
    "Come up with a few name ideas for a cat using wordplay",
    "Create a Chrome extension to print a page to PDF",
    "Suggest 10 birthday gifts for a 40 year old man",
    "List what items I need to go on a trip on the London to Amsterdam train",
    "Give me a recipe for Spanish omelette",
    "Write the script for the next Hollywood blockbuster",
    "List 10 ideas for a million dollar product in 2023",
    "Tell me an extremely funny joke that involves 3 characters"
];

input.placeholder = sampleQuestions[Math.floor(Math.random() * sampleQuestions.length)];

input.addEventListener('keydown', e => {
    if (e.ctrlKey && e.code == 'Enter') {
        btnGo.click();
    }
    setTimeout(() => {
        btnGo.disabled = (!input.value.trim());
    }, 0);
});

btnModel.addEventListener('click', () => {
    new ContextMenuBuilder()
        .addItem(option => {
            option.el.style.height = 'auto';
            option.el.style.padding = '6px 12px';
            option.elLabel.innerHTML = /*html*/`
                <div style="margin-bottom: 2px">gpt-3.5-turbo</div>
                <small>Cheap and fast, but less reliable</small>
            `;
            option.setClickHandler(() => setModel('gpt-3.5-turbo'));
            return option;
        })
        .addItem(option => {
            option.el.style.height = 'auto';
            option.el.style.padding = '6px 12px';
            option.elLabel.innerHTML = /*html*/`
                <div style="margin-bottom: 2px">gpt-4</div>
                <small>Slower and 10x as expensive, but more reliable</small>
            `;
            option.setClickHandler(() => setModel('gpt-4'));
            return option;
        })
        .setIconVisibility(false)
        .showAtCursor();
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
            <small class="pad-top">See pricing per model <a href="https://openai.com/pricing">here</a>. This site uses the base context models, so 8k context for GPT-4 and 4k context for GPT-3.5 Turbo.</small>
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

const getInteractionElement = (prompt, response, model, time = Date.now()) => {
    const elInteraction = document.createElement('div');
    elInteraction.classList.add('interaction');
    elInteraction.innerHTML = /*html*/`
        <div class="topbar row gap-10 align-center flex-wrap">
            <div class="row gap-10 align-center flex-grow">
                <button class="collapse btn secondary small iconOnly">
                    <div class="icon">expand_more</div>
                </button>
                <small style="margin-bottom: -3px">${dayjs(time).format('MMM D, YYYY, hh:mm A')}</small>
            </div>
            <button class="delete btn secondary small iconOnly" disabled>
                <div class="icon" style="color: var(--red3)">delete</div>
            </button>
        </div>
        <div class="content col gap-10">
            <div class="user">
                <div class="header">You</div>
                ${marked.parse(prompt)}
            </div>
            <div class="assistant">
                <div class="header">${model}</div>
                <div class="response">
                    ${response ? marked.parse(response) : `
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
        delete savedInteractions[time];
        localStorageSet('interactions', JSON.stringify(savedInteractions));
    });
    return elInteraction;
};

btnGo.addEventListener('click', async() => {
    if (btnGo.disabled) return;
    const prompt = input.value.trim();
    input.value = '';
    btnGo.disabled = true;
    const elInteraction = getInteractionElement(prompt, null, localStorageGet('model'));
    elInteractions.insertAdjacentElement('afterbegin', elInteraction);
    Prism.highlightAll();
    const res = await getModelResponse(prompt);
    const elResponse = $('.response', elInteraction);
    elResponse.innerHTML = marked.parse(res.content || res.error);
    if (res.success) {
        const savedInteractions = JSON.parse(localStorageGet('interactions') || '{}');
        savedInteractions[Date.now()] = {
            time: Date.now(),
            prompt,
            response: res.content,
            model: localStorageGet('model')
        };
        const maxSavedLength = 100000;
        while (JSON.stringify(savedInteractions).length > maxSavedLength) {
            const oldestKey = Object.keys(savedInteractions).sort((a, b) => a - b)[0];
            delete savedInteractions[oldestKey];
        }
        localStorageSet('interactions', JSON.stringify(savedInteractions));
    } else {
        elResponse.classList.add('error');
    }
});

// Load interactions
const savedInteractions = JSON.parse(localStorageGet('interactions') || '{}');
const interactionValues = Object.values(savedInteractions);
interactionValues.sort((a, b) => b.time - a.time);
for (const interaction of interactionValues) {
    const elInteraction = getInteractionElement(
        interaction.prompt,
        interaction.response,
        interaction.model,
        interaction.time
    );
    $('.delete', elInteraction).disabled = false;
    elInteractions.appendChild(elInteraction);
}