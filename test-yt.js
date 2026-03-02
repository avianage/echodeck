const youtubesearchapi = require("youtube-search-api");

async function test() {
    try {
        const videoId = "XqZsoesa55w"; // Example video
        console.log("Checking GetVideoDetails...");
        const details = await youtubesearchapi.GetVideoDetails(videoId);

        if (details.suggestion) {
            console.log("Suggestions found! Count:", details.suggestion.length);
            console.log("First suggestion structure:", JSON.stringify(details.suggestion[0], null, 2));
        } else {
            console.log("No suggestions found.");
        }

    } catch (e) {
        console.error("Error:", e);
    }
}

test();
