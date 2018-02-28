let posts = [];
let stories = {};
let editor;
let answers = {};
let editedAnswers = {};
let postOrder = [];
// !UW.yye1fxo has not been compromised at this time
let qTrip = '!UW.yye1fxo';
let newcount = 0;
const md = window.markdownit();
const isEditing = () => location.hash === '#edit';
const edits = {};
const serverUrl = debug
    ? 'http://localhost:8080'
    : 'http://145.249.106.38';

function main() {

    Promise
        .all([
        // getJson(`${serverUrl}/story`)
    ].concat([
        'story',
        'pol4chanPosts',
        'polTrip8chanPosts',
        'cbtsNonTrip8chanPosts',
        'cbtsTrip8chanPosts',
        'thestormTrip8chanPosts',
        'greatawakeningTrip8chanPosts',
        'qresearchTrip8chanPosts',
        'qresearchNonTrip8chanPosts'
    ].map(getLocalJson)))
        .then(values => {
            let i = 0
            stories = values[i++];
            posts = []
                .concat(values[i++])
                .concat(values[i++])
                .concat(values[i++])
                .concat(values[i++])
                .concat(values[i++])
                .concat(values[i++])
                .concat(values[i++])
                .concat(values[i++]);
            posts.sort((a, b) => b.timestamp - a.timestamp);
            postOrder.push(...(posts.map(p => (p.timestamp).toString()).reverse()));

            render(posts);
            initSearch();

            setTimeout(checkForNewPosts, 3000);
        });

    if (isEditing()) {
        const form = document.querySelector('#submitChanges');
        form.onsubmit = e => {
            e.preventDefault();
            const submission = Submission(form);
            submission.edits = edits;
            console.log(submission);
            postJson(`${serverUrl}/story`, submission).then(response => {
                console.log(response);
            });
        };
    }
}

function initSearch() {
    const searchElement = document.querySelector('input[type=search]');
    searchElement.oninput = () => {
        const value = searchElement.value;

        const keywordInText = value === value.toLowerCase()
            ? text => text
                .toLowerCase()
                .includes(value)
            : text => text.includes(value);

        const ids = posts
            .filter(p => p.text && keywordInText(p.text))
            .map(p => p.id);

        applyFilter(ids);
        if (value == '') 
            setParams({});
        else 
            setParams({q: value});
        }
    ;

    const postLines = posts
        .filter(p => p.text)
        .map(p => ({
            id: p.id,
            lines: p
                .text
                .split('\n')
                .map(t => t.trim().replace(/[.?]/g, ''))
        }));

    const result = {};
    for (const post of postLines) {
        for (const line of post.lines) {
            if (line == '') 
                continue;
            if (!result[line]) 
                result[line] = new Set();
            result[line].add(post.id);
        }
    }
    const resultList = Object
        .keys(result)
        .map(k => ({line: k, ids: result[k]}))
        .filter(a => a.ids.size > 2);

    resultList.sort((a, b) => b.ids.size - a.ids.size);
    const datalist = document.querySelector('#hints');
    datalist.innerHTML = resultList
        .map(i => `<option label="${i.ids.size}">${i.line}</option>`)
        .join('\n');

    const query = getParams(location.search);
    if ('q' in query) {
        searchElement.value = query.q;
        searchElement.oninput();
    }
}

function applyFilter(ids) {
    let count = 0;
    for (const element of Array.from(document.querySelectorAll('article'))) {
        if (ids.includes(element.item.id)) {
            element.hidden = false;
            count++;
        } else {
            element.hidden = true;
        }
    }
    document
        .querySelector('#count')
        .textContent = `${count}`;
    for (const h3 of Array.from(document.querySelectorAll('main .sticky'))) {
        const section = h3.nextElementSibling;
        h3.hidden = Array
            .from(section.children)
            .every(c => c.hidden);
    }
}

function toggleDialog(id) {
    if (!id) {
        document
            .querySelector('.dialog.open')
            .classList
            .remove('open');
    } else {
        const dialog = document.querySelector(`.dialog#${id}`);
        dialog
            .classList
            .toggle('open');
    }
}

