import express, { Router } from "express";
import bodyParser from "body-parser";
import cors from "cors";
import path from "path";
import fs from "fs";
import { getAllData } from './pinata';

import {
    type AgentRuntime,
    elizaLogger,
    getEnvVariable,
    type UUID,
    validateCharacterConfig,
    ServiceType,
    type Character,
} from "@elizaos/core";
import { get_all_bounties, distributeRewards } from "./bounty";
import { REST, Routes } from "discord.js";
import type { DirectClient } from ".";
import { validateUuid } from "@elizaos/core";
import { GoogleGenerativeAI } from "@google/generative-ai";

interface UUIDParams {
    agentId: UUID;
    roomId?: UUID;
}

function validateUUIDParams(
    params: { agentId: string; roomId?: string },
    res: express.Response
): UUIDParams | null {
    const agentId = validateUuid(params.agentId);
    if (!agentId) {
        res.status(400).json({
            error: "Invalid AgentId format. Expected to be a UUID: xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx",
        });
        return null;
    }

    if (params.roomId) {
        const roomId = validateUuid(params.roomId);
        if (!roomId) {
            res.status(400).json({
                error: "Invalid RoomId format. Expected to be a UUID: xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx",
            });
            return null;
        }
        return { agentId, roomId };
    }

    return { agentId };
}

async function callGemini(prompt: string) {
    try {
        const genAI = new GoogleGenerativeAI(process.env.GOOGLE_GENERATIVE_AI_API_KEY || '');
        const model = genAI.getGenerativeModel({ model: "gemini-2.0-flash" });
        
        const result = await model.generateContent(prompt);
        const response = await result.response;
        const text = response.text();
        
        // Strip markdown and return raw text
        return text.replace(/```json\n?/g, '').replace(/```\n?/g, '').trim();
    } catch (error) {
        console.error('Gemini API error:', error);
        return { 
            error: "Failed to get Gemini response",
            details: error.message
        };
    }
}

