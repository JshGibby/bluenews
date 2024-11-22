<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Real-Time Mosaic with Bluesky Firehose API</title>
    <style>
        body {
            display: flex;
            justify-content: center;
            align-items: center;
            height: 100vh;
            margin: 0;
            background-color: #f0f0f0;
        }
        .image-container {
            display: flex;
            flex-wrap: wrap;
            justify-content: center;
            align-items: center;
        }
        .image-card {
            width: 200px;
            height: 200px;
            background-color: black;
            transition: transform 0.5s, opacity 0.5s;
            transform: rotateY(180deg);
            opacity: 0;
            margin: 0;
            padding: 0;
        }
        .image-card img {
            width: 100%;
            height: 100%;
            object-fit: cover;
        }
        .image-card.show {
            transform: rotateY(0);
            opacity: 1;
        }
        .flip-in {
            animation: flipIn 0.5s forwards;
        }
        .flip-out {
            animation: flipOut 0.5s forwards;
        }
        @keyframes flipIn {
            from {
                transform: rotateY(180deg);
                opacity: 0;
            }
            to {
                transform: rotateY(0);
                opacity: 1;
            }
        }
        @keyframes flipOut {
            from {
                transform: rotateY(0);
                opacity: 1;
            }
            to {
                transform: rotateY(180deg);
                opacity: 0;
            }
        }
    </style>
