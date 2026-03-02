const youtubesearchapi = require("youtube-search-api");

async function test() {
    try {
        const videoId = "dQw4w9WgXcQ"; // Never Gonna Give You Up - definitely has suggestions
        console.log("Checking GetVideoDetails for:", videoId);
        const details = await youtubesearchapi.GetVideoDetails(videoId);

        console.log("Title:", details.title);
        if (details.suggestion && details.suggestion.length > 0) {
            console.log("Suggestions found! Count:", details.suggestion.length);
            console.log("First suggestion:", details.suggestion[0].title, "(ID:", details.suggestion[0].id, ")");
        } else {
            console.log("No suggestions found.");
            // Print the keys of secondaryResults if we can access it? 
            // In the library it's result.secondaryResults.secondaryResults.results
        }

    } catch (e) {
        console.error("Error:", e);
    }
}

test();
