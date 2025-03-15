import dotenv from "dotenv";
import { Scraper } from "agent-twitter-client";

// Load biến môi trường từ file .env
dotenv.config();

// Khởi tạo Scraper
const scraper = new Scraper();

let accountLoggedIn = false;

// Hàm đăng nhập Twitter
const login = async () => {
  console.log("🟠 Đang đăng nhập bằng tài khoản...");
  await scraper.login(
    process.env.TWITTER_USERNAME || "",
    process.env.TWITTER_PASSWORD || ""
  );
  console.log("🟢 Đã đăng nhập thành công!");
  accountLoggedIn = true;
};

// Hàm lấy tweet theo ID
export const getTweetById = async (tweetId: string) => {
  if (!accountLoggedIn) await login();

  try {
    const tweet = await scraper.getTweet(tweetId);
    console.log("🔹 Tweet lấy được:", tweet);
    return tweet;
  } catch (error) {
    console.error("❌ Lỗi khi lấy tweet:", error);
    throw error;
  }
};

// Hàm lấy tất cả tweet của một user
export const getTweetsByUser = async (username: string, count: number = 5) => {
  if (!accountLoggedIn) await login();

  try {
    const tweets = await scraper.getTweets(username, count);
    console.log(`🔹 ${count} tweet gần đây của ${username}:`, tweets);
    return tweets;
  } catch (error) {
    console.error("❌ Lỗi khi lấy tweet:", error);
    throw error;
  }
};

// Hàm đăng một tweet mới
export const postTweet = async (content: string) => {
  if (!accountLoggedIn) await login();

  try {
    await scraper.sendTweet(content);
    console.log("✅ Đã đăng tweet:", content);
  } catch (error) {
    console.error("❌ Lỗi khi đăng tweet:", error);
    throw error;
  }
};

// Hàm lấy tweet mới nhất của một tài khoản
export const getLatestTweet = async (username: string) => {
  if (!accountLoggedIn) await login();

  try {
    const latestTweet = await scraper.getLatestTweet(username);
    console.log("🔹 Tweet mới nhất:", latestTweet);
    return latestTweet;
  } catch (error) {
    console.error("❌ Lỗi khi lấy tweet mới nhất:", error);
    throw error;
  }
};