</head>
<body>
    <div class="image-container" id="mosaic"></div>
    <button id="pauseButton">Pause</button>
    <script>
        const url = "wss://jetstream2.us-east.bsky.network/subscribe?wantedCollections=app.bsky.feed.post";

        let isPaused = false;
        const pauseButton = document.getElementById('pauseButton');
        let activeWebSocket = null;
        let imageCounter = 0;
        const IMAGE_LIMIT = 1000;

        const PRESET_HASHTAGS = {
            'art': new Set(['art', 'digitalart', 'fanart', 'illustration', 'drawing', 'oc', 'photography', 
                            'artist', 'traditionalart', 'blender', 'render', 'c4d', '3d', '3dart', 
                            'procreate', 'sketch', 'artist', 'pixelart'])
        };

        function getUrlParameters() {
            const params = new URLSearchParams(window.location.search);
            const preset = params.get('preset')?.toLowerCase();
            const customTags = params.get('tags')?.toLowerCase();
            
            let activeHashtags = new Set();
            
            if (preset && PRESET_HASHTAGS[preset]) {
                activeHashtags = new Set([...PRESET_HASHTAGS[preset]]);
            }
            
            if (customTags) {
                const customTagsArray = customTags.split(',').map(tag => tag.trim());
                customTagsArray.forEach(tag => activeHashtags.add(tag));
            }
            
            return activeHashtags;
        }

        const ALLOWED_HASHTAGS = getUrlParameters();

        function hasAllowedHashtag(facets) {
            if (ALLOWED_HASHTAGS.size === 0) return true;
            
            if (!facets) return false;
            
            for (const facet of facets) {
                if (!facet.features) continue;
                
                for (const feature of facet.features) {
                    if (feature.$type === 'app.bsky.richtext.facet#tag') {
                        const hashtag = feature.tag.toLowerCase();
                        if (ALLOWED_HASHTAGS.has(hashtag)) {
                            return true;
                        }
                    }
                }
            }
            return false;
        }

        function setupWebSocket() {
            if (activeWebSocket) {
                activeWebSocket.close();
            }
            
            activeWebSocket = new WebSocket(url);
            
            activeWebSocket.onopen = () => {
                console.log("Connected to Bluesky WebSocket");
            };

            activeWebSocket.onmessage = async (event) => {
                if (isPaused) return;
                
                const json = JSON.parse(event.data);
                
                if (json.commit?.record?.$type === "app.bsky.feed.post" && 
                    json.commit.record.embed?.$type === "app.bsky.embed.images") {
                    
                    const facets = json.commit.record.facets;
                    if (!hasAllowedHashtag(facets)) {
                        return;
                    }
                    
                    const did = json.did;
                    const rkey = json.commit.rkey;
                    const postMessage = json.commit.record.text;
                    
                    const embedUrl = `https://embed.bsky.app/api/v1/embed?url=https://bsky.app/profile/${did}/post/${rkey}`;
                    const embedResponse = await fetch(embedUrl);
                    const embedData = await embedResponse.json();
                    
                    if (embedData.images) {
                        embedData.images.forEach(image => {
                            const imageUrl = image.url;
                            addImageToMosaic(imageUrl, did, rkey, postMessage);
                        });
                    }
                }
            };

            activeWebSocket.onerror = (error) => {
                console.error("WebSocket error:", error);
            };

            activeWebSocket.onclose = () => {
                console.log("WebSocket connection closed");
                if (!isPaused) {
                    // Attempt to reconnect after 5 seconds if not manually paused
                    setTimeout(() => {
                        setupWebSocket();
                    }, 100);
                }
            };
        }

        // Initialize the WebSocket connection
        setupWebSocket();

        pauseButton.addEventListener('click', () => {
            isPaused = !isPaused;
            pauseButton.textContent = isPaused ? 'Resume' : 'Pause';
            pauseButton.classList.toggle('paused');
            pauseButton.classList.remove('auto-paused');
            
            if (isPaused) {
                activeWebSocket.close();
            } else {
                imageCounter = 0;
                setupWebSocket();
            }
        });

        const mosaic = document.getElementById('mosaic');
        let currentIndex = 0;
        let gridSize = 0;

        // Calculate grid size based on viewport
        function calculateGridSize() {
            const viewportWidth = window.innerWidth;
            const viewportHeight = window.innerHeight;
            
            // Calculate how many columns we can fit with a minimum of 3
            const columnsCount = Math.max(3, Math.floor(viewportWidth / 200));
            const rowsCount = Math.floor(viewportHeight / (viewportWidth / columnsCount));
            
            return columnsCount * rowsCount;
        }

        // Initialize the grid with placeholder images
        function initializeMosaic() {
            gridSize = calculateGridSize();
            
            // Clear existing content
            mosaic.innerHTML = '';
            
            // Add placeholder images
            for (let i = 0; i < gridSize; i++) {
                const imgContainer = document.createElement('div');
                imgContainer.className = 'image-container';
                
                const img = new Image();
                img.src = 'data:image/svg+xml,' + encodeURIComponent(`
                    <svg width="200" height="200" xmlns="http://www.w3.org/2000/svg">
                        <rect width="100%" height="100%" fill="#000000"/>
                    </svg>
                `);
                img.alt = 'Placeholder';
                
                imgContainer.appendChild(img);
                mosaic.appendChild(imgContainer);
            }
        }

        // Recalculate grid size and reinitialize when window is resized
        window.addEventListener('resize', () => {
            initializeMosaic();
        });

        // Initial setup
        initializeMosaic();

        function addImageToMosaic(imageUrl, did, rkey, postMessage) {
            const img = new Image();
            img.src = imageUrl;
            img.dataset.postUrl = `https://bsky.app/profile/${did}/post/${rkey}`; // Store the URL
            
            img.onload = () => {
                if (isPaused) {
                    return;
                }
                displayImage(img, postMessage);
            };

            img.onerror = () => {
                console.error('Failed to load image:', imageUrl);
                if (!isPaused) {
                    currentIndex = (currentIndex + 1) % gridSize;
                }
            };
        }

        function displayImage(img, postMessage) {
            imageCounter++;
            if (imageCounter >= IMAGE_LIMIT && !isPaused) {
                isPaused = true;
                pause[_{{{CITATION{{{_1{](https://github.com/MadosMark/FakeNews/tree/92e370086106761ae9f629ef5f3355210e2d8541/header.php)

            message.style.color = 'white';
            message.style.fontSize = '14px';
            message.style.marginTop = '5px';
            
            imgContainer.appendChild(link);
            imgContainer.appendChild(message);

            const oldContainer = mosaic.children[currentIndex];
            oldContainer.classList.add('flip-out');
            
            setTimeout(() => {
                mosaic.children[currentIndex].replaceWith(imgContainer);
                currentIndex = (currentIndex + 1) % gridSize;
            }, 300);
        }

        // Initialize the WebSocket connection
        setupWebSocket();

        pauseButton.addEventListener('click', () => {
            isPaused = !isPaused;
            pauseButton.textContent = isPaused ? 'Resume' : 'Pause';
            pauseButton.classList.toggle('paused');
            pauseButton.classList.remove('auto-paused');
            
            if (isPaused) {
                activeWebSocket.close();
            } else {
                imageCounter = 0;
                setupWebSocket();
            }
        });

        const mosaic = document.getElementById('mosaic');
        let currentIndex = 0;
        let gridSize = 0;

        // Calculate grid size based on viewport
        function calculateGridSize() {
            const viewportWidth = window.innerWidth;
            const viewportHeight = window.innerHeight;
            
            // Calculate how many columns we can fit with a minimum of 3
            const columnsCount = Math.max(3, Math.floor(viewportWidth / 200));
            const rowsCount = Math.floor(viewportHeight / (viewportWidth / columnsCount));
            
            return columnsCount * rowsCount;
        }

        // Initialize the grid with placeholder images
        function initializeMosaic() {
            gridSize = calculateGridSize();
            
            // Clear existing content
            mosaic.innerHTML = '';
            
            // Add placeholder images
            for (let i = 0; i < gridSize; i++) {
                const imgContainer = document.createElement('div');
                imgContainer.className = 'image-container';
                
                const img = new Image();
                img.src = 'data:image/svg+xml,' + encodeURIComponent(`
                    <svg width="200" height="200" xmlns="http://www.w3.org/2000/svg">
                        <rect width="100%" height="100%" fill="#000000"/>
                    </svg>
                `);
                img.alt = 'Placeholder';
                
                imgContainer.appendChild(img);
                mosaic.appendChild(imgContainer);
            }
        }

        // Recalculate grid size and reinitialize when window is resized
        window.addEventListener('resize', () => {
            initializeMosaic();
        });

        // Initial setup
        initializeMosaic();
    </script>
</body>
</html>
