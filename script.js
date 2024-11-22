const url = "wss://jetstream2.us-east.bsky.network/subscribe?wantedCollections=app.bsky.feed.post";

const ws = new WebSocket(url);
ws.onopen = () => {
    console.log("Connected to Bluesky WebSocket");
};

// Create container for messages
const container = document.createElement('div');
container.style.cssText = `
    position: fixed;
    top: 0;
    left: 0;
    right: 0;
    bottom: 0;
    background: linear-gradient(135deg, #1a1a1a 0%, #2d2d2d 100%);
    color: #fff;
    overflow: hidden;
    font-family: monospace;
    display: flex;
    gap: 10px;
    padding: clamp(10px, 2vw, 20px);
    padding-top: 20px;
    box-sizing: border-box;
`;

// After creating the container, add these new elements
const controlsContainer = document.createElement('div');
controlsContainer.style.cssText = `
    position: fixed;
    top: clamp(10px, 2vw, 20px);
    left: clamp(10px, 2vw, 20px);
    display: flex;
    gap: 10px;
    z-index: 1000;
`;

const followBox = document.createElement('a');
followBox.href = 'https://bsky.app/profile/lantto.bsky.social';
followBox.target = '_blank';
followBox.style.cssText = `
    background: #2a2a2a;
    padding: 10px 15px;
    border-radius: 8px;
    color: #fff;
    text-decoration: none;
    font-family: monospace;
    transition: all 0.3s ease;
    cursor: pointer;
    box-shadow: 0 4px 12px rgba(0,0,0,0.4);
`;
followBox.textContent = 'Follow me @ Bsky';
followBox.addEventListener('mouseenter', () => {
    followBox.style.background = '#363636';
});
followBox.addEventListener('mouseleave', () => {
    followBox.style.background = '#2a2a2a';
});

const pauseButton = document.createElement('button');
pauseButton.style.cssText = `
    background: #2a2a2a;
    padding: 10px 15px;
    border-radius: 8px;
    color: #fff;
    border: none;
    font-family: monospace;
    transition: all 0.3s ease;
    cursor: pointer;
    box-shadow: 0 4px 12px rgba(0,0,0,0.4);
`;
pauseButton.textContent = 'Pause';
let isPaused = false;
pauseButton.addEventListener('click', () => {
    isPaused = !isPaused;
    pauseButton.textContent = isPaused ? 'Resume' : 'Pause';
    pauseButton.style.background = isPaused ? '#4ECDC4' : '#2a2a2a';
    columnPaused.fill(isPaused);
});
pauseButton.addEventListener('mouseenter', () => {
    pauseButton.style.background = isPaused ? '#5ddad1' : '#363636';
});
pauseButton.addEventListener('mouseleave', () => {
    pauseButton.style.background = isPaused ? '#4ECDC4' : '#2a2a2a';
});

controlsContainer.appendChild(followBox);
controlsContainer.appendChild(pauseButton);
document.body.appendChild(controlsContainer);

// Replace the fixed COLUMN_COUNT with a function
function getColumnCount() {
    const width = window.innerWidth;
    if (width < 768) return 2;        // Mobile
    if (width < 1024) return 3;       // Tablet
    if (width < 1440) return 4;       // Small Desktop
    if (width < 1920) return 5;       // Regular Desktop
    return 6;                         // Large Desktop
}

// Initialize variables
let COLUMN_COUNT = getColumnCount();
let columns = [];
let columnPaused = [];
let currentColumn = 0;

// Add these new utility functions
function getRandomColor() {
    const colors = ['#FF6B6B', '#4ECDC4', '#45B7D1', '#96CEB4', '#FFEEAD', '#D4A5A5'];
    return colors[Math.floor(Math.random() * colors.length)];
}

function formatMessage(text) {
    // Convert URLs to clickable links
    const urlRegex = /(https?:\/\/[^\s]+)/g;
    return text.replace(urlRegex, url => `<a href="${url}" target="_blank" style="color: #4ECDC4;">${url}</a>`);
}

