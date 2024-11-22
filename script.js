const url = "wss://jetstream2.us-east.bsky.network/subscribe?wantedCollections=app.bsky.feed.post";

const ws = new WebSocket(url);
ws.onopen = () => {
    console.log("Connected to Bluesky WebSocket");
};

// Initialize variables
let COLUMN_COUNT = getColumnCount();
let columns = [];
let columnPaused = [];
let currentColumn = 0;

// Replace the fixed COLUMN_COUNT with a function
function getColumnCount() {
    const width = window.innerWidth;
    if (width < 768) return 2;        // Mobile
    if (width < 1024) return 3;       // Tablet
    if (width < 1440) return 4;       // Small Desktop
    if (width < 1920) return 5;       // Regular Desktop
    return 6;                         // Large Desktop
}

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

async function fetchProfileFeed(url) {
    try {
        const response = await fetch(`{url}`);
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
        const response = await fetch(embedUrl);
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
                embedContainer.innerHTML = embedCode;
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

    // Fetch embed code
    const embedUrl = `https://cors-anywhere.herokuapp.com/https://embed.bsky.app/?url=https://bsky.app/profile/${json.did}/post/${json.commit.rkey}`;
    const response = await fetch(embedUrl);
    const embedCode = await response.text();

    // Create new message as a div
    const message = document.createElement('div');
    message.innerHTML = embedCode;
    
    // Move the message insertion and hover effects here
    columns[currentColumn].insertBefore(message, columns[currentColumn].firstChild);
    currentColumn = (currentColumn + 1) % COLUMN_COUNT;
    
    // Only remove old messages if column isn't paused
    if (!columnPaused[currentColumn] && columns[currentColumn].children.length > 15) {
        const oldMessages = Array.from(columns[currentColumn].children).slice(15);
        oldMessages.forEach(msg => {
            setTimeout(() => msg.remove(), 300);
        });
    }
};

ws.onerror = (error) => {
    console.error("WebSocket error:", error);
};

ws.onclose = () => {
    console.log("WebSocket connection closed");
};