function openStory(postId) {
    const dialog = document.querySelector(`.dialog#story`);
    const container = dialog.querySelector(`.container`);
    container.innerHTML = '';
    const post = posts.find(p => p.id == postId);

    const postElement = tag.fromString(html.postWithReplies(post));
    postElement
        .querySelector('button')
        .remove();

    const header = dialog.querySelector('header');
    header.innerHTML = '';
    header.appendChild(postElement);

    const story = stories[postId] || [];
    story.postId = postId;
    container.story = story;

    story
        .map(StoryElement)
        .forEach(appendTo(container));

    if (isEditing()) {
        create(AddForm(), appendTo(header), onSubmit(addNewStory(story, container)));
    }

    toggleDialog('story');
}

function notify(text) {
    const element = document.querySelector('#notification');
    if (text) {
        element.hidden = false;
        element.textContent = text;
    } else {
        setTimeout(() => {
            element.hidden = true;
        }, 3000);
    }
}

// RENDERING

function render(items) {
    const container = document.querySelector('main');
    container.innerHTML = '';
    let lastDate = new Date(items[0].timestamp * 1000);
    lastDate.setHours(0, 0, 0, 0);
    let subContainer = tag('section');
    container.appendChild(tag.fromString(html.date(lastDate)));
    for (const item of items) {
        const date = new Date(item.timestamp * 1000);
        date.setHours(0, 0, 0, 0);
        if (lastDate.getTime() !== date.getTime()) {
            lastDate = date;
            container.appendChild(subContainer);
            container.appendChild(tag.fromString(html.date(date)));
            subContainer = tag('section');
        }
        const element = tag.fromString(html.postWithReplies(item));
        element.item = item;
        subContainer.appendChild(element);
    }
    container.appendChild(subContainer);
    lazyload();
}

function readableColour($bg) {
    const r = parseInt($bg.substr(0, 2), 16);
    const g = parseInt($bg.substr(2, 2), 16);
    const b = parseInt($bg.substr(4, 2), 16);
    const contrast = Math.sqrt(r * r * .241 + g * g * .691 + b * b * .068);
    if (contrast > 130) {
        return '000000'
    } else {
        return 'FFFFFF'
    };
}

