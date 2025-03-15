require('dotenv').config();
const { Scraper } = require('agent-twitter-client');
const fs = require('fs');

async function getTweetById(tweetId) {
    const scraper = new Scraper();

    try {
        // Kiểm tra xem có file cookies không, nếu có thì dùng để tránh phải đăng nhập lại
        let cookies;
        if (fs.existsSync('cookies.json')) {
            try {
                cookies = JSON.parse(fs.readFileSync('cookies.json'));
                
                // Make sure cookies are in the correct format
                if (!Array.isArray(cookies)) {
                    throw new Error('Cookies are not in the expected format');
                }
                
                // Ensure each cookie has the required properties
                const validCookies = cookies.filter(cookie => 
                    typeof cookie === 'object' && 
                    cookie.name && 
                    cookie.value && 
                    cookie.domain
                );
                
                if (validCookies.length === 0) {
                    throw new Error('No valid cookies found');
                }
                
                await scraper.setCookies(validCookies);
                console.log("🟢 Đã sử dụng cookies để đăng nhập!");
            } catch (cookieError) {
                console.error("🔴 Lỗi cookies:", cookieError.message);
                console.log("🔄 Đang đăng nhập lại...");
                
                // Delete invalid cookies file
                fs.unlinkSync('cookies.json');
                
                // Login with credentials
                await loginAndSaveCookies(scraper);
            }
        } else {
            console.log("🟠 Không tìm thấy cookies, đang đăng nhập bằng tài khoản...");
            await loginAndSaveCookies(scraper);
        }

        // Lấy tweet theo ID
        const tweet = await scraper.getTweet(tweetId);
        console.log("🔹 Tweet lấy được:", tweet);
        return tweet;
    } catch (error) {
        console.error("❌ Lỗi khi lấy tweet:", error);
        throw error;
    }
}

async function loginAndSaveCookies(scraper) {
    // Check if environment variables are set
    if (!process.env.TWITTER_USERNAME || !process.env.TWITTER_PASSWORD) {
        throw new Error('TWITTER_USERNAME or TWITTER_PASSWORD environment variables are not set');
    }
    
    // Login with credentials
    await scraper.login(process.env.TWITTER_USERNAME, process.env.TWITTER_PASSWORD);
    
    // Save cookies for future use
    const cookies = await scraper.getCookies();
    fs.writeFileSync('cookies.json', JSON.stringify(cookies));
    console.log("🟢 Cookies đã được lưu!");
}

// Function to extract tweet content from URL
async function getTweetFromUrl(url) {
    // Extract tweet ID from URL
    const tweetIdMatch = url.match(/https?:\/\/(?:www\.)?(?:twitter\.com|x\.com)\/\w+\/status\/(\d+)/);
    if (!tweetIdMatch) {
        console.error("❌ URL không hợp lệ:", url);
        return null;
    }
    
    const tweetId = tweetIdMatch[1];
    console.log("🔍 Đã tìm thấy Tweet ID:", tweetId);
    
    // Get tweet by ID
    const tweet = await getTweetById(tweetId);
    return tweet;
}

// Chạy chương trình với một tweet ID mẫu
const TWEET_ID = "1899687494586978582"; // Thay bằng ID tweet bạn muốn lấy
getTweetById(TWEET_ID).catch(console.error);

// Export functions for use in other modules
module.exports = {
    getTweetById,
    getTweetFromUrl
};