// Extract column creation logic into a function
function createColumns() {
    container.innerHTML = '';
    columns = [];
    COLUMN_COUNT = getColumnCount();
    columnPaused = new Array(COLUMN_COUNT).fill(false);

    for (let i = 0; i < COLUMN_COUNT; i++) {
        const column = document.createElement('div');
        column.style.cssText = `
            flex: 1;
            display: flex;
            flex-direction: column;
            gap: 10px;
            height: calc(100%);
            overflow: hidden;
            transition: all 0.3s ease;
            border-radius: clamp(5px, 1vw, 10px);
            padding: clamp(5px, 1vw, 10px);
        `;

        column.addEventListener('mouseenter', () => {
            if (!isPaused) {  // Only pause column if global pause is not active
                columnPaused[i] = true;
                column.style.backgroundColor = 'rgba(255, 255, 255, 0.05)';
            }
        });

        column.addEventListener('mouseleave', () => {
            if (!isPaused) {  // Only unpause if global pause is not active
                columnPaused[i] = false;
                column.style.backgroundColor = 'transparent';
            }
        });

        columns.push(column);
        container.appendChild(column);
    }
    currentColumn = 0;
}

// Initialize columns on load
createColumns();

// Update columns on resize
window.addEventListener('resize', () => {
    const newColumnCount = getColumnCount();
    if (newColumnCount !== COLUMN_COUNT) {
        createColumns();
    }
});

document.body.appendChild(container);

async function fetchWithExponentialBackoff(url, retries = 5, delay = 1000) {
    try {
        const response = await fetch(url);
        if (!response.ok) {
            throw new Error(`HTTP error! status: ${response.status}`);
        }
        return await response.text();
    } catch (error) {
        if (retries > 0) {
            console.log(`Retrying in ${delay}ms...`);
            await new Promise(resolve => setTimeout(resolve, delay));
            return fetchWithExponentialBackoff(url, retries - 1, delay * 2);
        } else {
            throw error;
        }
    }
}

async function fetchProfileFeed(url) {
    try {
        const response = await fetch(url, { mode: 'no-cors' });
        const text = await response.text();
        const parser = new DOMParser();
        const doc = parser.parseFromString(text, 'text/html');
        const postLinks = Array.from(doc.querySelectorAll('a[href*="/post/"]')).map(a => a.href);
        return postLinks;
    } catch (error) {
        console.error("Error fetching profile feed:", error);
        return [];
    }
}

async function fetchEmbedCode(postUrl) {
    try {
        const embedUrl = `https://embed.bsky.app/?url=${postUrl}`;
        const response = await fetch(embedUrl, { mode: 'no-cors' });
        return response.text();
    } catch (error) {
        console.error("Error fetching embed code:", error);
        return '';
    }
}

async function displayMosaicFeed(profileUrls) {
    for (const profileUrl of profileUrls) {
        const postLinks = await fetchProfileFeed(profileUrl);
        for (const postLink of postLinks) {
            const embedCode = await fetchEmbedCode(postLink);
            if (embedCode) {
                const embedContainer = document.createElement('div');
                const userId = postLink.split('/')[4]; // Extract user ID from the post link
                const postId = postLink.split('/').pop(); // Extract post ID from the post link
                embedContainer.style.cssText = `
                    padding: 15px;
                    background: rgba(255, 255, 255, 0.05);
                    border-left: 4px solid ${getRandomColor()};
                    border-radius: 8px;
                    opacity: 0;
                    transform: translateY(-20px);
                    animation: fadeIn 0.3s ease forwards;
                    font-size: 14px;
                    word-break: break-word;
                    box-shadow: 0 2px 5px rgba(0,0,0,0.2);
                    transition: all 0.2s ease;
                    text-decoration: none;
                    color: inherit;
                    cursor: pointer;
                    display: block;
                `;
                embedContainer.innerHTML = `
                    <blockquote class="bluesky-embed" data-bluesky-uri="${postLink}" data-bluesky-cid="data-cid"></blockquote>
                    <blockquote class="bluesky-embed" data-bluesky-uri="at://did:plc:${userId}/app.bsky.feed.post/${postId}" data-bluesky-cid="data-cid"></blockquote>
                    <script async src="https://embed.bsky.app/static/embed.js" charset="utf-8"></script>
                `;
                columns[currentColumn].insertBefore(embedContainer, columns[currentColumn].firstChild);
                currentColumn = (currentColumn + 1) % COLUMN_COUNT;
            }
        }
    }
}