const html = {
    postWithReplies: (post) => {
        return `
        <article id="post${post.id}" class="source_${post.source}${ifExists(post.timestampDeletion, () => ' deleted')}">
          <span class="counter">${postOrder.indexOf((post.timestamp).toString()) + 1}</span>
          ${forAll(post.references, x => `
          <blockquote id="post${post.id}">${html.post(x)}</blockquote>`)}
          ${html.post(post)}
          <!--<button onclick="openTweet(${post.id})">🐦</button>-->
          <!--<button class="">📰</button>-->
          ${ifExists(stories[post.id] || isEditing(), x => `
          <button onclick="openStory(${post.id})">answers</button>
          `)}
        </article>`;
    },
    date: (date) => {
        return `<h3 class="center sticky"><time datetime="${date.toISOString()}">${formatDate(date)}</time></h3>`
    },
    post: (post) => {
        if (!post) 
            return '';
        const date = new Date(post.timestamp * 1000);
        const edate = new Date(post.edited * 1000);
        const postId = post.source !== undefined
            ? (post.source.includes("8chan")
                ? (pid) => '<span class="userid" title="userid" style="background-color: #' + pid + '; padding: 0px 5px; border-radius: 8px; color: #' + readableColour(pid) + '">ID: ' + pid + '</span>'
                : (pid) => '<span class="userid" title="userid">ID: ' + pid + '</span>')
            : (pid) => '<span class="userid" title="userid">ID: ' + pid + '</span>'
        return `
        <header>
            <time datetime="${date.toISOString()}">${formatDate(date)} ${formatTime(date)}</time>

            ${ifExists(post.subject, x => `
            <span class="subject" title="subject">${x}</span>`)}

            <span class="name" title="name">${post.name}</span>

            ${ifExists(post.trip, x => `
            <span class="trip" title="trip">${x}</span>`)}

            ${ifExists(post.email, x => `
            <span class="email" title="email">${x}</span>`)}

            ${ifExists(post.userId, x => `
            ${postId(x)}`)}

            <a href="${post.link}" target="_blank">${post.id}</a>
            
            ${ifExists(post.isNew, () => `<span class="new">NEW</span>`)}

            ${ifExists(post.edited, x => `
            <span class="edited" title="${edate.toISOString()}">Last edited at ${formatDate(edate)}, ${formatTime(edate)}</span>`)}
        </header>

        ${forAll(post.images, (i) => post.isNew
            ? html.img(i)
            : html.img(withLocalUrl(i)))}

        <div class="text">${addHighlights(post.text)}</div>`;
    },
    img: (image) => {
        if (!image) 
            return '';
        return `<a href="${image.url}" target="_blank">
          ${ifExists(image.filename, x => `
          <span class="filename" title="file name">${x}</span>`)}
          <img data-src="${image.url}" class="contain lazyload" width="300" height="300">
        </a>`;
    },
    news: item => {
        return `
        <a href="${item.url}" target="_blank" class="row">
          <div>${ifExists(item.imageUrl, html.thumbnail)}</div>
          <h2 class="stretch">${item.headline}</h2>
        </a>
        ${ifExists(item.description, x => `
        <p class="text">${x}</p>`)}
        <small>${getHostname(item.url)}</small>`;
    },
    thumbnail: (src) => {
        if (!src) 
            return '';
        return `<img src="${src}" class="contain" width="100" height="100">`;
    },
    addStoryItemForm: () => {
        return `<form class="content">
        <h2>Create a story item</h2>
        <div>
            <input id="type_tweet" name="type" type="radio" value="tweet" required>
            <label for="type_tweet">Tweet</label>
            <input id="type_textPart" name="type" type="radio" value="textPart" required>
            <label for="type_textPart">Text part</label>
        </div>
        <div id="details_textPart">
            <label for="markdown">Markdown</label>
            <textarea id="markdown" name="markdown" required></textarea>
        </div>
        <div id="details_tweet">
            <label for="tweetUrl">Tweet Url</label>
            <input id="tweetUrl" name="tweetUrl" type="url" pattern="https://twitter\.com/.*/status/[0-9]+" title="A valid url of a tweet url" required placeholder="e.g. https://twitter.com/realDonaldTrump/status/954681839419101185">
        </div>
        <div>
            <button type="submit" class="icon">add</button>
        </div>
        </form>`;
    }
};

const withLocalUrl = (image) => ({
    filename: image.filename,
    url: localImgSrc(image.url)
});

const localImgSrc = src => 'data/images/' + src
    .split('/')
    .slice(-1)[0];

const legendPattern = new RegExp(`(?!<[a|abbr|strong][^>]*>)([^a-zA-Z]|!\D|!\w|^)(${Object.keys(legend).join('|')})([^a-zA-Z])(?![^<]*<\/[a|abbr|strong]>)`, 'g');

