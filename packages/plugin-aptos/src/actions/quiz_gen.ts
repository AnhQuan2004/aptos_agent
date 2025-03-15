import { Action, ActionExample, Memory, IAgentRuntime, State, HandlerCallback, generateText, ModelClass, elizaLogger } from "@elizaos/core";
import { quizGenPrompt } from "./prompts";
import { QuizGenAction } from "./enum";
import axios from 'axios';
import { getTweetById } from "./twitterClient";
interface QuizQuestion {
    question: string;
    answerA: string;
    answerB: string;
    answerC: string;
    answerD: string;
    correctAnswer: string;
}

interface QuizData {
    questions: QuizQuestion[];
}

// Function to store quiz data to backend
async function storeQuizToBackend(quizData: QuizData): Promise<boolean> {
    try {
        const response = await axios.post(
            'https://movestack-backend.vercel.app/api/v1/quiz',
            quizData,
            {
                headers: {
                    'Content-Type': 'application/json'
                }
            }
        );
        
        if (response.status >= 200 && response.status < 300) {
            elizaLogger.info('Quiz data successfully stored to backend:', response.data);
            return true;
        } else {
            elizaLogger.error('Failed to store quiz data to backend:', response.status, response.data);
            return false;
        }
    } catch (error) {
        elizaLogger.error('Error storing quiz data to backend:', error);
        return false;
    }
}

export default {
    name: "QUIZ_GEN",
    similes: [
        "quiz gen", "quiz", "I need to quiz gen", "help me quiz gen", "what quiz gen", "help me generate a quiz", "generate a quiz", "quiz generation", "quiz generation help", "quiz generation help me", "quiz generation what", "quiz generation generate",
        "generate quiz from tweet", "tweet quiz", "quiz from tweet", "gen quiz from twitter", "twitter quiz", 
        "gen quiz + link", "quiz from twitter link", "quiz from x link", "quiz from twitter url", "quiz from x url"
    ],
    description: "Quiz gen of text content or from a tweet (supports direct tweet IDs and Twitter/X URLs)",

    validate: async (runtime: IAgentRuntime, message: Memory) => {
        return message.content?.text?.length > 0;
    },
    handler: async (runtime: IAgentRuntime,
        message: Memory,
        state: State,
        _options: { [key: string]: unknown },
        callback?: HandlerCallback) => {
        try {
            let textContent = message.content.text;
            let usedTweetId = null;
            
            // Extract tweet ID from different possible formats
            
            // 1. Check for direct tweet ID format: tweet:12345
            const directTweetIdMatch = textContent.match(/tweet:(\d+)/i);
            
            // 2. Check for Twitter/X URL format: https://x.com/username/status/12345 or https://twitter.com/username/status/12345
            const twitterUrlMatch = textContent.match(/(?:https?:\/\/)?(?:www\.)?(?:twitter\.com|x\.com)\/(?:#!\/)?(?:\w+)\/status\/(\d+)/i);
            
            // Use the first match found
            let tweetId = null;
            if (directTweetIdMatch) {
                tweetId = directTweetIdMatch[1];
                elizaLogger.info(`Found direct tweet ID reference: ${tweetId}`);
            } else if (twitterUrlMatch) {
                tweetId = twitterUrlMatch[1];
                elizaLogger.info(`Extracted tweet ID from URL: ${tweetId}`);
            }
            
            // If we found a tweet ID, try to fetch the tweet
            if (tweetId) {
                elizaLogger.info(`Fetching tweet with ID: ${tweetId}`);
                
                try {
                    const tweet = await getTweetById(tweetId);
                    if (tweet && tweet.text) {
                        elizaLogger.info(`Successfully fetched tweet: ${tweet.text}`);
                        textContent = tweet.text;
                        usedTweetId = tweetId;
                    } else {
                        elizaLogger.error(`Failed to fetch tweet content for ID: ${tweetId}`);
                    }
                } catch (error) {
                    elizaLogger.error(`Error fetching tweet: ${error}`);
                }
            }
            
            const context = quizGenPrompt(textContent);
            console.log(context);

            const response = await generateText({
                runtime,
                context: JSON.stringify(context),
                modelClass: ModelClass.SMALL,
            });

            let parsedQuestions: QuizQuestion[] = [];
            let parsedResponse: any;
            const processedQuestions = new Set();

            try {
                // First try parsing as JSON
                parsedResponse = JSON.parse(response.trim());
                if (Array.isArray(parsedResponse)) {
                    parsedQuestions = parsedResponse;
                } else {
                    parsedQuestions = [parsedResponse];
                }
            } catch (e) {
                // If JSON parsing fails, try parsing the formatted text
                const lines = response.trim().split('\n');
                let currentQuestion: Partial<QuizQuestion> = {};
                
                for (let i = 0; i < lines.length; i++) {
                    const line = lines[i].trim();
                    
                    if (line.startsWith('Question')) {
                        // If we have a complete question, check for duplicates before adding
                        if (currentQuestion.question && currentQuestion.correctAnswer) {
                            if (!processedQuestions.has(currentQuestion.question)) {
                                parsedQuestions.push(currentQuestion as QuizQuestion);
                                processedQuestions.add(currentQuestion.question);
                            }
                        }
                        // Start new question
                        currentQuestion = {};
                        const questionMatch = line.match(/Question \d+:\s*(.*)/);
                        if (questionMatch) {
                            currentQuestion.question = questionMatch[1].trim();
                        }
                    } else if (line.startsWith('A.')) currentQuestion.answerA = line.substring(2).trim();
                    else if (line.startsWith('B.')) currentQuestion.answerB = line.substring(2).trim();
                    else if (line.startsWith('C.')) currentQuestion.answerC = line.substring(2).trim();
                    else if (line.startsWith('D.')) currentQuestion.answerD = line.substring(2).trim();
                    else if (line.startsWith('Correct Answer:')) {
                        const correctMatch = line.match(/:\s*([A-D])/i);
                        if (correctMatch) {
                            currentQuestion.correctAnswer = correctMatch[1].trim();
                        }
                        // Add the last question if complete and not duplicate
                        if (currentQuestion.question && currentQuestion.correctAnswer) {
                            if (!processedQuestions.has(currentQuestion.question)) {
                                parsedQuestions.push(currentQuestion as QuizQuestion);
                                processedQuestions.add(currentQuestion.question);
                            }
                        }
                    }
                }
            }

            const quizData: QuizData = {
                questions: parsedQuestions
            };

            // Store quiz data to backend
            await storeQuizToBackend(quizData);
            
            // Prepare response data
            const responseData: any = {
                text: response.trim(),
                action: QuizGenAction.QUIZ_GEN,
                params: quizData
            };
            
            // If we used a tweet, include the tweet ID in the response
            if (usedTweetId) {
                responseData.tweetId = usedTweetId;
                responseData.source = "twitter";
            }
            
            callback(responseData);

        } catch (error) {
            console.error('Error in quiz gen:', error);
            throw error;
        }
    },
    examples: [
        [
            {
                user: "{{user1}}",
                content: {
                    text: "I love the new features in the app! It's so user-friendly."
                }
            },
            {
                user: "{{user2}}",
                content: {
                    text: "The app has improved a lot, especially the new updates!"
                }
            }
        ],
        [
            {
                user: "{{user3}}",
                content: {
                    text: "I'm not happy with the recent changes. They made it worse."
                }
            },
            {
                user: "{{user4}}",
                content: {
                    text: "The latest update is frustrating and confusing."
                }
            }
        ]
    ] as ActionExample[][],
};

export interface TwitterPost {
    id: string;
    text: string;
    userId: string;
    createdAt: Date;
}