const profileUrls = [
    'https://bsky.app/profile/saltydogfella.bsky.social/feed/aaaiirlsjouiq',
    'https://bsky.app/profile/aendra.com/feed/verified-news'
];

displayMosaicFeed(profileUrls);

ws.onmessage = async (event) => {
    const json = JSON.parse(event.data);

    if (json.kind !== 'commit' || 
        json.commit.collection !== 'app.bsky.feed.post' ||
        !json.commit.record ||
        json.commit.operation !== 'create') {
        return;
    }

    // Find next available unpause column
    let attempts = 0;
    while (columnPaused[currentColumn] && attempts < COLUMN_COUNT) {
        currentColumn = (currentColumn + 1) % COLUMN_COUNT;
        attempts++;
    }

    // If all columns are paused, skip this message
    if (attempts === COLUMN_COUNT) return;
    
    // Fetch embed code with a delay
    const delayBetweenRequests = 1000; // 1 second
    const embedUrl = `https://embed.bsky.app/?url=https://bsky.app/profile/${json.did}/post/${json.commit.rkey}`;
    await new Promise(resolve => setTimeout(resolve, delayBetweenRequests));
    const response = await fetch(embedUrl, { mode: 'no-cors' });
    const embedCode = await response.text();


    // Create new message as a div
    const message = document.createElement('div');
    const userId = json.did.split(':').pop(); // Extract user ID from the DID
    const postId = json.commit.rkey; // Extract post ID from the commit key
    message.style.cssText = `
        padding: 15px;
        background: rgba(255, 255, 255, 0.05);
        border-left: 4px solid ${getRandomColor()};
        border-radius: 8px;
        opacity: 1;
        transform: translateY(-20px);
        animation: fadeIn 0.3s ease forwards;
        font-size: 14px;
        word-break: break-word;
        box-shadow: 0 2px 5px rgba(0,0,0,0.2);
        transition: all 0.2s ease;
        text-decoration: none;
        color: inherit;
        cursor: pointer;
        display: block;
    `;
    message.innerHTML = `
        <blockquote class="bluesky-embed" data-bluesky-uri="${embedUrl}" data-bluesky-cid="data-cid"></blockquote>
        <blockquote class="bluesky-embed" data-bluesky-uri="at://did:plc:${userId}/app.bsky.feed.post/${postId}" data-bluesky-cid="data-cid"></blockquote>
        <script async src="https://embed.bsky.app/static/embed.js" charset="utf-8"></script>
    `;

    // Move the message insertion and hover effects here
    columns[currentColumn].insertBefore(message, columns[currentColumn].firstChild);
    currentColumn = (currentColumn + 1) % COLUMN_COUNT;

    // Only remove old messages if column isn't paused
    if (!columnPaused[currentColumn] && columns[currentColumn].children.length > 15) {
        const oldMessages = Array.from(columns[currentColumn].children).slice(15);
        oldMessages.forEach(msg => {
            msg.style.animation = 'fadeOut 0.3s ease forwards';
            setTimeout(() => msg.remove(), 300);
        });
    }

    // Add hover effect to messages
    message.addEventListener('mouseenter', () => {
        message.style.transform = 'scale(1.02)';
        message.style.background = 'rgba(255, 255, 255, 0.08)';
    });

    message.addEventListener('mouseleave', () => {
        message.style.transform = 'scale(1)';
        message.style.background = 'rgba(255, 255, 255, 0.05)';
    });
};

// Add CSS animations
const style = document.createElement('style');
style.textContent = `
    @keyframes fadeIn {
        from { 
            opacity: 0;
            transform: translateY(-20px) scale(0.95);
        }
        to { 
            opacity: 1;
            transform: translateY(0) scale(1);
        }
    }
    
    @keyframes fadeOut {
        from { 
            opacity: 1;
            transform: translateY(0) scale(1);
        }
        to { 
            opacity: 0;
            transform: translateY(20px) scale(0.95);
        }
    }
`;
document.head.appendChild(style);

ws.onerror = (error) => {
    console.error("WebSocket error:", error);
};

ws.onclose = () => {
    console.log("WebSocket connection closed");
};