function addHighlights(text) {
    return !text
        ? ''
        : text.replace(/(^>[^>].*\n?)+/g, (match) => `<q>${match}</q>`).replace(/https\:\/\/\s/g, (match) => `https://`).replace(/(https?:\/\/[.\w\/?\-=&#]+)/g, (match) => match.endsWith('.jpg')
            ? `<img src="${match}" alt="image">`
            : `<a href="${match}" target="_blank">${match}</a>`).replace(/\n/g, () => `<br \/>`).replace(/\s(?![^<]*>|\n)/g, (match) => `&#32;`).replace(/\/(?![^<]*>|<\/*[>$]])/g, (match) => `&#47;`).replace(/(\[[^[]+])/g, (match) => `<strong>${match}</strong>`).replace(legendPattern, (match, p1, p2, p3, o, s) => `${p1}<abbr title="${legend[p2]}">${p2}</abbr>${p3}`);
}

// PARSE 8chan

function checkForNewPosts() {
    clearTimeout(timerId)
    const boards = ['greatawakening', 'qresearch'];
    notify(`Searching for new posts`);

    for (const board of boards) {

        const alreadyParsedIds = Array
            .from(new Set(posts.filter(p => !p.isNew && p.source == `8chan_${board}`)))
            .map(p => parseInt(p.threadId));

        const alreadyParsedPosts = Array
            .from(new Set(posts.filter(p => !p.isNew && p.id && p.source == `8chan_${board}`)))
            .map(p => parseInt(p.id));

        const alreadyCheckedPosts = Array
            .from(new Set(posts.filter(p => p.isNew && p.source == `8chan_${board}`)))
            .map(p => parseInt(p.id));

        const catalogUrl = `https://8ch.net/${board}/catalog.json`;

        getJson(catalogUrl).then(response => {
            const threads = response.reduce((p, e) => p.concat(e.threads), []).slice(0, 25);
            const threadIds = threads.map((p) => p.no);
            var newThreadIds = []
            if (threadIds.length == 1) {
                // console.log(threadIds); //
                newThreadIds = threadIds;
            } else {
                newThreadIds = threadIds.filter((id) => !alreadyParsedIds.includes(id));
            }
            console.log(`[${board}] Already parsed threads: ${alreadyParsedIds}`);
            console.log(`[${board}] Already parsed posts: ${alreadyParsedPosts}`);
            console.log(`[${board}] Already checked posts: ${alreadyCheckedPosts}`);
            console.log(`[${board}] New threads: ${newThreadIds}`);

            Promise
                .all(newThreadIds.map(thread => getLiveTripPostsByThread(qTrip, alreadyCheckedPosts, alreadyParsedPosts, thread, board)))
                .then(result => {
                    const newPosts = result.reduce((p, e) => p.concat(e), []);
                    notify(`Found ${newPosts.length} new posts on ${board}`)
                    var audio = new Audio('../audio/alert.mp3');
                    audio.play();

                    newPosts.sort((a, b) => b['timestamp'] - a['timestamp']);
                    posts.unshift(...newPosts);
                    postOrder.push(...(newPosts.map(p => (p.timestamp).toString()).reverse()));
                    render(posts);
                    notify(null);
                });
        });
    }

    var timerId = setTimeout(checkForNewPosts, 900000);

}

function getLiveTripPostsByThread(trip, postparsed, preparsed, thread, board) {
    const threadUrl = (thread) => `https://8ch.net/${board}/res/${thread}.json`;
    const referencePattern = />>(\d+)/g;
    return getJson(threadUrl(thread)).then(result => {
        if (!result.posts.some((p) => p.trip === trip && !preparsed.includes(p.no))) {
            return [];
        }
        const newThreadPosts = result
            .posts
            .filter((x) => !preparsed.includes(x.no) && !postparsed.includes(x.no));
        console.log(`[${board}] New posts in thread ${thread} (next line):`);
        console.log(newThreadPosts.length > 0, newThreadPosts);
        const parsePosts = newThreadPosts.map(p => parseLive8chanPost(p, board));

        const newPosts = parsePosts.filter((p) => p.trip === qTrip);

        for (const newPost of newPosts) {
            referencePattern.lastIndex = 0;
            if (referencePattern.test(newPost.text)) {
                referencePattern.lastIndex = 0;
                const referenceId = referencePattern.exec(newPost.text)[1];
                newPost.references = parsePosts.filter((p) => p.id == referenceId);
            }
        }
        console.log(`[${board}] Added ${newPosts.length} posts from thread ${thread}`);
        newcount = newcount + newPosts.length
        if (newcount >= 1) {
            Tinycon.setBubble(newcount)
        }
        return newPosts;
    });
}

function parseLive8chanPost(post, board) {
    const getImages = (chanPost) => [
        {
            url: `https://media.8ch.net/file_store/${chanPost.tim}${chanPost.ext}`,
            filename: chanPost.filename
        }
    ].concat(chanPost.extra_files);
    return {
        images: post.tim
            ? getImages(post)
            : [],
        id: post
            .no
            .toString(),
        userId: post.id,
        timestamp: post.time,
        title: post.title,
        name: post.name,
        email: post.email,
        trip: post.trip,
        text: cleanHtmlText(post.com),
        subject: post.sub,
        source: '8chan_' + board,
        link: `https://8ch.net/${board}/res/${post.resto}.html#${post.no}`,
        threadId: post
            .resto
            .toString(),
        isNew: true
    };
}

function cleanHtmlText(htmlText) {
    const emptyPattern = /<p class="body-line empty "><\/p>/g;
    const referencePattern = /<a [^>]+>&gt;&gt;(\d+)<\/a>/g;
    const linkPattern = /<a [^>]+>(.+?)<\/a>/g;
    const quotePattern = /<p class="body-line ltr quote">&gt;(.+?)<\/p>/g;
    const paragraphPattern = /<p class="body-line ltr ">(.+?)<\/p>/g;

    return htmlText
        .replace(emptyPattern, '\n')
        .replace(referencePattern, (m, p1) => `>>${p1}`)
        .replace(linkPattern, (m, p1) => `${p1}`)
        .replace(quotePattern, (m, p1) => `>${p1}\n`)
        .replace(paragraphPattern, (m, p1) => `${p1}\n`);
}

/// editing
function StoryElement(storyPart) {
    const storyContainer = tag('div', {'class': storyPart.type});
    if (isEditing()) {
        storyContainer.appendChild(tag.fromString(`
            <header>
                <button class="icon" onclick="moveUpStoryPart(this)">keyboard_arrow_up</button>
                <button class="icon" onclick="moveDownStoryPart(this)">keyboard_arrow_down</button>
                <button class="icon" onclick="deleteStoryPart(this)">delete</button>
            </header>
            `));
        storyContainer.item = storyPart;
    }
    switch (storyPart.type) {
        case 'tweet':
            const tweetId = storyPart
                .tweetUrl
                .split('/')
                .slice(-1)[0];
            twttr
                .widgets
                .createTweet(tweetId, storyContainer)
                .then(el => {
                    const div = el.contentDocument.body.firstElementChild;
                    el.remove();
                    storyContainer.appendChild(div);
                });
            break;
        case 'news':
            storyContainer.appendChild(tag.fromString(html.news(storyPart.item)));
            break;
        case 'textPart':
            storyContainer.appendChild(tag.fromString(`<div>${md.render(storyPart.markdown)}</div>`));
            break;
    }
    return storyContainer;
}

function AddForm() {
    const form = tag.fromString(html.addStoryItemForm());

    bindRadios('type', form);

    return form;
}

function moveUpStoryPart(button) {
    const storyContainer = button.parentElement.parentElement;
    const container = storyContainer.parentElement;
    if (container.firstElementChild !== storyContainer) {
        container.insertBefore(storyContainer, storyContainer.previousElementSibling);
    }
    const story = storyContainer.parentElement.story;
    updateEditStory(story);

    const item = storyContainer.item;
    const index = story.indexOf(item);
    story[index] = story[index - 1];
    story[index - 1] = item;
}

function moveDownStoryPart(button) {
    const storyContainer = button.parentElement.parentElement;
    const container = storyContainer.parentElement;
    const story = storyContainer.parentElement.story;

    if (container.lastElementChild !== storyContainer) {
        container.insertBefore(storyContainer, storyContainer.nextElementSibling.nextElementSibling);
    } else {
        container.appendChild(storyContainer);
    }

    const item = storyContainer.item;
    const index = story.indexOf(item);
    story[index] = story[index + 1];
    story[index + 1] = item;

    updateEditStory(story);
}

function deleteStoryPart(button) {
    const storyContainer = button.parentElement.parentElement;
    const story = storyContainer.parentElement.story;
    const item = storyContainer.item;
    story.splice(story.indexOf(item), 1);
    storyContainer.remove();
    updateEditStory(story);
}

const addNewStory = (story, container) => form => event => {
    event.preventDefault();

    const submission = Submission(form);

    story.push(submission);

    create(StoryElement(submission), appendTo(container));

    updateEditStory(story);

    const radio = form.querySelector('[name=type]:checked');
    form.reset();
    radio.checked = true;
};

function updateEditStory(story) {
    stories[story.postId] = story;
    edits[story.postId] = story;
    const submitChanges = document.querySelector('#submitChanges');
    submitChanges.hidden = false;
    submitChanges
        .querySelector('#editSummary strong')
        .textContent = Object
        .keys(edits)
        .length;
}

document.addEventListener('DOMContentLoaded', main, false);
