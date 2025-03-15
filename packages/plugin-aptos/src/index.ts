import createBounty from "./actions/create_bounty.ts";
import giveInsightData from "./actions/give-insight-data.ts";
import checkVerify from "./actions/check_verify.ts";
import quizGen from "./actions/quiz_gen.ts";

//export all actions
export { createBounty, giveInsightData, checkVerify, quizGen};


export const aptosPlugin = {
    name: "aptos",
    description: "Aptos Plugin for Eliza",
    actions: [createBounty, giveInsightData, checkVerify, quizGen],
    evaluators: [],
    // providers: [walletProvider],
};

export default aptosPlugin;
