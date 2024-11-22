const url = "wss://jetstream2.us-east.bsky.network/subscribe?wantedCollections=app.bsky.feed.post";

const ws = new WebSocket(url);
ws.onopen = () => {
    console.log("Connected to Bluesky WebSocket");
};

// Create container for messages
const container = document.getElementById('container');

// After creating the container, add these new elements
const controlsContainer = document.getElementById('controlsContainer');
const followBox = document.getElementById('followBox');
const pauseButton = document.getElementById('pauseButton');

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

async function fetchProfileFeed(url) {
    try {
        const response = await fetch(url);
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
    try {
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
    } catch (error) {
        console.error("Error displaying mosaic feed:", error);
    }
}

const profileUrls = [
    'https://bsky.app/profile/saltydogfella.bsky.social/feed/aaaiirlsjouiq',
    'https://bsky.app/profile/aendra.com/feed/verified-news'
];

displayMosaicFeed(profileUrls);

ws.onmessage = async (event) => {
    try {
        const json = JSON.parse(event.data);

        if (json.kind !== 'commit' || 
            json.commit.collection !== 'app.bsky.feed.post' ||
            !json.commit.record ||
            json.commit.operation !== 'create') {
            return;

        // Find next available unpause column
        let attempts = 0;
        while (columnPaused[currentColumn] && attempts < COLUMN_COUNT) {
            currentColumn = (currentColumn + 1) % COLUMN_COUNT;
            attempts++;
        }
        
        // If all columns are paused, skip this message
        if (attempts === COLUMN_COUNT) return;

        // Fetch embed code
        const embedUrl = `https://embed.bsky.app/?url=https://bsky.app/profile/${json.did}/post/${json.commit.rkey}`;
        const response = await fetch(embedUrl);
        const embedCode = await response.text();

        // Create new message as a div
        const message = document.createElement('div');
        message.style.cssText = `
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
        
        message.innerHTML = embedCode;
        
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
    } catch (error) {
        console.error("Error handling WebSocket message:", error);
    }
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