export function createApiRouter(
    agents: Map<string, AgentRuntime>,
    directClient: DirectClient
): Router {
    const router = express.Router();

    router.use((req, res, next) => {
        res.header("Access-Control-Allow-Origin", "*");
        res.header("Access-Control-Allow-Methods", "GET, POST, OPTIONS");
        res.header("Access-Control-Allow-Headers", "Content-Type");
        next();
    });

    router.use(bodyParser.json());
    router.use(bodyParser.urlencoded({ extended: true }));
    router.use(
        express.json({
            limit: getEnvVariable("EXPRESS_MAX_PAYLOAD") || "100kb",
        })
    );

    router.get("/", (req, res) => {
        res.send("Welcome, this is the REST API!");
    });

    router.get("/hello", (req, res) => {
        res.json({ message: "Hello World!" });
    });

    // Add sentiment analysis route using Gemini
    router.post("/sentiment", async (req, res) => {
        try {
            const { text } = req.body;

            if (!text || typeof text !== 'string') {
                return res.status(400).json({ 
                    error: "Missing or invalid 'text' parameter. Please provide text to analyze." 
                });
            }

            const prompt = `
            Analyze the sentiment of this text and classify it as exactly one of these: "positive", "negative", or "neutral".
            
            Text: "${text}"
            
            Only respond with one word: either "positive", "negative", or "neutral".
            `;

            try {
                const genAI = new GoogleGenerativeAI(process.env.GOOGLE_GENERATIVE_AI_API_KEY || '');
                const model = genAI.getGenerativeModel({ model: "gemini-2.0-flash" });
                
                const result = await model.generateContent(prompt);
                const response = await result.response;
                let sentiment = response.text().trim().toLowerCase();
                
                // Ensure we only return one of the three valid responses
                if (!['positive', 'negative', 'neutral'].includes(sentiment)) {
                    // Extract just the sentiment word if it's embedded in a sentence
                    if (sentiment.includes('positive')) sentiment = 'positive';
                    else if (sentiment.includes('negative')) sentiment = 'negative';
                    else sentiment = 'neutral';
                }
                
                // For simple mode (only returning sentiment string)
                if (req.query.simple === 'true') {
                    return res.json(sentiment);
                }
                
                // Return complete result
                res.json({
                    text,
                    sentiment,
                    timestamp: new Date().toISOString()
                });
                
            } catch (error) {
                console.error('Gemini API error:', error);
                res.status(500).json({ 
                    error: "Failed to analyze sentiment with Gemini", 
                    details: error.message,
                    timestamp: new Date().toISOString()
                });
            }
        } catch (error) {
            console.error("Error in sentiment analysis API:", error);
            res.status(500).json({ 
                error: "Failed to analyze sentiment", 
                details: error.message,
                timestamp: new Date().toISOString()
            });
        }
    });

    // Add GET method for sentiment analysis
    router.get("/sentiment", async (req, res) => {
        try {
            const text = req.query.text as string;

            if (!text || typeof text !== 'string') {
                return res.status(400).json({ 
                    error: "Missing or invalid 'text' query parameter. Please provide text to analyze using ?text=your+text+here" 
                });
            }

            const prompt = `
            Analyze the sentiment of this text and classify it as exactly one of these: "positive", "negative", or "neutral".
            
            Text: "${text}"
            
            Only respond with one word: either "positive", "negative", or "neutral".
            `;

            try {
                const genAI = new GoogleGenerativeAI(process.env.GOOGLE_GENERATIVE_AI_API_KEY || '');
                const model = genAI.getGenerativeModel({ model: "gemini-2.0-flash" });
                
                const result = await model.generateContent(prompt);
                const response = await result.response;
                let sentiment = response.text().trim().toLowerCase();
                
                // Ensure we only return one of the three valid responses
                if (!['positive', 'negative', 'neutral'].includes(sentiment)) {
                    // Extract just the sentiment word if it's embedded in a sentence
                    if (sentiment.includes('positive')) sentiment = 'positive';
                    else if (sentiment.includes('negative')) sentiment = 'negative';
                    else sentiment = 'neutral';
                }
                
                // For simple mode (only returning sentiment string)
                if (req.query.simple === 'true') {
                    return res.json(sentiment);
                }
                
                // Return complete result
                res.json({
                    text,
                    sentiment,
                    timestamp: new Date().toISOString()
                });
                
            } catch (error) {
                console.error('Gemini API error:', error);
                res.status(500).json({ 
                    error: "Failed to analyze sentiment with Gemini", 
                    details: error.message,
                    timestamp: new Date().toISOString()
                });
            }
        } catch (error) {
            console.error("Error in sentiment analysis API:", error);
            res.status(500).json({ 
                error: "Failed to analyze sentiment", 
                details: error.message,
                timestamp: new Date().toISOString()
            });
        }
    });

    // Route to process and distribute rewards for expired bounties
    router.get("/reward", async (req, res) => {
        try {
            // Step 1: Get all bounties
            const rawBounties = await get_all_bounties();
            console.log("Raw bounties response:", JSON.stringify(rawBounties, null, 2));

            // The response is nested in an array of arrays, so we need to get the first element
            const bounties = Array.isArray(rawBounties) && rawBounties.length > 0 ? 
                (Array.isArray(rawBounties[0]) ? rawBounties[0] : []) : [];

            console.log("Processed bounties array:", JSON.stringify(bounties, null, 2));

            // Check if bounties are valid
            if (!Array.isArray(bounties) || bounties.length === 0) {
                throw new Error("No bounties found or invalid data format");
            }

            // Step 2: Determine current time
            const currentTime = Math.floor(Date.now() / 1000);
            console.log("Current Time:", currentTime);

            const results = [];

            // Step 3: Process each bounty
            for (const bounty of bounties) {
                // Convert snake_case to camelCase and parse values
                const expiredAt = parseInt(bounty.expired_at, 10);
                const shouldProcess = expiredAt <= currentTime && !bounty.distributed;

                console.log(`Processing bounty:
                    ID: ${bounty.bounty_id}
                    Expired At: ${expiredAt} (${new Date(expiredAt * 1000).toISOString()})
                    Current Time: ${currentTime} (${new Date(currentTime * 1000).toISOString()})
                    Distributed: ${bounty.distributed}
                    Should Process: ${shouldProcess}
                    Raw Bounty Data: ${JSON.stringify(bounty, null, 2)}
                `);

                if (shouldProcess) {
                    try {
                        console.log(`Processing distribution for bounty ID: ${bounty.bounty_id}`);
                        const result = await distributeRewards(bounty.bounty_id);

                        if (result !== null && result.hash) {
                            results.push({
                                bountyId: bounty.bounty_id,
                                status: "success",
                                transactionHash: result.hash,
                                expiredAt: new Date(expiredAt * 1000).toISOString(),
                                rewardAmount: bounty.reward_amount,
                                participants: bounty.participants?.length || 0,
                                minParticipants: bounty.min_of_participants
                            });
                        } else {
                            console.log(`Distribution failed for bounty ID: ${bounty.bounty_id}`);
                            results.push({
                                bountyId: bounty.bounty_id,
                                status: "skipped",
                                reason: "Distribution failed or already processed",
                                expiredAt: new Date(expiredAt * 1000).toISOString(),
                                rewardAmount: bounty.reward_amount,
                                participants: bounty.participants?.length || 0,
                                minParticipants: bounty.min_of_participants
                            });
                        }
                    } catch (error) {
                        console.error(`Error processing bounty ID: ${bounty.bounty_id}`, error);
                        results.push({
                            bountyId: bounty.bounty_id,
                            status: "failed",
                            error: error.message,
                            expiredAt: new Date(expiredAt * 1000).toISOString(),
                            rewardAmount: bounty.reward_amount,
                            participants: bounty.participants?.length || 0,
                            minParticipants: bounty.min_of_participants
                        });
                    }
                } else {
                    console.log(`Skipped bounty ID: ${bounty.bounty_id} - not expired or already distributed`);
                    results.push({
                        bountyId: bounty.bounty_id,
                        status: "pending",
                        reason: !bounty.distributed ? "Not expired yet" : "Already distributed",
                        expiredAt: new Date(expiredAt * 1000).toISOString(),
                        rewardAmount: bounty.reward_amount,
                        participants: bounty.participants?.length || 0,
                        minParticipants: bounty.min_of_participants,
                        currentTime: new Date(currentTime * 1000).toISOString()
                    });
                }
            }

            // Step 4: Return results
            res.json({
                timestamp: new Date().toISOString(),
                currentTimestamp: currentTime,
                processedBounties: results,
                totalBounties: bounties.length,
                rawBountyData: bounties // Include raw data for debugging
            });
        } catch (error) {
            console.error("Error in /reward route:", error);
            res.status(500).json({
                error: error.message,
                timestamp: new Date().toISOString()
            });
        }
    });

    router.get("/data", async (req, res) => {
        res.header("Access-Control-Allow-Origin", "*");
        res.header("Access-Control-Allow-Methods", "GET, POST, OPTIONS");
        res.header("Access-Control-Allow-Headers", "Content-Type");

        try {
            let rawData = await getAllData();

            if (!rawData || !Array.isArray(rawData) || rawData.length === 0) {
                throw new Error('No valid data found from Pinata');
            }

            const authorCounts = {};
            const formattedData = rawData.map(tweet => {
                // Add checks to ensure tweet and its properties are defined
                if (!tweet || !tweet.text) {
                    console.log("Skipping invalid tweet:", tweet);
                    return null; // Skip invalid or incomplete tweets
                }

                const author = tweet.authorFullname || "anonymous"; // fallback to 'anonymous'
                const text = tweet.text || ""; // empty string if missing
                const url = tweet.url || ""; // empty string if missing

                authorCounts[author] = (authorCounts[author] || 0) + 1;

                return {
                    id: `${author}_${authorCounts[author]}`,
                    authorFullname: author,
                    text: text,
                    url: url
                };
            }).filter(tweet => tweet !== null); // Remove any invalid tweets from the list

            if (formattedData.length === 0) {
                throw new Error("No valid tweets to process.");
            }

            const aiPrompt = `
🔹 🔹 **Objective**
- Convert the list of posts into a network consisting of **nodes** (posts, important keywords) and **edges** (relationships between them).
- **Hashtags (#)** and **mentions (@)** should only be added to the keywords list **if there are multiple related posts**.

🔹 **Step 1: Process post text**
- Remove **URLs** (e.g., "https://example.com").
- Extract **hashtags (#hashtag)** and **mentions (@username)**.
- Remove special characters **(except for @ and #)**.
- Convert all text to **lowercase**.
- **Skip posts** if they have fewer than 5 words.

🔹 **Step 2: Extract keywords & hashtags**
- **Only keep hashtags & mentions if they appear in 2 or more posts**.
- Discard hashtags & mentions if they appear only once.
- Retain **important keywords** such as **"blockchain", "zk-proof", "KYC", "DeFi", "wallet"**.

🔹 **Step 3: Build the graph**
- **Nodes:**
  - Each post is a node:
    \`{ "id": "Movement_1", "type": "post" }\`
  - Each important keyword **(including popular hashtags/mentions)** is a node:
    \`{ "id": "#defi", "type": "keyword" }\`
    \`{ "id": "@elonmusk", "type": "keyword" }\`

- **Edges:**
  - Connect posts to keywords.
  - Connect posts if they share a hashtag or mention that appears **in at least 2 posts**.
  - Example:
    \`{ "source": "Movement_1", "target": "#defi" }\`
    \`{ "source": "Movement_1", "target": "rushi_2" }\` (if both share the same hashtag)

🔹 **Input data (JSON)**
Here is the list of posts:
${JSON.stringify(formattedData, null, 2)}

🔹 **Desired output data**
- Return JSON with **nodes** and **edges** in the following format:
\`\`\`json
{
   "nodes": [
        { "id": "Movement_1", "type": "post" },
        { "id": "#defi", "type": "keyword" },
        { "id": "@elonmusk", "type": "keyword" }
   ],
   "edges": [
        { "source": "Movement_1", "target": "#defi" },
        { "source": "Movement_1", "target": "@elonmusk" },
        { "source": "rushi_2", "target": "#defi" }
   ]
}
\`\`\`
- **Only return JSON**, no extra text.
- Maintain standard JSON format for saving to a file and direct usage.
`;

            // Call the AI model with the constructed prompt
            const aiResponse = await callGemini(aiPrompt);

            if (typeof aiResponse === 'string') {
                const graphData = JSON.parse(aiResponse);

                // Map the content of posts into the graph data
                const contentMap = formattedData.reduce((map, item) => {
                    map[item.id] = {
                        text: item.text || "",
                        url: item.url || ""
                    };
                    return map;
                }, {});

                // Add content and URLs to the nodes
                graphData.nodes = graphData.nodes.map(node => ({
                    ...node,
                    content: node.type === "post" ? contentMap[node.id]?.text : undefined,
                    url: node.type === "post" ? contentMap[node.id]?.url : undefined
                }));

                // Return the graph data as a JSON response
                res.json(graphData);
            } else {
                throw new Error(aiResponse.error);
            }

        } catch (error) {
            res.status(500).json({
                error: error.message,
                timestamp: new Date().toISOString()
            });
        }
    });

    router.get("/agents", (req, res) => {
        const agentsList = Array.from(agents.values()).map((agent) => ({
            id: agent.agentId,
            name: agent.character.name,
            clients: Object.keys(agent.clients),
        }));
        res.json({ agents: agentsList });
    });

    router.get('/storage', async (req, res) => {
        try {
            const uploadDir = path.join(process.cwd(), "data", "characters");
            const files = await fs.promises.readdir(uploadDir);
            res.json({ files });
        } catch (error) {
            res.status(500).json({ error: error.message });
        }
    });

    router.get("/agents/:agentId", (req, res) => {
        const { agentId } = validateUUIDParams(req.params, res) ?? {
            agentId: null,
        };
        if (!agentId) return;

        const agent = agents.get(agentId);

        if (!agent) {
            res.status(404).json({ error: "Agent not found" });
            return;
        }

        const character = agent?.character;
        if (character?.settings?.secrets) {
            delete character.settings.secrets;
        }

        res.json({
            id: agent.agentId,
            character: agent.character,
        });
    });

    router.delete("/agents/:agentId", async (req, res) => {
        const { agentId } = validateUUIDParams(req.params, res) ?? {
            agentId: null,
        };
        if (!agentId) return;

        const agent: AgentRuntime = agents.get(agentId);

        if (agent) {
            agent.stop();
            directClient.unregisterAgent(agent);
            res.status(204).json({ success: true });
        } else {
            res.status(404).json({ error: "Agent not found" });
        }
    });

    router.post("/agents/:agentId/set", async (req, res) => {
        const { agentId } = validateUUIDParams(req.params, res) ?? {
            agentId: null,
        };
        if (!agentId) return;

        let agent: AgentRuntime = agents.get(agentId);

        // update character
        if (agent) {
            // stop agent
            agent.stop();
            directClient.unregisterAgent(agent);
            // if it has a different name, the agentId will change
        }

        // stores the json data before it is modified with added data
        const characterJson = { ...req.body };

        // load character from body
        const character = req.body;
        try {
            validateCharacterConfig(character);
        } catch (e) {
            elizaLogger.error(`Error parsing character: ${e}`);
            res.status(400).json({
                success: false,
                message: e.message,
            });
            return;
        }

        // start it up (and register it)
        try {
            agent = await directClient.startAgent(character);
            elizaLogger.log(`${character.name} started`);
        } catch (e) {
            elizaLogger.error(`Error starting agent: ${e}`);
            res.status(500).json({
                success: false,
                message: e.message,
            });
            return;
        }

        if (process.env.USE_CHARACTER_STORAGE === "true") {
            try {
                const filename = `${agent.agentId}.json`;
                const uploadDir = path.join(
                    process.cwd(),
                    "data",
                    "characters"
                );
                const filepath = path.join(uploadDir, filename);
                await fs.promises.mkdir(uploadDir, { recursive: true });
                await fs.promises.writeFile(
                    filepath,
                    JSON.stringify(
                        { ...characterJson, id: agent.agentId },
                        null,
                        2
                    )
                );
                elizaLogger.info(
                    `Character stored successfully at ${filepath}`
                );
            } catch (error) {
                elizaLogger.error(
                    `Failed to store character: ${error.message}`
                );
            }
        }

        res.json({
            id: character.id,
            character: character,
        });
    });

    router.get("/agents/:agentId/channels", async (req, res) => {
        const { agentId } = validateUUIDParams(req.params, res) ?? {
            agentId: null,
        };
        if (!agentId) return;

        const runtime = agents.get(agentId);

        if (!runtime) {
            res.status(404).json({ error: "Runtime not found" });
            return;
        }

        const API_TOKEN = runtime.getSetting("DISCORD_API_TOKEN") as string;
        const rest = new REST({ version: "10" }).setToken(API_TOKEN);

        try {
            const guilds = (await rest.get(Routes.userGuilds())) as Array<any>;

            res.json({
                id: runtime.agentId,
                guilds: guilds,
                serverCount: guilds.length,
            });
        } catch (error) {
            console.error("Error fetching guilds:", error);
            res.status(500).json({ error: "Failed to fetch guilds" });
        }
    });

    router.get("/agents/:agentId/:roomId/memories", async (req, res) => {
        const { agentId, roomId } = validateUUIDParams(req.params, res) ?? {
            agentId: null,
            roomId: null,
        };
        if (!agentId || !roomId) return;

        let runtime = agents.get(agentId);

        // if runtime is null, look for runtime with the same name
        if (!runtime) {
            runtime = Array.from(agents.values()).find(
                (a) => a.character.name.toLowerCase() === agentId.toLowerCase()
            );
        }

        if (!runtime) {
            res.status(404).send("Agent not found");
            return;
        }

        try {
            const memories = await runtime.messageManager.getMemories({
                roomId,
            });
            const response = {
                agentId,
                roomId,
                memories: memories.map((memory) => ({
                    id: memory.id,
                    userId: memory.userId,
                    agentId: memory.agentId,
                    createdAt: memory.createdAt,
                    content: {
                        text: memory.content.text,
                        action: memory.content.action,
                        source: memory.content.source,
                        url: memory.content.url,
                        inReplyTo: memory.content.inReplyTo,
                        attachments: memory.content.attachments?.map(
                            (attachment) => ({
                                id: attachment.id,
                                url: attachment.url,
                                title: attachment.title,
                                source: attachment.source,
                                description: attachment.description,
                                text: attachment.text,
                                contentType: attachment.contentType,
                            })
                        ),
                    },
                    embedding: memory.embedding,
                    roomId: memory.roomId,
                    unique: memory.unique,
                    similarity: memory.similarity,
                })),
            };

            res.json(response);
        } catch (error) {
            console.error("Error fetching memories:", error);
            res.status(500).json({ error: "Failed to fetch memories" });
        }
    });

    router.post("/agent/start", async (req, res) => {
        const { characterPath, characterJson } = req.body;
        console.log("characterPath:", characterPath);
        console.log("characterJson:", characterJson);
        try {
            let character: Character;
            if (characterJson) {
                character = await directClient.jsonToCharacter(
                    characterPath,
                    characterJson
                );
            } else if (characterPath) {
                character =
                    await directClient.loadCharacterTryPath(characterPath);
            } else {
                throw new Error("No character path or JSON provided");
            }
            await directClient.startAgent(character);
            elizaLogger.log(`${character.name} started`);

            res.json({
                id: character.id,
                character: character,
            });
        } catch (e) {
            elizaLogger.error(`Error parsing character: ${e}`);
            res.status(400).json({
                error: e.message,
            });
            return;
        }
    });

    router.post("/agents/:agentId/stop", async (req, res) => {
        const agentId = req.params.agentId;
        console.log("agentId", agentId);
        const agent: AgentRuntime = agents.get(agentId);

        // update character
        if (agent) {
            // stop agent
            agent.stop();
            directClient.unregisterAgent(agent);
            // if it has a different name, the agentId will change
            res.json({ success: true });
        } else {
            res.status(404).json({ error: "Agent not found" });
        }
    });

    return router;
}
